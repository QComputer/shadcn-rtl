import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";

function environment() {
  assert.equal(process.env.RETAIL_HERO_MEDIA_DISPOSABLE, "true");
  const base = new URL(process.env.E2E_BASE_URL ?? "");
  assert.equal(base.protocol, "http:");
  assert.equal(base.hostname, "127.0.0.1");
  assert.equal(base.port, "3421");
  assert.equal(base.pathname, "/");
  const db = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(db.hostname, "127.0.0.1");
  assert.match(db.port, /^55\d{3}$/);
  assert.match(db.pathname, /^\/retail_hero_e2e_[a-z0-9_]{8,32}$/i);
  assert.equal(process.env.DATABASE_URL, process.env.DIRECT_URL);
  const root = path.resolve(process.env.MEDIA_STORAGE_ROOT ?? "");
  assert.ok(path.isAbsolute(root) && root !== path.parse(root).root, "media storage must use a bounded, dedicated absolute path");
  const relativeRoot = path.relative(process.cwd(), root);
  assert.ok(relativeRoot === ".." || relativeRoot.startsWith(`..${path.sep}`), "media root must be outside the repository");
  return { base, output: path.resolve(process.env.E2E_OUTPUT_DIR ?? ".tmp/retail-hero-media-evidence"), root };
}

const { base, output, root } = environment();
const orgId = process.env.RETAIL_HERO_MEDIA_ORGANIZATION_ID;
const slug = process.env.RETAIL_HERO_MEDIA_SLUG;
const username = process.env.RETAIL_HERO_MEDIA_MANAGER;
const password = process.env.RETAIL_HERO_MEDIA_MANAGER_PASSWORD;
const foreignOrgId = process.env.RETAIL_HERO_MEDIA_FOREIGN_ORGANIZATION_ID;
const foreignImageId = process.env.RETAIL_HERO_MEDIA_FOREIGN_IMAGE_ID;
const privateImageId = process.env.RETAIL_HERO_MEDIA_PRIVATE_IMAGE_ID;
const revokedImageId = process.env.RETAIL_HERO_MEDIA_REVOKED_IMAGE_ID;
const missingDiskImageId = process.env.RETAIL_HERO_MEDIA_MISSING_DISK_IMAGE_ID;
const legacyRevisionId = process.env.RETAIL_HERO_MEDIA_LEGACY_REVISION_ID;
const legacyAboutId = process.env.RETAIL_HERO_MEDIA_LEGACY_ABOUT_ID;
const legacyNewId = process.env.RETAIL_HERO_MEDIA_LEGACY_NEW_ID;
assert.ok(orgId && slug === "aka-shoes" && username && password, "the synthetic Aka Shoes manager fixture is required");
assert.ok(foreignOrgId && foreignImageId && privateImageId && revokedImageId && missingDiskImageId && legacyRevisionId && legacyAboutId && legacyNewId);
const fixturePath = path.resolve("public/retail-preview/preview-fashion-campaign.png");
const chromePath = process.env.CHROME_EXECUTABLE_PATH;
if (chromePath) await fs.stat(chromePath);
await fs.mkdir(output, { recursive: true });

const report = { status: "FAILED", exitCode: 1, sourceSha: process.env.E2E_SOURCE_SHA, cases: [], network: [], console: [], screenshots: [], error: null };
let browser;
let context;
let page;
let uploaded;

function record(name, result = {}) { report.cases.push({ name, status: "PASSED", ...result }); }
const websiteApiPath = `/api/organizations/${encodeURIComponent(orgId)}/website`;
const studioPath = `/fa/dashboard/website-studio/${encodeURIComponent(orgId)}`;

async function getStudio() {
  const response = await context.request.get(new URL(websiteApiPath, base).href);
  assert.equal(response.status(), 200, "the authenticated synthetic manager can load their Website Studio");
  return response.json();
}

async function rejectDraftImage(content, baseRevisionId, pathName, mediaId, reason) {
  const response = await context.request.post(new URL(websiteApiPath, base).href, {
    headers: { origin: base.origin },
    data: { content, baseRevisionId, requestId: randomUUID() },
  });
  assert.equal(response.status(), 422, `invalid media at ${pathName} must be refused`);
  const body = await response.json();
  assert.equal(typeof body.error, "string");
  assert.deepEqual(Object.keys(body).sort(), ["diagnostics", "error"]);
  assert.ok(body.diagnostics.some(item => item.path === pathName && item.mediaId === mediaId && item.reason === reason));
  assert.ok(body.diagnostics.every(item => Object.keys(item).sort().join(",") === "mediaId,path,reason"), "diagnostics expose only allowlisted fields");
  return body;
}

