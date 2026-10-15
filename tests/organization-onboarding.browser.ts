import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { chromium, type Page, type BrowserContext } from "playwright";
import { PrismaClient } from "@prisma/client";

async function main() {
const runId = process.env.HOTEL_ONBOARDING_RUN_ID;
const port = Number(process.env.HOTEL_ONBOARDING_APP_PORT);
const password = process.env.HOTEL_ONBOARDING_TEST_PASSWORD;
const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.equal(process.env.HOTEL_ONBOARDING_PG_ACCEPTANCE, "1");
assert.match(runId ?? "", /^[a-f0-9]{12}$/);
assert.equal(target.hostname, "127.0.0.1");
assert.equal(target.pathname, `/hotel_onboarding_${runId}`);
assert.ok(password && password.length >= 20 && port > 1024);
assert.equal(process.env.VERCEL_ENV === "production", false);
const base = `http://bazarbaaz.ir:${port}`;
const artifacts = process.env.HOTEL_ONBOARDING_ARTIFACTS!;
await mkdir(artifacts, { recursive: true });
console.log("Browser fixture: creating synthetic verified identities");
const db = new PrismaClient();
const passwordHash = await bcrypt.hash(password!, 12);
const makeUser = async (name: string, role: "CUSTOMER" | "SUPER_ADMIN" = "CUSTOMER") => {
  const email = `${name}@example.invalid`;
  const user = await db.user.create({ data: { name, role, password: passwordHash, email, emailVerified: new Date() } });
  await db.emailVerification.create({ data: { userId: user.id, email, token: randomBytes(32).toString("hex"), verifiedAt: new Date(), expiresAt: new Date(Date.now() + 3600000) } });
  return user;
};
const operator = await makeUser(`browser-operator-${runId}`, "SUPER_ADMIN");
const admin = await makeUser("damoon-admin");
const manager = await makeUser("damoon-manager");
// A pre-existing customer relationship is not authority over that tenant and
// must not become the selected team context when this user later signs in.
const customerOrganization = await db.organization.findFirstOrThrow({ where: { slug: `second-${runId}` } });
await db.organizationMember.create({ data: { organizationId: customerOrganization.id, organizationSlug: customerOrganization.slug, userId: manager.id, role: "CUSTOMER" } });
console.log("Browser fixture: launching installed Chromium");
const browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" } : {}), args: ["--no-proxy-server", "--host-resolver-rules=MAP bazarbaaz.ir 127.0.0.1", `--unsafely-treat-insecure-origin-as-secure=${base}`] });
const results: Array<{ name: string; status: string }> = [];
const browserErrors: string[] = [];
const contexts: BrowserContext[] = [];
async function newPage() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  contexts.push(context);
  await context.route("**/*", (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  const page = await context.newPage();
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("requestfailed", (request) => browserErrors.push(`${new URL(request.url()).pathname}: ${request.failure()?.errorText}`));
  page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(120000);
  return page;
}
async function api(page: Page, url: string, body?: unknown, key?: string) {
  return page.evaluate(async ({ url, body, key }) => {
    const response = await fetch(url, { method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, cache: response.headers.get("cache-control"), body: await response.json() };
  }, { url, body, key });
}
async function login(page: Page, username: string, callback = "/fa/dashboard/hotel-website") {
  await page.goto(`${base}/fa/login?callbackUrl=${encodeURIComponent(callback)}`, { waitUntil: "domcontentloaded" });
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password!);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`${base}${callback}`, { waitUntil: "domcontentloaded" });
  const session = await api(page, "/api/auth/session");
  assert.equal(session.body.user.name, username);
  return session.body.user;
}
async function activate(page: Page, user: typeof admin, token: string) {
  await login(page, user.name, "/fa/onboarding/organization-invitation");
  await page.locator("#organization-invitation-token").fill(token);
  await page.locator('button[type="submit"]').click();
  await page.getByRole("status").filter({ hasText: "دسترسی سازمان فعال شد" }).waitFor();
  assert.equal(await page.locator("#organization-invitation-token").count(), 0);
  await page.screenshot({ path: path.join(artifacts, `${user.name}-activation.png`), fullPage: true });
  await page.getByRole("button", { name: "خروج و ورود دوباره" }).click();
  await page.waitForURL(/\/fa\/login/);
  await page.locator("#username").fill(user.name);
  await page.locator("#password").fill(password!);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`${base}/fa/dashboard/hotel-website`);
}

