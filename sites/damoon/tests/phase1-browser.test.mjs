import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";

const siteRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sharedPublicRoot = resolve(siteRoot, "../../public");
const node24 = "C:/Users/disso/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe";

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function waitReady(url, child) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error(`Damoon server exited early (${child.exitCode}).`);
    try { if ((await fetch(url)).ok) return; } catch { /* Server is starting. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Damoon local server did not become ready.");
}

async function startSharedBundleServer() {
  const contentTypes = {
    ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".png": "image/png", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".webp": "image/webp",
  };
  const server = createHttpServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { allow: "GET, HEAD" }); response.end(); return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
    catch { response.writeHead(400); response.end(); return; }
    if (pathname === "/healthz") { response.writeHead(200); response.end("ok"); return; }
    let file;
    if (pathname === "/damoon-front" || pathname === "/damoon-front/") {
      file = resolve(sharedPublicRoot, "damoon-front/index.html");
    } else if (pathname.startsWith("/damoon-front/")) {
      file = resolve(sharedPublicRoot, `.${pathname}`);
      const bundleRoot = resolve(sharedPublicRoot, "damoon-front");
      if (!file.startsWith(bundleRoot + sep)) { response.writeHead(404); response.end(); return; }
    } else if (!extname(pathname)) {
      file = resolve(sharedPublicRoot, "damoon-front/index.html");
    } else {
      response.writeHead(404); response.end(); return;
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, {
        "content-type": contentTypes[extname(file).toLowerCase()] || "application/octet-stream",
        "cache-control": "no-store", "x-content-type-options": "nosniff",
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise((resolveListen, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolveListen));
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose())),
  };
}

const locales = [
  { code: "fa", dir: "rtl" },
  { code: "en", dir: "ltr" },
  { code: "ar", dir: "rtl" },
];
const paths = [
  "/", "/rooms", "/restaurant", "/cafe", "/facilities", "/gallery", "/about", "/contact", "/policies",
  "/rooms/single", "/rooms/double", "/rooms/suite-3-bed", "/rooms/suite-4-5-bed",
];
function localizedPath(locale, path) {
  return locale === "fa" ? path : `/${locale}${path === "/" ? "/" : path}`;
}

test("Damoon Phase 1 pages, language switching, responsive layout and date-to-contact planning", { timeout: 360000 }, async t => {
  const executablePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
  if (!existsSync(executablePath)) {
    t.skip("Installed Chrome is unavailable; this acceptance requires the existing browser runtime.");
    return;
  }

  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(existsSync(node24) ? node24 : process.execPath, [join(siteRoot, "server.mjs")], {
    cwd: siteRoot, env: { ...process.env, PORT: String(port) }, windowsHide: true, stdio: "ignore",
  });
  let browser;
  let sharedServer;
  try {
    await waitReady(`${base}/healthz`, child);
    sharedServer = await startSharedBundleServer();
    browser = await chromium.launch({ headless: true, executablePath, args: ["--disable-features=HttpsFirstBalancedModeAutoEnable,HttpsUpgrades"] });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors = [];
    const failedLocalAssets = [];
    let activeRuntimeOrigin = new URL(base).origin;
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("response", response => {
      const url = new URL(response.url());
      if (url.origin === activeRuntimeOrigin && /\.(?:css|js|svg|webp|png|woff2?|ttf)$/i.test(url.pathname) && response.status() >= 400) {
        failedLocalAssets.push(`${response.status()} ${url.pathname}`);
      }
    });

    const runtimes = [
      { name: "standalone source", base },
      { name: "shared public bundle", base: sharedServer.base },
    ];
    for (const runtime of runtimes) {
      activeRuntimeOrigin = new URL(runtime.base).origin;

    // Visit every contracted page in every language at a narrow viewport. This
    // checks real rendered content and page-level overflow, including long room titles.
    for (const locale of locales) {
      for (const path of paths) {
        const url = localizedPath(locale.code, path);
        await page.goto(`${runtime.base}${url}`, { waitUntil: "networkidle" });
        await page.locator("main#main").waitFor({ state: "visible" });
        assert.equal(await page.locator("html").getAttribute("lang"), locale.code, `${url} language`);
        assert.equal(await page.locator("html").getAttribute("dir"), locale.dir, `${url} direction`);
        const mainText = (await page.locator("main#main").innerText()).trim();
        assert.ok(mainText.length > 20, `${url} has visible localized main content`);
        if (path === "/contact") {
          const approvalNotice = page.locator('[data-contact-approval="pending"]');
          await approvalNotice.waitFor({ state: "visible" });
          assert.ok((await approvalNotice.innerText()).trim().length > 10, `${url} explains pending management confirmation`);
        }
        const normalizedDigits = mainText.replace(/[۰-۹٠-٩]/g, digit => "۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩".indexOf(digit) % 10);
        assert.doesNotMatch(normalizedDigits, /\b24[- ]?hour(?:s)?\b|\bfree(?:\s+buffet)?\s+breakfast\b|(?:\b(?:12|14):00\b|٢٤\s*ساعة|۲۴\s*ساعت|إفطار\s*(?:مجاني|مجانًا)|صبحانه\s+رایگان)/i, `${url} avoids unconfirmed service guarantees and fixed times`);
        const overflow = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(overflow.scroll <= overflow.width + 1, `${url} mobile horizontal overflow: ${JSON.stringify(overflow)}`);
      }
    }
    // Check representative contracted pages at a desktop viewport in every
    // locale as well. The complete interactive journey below remains covered
    // on mobile, where the responsive navigation path is exercised.
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const locale of locales) {
      for (const path of ["/", "/rooms", "/contact", "/rooms/single", "/gallery"]) {
        const url = localizedPath(locale.code, path);
        await page.goto(`${runtime.base}${url}`, { waitUntil: "networkidle" });
        await page.locator("main#main").waitFor({ state: "visible" });
        assert.equal(await page.locator("html").getAttribute("lang"), locale.code, `${url} desktop language`);
        assert.equal(await page.locator("html").getAttribute("dir"), locale.dir, `${url} desktop direction`);
        assert.ok((await page.locator("main#main").innerText()).trim().length > 20, `${url} desktop content`);
        const overflow = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(overflow.scroll <= overflow.width + 1, `${url} desktop horizontal overflow: ${JSON.stringify(overflow)}`);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    assert.deepEqual(pageErrors, [], "localized routes do not throw browser-side exceptions");
    assert.deepEqual(failedLocalAssets, [], "localized routes load all requested local assets");

    await page.goto(`${runtime.base}/en/gallery`, { waitUntil: "networkidle" });
    await page.locator("[data-gallery-index]").first().click();
    const galleryDialog = page.locator('[role="dialog"][aria-modal="true"]');
    await galleryDialog.waitFor({ state: "visible" });
    await page.locator("[data-dialog-next]").click();
    assert.match(await page.locator(".gallery-dialog__count").innerText(), /2/);
    await page.locator("[data-dialog-close]").click();
    await galleryDialog.waitFor({ state: "hidden" });
    await page.locator("[data-theme-toggle]").click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark", "theme control changes the rendered theme");
    await page.locator("[data-theme-toggle]").click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "light", "theme control can restore the light theme");

    // Language links must preserve both the concrete subroute and navigation state.
    await page.goto(`${runtime.base}/en/rooms/single?phase=1&check=route#contact`, { waitUntil: "networkidle" });
    await page.locator("[data-adult-count]").selectOption("4");
    await page.locator("[data-child-count]").selectOption("2");
    await page.locator('[data-child-age="0"]').fill("8");
    await page.locator(".language-switcher summary").click();
    await page.locator('.language-switcher a[hreflang="ar"]').click();
    await page.waitForURL(url => url.pathname === "/ar/rooms/single" && url.searchParams.get("phase") === "1" && url.searchParams.get("check") === "route" && url.hash === "#contact");
    assert.equal(await page.locator("html").getAttribute("lang"), "ar");
    const switchedUrl = new URL(page.url());
    assert.equal(switchedUrl.searchParams.get("adults"), "4", "language switch carries current adult choice, not stale URL state");
    assert.equal(switchedUrl.searchParams.get("guests"), "4");
    assert.equal(switchedUrl.searchParams.get("children"), "2");
    assert.equal(switchedUrl.searchParams.get("childAges"), "8,", "language switch carries latest partial age entry");

    const partialContactHref = await page.locator(".accommodation-coordination__actions .accommodation-link").getAttribute("href");
    const partialContactUrl = new URL(partialContactHref, runtime.base);
    assert.equal(partialContactUrl.pathname, "/ar/contact");
    assert.equal(partialContactUrl.searchParams.get("room"), "single", "contact link preserves the selected room");
    assert.equal(partialContactUrl.searchParams.get("adults"), "4");
    assert.equal(partialContactUrl.searchParams.get("children"), "2");
    assert.equal(partialContactUrl.searchParams.get("childAges"), "8,");
    const partialContactContext = await browser.newContext();
    try {
      const partialContactPage = await partialContactContext.newPage();
      await partialContactPage.goto(partialContactUrl.href, { waitUntil: "networkidle" });
      const partialSummary = partialContactPage.locator(".hospitality-stay-context");
      await partialSummary.waitFor({ state: "visible" });
      const partialSummaryText = await partialSummary.innerText();
      assert.match(partialSummaryText, /غير محدد/, `${runtime.name}: contact summary identifies the unknown age`);
      const editPlanUrl = new URL(await partialSummary.locator(".hospitality-text-link").getAttribute("href"), runtime.base);
      assert.equal(editPlanUrl.pathname, "/ar/rooms/single", `${runtime.name}: edit plan returns to the selected room`);
      assert.equal(editPlanUrl.searchParams.get("childAges"), "8,");
    } finally {
      await partialContactContext.close();
    }

    // Use the visible calendar and occupancy controls. An incomplete range must
    // be rejected while retaining the selected arrival; complete dates plus
    // invalid child ages must retain all entered choices and stay local.
    await page.goto(`${runtime.base}/en/`, { waitUntil: "networkidle" });
    const apiRequests = [];
    page.on("request", request => { if (/\/api\/hotel\//.test(request.url())) apiRequests.push(request.url()); });
    const tomorrow = await page.evaluate(() => {
      const date = new Date(); date.setDate(date.getDate() + 1);
      const pad = value => String(value).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    });
    await page.locator('[data-date-field="checkIn"]').click();
    let monthMoves = 0;
    while (!(await page.locator(`[data-calendar-day="${tomorrow}"]`).count()) && monthMoves++ < 3) {
      await page.locator("[data-month-next]").click();
    }
    const arrival = page.locator(`[data-calendar-day="${tomorrow}"]`);
    await arrival.waitFor({ state: "visible" });
    await arrival.click();
    assert.match(await page.locator('[data-date-value="checkIn"]').innerText(), /\S/);
    await page.locator("[data-calendar-close]").click();
    await page.locator(".booking-form .booking-submit[type=submit]").click();
    assert.ok(await page.locator("#booking-calendar").evaluate(dialog => dialog.open), "missing departure opens calendar for correction");
    assert.match(await page.locator('[data-date-value="checkIn"]').innerText(), /\S/, "arrival stays selected after incomplete-range rejection");
    await page.locator("[data-calendar-close]").click();

    // Pick a return date a few days after arrival, navigating the calendar if
    // the target crosses a month boundary.
    const departure = await page.evaluate(() => {
      const date = new Date(); date.setDate(date.getDate() + 4);
      const pad = value => String(value).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    });
    await page.locator('[data-date-field="checkOut"]').click();
    monthMoves = 0;
    while (!(await page.locator(`[data-calendar-day="${departure}"]`).count()) && monthMoves++ < 3) {
      await page.locator("[data-month-next]").click();
    }
    await page.locator(`[data-calendar-day="${departure}"]`).click();
    await page.locator("[data-adult-count]").selectOption("3");
    await page.locator("[data-child-count]").selectOption("2");
    await page.locator('[data-child-age="0"]').fill("7");
    await page.locator('[data-child-age="1"]').fill("");
    await page.locator(".booking-form .booking-submit[type=submit]").click();
    assert.match(await page.locator(".booking-message").innerText(), /age|each child/i, `${runtime.name}: incomplete child ages are explained in English`);
    assert.equal(await page.locator("[data-adult-count]").inputValue(), "3");
    assert.equal(await page.locator("[data-child-count]").inputValue(), "2");
    assert.equal(await page.locator('[data-child-age="0"]').inputValue(), "7");
    assert.equal(await page.locator('[data-child-age="1"]').inputValue(), "");
    assert.deepEqual(apiRequests, [], "date and guest planning must not call booking APIs");

    // Complete the age entry and continue through the actual room/contact links.
    await page.locator('[data-child-age="1"]').fill("12");
    await page.locator("[data-menu-toggle]").click();
    assert.equal(await page.locator("[data-menu-toggle]").getAttribute("aria-expanded"), "true", "mobile navigation opens");
    await page.locator('#mobile-menu a[href^="/en/rooms"]').click();
    await page.waitForURL(url => url.pathname === "/en/rooms");
    const roomLink = page.locator('.accommodation-page a[href^="/en/rooms/"]').first();
    await roomLink.waitFor({ state: "visible" });
    const roomHref = await roomLink.getAttribute("href");
    const roomUrl = new URL(roomHref, runtime.base);
    assert.equal(roomUrl.searchParams.get("checkIn"), tomorrow);
    assert.equal(roomUrl.searchParams.get("checkOut"), departure);
    assert.equal(roomUrl.searchParams.get("guests"), "3");
    assert.equal(roomUrl.searchParams.get("children"), "2");
    assert.equal(roomUrl.searchParams.get("childAges"), "7,12");
    await page.goto(roomUrl.href, { waitUntil: "networkidle" });
    assert.equal(await page.locator("[data-adult-count]").inputValue(), "3", "room page rehydrates adult count");
    assert.equal(await page.locator("[data-child-count]").inputValue(), "2", "room page rehydrates child count");
    assert.equal(await page.locator('[data-child-age="0"]').inputValue(), "7", "room page rehydrates first child age");
    assert.equal(await page.locator('[data-child-age="1"]').inputValue(), "12", "room page rehydrates second child age");
    await page.locator(".booking-form .booking-submit[type=submit]").click();
    await page.waitForURL(/\/en\/contact\?/);
    const contactUrl = new URL(page.url());
    assert.equal(contactUrl.pathname, "/en/contact");
    assert.equal(contactUrl.searchParams.get("checkIn"), tomorrow);
    assert.equal(contactUrl.searchParams.get("checkOut"), departure);
    assert.equal(contactUrl.searchParams.get("adults"), "3");
    assert.equal(contactUrl.searchParams.get("children"), "2");
    assert.equal(contactUrl.searchParams.get("childAges"), "7,12");
    assert.equal(contactUrl.searchParams.get("room"), roomUrl.pathname.split("/").at(-1));

    const freshContext = await browser.newContext();
    try {
      const freshPage = await freshContext.newPage();
      await freshPage.goto(contactUrl.href, { waitUntil: "networkidle" });
      assert.equal(await freshPage.evaluate(() => sessionStorage.length), 0, "fresh contact context has no carried session state");
      const summary = freshPage.locator(".hospitality-stay-context");
      await summary.waitFor({ state: "visible" });
      const summaryText = await summary.innerText();
      assert.match(summaryText, /3 adults/i);
      assert.match(summaryText, /2 children/i);
      assert.match(summaryText, /Child ages: 7, 12/i);
      assert.match(summaryText, /not a confirmed reservation/i, "contact summary describes coordination, not a confirmed booking");

      const invalidRangePage = await freshContext.newPage();
      await invalidRangePage.goto(`${runtime.base}/en/rooms/single?checkIn=2020-01-02&checkOut=2020-01-01&adults=3&children=2&childAges=7%2C12`, { waitUntil: "networkidle" });
      assert.equal(await invalidRangePage.locator('[data-date-value="checkIn"]').innerText(), "Select date", "reversed stale date range is rejected");
      assert.equal(await invalidRangePage.locator('[data-date-value="checkOut"]').innerText(), "Select date");
      assert.equal(await invalidRangePage.locator("[data-adult-count]").inputValue(), "3", "guest selections survive invalid dates");
      assert.equal(await invalidRangePage.locator("[data-child-count]").inputValue(), "2");
      assert.equal(await invalidRangePage.locator('[data-child-age="0"]').inputValue(), "7");
      await invalidRangePage.locator(".booking-form .booking-submit[type=submit]").click();
      assert.ok(await invalidRangePage.locator("#booking-calendar").evaluate(dialog => dialog.open), "invalid date range is rejected locally");
      assert.deepEqual(apiRequests, [], "invalid range cannot initiate booking API traffic");
      assert.deepEqual(apiRequests, [], "room/contact planning stays independent of booking providers");
    } finally {
      await freshContext.close();
    }

    // Run the complete localized room-selection journey from the rooms list
    // through visible date and occupancy controls to contact-summary copy.
    for (const locale of ["fa", "en", "ar"]) for (const viewport of [
      { width: 390, height: 844 }, { width: 1440, height: 1000 },
    ]) {
      const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"], viewport });
      try {
        const localizedPage = await context.newPage();
        const localizedApiRequests = [];
        localizedPage.on("request", request => { if (/\/api\/hotel\//.test(request.url())) localizedApiRequests.push(request.url()); });
        await localizedPage.goto(`${runtime.base}${localizedPath(locale, "/rooms")}`, { waitUntil: "networkidle" });
        const localizedRoomLink = localizedPage.locator('.accommodation-page a[href*="/rooms/"]').first();
        await localizedRoomLink.waitFor({ state: "visible" });
        const localizedRoomUrl = new URL(await localizedRoomLink.getAttribute("href"), runtime.base);
        await localizedPage.goto(localizedRoomUrl.href, { waitUntil: "networkidle" });
        const localizedCheckIn = await localizedPage.evaluate(() => {
          const date = new Date(); date.setDate(date.getDate() + 7);
          const pad = value => String(value).padStart(2, "0");
          return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        });
        const localizedCheckOut = await localizedPage.evaluate(() => {
          const date = new Date(); date.setDate(date.getDate() + 9);
          const pad = value => String(value).padStart(2, "0");
          return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        });
        for (const [field, date] of [["checkIn", localizedCheckIn], ["checkOut", localizedCheckOut]]) {
          const dateValue = localizedPage.locator(`[data-date-value="${field}"]`);
          const previousDateValue = await dateValue.innerText();
          await localizedPage.locator(`[data-date-field="${field}"]`).click();
          let moves = 0;
          while (!(await localizedPage.locator(`[data-calendar-day="${date}"]`).count()) && moves++ < 3) {
            await localizedPage.locator("[data-month-next]").click();
          }
          await localizedPage.locator(`[data-calendar-day="${date}"]`).click();
          await localizedPage.waitForFunction(({ selectedField, previous }) => {
            const element = document.querySelector(`[data-date-value="${selectedField}"]`);
            return element && element.textContent.trim() !== previous.trim();
          }, { selectedField: field, previous: previousDateValue });
          const calendarClose = localizedPage.locator("[data-calendar-close]");
          if (await calendarClose.isVisible()) await calendarClose.click();
        }
        await localizedPage.locator("[data-adult-count]").selectOption("3");
        await localizedPage.locator("[data-child-count]").selectOption("2");
        await localizedPage.locator('[data-child-age="0"]').fill("7");
        await localizedPage.locator('[data-child-age="1"]').fill("12");
        await localizedPage.locator(".booking-form .booking-submit[type=submit]").click();
        const expectedContactPath = localizedPath(locale, "/contact");
        await localizedPage.waitForURL(url => url.pathname === expectedContactPath && url.searchParams.has("room"));
        const localizedContact = new URL(localizedPage.url());
        assert.equal(localizedContact.searchParams.get("checkIn"), localizedCheckIn);
        assert.equal(localizedContact.searchParams.get("checkOut"), localizedCheckOut);
        assert.equal(localizedContact.searchParams.get("adults"), "3");
        assert.equal(localizedContact.searchParams.get("children"), "2");
        assert.equal(localizedContact.searchParams.get("childAges"), "7,12");
        assert.equal(localizedContact.searchParams.get("room"), localizedRoomUrl.pathname.split("/").at(-1));
        assert.equal(await localizedPage.locator("html").getAttribute("lang"), locale);
        assert.equal(await localizedPage.locator("html").getAttribute("dir"), locales.find(item => item.code === locale).dir);
        await localizedPage.locator(".hospitality-stay-context").waitFor({ state: "visible" });
        const localizedSummary = await localizedPage.locator(".hospitality-stay-context").innerText();
        assert.ok(localizedSummary.length > 20, `${locale} contact summary is visible and localized`);
        const noConfirmation = locale === "fa" ? "رزرو قطعی نیست" : locale === "ar" ? "ليس حجزاً مؤكداً" : "not a confirmed reservation";
        assert.ok(localizedSummary.includes(noConfirmation), `${locale} does not claim a confirmed booking`);
        await localizedPage.locator("[data-copy-stay]").click();
        await localizedPage.waitForFunction(() => document.querySelector("[data-copy-status]")?.textContent);
        const localizedCopied = await localizedPage.evaluate(() => navigator.clipboard.readText());
        assert.ok(localizedCopied.length > 40, `${locale} ${viewport.width}px journey can copy its contact summary`);
        const ageSeven = locale === "fa" ? ["۷"] : locale === "ar" ? ["٧", "7"] : ["7"];
        const ageTwelve = locale === "fa" ? ["۱۲"] : locale === "ar" ? ["١٢", "12"] : ["12"];
        assert.ok(ageSeven.some(age => localizedCopied.includes(age)) && ageTwelve.some(age => localizedCopied.includes(age)), `${locale} copied summary retains both localized child ages`);
        assert.ok(localizedCopied.includes(noConfirmation), `${locale} copied summary retains the no-confirmation notice`);
        assert.deepEqual(localizedApiRequests, [], `${locale} coordination does not call booking APIs`);
      } finally {
        await context.close();
      }
    }
    assert.deepEqual(pageErrors, [], `${runtime.name}: browser-side errors are absent throughout acceptance`);
    assert.deepEqual(failedLocalAssets, [], `${runtime.name}: local assets load throughout acceptance`);
    }
  } finally {
    await browser?.close();
    await sharedServer?.close();
    if (child.exitCode === null) {
      const exited = new Promise(resolveExit => child.once("exit", resolveExit));
      child.kill();
      await exited;
    }
  }
});


test("Damoon stay summary copy supports three languages and clipboard fallback in both runtimes", { timeout: 120000 }, async () => {
  const executablePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(existsSync(node24) ? node24 : process.execPath, [join(siteRoot, "server.mjs")], {
    cwd: siteRoot, env: { ...process.env, PORT: String(port) }, windowsHide: true, stdio: "ignore",
  });
  let browser, shared;
  try {
    await waitReady(`${base}/healthz`, child);
    shared = await startSharedBundleServer();
    browser = await chromium.launch({ headless: true, executablePath });
    const checkIn = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const checkOut = new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10);
    for (const origin of [base, shared.base]) for (const { code, dir } of locales) for (const viewport of [
      { width: 390, height: 844 }, { width: 1440, height: 1000 },
    ]) {
      const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"], viewport });
      const page = await context.newPage();
      const requests = [], errors = [];
      page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
      page.on("pageerror", error => errors.push(error.message));
      const target = `${origin}${localizedPath(code, "/contact")}?checkIn=${checkIn}&checkOut=${checkOut}&adults=3&guests=3&children=2&childAges=7,&room=double&ref=copy#stay`;
      await page.goto(target);
      const summary = page.locator(".hospitality-stay-context");
      await summary.locator("[data-copy-stay]").click();
      await page.waitForFunction(() => document.querySelector("[data-copy-status]")?.textContent);
      const copied = (await page.evaluate(() => navigator.clipboard.readText())).replaceAll("\r\n", "\n");
      assert.ok(copied.length > 40);
      assert.ok(copied.includes(code === "fa" ? "نامشخص" : code === "ar" ? "غير محدد" : "not specified"));
      assert.match(copied, code === "fa" ? /رزرو قطعی نیست/ : code === "ar" ? /ليس حجزاً مؤكداً/ : /not a confirmed reservation/);
      assert.equal(await page.locator("html").getAttribute("dir"), dir);
      assert.equal(await summary.locator("[data-copy-manual-label]").isVisible(), false);
      for (const mode of ["denied", "unavailable"]) {
        await page.evaluate(mode => Object.defineProperty(navigator, "clipboard", { configurable: true, value: mode === "denied" ? { writeText: async () => { throw new DOMException("Denied", "NotAllowedError"); } } : undefined }), mode);
        await summary.locator("[data-copy-stay]").click();
        const manual = summary.locator("[data-copy-manual]");
        await manual.waitFor({ state: "visible" });
        assert.equal(await manual.inputValue(), copied);
        assert.deepEqual(await manual.evaluate(el => [document.activeElement === el, el.selectionStart, el.selectionEnd]), [true, 0, copied.length]);
        assert.equal(page.url(), target, "copy preserves route and stay query/hash");
        assert.ok(await manual.getAttribute("readonly") !== null);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    if (shared) await shared.close();
    if (child.exitCode === null) { const exited = new Promise(resolveExit => child.once("exit", resolveExit)); child.kill(); await exited; }
  }
});
