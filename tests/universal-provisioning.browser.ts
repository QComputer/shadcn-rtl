import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { chromium, type BrowserContext, type Page } from "playwright";
import { PrismaClient } from "@prisma/client";

type Recipient = { user: { id: string; name: string; email: string }; role: "ADMIN" | "MANAGER" };
type Configuration = {
  key: string;
  name: string;
  slug: string;
  type: "SHOP" | "APPOINTMENT";
  vertical: "HOTEL" | null;
  entitledCapabilities: string[];
  enabledCapabilities: string[];
  property?: { name: string; slug: string };
  recipients: Recipient[];
};
type Completed = {
  planId: string;
  approvedSha256: string;
  receipt: { organizationId: string; organizationSlug: string; propertyId?: string | null; capabilities: string[]; [key: string]: unknown };
  invitations: Array<{ invitationId: string; oneTimeToken: string; status: string }>;
};

async function main() {
  const runId = process.env.HOTEL_ONBOARDING_RUN_ID;
  const port = Number(process.env.HOTEL_ONBOARDING_APP_PORT);
  const password = process.env.HOTEL_ONBOARDING_TEST_PASSWORD;
  const databaseUrl = process.env.DATABASE_URL ?? "http://invalid";
  const target = new URL(databaseUrl);
  assert.equal(process.env.HOTEL_ONBOARDING_PG_ACCEPTANCE, "1", "P14 browser acceptance requires the guarded local PostgreSQL harness");
  assert.match(runId ?? "", /^[a-f0-9]{12}$/);
  assert.notEqual(process.env.VERCEL_ENV, "production");
  assert.equal(target.protocol, "postgresql:");
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.pathname, `/hotel_onboarding_${runId}`);
  assert.equal(target.username, "hotel_onboarding_test");
  assert.ok(password && password.length >= 20 && port > 1024);
  const base = `http://bazarbaaz.ir:${port}`;
  const artifacts = process.env.HOTEL_ONBOARDING_ARTIFACTS;
  assert.ok(artifacts, "ARTIFACTS must point at the guarded run artifact directory");
  await mkdir(artifacts!, { recursive: true });

  const db = new PrismaClient();
  const contexts: BrowserContext[] = [];
  const results: Array<{ name: string; status: "PASSED" }> = [];
  const browserErrors: string[] = [];
  const navigationCancellations: string[] = [];
  const responseStatuses = new WeakMap<object, number>();
  const authenticationTransitions = new WeakSet<Page>();
  const closingPages = new WeakSet<Page>();
  let currentStep = "create synthetic identities";
  const step = (value: string) => {
    currentStep = value;
    writeFileSync(path.join(artifacts!, "p14-browser-progress.json"), JSON.stringify({ step: value, completedScenarios: results.length }));
  };
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const completed: Completed[] = [];
  const secretTokens = new Set<string>();

  async function makeVerifiedCustomer(label: string) {
    const name = `p14b-${label}-${runId}`;
    const email = `${name}@example.invalid`;
    const user = await db.user.create({
      data: { name, email, role: "CUSTOMER", password: await bcrypt.hash(password!, 12), emailVerified: new Date() },
    });
    await db.emailVerification.create({
      data: { userId: user.id, email, token: randomBytes(32).toString("hex"), verifiedAt: new Date(), expiresAt: new Date(Date.now() + 3600000) },
    });
    return { id: user.id, name: user.name, email };
  }

  async function api(page: Page, url: string, options: { method?: string; body?: unknown; key?: string } = {}) {
    return page.evaluate(async ({ url, method, body, key }) => {
      const response = await fetch(url, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(key ? { "Idempotency-Key": key } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, cache: response.headers.get("cache-control"), body: await response.json().catch(() => null) };
    }, { url, method: options.method ?? (options.body === undefined ? "GET" : "POST"), body: options.body, key: options.key });
  }

  async function newPage(viewport = { width: 1365, height: 900 }) {
    const context = await browser!.newContext({ viewport });
    contexts.push(context);
    await context.route("**/*", (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("response", (response) => responseStatuses.set(response.request(), response.status()));
    page.on("requestfailed", (request) => {
      const target = new URL(request.url());
      const failure = request.failure()?.errorText ?? "failed";
      // Next cancels same-origin RSC prefetches during navigation and reload.
      // Retain them as evidence; external or actual transport failures still fail.
      const status = responseStatuses.get(request);
      if (failure === "net::ERR_ABORTED" && target.origin === base
        && ((request.method() === "GET" && (closingPages.has(page) || request.headers().rsc === "1" || request.isNavigationRequest()
          || target.pathname.startsWith("/_next/static/chunks/")
          || (target.pathname === "/api/auth/session" && authenticationTransitions.has(page))))
          || (status !== undefined && status >= 200 && status < 300))) {
        navigationCancellations.push(target.pathname);
      } else browserErrors.push(`${target.pathname}: ${failure}`);
    });
    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(120000);
    return page;
  }
  async function closePage(page: Page) {
    closingPages.add(page);
    await page.context().close();
  }

  async function login(page: Page, username: string, callback = "/fa/dashboard") {
    step(`credential login ${username} to ${callback}`);
    await page.goto(`${base}/fa/login?callbackUrl=${encodeURIComponent(callback)}`, { waitUntil: "domcontentloaded" });
    await page.locator("#username").fill(username);
    await page.locator("#password").fill(password!);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(`${base}${callback}`, { waitUntil: "domcontentloaded" });
    const session = await api(page, "/api/auth/session");
    assert.equal(session.body?.user?.name, username);
    return session.body.user as { id: string; name: string; role: string; organizationId?: string | null };
  }

  async function fillRecipient(page: Page, index: number, recipient: Recipient, viaLookup = false) {
    if (viaLookup) {
      await page.getByTestId(`p14-recipient-${index}-username`).fill(recipient.user.name);
      const lookupPromise = page.waitForResponse((response) => response.url().includes("/api/dashboard/tenant-provisioning-recipients?") && response.request().method() === "GET");
      await page.getByTestId(`p14-recipient-${index}-search`).click();
      const lookup = await lookupPromise;
      assert.equal(lookup.status(), 200);
      const lookupBody = await lookup.json();
      assert.ok(lookupBody.items.some((item: { id: string; name: string; email: string }) => item.id === recipient.user.id && item.name === recipient.user.name && item.email === recipient.user.email));
      await page.getByRole("button").filter({ hasText: recipient.user.name }).filter({ hasText: recipient.user.email }).click();
      assert.equal(await page.getByTestId(`p14-recipient-${index}-userId`).inputValue(), recipient.user.id);
      assert.equal(await page.getByTestId(`p14-recipient-${index}-email`).inputValue(), recipient.user.email);
    } else {
      await page.getByTestId(`p14-recipient-${index}-userId`).fill(recipient.user.id);
      await page.getByTestId(`p14-recipient-${index}-username`).fill(recipient.user.name);
      await page.getByTestId(`p14-recipient-${index}-email`).fill(recipient.user.email);
    }
    await page.getByTestId(`p14-recipient-${index}-role`).selectOption(recipient.role);
  }

  async function setChecked(page: Page, id: string, checked: boolean) {
    const input = page.getByTestId(id);
    if (checked) await input.check(); else await input.uncheck();
  }

  async function fillConfiguration(page: Page, configuration: Configuration, searchFirstRecipient = false) {
    await page.getByTestId("p14-name").fill(configuration.name);
    await page.getByTestId("p14-slug").fill(configuration.slug);
    await page.getByTestId("p14-locale").selectOption("fa");
    await page.getByTestId("p14-vertical").selectOption(configuration.vertical ?? "none");
    if (configuration.vertical !== "HOTEL") await page.getByTestId("p14-type").selectOption(configuration.type);
    for (const capability of ["SHOP", "APPOINTMENT", "HOTEL_WEBSITE"]) {
      if (capability === "HOTEL_WEBSITE" && configuration.vertical !== "HOTEL") {
        assert.equal(await page.getByTestId(`p14-entitlement-${capability}`).isDisabled(), true);
        assert.equal(await page.getByTestId(`p14-capability-${capability}`).isDisabled(), true);
        continue;
      }
      await setChecked(page, `p14-entitlement-${capability}`, configuration.entitledCapabilities.includes(capability));
      await setChecked(page, `p14-capability-${capability}`, configuration.enabledCapabilities.includes(capability));
    }
    if (configuration.property) {
      await page.getByTestId("p14-property-name").fill(configuration.property.name);
      await page.getByTestId("p14-property-slug").fill(configuration.property.slug);
    }
    await fillRecipient(page, 0, configuration.recipients[0]!, searchFirstRecipient);
    for (const [index, recipient] of configuration.recipients.slice(1).entries()) {
      await page.getByTestId("p14-add-recipient").click();
      await fillRecipient(page, index + 1, recipient);
    }
  }

  async function createAndExecute(operatorPage: Page, configuration: Configuration, screenshotPrefix?: string, searchFirstRecipient = false): Promise<Completed> {
    step(`configure and execute ${configuration.key}`);
    await operatorPage.goto(`${base}/fa/dashboard/tenant-provisioning/new`, { waitUntil: "domcontentloaded" });
    await operatorPage.getByTestId("p14-name").waitFor();
    await fillConfiguration(operatorPage, configuration, searchFirstRecipient);
    if (screenshotPrefix) {
      await operatorPage.screenshot({ path: path.join(artifacts!, `${screenshotPrefix}-desktop.png`), fullPage: true, mask: [operatorPage.getByTestId("p14-token")] });
      await operatorPage.setViewportSize({ width: 390, height: 844 });
      assert.equal(await operatorPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, "mobile wizard has no horizontal document overflow");
      await operatorPage.screenshot({ path: path.join(artifacts!, `${screenshotPrefix}-mobile.png`), fullPage: true, mask: [operatorPage.getByTestId("p14-token")] });
      await operatorPage.setViewportSize({ width: 1365, height: 900 });
    }

    const createResponsePromise = operatorPage.waitForResponse((response) => response.url().endsWith("/api/dashboard/tenant-provisioning-plans") && response.request().method() === "POST");
    await operatorPage.getByTestId("p14-save").click();
    const createResponse = await createResponsePromise;
    assert.ok([200, 201].includes(createResponse.status()), `${configuration.key} UI create request succeeds`);
    const createdPlan = await createResponse.json() as { id: string };
    const planId = createdPlan.id;
    assert.ok(planId && planId !== "new");
    await operatorPage.waitForURL(`${base}/fa/dashboard/tenant-provisioning/${planId}`);
    await operatorPage.getByTestId("p14-name").waitFor();

    // Exercise the edit/save path too, then validate the exact persisted version.
    await operatorPage.getByTestId("p14-name").fill(`${configuration.name} · بررسی`);
    const saveResponsePromise = operatorPage.waitForResponse((response) => response.url().endsWith(`/api/dashboard/tenant-provisioning-plans/${planId}`) && response.request().method() === "PATCH");
    await operatorPage.getByTestId("p14-save").click();
    assert.equal((await saveResponsePromise).status(), 200);
    const persisted = await api(operatorPage, `/api/dashboard/tenant-provisioning-plans/${planId}`);
    assert.equal(persisted.status, 200);
    assert.equal(persisted.body.executionConfiguration.name, `${configuration.name} · بررسی`);

    const validationResponsePromise = operatorPage.waitForResponse((response) => response.url().endsWith(`/api/dashboard/tenant-provisioning-plans/${planId}/validate`));
    await operatorPage.getByTestId("p14-validate").click();
    const validationResponse = await validationResponsePromise;
    assert.equal(validationResponse.status(), 200);
    assert.equal((await validationResponse.json()).status, "READY");
    await operatorPage.getByTestId("p14-approve").waitFor({ state: "visible" });

    const approvalResponsePromise = operatorPage.waitForResponse((response) => response.url().endsWith(`/api/dashboard/tenant-provisioning-plans/${planId}/approve`));
    await operatorPage.getByTestId("p14-approve").click();
    const approvalResponse = await approvalResponsePromise;
    assert.equal(approvalResponse.status(), 200);
    const approval = await approvalResponse.json();
    assert.match(approval.approvedExecutionSha256, /^[a-f0-9]{64}$/);
    assert.equal(approval.status, "APPROVED");

    const executeResponsePromise = operatorPage.waitForResponse((response) => response.url().endsWith(`/api/dashboard/tenant-provisioning-plans/${planId}/execute`) && response.request().method() === "POST");
    await operatorPage.getByTestId("p14-execute").click();
    const executeResponse = await executeResponsePromise;
    assert.equal(executeResponse.status(), 200);
    const execution = await executeResponse.json() as { receipt: Completed["receipt"]; invitations: Completed["invitations"]; replayed: boolean };
    for (const invitation of execution.invitations ?? []) if (invitation.oneTimeToken) secretTokens.add(invitation.oneTimeToken);
    assert.equal(execution.replayed, false);
    assert.ok(execution.receipt.organizationId);
    assert.equal(execution.receipt.organizationSlug, configuration.slug);
    assert.deepEqual([...execution.receipt.capabilities].sort(), [...configuration.enabledCapabilities].sort());
    assert.equal(execution.receipt.activationState, "AWAITING_ADMIN_ACTIVATION");
    assert.equal(execution.receipt.bookingEnabled, false);
    assert.equal(execution.receipt.paymentsEnabled, false);
    assert.equal(execution.invitations.length, configuration.recipients.length);
    assert.ok(execution.invitations.every((invitation) => invitation.status === "CREATED" && invitation.oneTimeToken.length > 0));
    await operatorPage.getByTestId("p14-token").first().waitFor();
    assert.equal(await operatorPage.getByTestId("p14-token").count(), configuration.recipients.length, "UI renders one-time tokens only from the execute response");
    assert.deepEqual(
      (await operatorPage.getByTestId("p14-token").allTextContents()).map((token) => token.trim()).sort(),
      execution.invitations.map((invitation) => invitation.oneTimeToken).sort(),
    );
    assert.equal(await db.organizationMember.count({ where: { organizationId: execution.receipt.organizationId } }), 0, "issuing a token does not activate tenant access");
    assert.equal(await db.user.findUniqueOrThrow({ where: { id: configuration.recipients[0]!.user.id } }).then((user) => user.role), "CUSTOMER");

    const receiptFromUi = await api(operatorPage, `/api/dashboard/tenant-provisioning-plans/${planId}`);
    assert.equal(receiptFromUi.status, 200);
    assert.equal(receiptFromUi.body.status, "COMPLETED");
    assert.equal(receiptFromUi.body.executionReceipt.organizationId, execution.receipt.organizationId);
    assert.equal(receiptFromUi.body.invitations.length, configuration.recipients.length);
    assert.ok(receiptFromUi.body.invitations.every((invitation: { status: string }) => invitation.status === "CREATED"));
    assert.equal(await operatorPage.getByTestId("p14-execute").isDisabled(), true);

    const executionKey = executeResponse.request().headers()["idempotency-key"];
    assert.ok(executionKey, "UI execute uses an idempotency key");
    const replay = await api(operatorPage, `/api/dashboard/tenant-provisioning-plans/${planId}/execute`, {
      method: "POST", body: { approvedSha256: approval.approvedExecutionSha256 }, key: executionKey,
    });
    assert.equal(replay.status, 200);
    assert.equal(replay.body.replayed, true);
    assert.deepEqual(replay.body.invitations, [], "receipt replay never returns one-time tokens");
    assert.equal(await db.organization.count({ where: { slug: configuration.slug } }), 1);
    assert.equal(await db.organizationInvitation.count({ where: { organizationId: execution.receipt.organizationId } }), configuration.recipients.length);

    // A completed receipt is recoverable after reload; one-time tokens are not.
    await operatorPage.reload();
    await operatorPage.getByTestId("p14-name").waitFor();
    const reloaded = await api(operatorPage, `/api/dashboard/tenant-provisioning-plans/${planId}`);
    assert.equal(reloaded.body.status, "COMPLETED");
    assert.equal(reloaded.body.executionReceipt.organizationId, execution.receipt.organizationId);
    assert.equal(await operatorPage.getByTestId("p14-token").count(), 0);
    assert.equal(await operatorPage.getByText("پس از بارگذاری مجدد، رمز یک‌بارمصرف قابل بازیابی نیست.", { exact: true }).count(), 1);

    const done: Completed = { planId, approvedSha256: approval.approvedExecutionSha256, receipt: execution.receipt, invitations: execution.invitations };
    completed.push(done);
    return done;
  }

  async function activate(page: Page, user: { id: string; name: string }, token: string, callback = "/fa/dashboard") {
    authenticationTransitions.add(page);
    await login(page, user.name, "/fa/onboarding/organization-invitation");
    step(`submit identity-bound invitation for ${user.name}`);
    await page.locator("#organization-invitation-token").fill(token);
    const redemptionPromise = page.waitForResponse((response) => response.url().endsWith("/api/organization-invitations/redeem") && response.request().method() === "POST");
    await page.locator('button[type="submit"]').click();
    const redemption = await redemptionPromise;
    assert.equal(redemption.status(), 200);
    await page.getByRole("status").filter({ hasText: "دسترسی سازمان فعال شد" }).waitFor();
    assert.equal(await page.locator("#organization-invitation-token").count(), 0);
    await page.getByRole("button", { name: "خروج و ورود دوباره" }).click();
    step(`sign out before loading activated membership for ${user.name}`);
    await page.waitForURL(/\/fa\/login/, { waitUntil: "domcontentloaded" });
    const session = await login(page, user.name, callback);
    assert.equal(session.role, "CUSTOMER", "tenant invitations never elevate the global account role");
    assert.notEqual(session.organizationId, undefined);
    authenticationTransitions.delete(page);
  }

  try {
    const superAdmin = await db.user.create({
      data: { name: `p14b-operator-${runId}`, email: `p14b-operator-${runId}@example.invalid`, role: "SUPER_ADMIN", password: await bcrypt.hash(password!, 12), emailVerified: new Date() },
    });
    await db.emailVerification.create({
      data: { userId: superAdmin.id, email: superAdmin.email!, token: randomBytes(32).toString("hex"), verifiedAt: new Date(), expiresAt: new Date(Date.now() + 3600000) },
    });
    const shopAdmin = await makeVerifiedCustomer("shop-admin");
    const shopManager = await makeVerifiedCustomer("shop-manager");
    const appointmentAdmin = await makeVerifiedCustomer("appointment-admin");
    const hotelAdmin = await makeVerifiedCustomer("hotel-admin");
    const combinedAdmin = await makeVerifiedCustomer("combined-admin");
    const collisionAdmin = await makeVerifiedCustomer("collision-admin");
    const foreignManager = await makeVerifiedCustomer("foreign-manager");
    const customerOrganization = await db.organization.create({ data: { name: "P14 isolated foreign tenant", slug: `p14b-foreign-${runId}`, type: "SHOP", isOpen: false } });
    await db.organizationMember.create({ data: { organizationId: customerOrganization.id, organizationSlug: customerOrganization.slug, userId: foreignManager.id, role: "MANAGER" } });
    await db.user.update({ where: { id: foreignManager.id }, data: { isTeamMember: true } });

    browser = await chromium.launch({
      headless: true,
      ...(process.platform === "win32" ? { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" } : {}),
      args: ["--no-proxy-server", "--host-resolver-rules=MAP bazarbaaz.ir 127.0.0.1", `--unsafely-treat-insecure-origin-as-secure=${base}`],
    });
    const operatorPage = await newPage();
    await login(operatorPage, superAdmin.name, "/fa/dashboard/tenant-provisioning/new");
    assert.equal(await operatorPage.evaluate(() => window.isSecureContext && typeof crypto.randomUUID === "function"), true);

    const shop = await createAndExecute(operatorPage, {
      key: "shop", name: `P14 shop ${runId}`, slug: `p14b-shop-${runId}`, type: "SHOP", vertical: null,
      entitledCapabilities: ["SHOP", "APPOINTMENT"], enabledCapabilities: ["SHOP"], recipients: [{ user: shopAdmin, role: "ADMIN" }, { user: shopManager, role: "MANAGER" }],
    }, "p14-wizard", true);
    const appointment = await createAndExecute(operatorPage, {
      key: "appointment", name: `P14 appointments ${runId}`, slug: `p14b-appointment-${runId}`, type: "APPOINTMENT", vertical: null,
      entitledCapabilities: ["APPOINTMENT"], enabledCapabilities: ["APPOINTMENT"], recipients: [{ user: appointmentAdmin, role: "ADMIN" }],
    });
    const hotel = await createAndExecute(operatorPage, {
      key: "hotel", name: `P14 hotel ${runId}`, slug: `p14b-hotel-${runId}`, type: "SHOP", vertical: "HOTEL",
      entitledCapabilities: ["HOTEL_WEBSITE"], enabledCapabilities: ["HOTEL_WEBSITE"], property: { name: `P14 synthetic property ${runId}`, slug: "main" }, recipients: [{ user: hotelAdmin, role: "ADMIN" }],
    });
    assert.ok(hotel.receipt.propertyId);
    await operatorPage.setViewportSize({ width: 390, height: 844 });
    const combined = await createAndExecute(operatorPage, {
      key: "combined", name: `P14 combined ${runId}`, slug: `p14b-combined-${runId}`, type: "SHOP", vertical: null,
      entitledCapabilities: ["SHOP", "APPOINTMENT"], enabledCapabilities: ["SHOP", "APPOINTMENT"], recipients: [{ user: combinedAdmin, role: "ADMIN" }],
    });
    await operatorPage.setViewportSize({ width: 1365, height: 900 });
    results.push({ name: "Wizard creates SHOP, unclassified APPOINTMENT, HOTEL_WEBSITE property, and combined capabilities with reviewed approved receipts", status: "PASSED" });

    // The manager's tenant role cannot use platform provisioning APIs.
    const managerPage = await newPage();
    await activate(managerPage, shopManager, shop.invitations[1]!.oneTimeToken);
    const managerAttempt = await api(managerPage, `/api/dashboard/tenant-provisioning-plans/${shop.planId}/execute`, {
      method: "POST", body: { approvedSha256: shop.approvedSha256 }, key: `${runId}-manager-denied-execute`,
    });
    assert.equal(managerAttempt.status, 403);
    assert.equal(await db.organization.count({ where: { slug: shop.receipt.organizationSlug } }), 1);
    assert.equal(await db.organizationInvitation.count({ where: { organizationId: shop.receipt.organizationId } }), 2);
    const foreignPage = await newPage();
    await login(foreignPage, foreignManager.name);
    assert.equal((await api(foreignPage, `/api/organizations/${shop.receipt.organizationId}/members`)).status, 403);
    assert.equal(await db.user.findUniqueOrThrow({ where: { id: foreignManager.id } }).then((user) => user.role), "CUSTOMER");
    await closePage(foreignPage);
    results.push({ name: "Tenant manager cannot execute platform plans and a manager from another membership cannot inspect the SHOP tenant", status: "PASSED" });

    const shopAdminPage = await newPage();
    await activate(shopAdminPage, shopAdmin, shop.invitations[0]!.oneTimeToken);
    const shopMemberships = await api(shopAdminPage, "/api/users/me/membership");
    const shopMembership = shopMemberships.body.memberships.find((membership: { organizationId: string }) => membership.organizationId === shop.receipt.organizationId);
    assert.equal(shopMembership?.role, "ADMIN");
    assert.deepEqual(shopMembership?.organizationCapabilities, ["SHOP"]);
    assert.equal((await api(shopAdminPage, `/api/organizations/${shop.receipt.organizationId}/members`)).status, 200);
    const productCountBefore = await db.product.count({ where: { organizationId: shop.receipt.organizationId } });
    const invalidProduct = await api(shopAdminPage, "/api/products", { method: "POST", body: { organizationId: shop.receipt.organizationId } });
    assert.equal(invalidProduct.status, 400, "active SHOP capability is reached before invalid input validation; request creates no product");
    assert.equal(await db.product.count({ where: { organizationId: shop.receipt.organizationId } }), productCountBefore);
    const managerMemberships = await api(managerPage, "/api/users/me/membership");
    assert.equal(managerMemberships.body.memberships.find((membership: { organizationId: string }) => membership.organizationId === shop.receipt.organizationId)?.role, "MANAGER");
    await closePage(managerPage);
    await closePage(shopAdminPage);
    results.push({ name: "Verified SHOP ADMIN and MANAGER activate as scoped memberships while global accounts stay CUSTOMER", status: "PASSED" });

    // Revoke the first appointment invitation and issue a replacement through
    // the operator UI. Keep both bearer tokens in memory only.
    await operatorPage.goto(`${base}/fa/dashboard/tenant-provisioning/${appointment.planId}`, { waitUntil: "domcontentloaded" });
    await operatorPage.getByTestId("p14-name").waitFor();
    const oldAppointmentToken = appointment.invitations[0]!.oneTimeToken;
    operatorPage.once("dialog", (dialog) => void dialog.accept());
    const revokeResponsePromise = operatorPage.waitForResponse((response) => response.url().endsWith("/api/platform/organization-onboarding/invitations/revoke") && response.request().method() === "POST");
    await operatorPage.getByRole("button", { name: "لغو دعوت", exact: true }).click();
    assert.equal((await revokeResponsePromise).status(), 200);
    const resendResponsePromise = operatorPage.waitForResponse((response) => response.url().endsWith("/api/platform/organization-onboarding/invitations") && response.request().method() === "POST");
    await operatorPage.getByRole("button", { name: "صدور دوبارهٔ دعوت", exact: true }).click();
    const resendResponse = await resendResponsePromise;
    assert.equal(resendResponse.status(), 200);
    const resent = await resendResponse.json() as { invitationId: string; oneTimeToken: string; status: string };
    if (resent.oneTimeToken) secretTokens.add(resent.oneTimeToken);
    assert.ok(resent.oneTimeToken && resent.oneTimeToken !== oldAppointmentToken);
    await operatorPage.getByTestId("p14-token").waitFor();
    assert.equal(await operatorPage.getByTestId("p14-token").count(), 1);
    assert.equal((await operatorPage.getByTestId("p14-token").textContent())?.trim(), resent.oneTimeToken);
    const appointmentHistory = await api(operatorPage, `/api/dashboard/tenant-provisioning-plans/${appointment.planId}`);
    assert.equal(appointmentHistory.status, 200);
    assert.equal(appointmentHistory.body.invitations.length, 2);
    assert.deepEqual(appointmentHistory.body.invitations.map((invitation: { status: string }) => invitation.status).sort(), ["CREATED", "REVOKED"]);

    const oldTokenPage = await newPage();
    await login(oldTokenPage, appointmentAdmin.name);
    const oldRedemption = await api(oldTokenPage, "/api/organization-invitations/redeem", { method: "POST", body: { token: oldAppointmentToken } });
    assert.equal(oldRedemption.status, 410, "revoked invitation token is permanently unusable for its intended recipient");
    await closePage(oldTokenPage);
    appointment.invitations[0] = { ...appointment.invitations[0]!, invitationId: resent.invitationId, oneTimeToken: resent.oneTimeToken, status: resent.status };
    results.push({ name: "Appointment invitation revoke and resend invalidates the prior token and records a two-entry history", status: "PASSED" });

    const appointmentPage = await newPage();
    await activate(appointmentPage, appointmentAdmin, appointment.invitations[0]!.oneTimeToken);
    const appointmentMembership = (await api(appointmentPage, "/api/users/me/membership")).body.memberships.find((membership: { organizationId: string }) => membership.organizationId === appointment.receipt.organizationId);
    assert.equal(appointmentMembership?.role, "ADMIN");
    assert.deepEqual(appointmentMembership?.organizationCapabilities, ["APPOINTMENT"]);
    const claimedAppointmentHistory = await api(operatorPage, `/api/dashboard/tenant-provisioning-plans/${appointment.planId}`);
    assert.equal(claimedAppointmentHistory.body.invitations.length, 2);
    assert.deepEqual(claimedAppointmentHistory.body.invitations.map((invitation: { status: string }) => invitation.status).sort(), ["CLAIMED", "REVOKED"]);
    await closePage(appointmentPage);
    const combinedPage = await newPage();
    await activate(combinedPage, combinedAdmin, combined.invitations[0]!.oneTimeToken);
    const combinedMembership = (await api(combinedPage, "/api/users/me/membership")).body.memberships.find((membership: { organizationId: string }) => membership.organizationId === combined.receipt.organizationId);
    assert.deepEqual([...combinedMembership.organizationCapabilities].sort(), ["APPOINTMENT", "SHOP"]);
    await closePage(combinedPage);

    const hotelPage = await newPage();
    await activate(hotelPage, hotelAdmin, hotel.invitations[0]!.oneTimeToken, `/fa/dashboard/hotel-website/${hotel.receipt.organizationId}/${hotel.receipt.propertyId}`);
    const hotelMemberships = await api(hotelPage, "/api/users/me/membership");
    const hotelMembership = hotelMemberships.body.memberships.find((membership: { organizationId: string }) => membership.organizationId === hotel.receipt.organizationId);
    assert.equal(hotelMembership?.role, "ADMIN");
    assert.deepEqual(hotelMembership?.organizationCapabilities, ["HOTEL_WEBSITE"]);
    assert.equal((await api(hotelPage, `/api/organizations/${hotel.receipt.organizationId}/hotels/${hotel.receipt.propertyId}/website/revisions`)).status, 200);
    await hotelPage.getByRole("button", { name: "ثبت نسخه جدید", exact: true }).waitFor();
    await hotelPage.screenshot({ path: path.join(artifacts!, "p14b-hotel-dashboard.png"), fullPage: true, mask: [hotelPage.getByTestId("p14-token")] });
    await closePage(hotelPage);
    results.push({ name: "APPOINTMENT, combined capability, and HOTEL_WEBSITE identities activate with only their scoped roles and hotel dashboard access", status: "PASSED" });

    // Duplicate organization slugs fail in validation. The UI shows the safe
    // conflict and no tenant-side side effects are written.
    step("duplicate slug conflict in operator UI");
    const collisionSlug = `p14b-collision-${runId}`;
    const collisionOrganization = await db.organization.create({ data: { name: "Synthetic P14 slug collision", slug: collisionSlug, type: "SHOP" } });
    await operatorPage.goto(`${base}/fa/dashboard/tenant-provisioning/new`, { waitUntil: "domcontentloaded" });
    await operatorPage.getByTestId("p14-name").waitFor();
    await fillConfiguration(operatorPage, {
      key: "collision", name: "P14 collision probe", slug: collisionSlug, type: "SHOP", vertical: null,
      entitledCapabilities: ["SHOP"], enabledCapabilities: ["SHOP"], recipients: [{ user: collisionAdmin, role: "ADMIN" }],
    });
    const collisionPlanResponse = operatorPage.waitForResponse((response) => response.url().endsWith("/api/dashboard/tenant-provisioning-plans") && response.request().method() === "POST");
    await operatorPage.getByTestId("p14-save").click();
    const createdCollisionResponse = await collisionPlanResponse;
    assert.ok([200, 201].includes(createdCollisionResponse.status()));
    const collisionPlanId = (await createdCollisionResponse.json() as { id: string }).id;
    await operatorPage.waitForURL(`${base}/fa/dashboard/tenant-provisioning/${collisionPlanId}`);
    await operatorPage.getByTestId("p14-name").waitFor();
    const before = {
      organizations: await db.organization.count({ where: { slug: collisionSlug } }),
      settings: await db.organizationSettings.count({ where: { organizationSlug: collisionSlug } }),
      capabilities: await db.organizationCapability.count({ where: { organizationId: collisionOrganization.id } }),
      invitations: await db.organizationInvitation.count({ where: { organization: { slug: collisionSlug } } }),
      payments: await db.paymentRequest.count(), reservations: await db.hotelReservation.count(), holds: await db.hotelBookingHold.count(),
    };
    const collisionValidationPromise = operatorPage.waitForResponse((response) => response.url().endsWith(`/api/dashboard/tenant-provisioning-plans/${collisionPlanId}/validate`));
    await operatorPage.getByTestId("p14-validate").click();
    const collisionValidation = await collisionValidationPromise;
    assert.equal(collisionValidation.status(), 409);
    await operatorPage.getByRole("alert").filter({ hasText: "نشانی سازمان قبلاً استفاده شده است" }).waitFor();
    const collisionDetail = await api(operatorPage, `/api/dashboard/tenant-provisioning-plans/${collisionPlanId}`);
    assert.notEqual(collisionDetail.body.status, "APPROVED");
    assert.equal(await db.organization.findUniqueOrThrow({ where: { id: collisionOrganization.id } }).then((organization) => organization.name), "Synthetic P14 slug collision");
    assert.deepEqual({
      organizations: await db.organization.count({ where: { slug: collisionSlug } }),
      settings: await db.organizationSettings.count({ where: { organizationSlug: collisionSlug } }),
      capabilities: await db.organizationCapability.count({ where: { organizationId: collisionOrganization.id } }),
      invitations: await db.organizationInvitation.count({ where: { organization: { slug: collisionSlug } } }),
      payments: await db.paymentRequest.count(), reservations: await db.hotelReservation.count(), holds: await db.hotelBookingHold.count(),
    }, before);
    results.push({ name: "Conflicting slug fails UI validation without changing the existing organization or creating settings, capabilities, invitations, payments, reservations, or holds", status: "PASSED" });

    // The original SHOP plan remains recoverable after both recipients claim;
    // its receipt is stable and only its one-time invitation state changes.
    step("recover completed receipt and activation statuses");
    await operatorPage.goto(`${base}/fa/dashboard/tenant-provisioning/${shop.planId}`, { waitUntil: "domcontentloaded" });
    await operatorPage.getByTestId("p14-name").waitFor();
    const claimed = await api(operatorPage, `/api/dashboard/tenant-provisioning-plans/${shop.planId}`);
    assert.equal(claimed.body.executionReceipt.organizationId, shop.receipt.organizationId);
    assert.deepEqual(claimed.body.invitations.map((invitation: { status: string }) => invitation.status).sort(), ["CLAIMED", "CLAIMED"]);
    assert.equal(await operatorPage.getByTestId("p14-token").count(), 0);
    assert.equal(await db.organization.count({ where: { slug: shop.receipt.organizationSlug } }), 1);
    assert.equal(await db.organizationInvitation.count({ where: { organizationId: shop.receipt.organizationId } }), 2);
    assert.ok((await db.user.findMany({ where: { id: { in: [shopAdmin.id, shopManager.id, appointmentAdmin.id, hotelAdmin.id, combinedAdmin.id] } }, select: { role: true } })).every((user) => user.role === "CUSTOMER"));
    results.push({ name: "Reloaded completed plan keeps its original receipt and claimed invitation statuses without duplicate tenants", status: "PASSED" });

    for (const [locale, direction, title] of [["en", "ltr", "Guided workspace setup"], ["ar", "rtl", "إعداد مساحة العمل الموجّه"]] as const) {
      step(`localized ${locale} wizard`);
      await operatorPage.goto(`${base}/${locale}/dashboard/tenant-provisioning/new`, { waitUntil: "domcontentloaded" });
      await operatorPage.getByRole("heading", { name: title, exact: true }).waitFor();
      assert.ok(await operatorPage.locator(`main[dir="${direction}"]`).count() > 0);
      await operatorPage.getByTestId("p14-name").fill(`Synthetic ${locale} draft`);
    }
    results.push({ name: "Mobile combined-capability execution and English LTR/Arabic RTL wizard rendering", status: "PASSED" });

    assert.deepEqual(browserErrors, [], `browser console/request errors: ${browserErrors.join(" | ")}`);
    await writeFile(path.join(artifacts!, "p14-browser-result.json"), JSON.stringify({ status: "PASSED", exitCode: 0, environment: "LOCAL_GUARDED_POSTGRES_INSTALLED_CHROME", provenance: "SYNTHETIC_FIXTURES_ONLY", navigationCancellations, results }, null, 2));
    console.log(`P14 authenticated browser acceptance: ${results.length}/${results.length} scenarios passed; synthetic local fixtures only`);
  } catch (error) {
    await writeFile(path.join(artifacts!, "p14-browser-errors.json"), JSON.stringify(browserErrors, null, 2));
    for (const [index, context] of contexts.entries()) {
      const page = context.pages()[0];
      if (page) await page.screenshot({ path: path.join(artifacts!, `p14-failed-browser-${index}.png`), timeout: 10000, mask: [page.getByTestId("p14-token")] }).catch(() => {});
    }
    let safeMessage = error instanceof Error
      ? error.message.replaceAll(password!, "<redacted>").replaceAll(databaseUrl, "<task-db>")
      : "Browser failure";
    for (const token of secretTokens) safeMessage = safeMessage.replaceAll(token, "<redacted-invitation>");
    safeMessage = `${currentStep}: ${safeMessage}; current paths: ${contexts.flatMap((context) => context.pages().map((page) => new URL(page.url()).pathname)).join(", ")}`;
    await writeFile(path.join(artifacts!, "p14-browser-result.json"), JSON.stringify({ status: "FAILED", exitCode: 1, results, error: safeMessage }, null, 2));
    throw new Error(safeMessage);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    await browser?.close();
    await db.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const password = process.env.HOTEL_ONBOARDING_TEST_PASSWORD ?? "__not_a_password__";
  const databaseUrl = process.env.DATABASE_URL ?? "__not_a_url__";
  const message = error instanceof Error ? error.message : "Browser setup failure";
  console.error(message.replaceAll(password, "<redacted>").replaceAll(databaseUrl, "<task-db>").slice(-1600));
  process.exit(1);
});
