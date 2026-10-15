import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = new URL(process.env.DAMOON_PREVIEW_BASE_URL || "http://127.0.0.1:4179");
const artifactDirectory = path.resolve(process.env.DAMOON_PREVIEW_ARTIFACTS || ".tmp/damoon-owner-preview-browser");
const chromeCandidates = [
  process.env.CHROME_PATH,
  process.env.CHROME_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);
const chromePath = process.platform === "win32" ? chromeCandidates[0] : undefined;
const locales = [
  { locale: "fa", direction: "rtl", checkIn: "انتخاب تاریخ ورود شمسی", calendarClose: "بستن تقویم", guests: "انتخاب ترکیب مهمانان", adultIncrement: "افزایش بزرگسال", adultCount: "تعداد بزرگسالان", guestDone: "تأیید مهمانان", menuOpen: "بازکردن فهرست" },
  { locale: "en", direction: "ltr", checkIn: "Choose Jalali check-in date", calendarClose: "Close calendar", guests: "Choose guest composition", adultIncrement: "Increase adults", adultCount: "Number of adults", guestDone: "Apply guests", menuOpen: "Open navigation" },
  { locale: "ar", direction: "rtl", checkIn: "اختر تاريخ الوصول بالتقويم الشمسي", calendarClose: "إغلاق التقويم", guests: "اختيار تكوين الضيوف", adultIncrement: "زيادة البالغين", adultCount: "عدد البالغين", guestDone: "تطبيق الضيوف", menuOpen: "فتح القائمة" },
];
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

function parseAccessHeaders() {
  const raw = process.env.DAMOON_PREVIEW_ACCESS_HEADERS_JSON;
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  assert.ok(parsed && typeof parsed === "object" && !Array.isArray(parsed), "DAMOON_PREVIEW_ACCESS_HEADERS_JSON must be a JSON object");
  for (const [name, value] of Object.entries(parsed)) {
    assert.ok(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name), "preview access header names must be valid HTTP tokens");
    assert.equal(typeof value, "string", "preview access header values must be strings");
  }
  return parsed;
}

function isAuthRedirect(url) {
  return /\/(?:login|log-in|signin|sign-in|auth|sso)(?:\/|$)/i.test(url.pathname) || /(?:^|\.)vercel\.app\/.*\/login/i.test(url.href);
}

const results = [];
const unexpectedCalls = [];
const browserErrors = [];
const authHeaders = parseAccessHeaders();
// Supported same-project Vercel development OIDC authentication. The short-
// lived token stays in memory and is attached only to this preview origin.
if (process.env.VERCEL_OIDC_TOKEN) authHeaders["x-vercel-trusted-oidc-idp-token"] = process.env.VERCEL_OIDC_TOKEN;
let browser;
let status = "PASSED";
let fatalError;

await mkdir(artifactDirectory, { recursive: true });