const mediaFilename = `hotel-onboarding-${runId}.png`;
const mediaFile = path.resolve("../uploads", mediaFilename);
const mediaBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let mediaCreated = false;
try {
  await mkdir(path.dirname(mediaFile), { recursive: true });
  await writeFile(mediaFile, mediaBytes, { flag: "wx" });
  mediaCreated = true;
  console.log("Browser fixture: operator login");
  const operatorPage = await newPage();
  await login(operatorPage, operator.name);
  const created = await api(operatorPage, "/api/platform/organization-onboarding/hotel", { name: "دامون · نمونهٔ مصنوعی آزمون", slug: "damoon-hotel", property: { name: "ملک مصنوعی آزمون", slug: "main" }, locale: "fa" }, `${runId}-browser-bootstrap`);
  assert.equal(created.status, 200);
  const hotel = created.body;
  assert.equal((await api(operatorPage, "/api/platform/organization-onboarding/hotel", { name: "دامون · نمونهٔ مصنوعی آزمون", slug: "damoon-hotel", property: { name: "ملک مصنوعی آزمون", slug: "main" }, locale: "fa" }, `${runId}-browser-bootstrap`)).body.replayed, true);
  results.push({ name: "Authenticated SUPER_ADMIN bootstrap and retry", status: "PASSED" });
  console.log("Browser fixture: operator bootstrap passed");
  const issued = [];
  for (const [user, role] of [[admin, "ADMIN"], [manager, "MANAGER"]] as const) {
    const response = await api(operatorPage, "/api/platform/organization-onboarding/invitations", { organizationId: hotel.organizationId, recipientUserId: user.id, recipientEmail: user.email, recipientUsername: user.name, invitedRole: role }, `${runId}-browser-${role}`);
    assert.equal(response.status, 200);
    issued.push(response.body);
  }
  const adminPage = await newPage();
  const managerPage = await newPage();
  await activate(adminPage, admin, issued[0].oneTimeToken);
  await activate(managerPage, manager, issued[1].oneTimeToken);
  console.log("Browser fixture: both recipient activations passed");
  for (const [page, user, role] of [[adminPage, admin, "ADMIN"], [managerPage, manager, "MANAGER"]] as const) {
    const session = await api(page, "/api/auth/session");
    assert.equal(session.body.user.role, "CUSTOMER");
    assert.equal(session.body.user.organizationId, hotel.organizationId);
    const membership = await api(page, "/api/users/me/membership");
    assert.equal(membership.body.membership.role, role);
    await page.getByRole("link").filter({ hasText: "ملک مصنوعی آزمون" }).click();
    await page.waitForURL(`${base}/fa/dashboard/hotel-website/${hotel.organizationId}/${hotel.propertyId}`);
    await page.screenshot({ path: path.join(artifacts, `${user.name}-cms.png`), fullPage: true });
  }
  results.push({ name: "Admin and manager real credential login, verified activation, relogin and CMS navigation", status: "PASSED" });
  const foreignUser = await makeUser(`foreign-manager-${runId}`);
  await db.organizationMember.create({ data: { organizationId: customerOrganization.id, organizationSlug: customerOrganization.slug, userId: foreignUser.id, role: "MANAGER" } });
  await db.user.update({ where: { id: foreignUser.id }, data: { isTeamMember: true } });
  const foreignPage = await newPage();
  await login(foreignPage, foreignUser.name);
  const foreignAccess = await api(foreignPage, `/api/organizations/${hotel.organizationId}/hotels/${hotel.propertyId}/website/revisions`);
  assert.equal(foreignAccess.status, 403);
  const foreignWorkspace = await foreignPage.goto(`${base}/fa/dashboard/hotel-website/${hotel.organizationId}/${hotel.propertyId}`);
  // Next may have streamed the authenticated layout before notFound(). In
  // that case the document is 200; the segment fallback must still hide the
  // workspace, stay noindex, and the underlying API must remain 403.
  assert.ok(foreignWorkspace && [200, 404].includes(foreignWorkspace.status()));
  await foreignPage.getByTestId("hotel-cms-unavailable").waitFor();
  assert.equal(await foreignPage.getByRole("button", { name: "ثبت نسخه جدید", exact: true }).count(), 0);
  assert.match(await foreignPage.locator('meta[name="robots"]').first().getAttribute("content") ?? "", /noindex/);
  assert.equal(await foreignPage.getByText("دامون · نمونهٔ مصنوعی آزمون", { exact: true }).count(), 0);
  results.push({ name: "Independent tenant manager cannot enter Hotel A workspace or read private revisions", status: "PASSED" });
  const pathBase = `/api/organizations/${hotel.organizationId}/hotels/${hotel.propertyId}/website`;
  const content = { title: { fa: "دامون · آزمون مصنوعی", en: "Synthetic Damoon test", ar: "اختبار دامون الاصطناعي" }, hero: { heading: { fa: "پیش‌نمایش ساختگی دامون", en: "Synthetic Damoon preview", ar: "معاينة دامون الاصطناعية" } }, introduction: { body: { fa: "این متن فقط دادهٔ مصنوعی آزمون است.", en: "Synthetic test data only.", ar: "بيانات اختبار اصطناعية فقط." } }, sections: [], contact: {} };
  const ownImage = await db.image.create({ data: { organizationId: hotel.organizationId, filename: mediaFilename, url: `/uploads/${mediaFilename}`, mimeType: "image/png", access: "PUBLIC", purpose: "SYNTHETIC_ACCEPTANCE_ONLY" } });
  const foreignImage = await db.image.create({ data: { organizationId: customerOrganization.id, filename: `foreign-${runId}.png`, url: `/uploads/foreign-${runId}.png`, mimeType: "image/png", access: "PUBLIC" } });
  assert.equal((await api(managerPage, `${pathBase}/revisions`, { content, media: [{ imageId: foreignImage.id, scope: "PROPERTY", roomTypeId: null, slot: "GALLERY", sortOrder: 0, altText: {} }] }, `${runId}-foreign-image`)).status, 403);
  // Only the guarded loopback origin is treated as secure by this browser.
  // Production still requires HTTPS and native cryptographic idempotency keys.
  assert.equal(await managerPage.evaluate(() => window.isSecureContext && typeof crypto.randomUUID === "function"), true);
  // Use the merchant UI to create the immutable revision in all three locales.
  await managerPage.getByRole("button", { name: "+ بخش متنی", exact: true }).click();
  for (const locale of ["fa", "en", "ar"] as const) {
    await managerPage.getByLabel("زبان ویرایش").selectOption(locale);
    await managerPage.getByLabel("عنوان صفحه", { exact: true }).fill(content.title[locale]);
    await managerPage.getByLabel("عنوان اصلی صفحه", { exact: true }).fill(content.hero.heading[locale]);
    await managerPage.getByLabel("متن معرفی هتل", { exact: true }).fill(content.introduction.body[locale]);
    await managerPage.getByLabel("متن بخش", { exact: true }).fill(`${content.introduction.body[locale]} · section`);
  }
  await managerPage.getByRole("button", { name: "+ افزودن تصویر", exact: true }).click();
  await managerPage.getByLabel("شناسه تصویر", { exact: true }).fill(ownImage.id);
  const createdDraft = managerPage.waitForResponse((response) => response.url().endsWith(`${pathBase}/revisions`) && response.request().method() === "POST");
  await managerPage.getByRole("button", { name: "ثبت نسخه جدید", exact: true }).click();
  const draftResponse = await createdDraft;
  assert.equal(draftResponse.status(), 201);
  const draft = await draftResponse.json();
  const revisionId = draft.result.id;
  console.log("Browser fixture: manager UI created immutable localized revision");
  await managerPage.getByRole("button", { name: /نسخه 1/ }).click();
  await managerPage.getByTestId("hotel-owner-preview-label").waitFor();
  assert.equal(await managerPage.locator('[data-provenance="AUTHENTICATED_CMS_PREVIEW"]').count(), 1);
  assert.match(await managerPage.locator('meta[name="robots"]').getAttribute("content") ?? "", /noindex/);
  await managerPage.screenshot({ path: path.join(artifacts, "manager-private-hotel-presentation.png"), fullPage: true });
  const preview = await api(managerPage, `${pathBase}/revisions/${revisionId}/preview?locale=fa`);
  assert.equal(preview.status, 200);
  assert.equal(preview.body.mode, "PREVIEW");
  assert.match(preview.cache ?? "", /no-store/);
  assert.equal((await api(operatorPage, `${pathBase}/revisions/${revisionId}/preview?locale=fa`)).status, 200);
  const publicPath = `/api/hotel/v1/website/properties/main?locale=fa&organizationSlug=damoon-hotel`;
  const anonymous = await newPage();
  await anonymous.goto(`${base}/api/auth/session`);
  assert.equal((await api(anonymous, "/api/organization-invitations/redeem", { token: issued[0].oneTimeToken })).status, 401);
  assert.equal((await api(anonymous, `${pathBase}/revisions/${revisionId}/preview?locale=fa`)).status, 401);
  assert.equal((await api(anonymous, publicPath)).body.mode, "UNPUBLISHED");
  await anonymous.goto(`${base}/damoon-hotel?source=onboarding-test`);
  await anonymous.locator('[data-hotel-state="NO_APPROVED_CONTENT"]').waitFor();
  assert.equal(await anonymous.getByText(content.hero.heading.fa, { exact: true }).count(), 0);
  assert.ok(new URL(anonymous.url()).pathname === "/fa/damoon-hotel");
  assert.equal(new URL(anonymous.url()).searchParams.get("source"), "onboarding-test");
  results.push({ name: "Unpublished content stays private and platform locale redirect preserves query", status: "PASSED" });
  assert.equal((await api(managerPage, "/api/platform/organization-onboarding/hotel", {}, `${runId}-denied`)).status, 403);
  assert.equal((await api(managerPage, `/api/organizations/${hotel.organizationId}/members`, { userId: manager.id, role: "SUPER_ADMIN" })).status, 403);
  assert.equal((await api(managerPage, `${pathBase}/revisions/${revisionId}/review`, { decision: "APPROVED" }, `${runId}-denied-approve`)).status, 403);
  const foreignOrg = await db.organization.findFirstOrThrow({ where: { slug: `second-${runId}` }, include: { hotelProperties: true } });
  assert.equal((await api(managerPage, `/api/organizations/${foreignOrg.id}/hotels/${foreignOrg.hotelProperties[0].id}/website/revisions`)).status, 403);
  results.push({ name: "Manager cannot grant privileges, approve content or access a foreign tenant", status: "PASSED" });
  await managerPage.getByRole("button", { name: "ارسال برای بررسی", exact: true }).click();
  await managerPage.getByRole("status").filter({ hasText: "نسخه برای بررسی ارسال شد" }).waitFor();
  await adminPage.reload();
  await adminPage.getByRole("button", { name: /نسخه 1/ }).click();
  await adminPage.getByRole("button", { name: "تأیید نسخه", exact: true }).click();
  await adminPage.getByRole("status").filter({ hasText: "نسخه تأیید شد" }).waitFor();
  const publishing = adminPage.waitForResponse((response) => response.url().endsWith(`/revisions/${revisionId}/publish`) && response.request().method() === "POST");
  await adminPage.getByRole("button", { name: "انتشار نسخه تأییدشده", exact: true }).click();
  const publicationResponse = await publishing;
  assert.equal(publicationResponse.status(), 200);
  const publicationBody = await publicationResponse.json();
  console.log("Browser fixture: independent Admin UI approved and published revision");
  const published = await api(anonymous, publicPath);
  assert.match(published.cache ?? "", /no-store/);
  assert.equal(published.body.revisionNumber, 1);
  assert.equal(published.body.content.sections[0].heading, null, "empty optional localized heading is not fabricated");
  const mediaUrl = published.body.propertyGallery[0].src as string;
  assert.match(mediaUrl, /organizationSlug=damoon-hotel/);
  const delivered = await anonymous.evaluate(async (url) => {
    const response = await fetch(url, { cache: "no-store" });
    return { status: response.status, mime: response.headers.get("content-type"), bytes: Array.from(new Uint8Array(await response.arrayBuffer())) };
  }, mediaUrl);
  assert.equal(delivered.status, 200);
  assert.match(delivered.mime ?? "", /image\/png/);
  assert.deepEqual(Buffer.from(delivered.bytes), mediaBytes);
  const foreignMedia = await api(anonymous, mediaUrl.replace("organizationSlug=damoon-hotel", `organizationSlug=${customerOrganization.slug}`));
  assert.equal(foreignMedia.status, 404);
  results.push({ name: "Manager UI edits fa/en/ar and media; authenticated private presentation; independent Admin UI review/publication; exact authorized media bytes", status: "PASSED" });
  for (const locale of ["fa", "en", "ar"] as const) {
    await anonymous.setViewportSize(locale === "fa" ? { width: 390, height: 844 } : { width: 1280, height: 850 });
    const pageResponse = await anonymous.goto(`${base}/${locale}/damoon-hotel`);
    assert.match(pageResponse?.headers()["cache-control"] ?? "", /private|no-store/);
    await anonymous.getByRole("heading", { name: content.hero.heading[locale], exact: true }).waitFor();
    const photo = anonymous.locator("#gallery img").first();
    await photo.scrollIntoViewIfNeeded();
    await photo.evaluate(async (element) => { await (element as HTMLImageElement).decode(); });
    assert.equal(await photo.evaluate((element) => (element as HTMLImageElement).naturalWidth), 1);
    assert.ok((await anonymous.title()).includes(content.title[locale]));
    assert.equal(await anonymous.locator('meta[name="description"]').getAttribute("content"), content.introduction.body[locale]);
    assert.match(await anonymous.locator('meta[name="robots"]').getAttribute("content") ?? "", /noindex/);
    const canonical = await anonymous.locator('link[rel="canonical"]').getAttribute("href");
    assert.equal(new URL(canonical!).hostname, "bazarbaaz.ir");
    assert.equal(new URL(canonical!).pathname, `/${locale}/damoon-hotel`);
    await anonymous.screenshot({ path: path.join(artifacts, `published-synthetic-${locale}.png`), fullPage: true });
    assert.equal(await anonymous.locator("html").getAttribute("dir"), locale === "en" ? "ltr" : "rtl");
    assert.equal(await anonymous.locator("html").getAttribute("lang"), locale);
    assert.equal(await anonymous.locator("body").evaluate((element) => getComputedStyle(element).direction), locale === "en" ? "ltr" : "rtl");
  }
  results.push({ name: "Independent administrator publishes exact revision; platform-host Hotel renders fa/en/ar at mobile and desktop sizes", status: "PASSED" });
  const ownDraft = await api(adminPage, `${pathBase}/revisions`, { content, media: [] }, `${runId}-admin-own-draft`);
  assert.equal(ownDraft.status, 201);
  const ownRevision = ownDraft.body.result.id;
  assert.equal((await api(adminPage, `${pathBase}/revisions/${ownRevision}/submit`, {}, `${runId}-admin-submit`)).status, 200);
  assert.equal((await api(adminPage, `${pathBase}/revisions/${ownRevision}/review`, { decision: "APPROVED" }, `${runId}-admin-self-approval`)).status, 403);
  assert.equal((await api(anonymous, publicPath)).body.revisionNumber, 1, "a new draft never replaces publication");
  await db.image.update({ where: { id: ownImage.id }, data: { access: "PRIVATE" } });
  assert.equal((await api(anonymous, publicPath)).body.propertyGallery.length, 0);
  assert.equal((await api(anonymous, mediaUrl)).status, 404);
  assert.equal((await api(managerPage, `${pathBase}/revisions/${revisionId}/preview?locale=fa`)).status, 403);
  results.push({ name: "Self-approval rejected; new revision preserves publication; current private media disappears and association/preview fail closed", status: "PASSED" });
  const revoke = await api(adminPage, `${pathBase}/publications/${publicationBody.result.publicationId}/revoke`, { reason: "Synthetic test complete" }, `${runId}-browser-revoke`);
  assert.equal(revoke.status, 200);
  assert.equal((await api(anonymous, publicPath)).body.mode, "UNPUBLISHED");
  await anonymous.goto(`${base}/fa/damoon-hotel`);
  await anonymous.locator('[data-hotel-state="NO_APPROVED_CONTENT"]').waitFor();
  assert.equal(await anonymous.getByText(content.hero.heading.fa, { exact: true }).count(), 0);
  assert.equal((await api(anonymous, mediaUrl)).status, 404);
  // Next omits an empty description tag; absent and empty are both safe.
  const revokedDescription = await anonymous.evaluate(() => document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "");
  assert.equal(revokedDescription, "");
  assert.match(await anonymous.locator('meta[name="robots"]').getAttribute("content") ?? "", /noindex/);
  await db.organizationCapability.updateMany({ where: { organizationId: hotel.organizationId, key: "HOTEL_WEBSITE" }, data: { status: "INACTIVE", disabledAt: new Date() } });
  assert.equal((await api(managerPage, `${pathBase}/revisions`)).status, 403);
  assert.equal((await api(anonymous, publicPath)).status, 404);
  await anonymous.goto(`${base}/en/damoon-hotel`);
  await anonymous.locator('[data-hotel-state="UNAVAILABLE_PROPERTY"]').waitFor();
  results.push({ name: "Revoked content/metadata/media unavailable; disabled website capability denies manager and public reads", status: "PASSED" });
  const caps = await db.organizationCapability.findMany({ where: { organizationId: hotel.organizationId } });
  assert.deepEqual(caps.map((item) => item.key), ["HOTEL_WEBSITE"]);
  assert.equal(await db.hotelInventory.count(), 0);
  assert.equal(await db.order.count(), 0);
  assert.equal(await db.hotelReservation.count(), 0);
  assert.equal(await db.hotelBookingHold.count(), 0);
  assert.equal(await db.paymentRequest.count(), 0);
  results.push({ name: "Revocation removes public content; no booking capability, holds, payments or reservations", status: "PASSED" });
  await writeFile(path.join(artifacts, "browser-result.json"), JSON.stringify({ status: "PASSED", exitCode: 0, environment: `LOCAL_${process.env.HOTEL_ONBOARDING_SERVER_MODE ?? "DEVELOPMENT"}_SERVER`, provenance: "SYNTHETIC_FIXTURES_ONLY", results }, null, 2));
  console.log(`Authenticated browser acceptance: ${results.length}/${results.length} scenarios passed; synthetic fixtures only`);
} catch (error) {
  await writeFile(path.join(artifacts, "browser-errors.json"), JSON.stringify(browserErrors, null, 2));
  for (const [index, context] of contexts.entries()) {
    const page = context.pages()[0];
    if (page) await page.screenshot({ path: path.join(artifacts, `failed-browser-${index}.png`), timeout: 10000 }).catch(() => {});
  }
  await writeFile(path.join(artifacts, "browser-result.json"), JSON.stringify({ status: "FAILED", exitCode: 1, results, error: error instanceof Error ? error.message.replaceAll(password!, "<redacted>") : "Browser failure" }, null, 2));
  throw error;
} finally {
  if (mediaCreated) await unlink(mediaFile);
  await Promise.all(contexts.map((context) => context.close()));
  await browser.close();
  await db.$disconnect();
}
}

void main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : "Browser setup failure";
  const safe = message.replaceAll(process.env.HOTEL_ONBOARDING_TEST_PASSWORD ?? "__not_a_password__", "<redacted>").replaceAll(process.env.DATABASE_URL ?? "__not_a_url__", "<task-db>");
  console.error(safe.slice(-1200));
  // Setup failures can occur before the inner cleanup block owns the client.
  process.exit(1);
});
