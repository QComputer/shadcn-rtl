import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
const installed = new Map();

function targetConnection(cdp, sessionId) {
  let nextId = 0;
  return {
    async send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const finish = (error, result) => { clearTimeout(timer); cdp.off("Target.receivedMessageFromTarget", receive); if (error) reject(error); else resolve(result); };
        const receive = (event) => {
          if (event.sessionId !== sessionId) return;
          const message = JSON.parse(event.message);
          if (message.id === id) finish(message.error ? new Error(message.error.message) : null, message.result);
        };
        const timer = setTimeout(() => finish(new Error(`Native target command timed out: ${method}`)), 15000);
        cdp.on("Target.receivedMessageFromTarget", receive);
        void cdp.send("Target.sendMessageToTarget", { sessionId, message: JSON.stringify({ id, method, params }) }).catch(error => finish(error));
      });
    },
    close: () => cdp.send("Target.detachFromTarget", { sessionId }),
  };
}

// These commands install and launch an actual browser-managed application.
// No synthetic beforeinstallprompt or --app tab is accepted as installation.
export async function verifyNativeInstall({ browser, origin, manifest, startPath, artifactDir, label }) {
  const cdp = await browser.newBrowserCDPSession();
  const manifestId = new URL(manifest.id, origin).href;
  const startUrl = new URL(startPath ?? manifest.start_url, origin).href;
  const evidence = { label, manifestId, startUrl, status: "NOT_VERIFIED", android: "NOT_TESTED" };
  let target;
  try {
    evidence.browser = (await cdp.send("Browser.getVersion")).product;
    // Install from a real visited storefront in the persistent profile.
    // Earlier worker tests use isolated contexts and do not seed this profile.
    const installPage = await browser.contexts()[0].newPage();
    await installPage.bringToFront();
    await installPage.addInitScript(() => {
      window.__pwaDiagnostics = [];
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        if (String(args[0]).includes("manifest")) {
          const data = await response.clone().json().catch(() => null);
          window.__pwaDiagnostics.push({ kind: "manifest-fetch", status: response.status, display: data?.display, name: data?.name, icons: data?.icons?.length });
        }
        return response;
      };
      const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
      navigator.serviceWorker.register = async (...args) => {
        window.__pwaDiagnostics.push({ kind: "register" });
        try { const result = await originalRegister(...args); window.__pwaDiagnostics.push({ kind: "registered", scope: result.scope }); return result; }
        catch (error) { window.__pwaDiagnostics.push({ kind: "register-error", name: error.name, message: error.message }); throw error; }
      };
    });
    const pageErrors = [];
    const workerDiagnostics = [];
    const workerCdp = await installPage.context().newCDPSession(installPage);
    workerCdp.on("ServiceWorker.workerErrorReported", event => workerDiagnostics.push(event.errorMessage));
    await workerCdp.send("ServiceWorker.enable");
    installPage.on("pageerror", error => pageErrors.push(String(error.message).slice(0,300)));
    try {
      await installPage.goto(startUrl, { waitUntil: "domcontentloaded" });
      const pageManifest = await installPage.evaluate(async () => {
        const link = document.querySelector('link[rel="manifest"]');
        if (!link) return null;
        const response = await fetch(link.href, { cache: "no-store", credentials: "same-origin" });
        return { href: link.href, status: response.status, manifest: await response.json().catch(() => null) };
      });
      assert.equal(pageManifest?.status, 200, "the installed storefront must advertise a working manifest");
      assert.equal(pageManifest.manifest?.name, manifest.name, "the actual page manifest must match the tenant identity");
      assert.equal(pageManifest.manifest?.short_name, manifest.short_name);
      assert.equal(new URL(pageManifest.manifest?.id, origin).href, manifestId);
      assert.equal(pageManifest.manifest?.start_url, manifest.start_url);
      assert.equal(pageManifest.manifest?.scope, manifest.scope);
      assert.deepEqual(pageManifest.manifest?.icons?.map(({ src, sizes, purpose }) => ({ src, sizes, purpose })), manifest.icons.map(({ src, sizes, purpose }) => ({ src, sizes, purpose })));
      evidence.pageManifest = { href: pageManifest.href, status: pageManifest.status, name: pageManifest.manifest.name, short_name: pageManifest.manifest.short_name, id: pageManifest.manifest.id, start_url: pageManifest.manifest.start_url, scope: pageManifest.manifest.scope, icons: pageManifest.manifest.icons };
      await installPage.waitForFunction(async () => Boolean((await navigator.serviceWorker.ready).active), undefined, { polling: 250 });
      await installPage.goto(startUrl, { waitUntil: "domcontentloaded" });
      await installPage.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
      evidence.installationPageWorker = "ACTIVE_AND_CONTROLLING";
      await cdp.send("PWA.install", { manifestId, installUrlOrBundleUrl: startUrl });
    } finally {
      evidence.installPageDiagnostics = await installPage.evaluate(async () => ({url:location.href,secure:isSecureContext,ready:document.readyState,manifest:document.querySelector('link[rel="manifest"]')?.href,registrations:await navigator.serviceWorker.getRegistrations().then(rows=>rows.map(row=>row.scope)), scripts:[...document.scripts].filter(s=>s.src).length, events:window.__pwaDiagnostics, enabled:document.documentElement.innerHTML.match(/\\"enabled\\":(true|false)/g)?.slice(-5)})).catch(() => null);
      evidence.pageErrors=pageErrors;
      evidence.workerErrors=workerDiagnostics;
      await workerCdp.detach();
      await installPage.close();
    }
    installed.set(manifestId, cdp);
    evidence.installCommand = "SUCCEEDED";
    evidence.osAppState = await cdp.send("PWA.getOsAppState", { manifestId });
    await cdp.send("PWA.changeAppUserSettings", { manifestId, displayMode: "standalone" });
    evidence.userDisplayMode = "standalone";
    const nativeFailures = [];
    const watchNativePage = page => {
      page.on("pageerror", error => nativeFailures.push({kind:"pageerror",message:String(error.message).slice(0,300)}));
      page.on("requestfailed", request => nativeFailures.push({kind:"requestfailed",url:request.url(),reason:request.failure()?.errorText}));
    };
    browser.contexts()[0].on("page",watchNativePage);
    const launched = await cdp.send("PWA.launch", { manifestId });
    evidence.targetId = launched.targetId;
    // A launch may return a tab target ID while Playwright exposes its child
    // page target. Match an actual standalone window, never an ordinary tab.
    let appPage;
    const expectedLaunchPath = new URL(startUrl).pathname;
    for (let i = 0; i < 40 && !appPage; i++) {
      for (const context of browser.contexts()) for (const page of context.pages()) {
        try {
          const actual = await page.evaluate(() => ({ origin: location.origin, pathname: location.pathname, standalone: matchMedia("(display-mode: standalone)").matches }));
          if (actual.origin === origin && actual.pathname === expectedLaunchPath && actual.standalone) appPage = page;
        } catch { /* A closing or not-yet-loaded target is not evidence. */ }
      }
      if (!appPage) await delay(250);
    }
    if (appPage) {
      await appPage.bringToFront();
      const session = await appPage.context().newCDPSession(appPage);
      target = { send: (method, params) => session.send(method, params), close: () => session.detach() };
    } else {
      const info = await cdp.send("Target.getTargetInfo", { targetId: launched.targetId });
      evidence.launchTarget = { targetId: info.targetInfo.targetId, type: info.targetInfo.type, url: info.targetInfo.url };
      const { targetInfos } = await cdp.send("Target.getTargets");
      evidence.discoveredTargets = targetInfos.filter(info => info.url.startsWith(origin)).map(({ targetId, type, url }) => ({ targetId, type, url }));
      const actual = info.targetInfo.type === "page" ? info.targetInfo : targetInfos.find(info => info.type === "page" && info.url.startsWith(origin));
      assert.ok(actual, "a real launched application page target must exist");
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId: actual.targetId, flatten: false });
      target = targetConnection(cdp, sessionId);
    }
    const state = async () => {
      const result = await target.send("Runtime.evaluate", { expression: "({url:location.href,standalone:matchMedia('(display-mode: standalone)').matches,title:document.title,ready:document.readyState,body:document.body?.innerText || ''})", returnByValue: true });
      return result.result.value;
    };
    let launch;
    for (let i = 0; i < 80; i++) {
      launch = await state();
      if (launch?.ready === "complete" && launch.url.startsWith(origin)) break;
      await delay(250);
    }
    assert.equal(new URL(launch.url).origin, origin);
    assert.equal(new URL(launch.url).pathname, new URL(startUrl).pathname);
    assert.equal(launch.standalone, true, "actual native app target must report standalone mode");
    evidence.launch = { url: launch.url, title: launch.title, standalone: launch.standalone };
    evidence.nativeFailures = nativeFailures;
    if (appPage) await appPage.locator('main[data-retail-display-mode="standalone"]').waitFor({state:"visible",timeout:15000});
    assert.doesNotMatch((await state()).body,/Loading chunk .* failed|خطایی رخ داد/);
    const processed = await target.send("Page.getAppManifest", { manifestId });
    const identity = processed.data ? JSON.parse(processed.data) : processed.manifest;
    assert.equal(identity.name, manifest.name);
    evidence.processedManifest = { url: processed.url, name: identity.name, id: identity.id, scope: identity.scope, start_url: identity.start_url, short_name: identity.short_name, icons: identity.icons };
    const screenshot = await target.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${artifactDir}/native-${label}.png`, Buffer.from(screenshot.data, "base64"));
    const deepLink = new URL(`${new URL(startUrl).pathname}/profile`, origin).href;
    await target.send("Page.navigate", { url: deepLink });
    let deep;
    for (let i = 0; i < 80; i++) {
      deep = await state();
      if (deep?.ready === "complete" && new URL(deep.url).pathname.endsWith("/profile")) break;
      await delay(250);
    }
    assert.equal(new URL(deep.url).origin, origin);
    assert.ok(new URL(deep.url).pathname.endsWith("/profile"));
    assert.equal(deep.standalone, true);
    evidence.deepLink = { url: deep.url, title: deep.title, standalone: deep.standalone };
    if (appPage) {
      // The private account route need not advertise an installable manifest.
      // Return to the installed start URL and wait for its real worker.
      await appPage.goto(startUrl, { waitUntil: "domcontentloaded" });
      evidence.workerBefore = await appPage.evaluate(async () => ({ secure: isSecureContext, url: location.href, manifest: document.querySelector('link[rel="manifest"]')?.href, registrations: await navigator.serviceWorker.getRegistrations().then(entries => entries.map(entry => ({scope:entry.scope,active:Boolean(entry.active)}))) }));
      await appPage.waitForFunction(async () => Boolean((await navigator.serviceWorker.ready).active));
      if (!await appPage.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
        await appPage.reload({ waitUntil: "domcontentloaded" });
        await appPage.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
      }
      await appPage.context().setOffline(true);
      try {
        await appPage.reload({ waitUntil: "domcontentloaded" });
        assert.match(await appPage.locator("body").innerText(), /اتصال (?:به )?اینترنت برقرار نیست/);
        await appPage.screenshot({ path: `${artifactDir}/native-${label}-offline.png` });
      } finally { await appPage.context().setOffline(false); }
      await appPage.goto(startUrl, { waitUntil: "domcontentloaded" });
      await appPage.getByText(manifest.name, { exact: false }).first().waitFor();
      assert.equal(await appPage.evaluate(() => matchMedia("(display-mode: standalone)").matches), true);
      await appPage.locator('main[data-retail-display-mode="standalone"]').waitFor({state:"visible",timeout:15000});
      assert.doesNotMatch(await appPage.locator("body").innerText(), /Loading chunk .* failed|خطایی رخ داد/);
      evidence.offlineReconnect = "PASSED";
    } else evidence.offlineReconnect = "NOT_VERIFIED_TARGET_NOT_EXPOSED_AS_PAGE";
    evidence.coexistingManifestIds = [...installed.keys()];
    evidence.status = "INSTALLED_AND_LAUNCHED_STANDALONE";
  } catch (error) {
    evidence.reason = String(error.message).slice(0, 600);
    const unavailable = /(?:wasn.t found|not supported|not available|headless|web app provider|unsupported|requires.*default.*context)/i.test(evidence.reason);
    evidence.status = unavailable ? "INSTALL_MECHANISM_UNAVAILABLE" : evidence.installCommand ? "APPLICATION_ASSERTION_FAILED" : "INSTALL_FAILED";
  } finally {
    await target?.close().catch(() => {});
    if (!installed.has(manifestId)) await cdp.detach();
  }
  return evidence;
}

export async function cleanupNativeInstalls() {
  const evidence = [];
  for (const [manifestId, cdp] of installed) {
    try { await cdp.send("PWA.uninstall", { manifestId }); evidence.push({ manifestId, cleanup: "PASSED" }); }
    catch (error) { evidence.push({ manifestId, cleanup: "FAILED", reason: String(error.message).slice(0, 300) }); }
    finally { await cdp.detach().catch(() => {}); }
  }
  installed.clear();
  return evidence;
}