try {
  browser = await chromium.launch({ headless: true, ...(chromePath ? { executablePath: chromePath } : {}) });

  for (const viewport of viewports) {
    for (const entry of locales) {
      const pageResult = {
        locale: entry.locale,
        viewport: `${viewport.width}x${viewport.height}`,
        screenshot: `${entry.locale}-${viewport.name}.png`,
        checks: {},
        errors: [],
      };
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      await context.route("**/*", (route) => {
        const requestUrl = new URL(route.request().url());
        if (requestUrl.origin !== pageOrigin) return route.abort("blockedbyclient");
        if (Object.keys(authHeaders).length === 0) return route.continue();
        return route.continue({ headers: { ...route.request().headers(), ...authHeaders } });
      });
      const page = await context.newPage();
      const pageOrigin = baseUrl.origin;
      const pageRequests = [];
      let response;

      page.on("request", (request) => {
        const requestUrl = new URL(request.url());
        const isHttp = requestUrl.protocol === "http:" || requestUrl.protocol === "https:";
        const external = isHttp && requestUrl.origin !== pageOrigin;
        const api = requestUrl.pathname.startsWith("/api/");
        const record = { method: request.method(), path: requestUrl.pathname, external, api };
        pageRequests.push(record);
        if (external || api) unexpectedCalls.push({ locale: entry.locale, viewport: viewport.name, ...record });
      });
      page.on("requestfailed", (request) => {
        const requestUrl = new URL(request.url());
        const message = `${request.method()} ${requestUrl.pathname}: ${request.failure()?.errorText || "request failed"}`;
        pageResult.errors.push(message);
        browserErrors.push({ locale: entry.locale, viewport: viewport.name, message });
      });
      page.on("pageerror", (error) => {
        pageResult.errors.push(`page error: ${error.message}`);
        browserErrors.push({ locale: entry.locale, viewport: viewport.name, message: `page error: ${error.message}` });
      });

      try {
        const route = `/${entry.locale}`;
        response = await page.goto(new URL(route, baseUrl).href, { waitUntil: "networkidle", timeout: 45000 });
        if (isAuthRedirect(new URL(page.url()))) {
          pageResult.status = "BLOCKED";
          pageResult.blocker = "Preview access redirected to an authentication route";
          status = "BLOCKED";
          continue;
        }
        assert.ok(response, "navigation returned an HTTP response");
        if (response.status() === 401 || response.status() === 403) {
          pageResult.status = "BLOCKED";
          pageResult.blocker = `Preview returned HTTP ${response.status()}`;
          status = "BLOCKED";
          continue;
        }
        assert.equal(response.status(), 200, `/${entry.locale} should return HTTP 200`);

        const documentState = await page.evaluate(() => {
          const main = document.querySelector("main");
          const hero = main?.querySelector("#home, .hero, [data-testid*=hero]");
          const rooms = main?.querySelector("#rooms, [data-testid=room-showcase]");
          const previewBanner = document.querySelector("#synthetic-preview-banner");
          const conceptRooms = [...(main?.querySelectorAll('[data-room-kind="concept"]') || [])];
          const publishedRooms = [...(main?.querySelectorAll('[data-room-kind="published"]') || [])];
          const robots = document.querySelector('meta[name="robots" i]')?.content || "";
          const noindex = /(?:^|[,\s])noindex(?:$|[,\s])/i.test(robots);
          return {
            lang: document.documentElement.lang,
            dir: document.documentElement.dir,
            mainVisible: Boolean(main && main.getClientRects().length),
            provenance: main?.getAttribute("data-provenance") || null,
            markerVisible: Boolean(previewBanner && previewBanner.getClientRects().length),
            heroVisible: Boolean(hero && hero.getClientRects().length),
            heroHeadingVisible: Boolean(main?.querySelector("h1")?.getClientRects().length),
            roomsVisible: Boolean(rooms && rooms.getClientRects().length),
            conceptRoomCount: conceptRooms.filter((room) => room.getClientRects().length > 0).length,
            publishedRoomCount: publishedRooms.length,
            noindex,
            robots,
            images: [...(main?.querySelectorAll("img") || [])].map((image) => ({
              srcPath: (() => { try { return new URL(image.currentSrc || image.src).pathname; } catch { return ""; } })(),
              complete: image.complete,
              naturalWidth: image.naturalWidth,
              naturalHeight: image.naturalHeight,
            })),
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          };
        });

        assert.equal(await page.locator("html").getAttribute("lang"), entry.locale, "HTML language matches route locale");
        assert.equal(documentState.dir, entry.direction, "HTML direction matches route locale");
        assert.ok(documentState.mainVisible, "a rendered main element is visible");
        assert.ok(["PREVIEW", "SYNTHETIC", "SYNTHETIC_PREVIEW"].includes(documentState.provenance) || documentState.markerVisible, "main carries synthetic preview provenance or the dedicated preview marker is visible");
        assert.ok(documentState.markerVisible, "the dedicated synthetic preview banner is visible");
        assert.ok(documentState.heroVisible && documentState.heroHeadingVisible, "the hero section and heading are rendered");
        assert.ok(documentState.roomsVisible, "the rooms section is rendered");
        assert.equal(documentState.conceptRoomCount, 3, "exactly three concept room cards are visible");
        assert.equal(documentState.publishedRoomCount, 0, "no published room cards appear in the synthetic preview");
        assert.ok(documentState.noindex, "a robots meta tag includes noindex");
        assert.ok(documentState.scrollWidth <= documentState.clientWidth, `no horizontal overflow (${documentState.scrollWidth} <= ${documentState.clientWidth})`);
        assert.ok(documentState.images.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0), "all rendered images have non-zero natural dimensions");
        pageResult.checks.document = {
          lang: documentState.lang,
          dir: documentState.dir,
          provenance: documentState.provenance,
          visibleSyntheticMarker: documentState.markerVisible,
          main: documentState.mainVisible,
          hero: documentState.heroVisible && documentState.heroHeadingVisible,
          rooms: documentState.roomsVisible,
          conceptRoomCards: documentState.conceptRoomCount,
          publishedRoomCards: documentState.publishedRoomCount,
          noindex: documentState.noindex,
          horizontalOverflow: false,
          images: documentState.images.length,
        };

        if (viewport.name === "mobile") {
          const menu = page.getByRole("button", { name: entry.menuOpen, exact: true });
          if (await menu.count()) {
            await menu.click();
            const nav = page.locator("nav#published-hotel-navigation");
            const firstLink = nav.locator("a").first();
            await firstLink.waitFor({ state: "visible" });
            assert.equal(await firstLink.evaluate((element) => document.activeElement === element), true, "opening mobile navigation focuses its first link");
            await page.keyboard.press("Escape");
            assert.equal(await menu.getAttribute("aria-expanded"), "false", "Escape closes mobile navigation");
            assert.equal(await menu.evaluate((element) => document.activeElement === element), true, "Escape restores focus to the menu button");
            pageResult.checks.mobileMenu = "PASS";
          } else assert.fail("localized mobile navigation trigger is required");
        }

        const dateTrigger = page.getByRole("button", { name: entry.checkIn, exact: true });
        assert.equal(await dateTrigger.count(), 1, `localized date selector exists for ${entry.locale}`);
        await dateTrigger.click();
        await page.getByTestId("jalali-calendar-dialog").waitFor({ state: "visible" });
        await page.getByRole("button", { name: entry.calendarClose, exact: true }).click();
        await page.getByTestId("jalali-calendar-dialog").waitFor({ state: "detached" });
        assert.equal(await dateTrigger.evaluate((element) => document.activeElement === element), true, "closing the readonly date preview restores focus to its trigger");
        pageResult.checks.datePicker = "PASS";

        const guestTrigger = page.getByRole("button", { name: entry.guests, exact: true });
        assert.equal(await guestTrigger.count(), 1, `localized guest selector exists for ${entry.locale}`);
        await guestTrigger.click();
        const increment = page.getByRole("button", { name: entry.adultIncrement, exact: true });
        await increment.waitFor({ state: "visible" });
        const before = (await page.locator(`output[aria-label="${entry.adultCount}"]`).innerText()).trim();
        await increment.click();
        const after = (await page.locator(`output[aria-label="${entry.adultCount}"]`).innerText()).trim();
        assert.notEqual(after, before, "guest selector updates the adult count");
        await page.getByRole("button", { name: entry.guestDone, exact: true }).click();
        pageResult.checks.guestSelector = "PASS";

        assert.equal(pageRequests.some((request) => request.external || request.api), false, "the self-contained preview makes no external or API requests");
        assert.equal(pageResult.errors.length, 0, "browser has no failed requests or page errors");
        await page.screenshot({ path: path.join(artifactDirectory, pageResult.screenshot), fullPage: true });
        pageResult.status = "PASS";
      } catch (error) {
        pageResult.status = "FAIL";
        pageResult.errors.push(error instanceof Error ? error.message : String(error));
        status = status === "BLOCKED" ? status : "FAILED";
      } finally {
        await context.close();
        results.push(pageResult);
      }
    }
  }
} catch (error) {
  status = "FAILED";
  fatalError = error instanceof Error ? error.message : String(error);
} finally {
  await browser?.close().catch(() => {});
}

if (unexpectedCalls.length > 0 && status !== "BLOCKED") status = "FAILED";
if (browserErrors.length > 0 && status !== "BLOCKED") status = "FAILED";
const exitCode = status === "PASSED" ? 0 : status === "BLOCKED" ? 2 : 1;
const result = {
  status,
  exitCode,
  environment: "SYNTHETIC_OWNER_PREVIEW",
  baseUrl: baseUrl.origin,
  artifactDirectory,
  expectedPages: 6,
  completedPages: results.length,
  results,
  unexpectedCalls,
  browserErrors,
  ...(fatalError ? { fatalError } : {}),
  finishedAt: new Date().toISOString(),
};
await writeFile(path.join(artifactDirectory, "result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status, exitCode, completedPages: results.length, artifactDirectory, resultFile: path.join(artifactDirectory, "result.json") }, null, 2));
process.exitCode = exitCode;
