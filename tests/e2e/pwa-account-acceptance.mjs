import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";

const privateIdentityKeys = ["id", "name", "email", "firstName", "lastName"];
const noCommerceWrites = (events) => events.filter(({ method, pathname }) =>
  method !== "GET" && /\/(?:api\/)?(?:retail\/v1\/)?(?:cart|checkout|orders?|payments?)(?:\/|$)/i.test(pathname),
);

/**
 * Browser-checks the authenticated customer identity and the public Shop
 * account/cart surfaces without adding cart items, orders, or payments.
 */
export async function verifyRetailAccount({ browser, prisma, origin, slug, artifactDir, runId }) {
  assert.ok(browser, "a Playwright browser is required");
  assert.ok(prisma, "the isolated Prisma client is required");
  assert.match(String(slug), /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.match(String(runId), /^[A-Za-z0-9_-]{4,80}$/);

  const target = new URL(origin);
  assert.ok(["http:", "https:"].includes(target.protocol));
  const basePath = target.pathname.replace(/\/+$/, "");
  const appUrl = (pathname) => new URL(`${basePath}${pathname}`, target.origin).toString();
  const storefrontPath = `/fa/retail/${encodeURIComponent(slug)}`;
  const accountPath = `${storefrontPath}/account`;
  const checkoutPath = `${storefrontPath}/checkout`;
  const accountUrl = appUrl(accountPath);
  const checkoutUrl = appUrl(checkoutPath);
  const artifacts = path.resolve(artifactDir);
  await mkdir(artifacts, { recursive: true });

  const suffix = randomBytes(6).toString("hex");
  const run = String(runId).replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 40);
  const username = `pwa-account-${run}-${suffix}`.toLowerCase();
  const email = `${username}@example.invalid`;
  const password = randomBytes(24).toString("base64url");
  const user = await prisma.user.create({
    data: {
      name: username,
      email,
      password: await bcrypt.hash(password, 12),
      role: "CUSTOMER",
      emailVerified: new Date(),
      firstName: "Synthetic",
      lastName: `Retail ${suffix}`,
      isActive: true,
    },
  });

  const contexts = [];
  const commerceWrites = [];
  const screenshots = [];
  const checks = [];
  try {
    await prisma.emailVerification.create({ data: {
      userId: user.id,
      email,
      token: randomBytes(32).toString("hex"),
      verifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    } });

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { slug },
      select: { name: true, email: true },
    });
    const baseline = await commerceCounts(prisma, slug, user.id);

    for (const viewport of [
      { name: "desktop", width: 1440, height: 900 },
      { name: "mobile", width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      contexts.push(context);
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(60000);
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (url.origin === target.origin) commerceWrites.push({ method: request.method(), pathname: url.pathname });
      });

      await page.goto(appUrl(storefrontPath), { waitUntil: "domcontentloaded" });
      await page.locator("main h1").first().waitFor();
      const accountLink = viewport.width < 640
        ? page.locator('nav[aria-label="پیمایش موبایل فروشگاه"] a[href$="/account"]')
        : page.getByRole("link", { name: "حساب من", exact: true });
      await accountLink.waitFor({ state: "visible" });
      await accountLink.click();
      await page.waitForURL((url) => url.pathname === new URL(accountUrl).pathname);
      await page.getByRole("heading", { name: organization.name, exact: true }).waitFor();
      let accountText = await page.locator("body").innerText();
      assert.doesNotMatch(accountText, new RegExp(escapeRegExp(username), "i"));
      assert.doesNotMatch(accountText, new RegExp(escapeRegExp(email), "i"));
      checks.push(`${viewport.name}: account navigation opens this tenant's public Shop profile without exposing customer identity`);
      screenshots.push(await capture(page, artifacts, `${run}-${viewport.name}-account-anonymous.png`));

      const anonymousProfile = await getJson(page, appUrl("/api/users/me"));
      assert.equal(anonymousProfile.status, 401, "anonymous access to the private customer profile must be rejected");
      for (const key of privateIdentityKeys) assert.equal(Object.hasOwn(anonymousProfile.body, key), false, `anonymous profile response must not expose ${key}`);

      await page.goto(checkoutUrl, { waitUntil: "domcontentloaded" });
      await page.getByRole("link", { name: "ورود به حساب کاربری", exact: true }).waitFor();
      const anonymousCheckoutText = await page.locator("body").innerText();
      assert.doesNotMatch(anonymousCheckoutText, new RegExp(escapeRegExp(username), "i"));
      assert.doesNotMatch(anonymousCheckoutText, new RegExp(escapeRegExp(email), "i"));
      checks.push(`${viewport.name}: anonymous cart/checkout shows the sign-in gate and no private customer data`);
      screenshots.push(await capture(page, artifacts, `${run}-${viewport.name}-checkout-anonymous.png`));

      const callback = `${basePath}${checkoutPath}`;
      const loginUrl = new URL(appUrl("/fa/login"));
      loginUrl.searchParams.set("callbackUrl", callback);
      await page.goto(loginUrl.toString(), { waitUntil: "domcontentloaded" });
      await page.locator("#username").fill(username);
      await page.locator("#password").fill(password);
      await page.locator('button[type="submit"]').click();
      await page.waitForURL((url) => url.pathname === new URL(checkoutUrl).pathname, { waitUntil: "domcontentloaded" });

      const ownProfile = await getJson(page, appUrl("/api/users/me"));
      assert.equal(ownProfile.status, 200);
      assert.equal(ownProfile.body.id, user.id);
      assert.equal(ownProfile.body.name, username);
      assert.equal(ownProfile.body.email, email);
      assert.equal(ownProfile.body.role, "CUSTOMER");
      for (const key of ["password", "lockedUntil", "failedLoginAttempts", "emailVerified", "emailVerifications"]) {
        assert.equal(Object.hasOwn(ownProfile.body, key), false, `customer profile DTO must omit ${key}`);
      }
      const session = await getJson(page, appUrl("/api/auth/session"));
      assert.equal(session.status, 200);
      assert.equal(session.body.user.id, user.id);
      assert.equal(session.body.user.name, username);
      checks.push(`${viewport.name}: bcrypt-authenticated CUSTOMER can read only their public self-profile DTO`);

      await page.getByText("سبد خرید شما خالی است.", { exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "ثبت سفارش", exact: true }).count(), 0,
        "empty cart must not expose an active order submission control");
      const authenticatedCheckoutText = await page.locator("body").innerText();
      assert.doesNotMatch(authenticatedCheckoutText, new RegExp(escapeRegExp(username), "i"),
        "the public checkout surface does not render unrelated account identity");
      screenshots.push(await capture(page, artifacts, `${run}-${viewport.name}-checkout-customer.png`));

      await page.goto(accountUrl, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: organization.name, exact: true }).waitFor();
      accountText = await page.locator("body").innerText();
      assert.doesNotMatch(accountText, new RegExp(escapeRegExp(username), "i"));
      assert.doesNotMatch(accountText, new RegExp(escapeRegExp(email), "i"));
      if (organization.email) assert.match(accountText, new RegExp(escapeRegExp(organization.email), "i"));
      screenshots.push(await capture(page, artifacts, `${run}-${viewport.name}-account-customer.png`));
    }

    const after = await commerceCounts(prisma, slug, user.id);
    assert.deepEqual(after, baseline, "account and cart acceptance must not write carts, orders, or payments");
    assert.deepEqual(noCommerceWrites(commerceWrites), [], "browser flow must issue no commerce mutation requests");
    checks.push("both viewports: cart/order/payment records unchanged and no commerce mutation request was sent");
    return { status: "PASSED", slug, checks, screenshots };
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
    await prisma.user.deleteMany({ where: { id: user.id, name: username, email } });
  }
}

async function commerceCounts(prisma, slug, customerId) {
  const [carts, orders, payments] = await Promise.all([
    prisma.shopCart.count({ where: { organizationSlug: slug, customerId } }),
    prisma.order.count({ where: { organizationSlug: slug, customerId } }),
    prisma.payment.count({ where: { order: { organizationSlug: slug, customerId } } }),
  ]);
  return { carts, orders, payments };
}

async function getJson(page, pathname) {
  return page.evaluate(async (url) => {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", headers: { accept: "application/json" } });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  }, pathname);
}

async function capture(page, artifactDir, filename) {
  const file = path.join(artifactDir, filename);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
