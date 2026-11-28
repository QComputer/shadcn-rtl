import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
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
  let accountUrl = appUrl(accountPath);
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
      const accountLink = viewport.width < 640
        ? page.locator('nav[aria-label="پیمایش موبایل فروشگاه"] a[href$="/account"]')
        : page.getByRole("link", { name: "حساب من", exact: true });
      // The current published catalog uses section headings rather than a
      // single main h1. Wait for its visible account navigation contract,
      // which is also the control this acceptance is about to exercise.
      await accountLink.waitFor({ state: "visible" });
      const accountHref = await accountLink.getAttribute("href");
      assert.ok(accountHref, `${viewport.name}: account navigation has a destination`);
      const linkedAccountUrl = new URL(accountHref, target.origin);
      assert.equal(linkedAccountUrl.origin, target.origin, `${viewport.name}: account navigation stays on this storefront origin`);
      assert.ok(linkedAccountUrl.pathname.startsWith(`${storefrontPath}/`), `${viewport.name}: account navigation stays bound to this tenant: ${linkedAccountUrl.pathname}`);
      assert.match(linkedAccountUrl.pathname, /\/(?:account|profile)\/?$/, `${viewport.name}: account navigation targets a supported profile route`);
      accountUrl = linkedAccountUrl.toString();
      await accountLink.click();
      await page.waitForURL((url) => url.pathname.replace(/\/$/, "") === linkedAccountUrl.pathname.replace(/\/$/, ""), { waitUntil: "domcontentloaded" });
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
      await page.getByRole("heading", { name: "سبد خریدتان هنوز خالی است", exact: true }).waitFor();
      const anonymousCheckoutText = await page.locator("body").innerText();
      assert.doesNotMatch(anonymousCheckoutText, new RegExp(escapeRegExp(username), "i"));
      assert.doesNotMatch(anonymousCheckoutText, new RegExp(escapeRegExp(email), "i"));
      assert.doesNotMatch(anonymousCheckoutText, /برای ثبت نهایی سفارش در این نسخه وارد حساب شوید/,
        "guest checkout must not require an account for order placement");
      checks.push(`${viewport.name}: anonymous checkout remains available without mandatory registration and exposes no private customer data`);
      screenshots.push(await capture(page, artifacts, `${run}-${viewport.name}-checkout-anonymous.png`));

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
  // Playwright's screenshot helper waits for document.fonts.ready. A remote
  // font can remain pending in the isolated CI network after the page itself
  // is fully usable, so capture the same rendered page through Chromium CDP.
  const session = await page.context().newCDPSession(page);
  try {
    const { cssContentSize } = await session.send("Page.getLayoutMetrics");
    const { data } = await session.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 },
    });
    await writeFile(file, Buffer.from(data, "base64"));
  } finally {
    await session.detach();
  }
  return file;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