async function saveDraft(pageForSave) {
  const responsePromise = pageForSave.waitForResponse(response => {
    const request = response.request();
    return new URL(response.url()).pathname === websiteApiPath && request.method() === "POST";
  });
  await pageForSave.getByRole("button", { name: "ذخیره پیش‌نویس" }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 201, `private draft save returned ${response.status()}`);
  await pageForSave.getByRole("status").filter({ hasText: "پیش‌نویس خصوصی ذخیره شد" }).waitFor({ state: "visible" });
  return response.json();
}

try {
  browser = await chromium.launch({ headless: true, ...(chromePath ? { executablePath: chromePath } : {}), args: ["--disable-features=HttpsFirstBalancedModeAutoEnable,HttpsUpgrades"] });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, baseURL: base.href });
  await context.addInitScript(() => localStorage.setItem("shadcn-rtl-theme", "system"));
  context.setDefaultNavigationTimeout(90_000);
  page = await context.newPage();
  page.on("pageerror", error => report.console.push({ type: "pageerror", message: error.message.slice(0, 500) }));
  page.on("console", message => { if (message.type() === "error") report.console.push({ type: "console", message: message.text().slice(0, 500) }); });
  page.on("request", request => {
    const pathName = new URL(request.url()).pathname;
    if (pathName === "/fa/login" || pathName.startsWith("/api/auth/") || pathName.includes("/website") || pathName.startsWith("/api/media/")) report.network.push({ method: request.method(), path: pathName, phase: "request" });
  });
  page.on("response", response => {
    const pathName = new URL(response.url()).pathname;
    if (pathName === "/fa/login" || pathName.startsWith("/api/auth/") || pathName.includes("/website") || pathName.startsWith("/api/media/")) report.network.push({ method: response.request().method(), path: pathName, status: response.status(), phase: "response" });
  });

  const csrfResponse = await context.request.get(new URL("/api/auth/csrf", base).href);
  assert.equal(csrfResponse.status(), 200, "synthetic manager sign-in must obtain a CSRF token");
  const { csrfToken } = await csrfResponse.json();
  assert.equal(typeof csrfToken, "string");
  const signInResponse = await context.request.post(new URL("/api/auth/callback/credentials", base).href, {
    headers: { origin: base.origin },
    form: { csrfToken, callbackUrl: new URL(studioPath, base).href, username, password },
  });
  assert.equal(signInResponse.status(), 200, "synthetic manager credentials callback must complete");
  const sessionResponse = await context.request.get(new URL("/api/auth/session", base).href);
  assert.equal(sessionResponse.status(), 200);
  const session = await sessionResponse.json();
  assert.equal(session?.user?.organizationId, orgId, "the browser session must belong to the synthetic Aka Shoes tenant");
  await page.goto(new URL(studioPath, base).href, { waitUntil: "domcontentloaded" });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  await page.getByText("استودیوی وب‌سایت فروشگاه", { exact: true }).waitFor({ state: "visible" });
  const hero = page.locator('section[aria-labelledby="retail-hero-title"]');
  await hero.waitFor({ state: "visible" });
  await hero.getByLabel("تیتر اصلی").fill("Synthetic Aka Shoes hero acceptance · first revision");
  await hero.getByLabel("توضیح کوتاه").fill("Disposable authenticated manager acceptance");
  record("synthetic Aka Shoes manager opens an existing legacy hero revision");

  let current = await getStudio();
  assert.equal(current.revision.id, legacyRevisionId);
  const publishedRevisionId = current.publication.revisionId;
  assert.equal(publishedRevisionId, legacyRevisionId);
  assert.equal(current.content.sections[0].visible, false);
  assert.equal(current.content.sections[0].imageId, `brand:${slug}:/brand/tenants/${slug}/home/hero/aka-home-hero-desktop.webp`);
  assert.equal(current.content.sections[1].imageId, legacyAboutId);
  assert.equal(current.content.sections[2].visible, false);
  assert.deepEqual(current.content.sections[2].imageIds, [
    `brand:${slug}:/brand/tenants/${slug}/home/hero/aka-home-hero-mobile.webp`,
    `brand:${slug}:/brand/tenants/${slug}/home/hero/aka-home-hero-desktop.webp`,
  ]);

  const foreignContent = structuredClone(current.content);
  foreignContent.hero.desktopImageId = foreignImageId;
  await rejectDraftImage(foreignContent, current.revision.id, "hero.desktopImageId", foreignImageId, "UNAVAILABLE");
  const privateContent = structuredClone(current.content);
  privateContent.hero.mobileImageId = privateImageId;
  await rejectDraftImage(privateContent, current.revision.id, "hero.mobileImageId", privateImageId, "UNAVAILABLE");
  const revokedContent = structuredClone(current.content);
  revokedContent.hero.mobileImageId = revokedImageId;
  await rejectDraftImage(revokedContent, current.revision.id, "hero.mobileImageId", revokedImageId, "UNAVAILABLE");
  const missingContent = structuredClone(current.content);
  missingContent.hero.desktopImageId = missingDiskImageId;
  await rejectDraftImage(missingContent, current.revision.id, "hero.desktopImageId", missingDiskImageId, "UNAVAILABLE");
  const missingUrl = `/api/media/${encodeURIComponent(orgId)}/tenants/${encodeURIComponent(orgId)}/uploads/${encodeURIComponent(process.env.RETAIL_HERO_MEDIA_MISSING_DISK_FILENAME)}`;
  assert.equal((await context.request.get(new URL(missingUrl, base).href)).status(), 404);
  const missingGallery = await context.request.get(new URL(`${websiteApiPath}/media?q=missing-disk-fixture`, base).href);
  assert.equal(missingGallery.status(), 200);
  assert.equal((await missingGallery.json()).images.some(image => image.id === missingDiskImageId), false);
  record("foreign, private, revoked, and missing-disk objects are refused without foreign metadata and missing objects are not delivered or selectable");

  const introducedLegacyContent = structuredClone(current.content);
  introducedLegacyContent.sections[1].imageId = legacyNewId;
  await rejectDraftImage(introducedLegacyContent, current.revision.id, "sections.1.imageId", legacyNewId, "LEGACY_REPLACEMENT_REQUIRED");
  const movedLegacyContent = structuredClone(current.content);
  movedLegacyContent.sections[2].imageIds[0] = legacyAboutId;
  await rejectDraftImage(movedLegacyContent, current.revision.id, "sections.2.imageIds.0", legacyAboutId, "LEGACY_REPLACEMENT_REQUIRED");
  record("new and moved mapped legacy IDs are rejected while the original same-path references remain eligible for carry-forward");

  await hero.getByRole("button", { name: /گالری فروشگاه/ }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  const imageButtons = dialog.locator("button[aria-pressed]");
  await assertEventuallyCount(imageButtons, 23);
  await dialog.getByRole("button", { name: "بعدی" }).click();
  await assertEventuallyCount(imageButtons, 2);
  const pageTwoFilename = (await imageButtons.nth(0).locator("span").first().textContent()).trim();
  const selectedSearch = await context.request.get(new URL(`${websiteApiPath}/media?q=${encodeURIComponent(pageTwoFilename)}`, base).href);
  assert.equal(selectedSearch.status(), 200);
  const selectedMedia = (await selectedSearch.json()).images.find(image => image.filename === pageTwoFilename);
  assert.ok(selectedMedia?.id && selectedMedia.organizationId === orgId);
  await imageButtons.nth(0).click();
  await dialog.waitFor({ state: "hidden" });
  await hero.getByText(pageTwoFilename, { exact: true }).waitFor({ state: "visible" });
  await hero.getByRole("button", { name: /گالری فروشگاه/ }).first().click();
  await page.getByRole("dialog").getByText(pageTwoFilename, { exact: true }).first().waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  record("valid tenant gallery image can be selected and stays addressable across gallery pagination");

  const savedLegacyRevision = await saveDraft(page);
  assert.notEqual(savedLegacyRevision.id, legacyRevisionId);
  assert.equal(savedLegacyRevision.content.hero.desktopImageId, selectedMedia.id);
  assert.equal(savedLegacyRevision.content.hero.mobileImageId, current.content.hero.mobileImageId);
  assert.deepEqual(savedLegacyRevision.content.sections, current.content.sections, "hidden section legacy IDs remain byte-for-byte unchanged");
  let afterSave = await getStudio();
  assert.equal(afterSave.revision.id, savedLegacyRevision.id);
  assert.equal(afterSave.content.hero.desktopImageId, selectedMedia.id);
  assert.equal(afterSave.content.hero.mobileImageId, current.content.hero.mobileImageId);
  assert.deepEqual(afterSave.content.sections, current.content.sections);
  assert.equal(afterSave.publication.revisionId, publishedRevisionId, "saving a private draft leaves the public pointer unchanged");
  await page.reload({ waitUntil: "domcontentloaded" });
  await hero.getByLabel("تیتر اصلی").waitFor({ state: "visible" });
  await hero.getByText(pageTwoFilename, { exact: true }).waitFor({ state: "visible" });
  record("private save reloads with the selected image ID and unchanged hidden legacy references");

  await page.getByRole("button", { name: "پیش‌نمایش ذخیره‌شده" }).click();
  const previewFrame = page.frameLocator('iframe[title="پیش‌نمایش خصوصی وب‌سایت فروشگاه"]');
  const previewHero = previewFrame.locator("[data-retail-managed-hero]");
  await previewHero.waitFor({ state: "visible" });
  await page.getByRole("button", { name: /رومیزی/ }).click();
  await waitForHeroImageCurrentSrc(previewHero.locator("img").first(), pageTwoFilename);
  await page.getByRole("button", { name: /موبایل/ }).click();
  await waitForHeroImageCurrentSrc(previewHero.locator("img").first(), "aka-lookbook-green-yellow.webp");
  record("private preview renders both the newly selected gallery image and the unchanged legacy mobile image");
  await page.getByRole("button", { name: "ویرایش محتوا" }).click();

  await page.getByRole("button", { name: "انتشار نسخهٔ ذخیره‌شده" }).click();
  await page.getByRole("button", { name: "تأیید انتشار" }).click();
  await page.getByRole("alert").filter({ hasText: "تصویر هیرو" }).waitFor({ state: "visible" });
  afterSave = await getStudio();
  assert.equal(afterSave.publication.revisionId, publishedRevisionId, "unresolved legacy hero slots must not change the published pointer");
  record("explicit publication rejects unresolved legacy hero slots and leaves the published hero unchanged");

  const mobileSlot = hero.getByText("تصویر نمایشگر موبایل (اختیاری)", { exact: true }).locator("..");
  await mobileSlot.getByRole("button").click();
  const uploadDialog = page.getByRole("dialog");
  await uploadDialog.waitFor({ state: "visible" });
  const fixtureStat = await fs.stat(fixturePath);
  assert.ok(fixtureStat.size > 0 && fixtureStat.size < 5 * 1024 * 1024, "upload fixture must be a valid image smaller than 5 MB");
  const uploadPromise = page.waitForResponse(response => new URL(response.url()).pathname === `${websiteApiPath}/media` && response.request().method() === "POST");
  await uploadDialog.locator('input[type="file"]').setInputFiles(fixturePath);
  const uploadResponse = await uploadPromise;
  assert.equal(uploadResponse.status(), 201);
  uploaded = (await uploadResponse.json()).image;
  assert.ok(uploaded?.id && uploaded?.url && uploaded.organizationId === orgId);
  assert.ok(uploaded.sizeBytes < 5 * 1024 * 1024);
  await uploadDialog.waitFor({ state: "hidden" });
  const delivery = await context.request.get(new URL(uploaded.url, base).href);
  assert.equal(delivery.status(), 200);
  assert.match(delivery.headers()["content-type"] ?? "", /^image\/png/);
  record("valid image upload below 5 MB becomes tenant-owned media and is delivered by GET");

  const uploadedRevision = await saveDraft(page);
  assert.notEqual(uploadedRevision.id, savedLegacyRevision.id);
  assert.equal(uploadedRevision.content.hero.mobileImageId, uploaded.id);
  assert.equal(uploadedRevision.content.hero.desktopImageId, selectedMedia.id);
  assert.deepEqual(uploadedRevision.content.sections, current.content.sections);
  current = await getStudio();
  assert.equal(current.revision.id, uploadedRevision.id);
  assert.equal(current.publication.revisionId, publishedRevisionId);

  await page.getByRole("button", { name: "پیش‌نمایش ذخیره‌شده" }).click();
  const uploadedPreview = page.frameLocator('iframe[title="پیش‌نمایش خصوصی وب‌سایت فروشگاه"]').locator("[data-retail-managed-hero]");
  await uploadedPreview.waitFor({ state: "visible" });
  await page.getByRole("button", { name: /رومیزی/ }).click();
  await waitForHeroImageCurrentSrc(uploadedPreview.locator("img").first(), pageTwoFilename);
  await page.getByRole("button", { name: /موبایل/ }).click();
  await waitForHeroImageCurrentSrc(uploadedPreview.locator("img").first(), uploaded.filename);
  record("uploaded media persists after reload and renders in the private preview");
  await page.getByRole("button", { name: "ویرایش محتوا" }).click();

  await page.getByRole("button", { name: "انتشار نسخهٔ ذخیره‌شده" }).click();
  await page.getByRole("button", { name: "تأیید انتشار" }).click();
  await page.getByRole("status").filter({ hasText: "هیرو منتشر شد" }).waitFor({ state: "visible" });
  let publication = (await getStudio()).publication;
  assert.equal(publication.revisionId, uploadedRevision.id);
  assert.equal(publication.previousRevisionId, publishedRevisionId);
  record("explicit publication advances the pointer only after all hero slots use eligible media");

  await hero.getByLabel("تیتر اصلی").fill("Synthetic Aka Shoes hero acceptance · second published revision");
  const secondPublishedDraft = await saveDraft(page);
  await page.getByRole("button", { name: "انتشار نسخهٔ ذخیره‌شده" }).click();
  await page.getByRole("button", { name: "تأیید انتشار" }).click();
  await page.getByRole("status").filter({ hasText: "هیرو منتشر شد" }).waitFor({ state: "visible" });
  publication = (await getStudio()).publication;
  assert.equal(publication.revisionId, secondPublishedDraft.id);
  assert.equal(publication.previousRevisionId, uploadedRevision.id);
  await page.getByRole("button", { name: "بازگشت به هیروی قبلی" }).click();
  await page.getByRole("button", { name: "تأیید بازگشت" }).click();
  await page.getByRole("status").filter({ hasText: "هیرو به نسخهٔ قبلی بازگشت" }).waitFor({ state: "visible" });
  publication = (await getStudio()).publication;
  assert.equal(publication.revisionId, uploadedRevision.id);
  assert.equal(publication.previousRevisionId, secondPublishedDraft.id);
  await page.goto(`/fa/${encodeURIComponent(slug)}/shop`, { waitUntil: "domcontentloaded" });
  const publicHero = page.locator("[data-retail-managed-hero]");
  await publicHero.waitFor({ state: "visible" });
  await publicHero.getByText("Synthetic Aka Shoes hero acceptance · first revision", { exact: true }).waitFor({ state: "visible" });
  record("published history and rollback restore the preceding immutable hero revision");

  const foreignGallery = await context.request.get(new URL(`/api/organizations/${encodeURIComponent(foreignOrgId)}/website/media?q=gallery-fixture`, base).href);
  assert.equal(foreignGallery.status(), 403, "the manager cannot query another tenant gallery");
  assert.equal(report.console.filter(item => item.type === "pageerror").length, 0, "there must be no browser runtime errors");
  report.status = "PASSED";
  report.exitCode = 0;
} catch (error) {
  report.error = String(error).slice(0, 1000);
  if (page) await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true }).catch(() => undefined);
} finally {
  if (context) await context.tracing.stop(report.status === "PASSED" ? undefined : { path: path.join(output, "trace.zip") }).catch(() => undefined);
  if (context) await context.close().catch(() => undefined);
  if (browser) await browser.close().catch(() => undefined);
  report.cases = report.cases.map(test => ({ ...test, status: report.status === "PASSED" ? test.status : "PARTIAL" }));
  await fs.writeFile(path.join(output, "network.json"), JSON.stringify(report.network, null, 2));
  await fs.writeFile(path.join(output, "console.json"), JSON.stringify(report.console, null, 2));
  await fs.writeFile(path.join(output, "result.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, exitCode: report.exitCode, sourceSha: report.sourceSha, cases: report.cases, screenshots: report.screenshots, error: report.error, output }));
}
process.exitCode = report.exitCode;

async function assertEventuallyCount(locator, expected) {
  await locator.first().waitFor({ state: "visible", timeout: 30_000 });
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await locator.count() === expected) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal(await locator.count(), expected);
}

async function waitForHeroImageCurrentSrc(image, expectedFilename) {
  await image.waitFor({ state: "visible", timeout: 30_000 });
  const deadline = Date.now() + 30_000;
  let currentSrc = "";
  while (Date.now() < deadline) {
    currentSrc = await image.evaluate(element => element.currentSrc).catch(() => "");
    if (currentSrc.includes(expectedFilename)) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(currentSrc.includes(expectedFilename), `Expected visible Hero image currentSrc to include ${expectedFilename}; received ${currentSrc}`);
}
