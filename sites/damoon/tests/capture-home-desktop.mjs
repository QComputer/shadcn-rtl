import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = resolve(process.argv[2]);
const portServer = createServer();
await new Promise((resolveListen, reject) => portServer.once("error", reject).listen(0, "127.0.0.1", resolveListen));
const { port } = portServer.address();
await new Promise((resolveClose, reject) => portServer.close(error => error ? reject(error) : resolveClose()));
const child = spawn(process.execPath, ["server.mjs"], {
  cwd: root, env: { ...process.env, PORT: String(port) }, windowsHide: true, stdio: "ignore",
});
let browser;
try {
  const url = `http://127.0.0.1:${port}/`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch { /* wait for server startup */ }
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
  if (!ready) throw new Error("Damoon local server did not become ready");
  browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const findings = [];
  for (const locale of ["fa", "en", "ar"]) {
    for (const width of [390, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${new URL(url).origin}${locale === "fa" ? "/" : `/${locale}/`}`, { waitUntil: "networkidle" });
      for (const palette of ["hermes", "forest", "wood"]) for (const theme of ["light", "dark"]) {
        await page.evaluate(({ theme, palette }) => { document.documentElement.dataset.theme = theme; document.documentElement.dataset.palette = palette; }, { theme, palette });
        const state = await page.evaluate(() => {
          const box = selector => {
            const element = document.querySelector(selector);
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, display: style.display };
          };
          const hero = box(".home-top .page-hero--home");
          const booking = box(".home-top [data-booking-slot]");
          const nav = box(".site-header .site-nav");
          const toggle = box(".site-header .menu-toggle");
          const image = document.querySelector(".home-top .page-hero__visual img");
          return {
            locale: document.documentElement.lang, direction: document.documentElement.dir,
            viewportWidth: innerWidth, scrollWidth: document.documentElement.scrollWidth,
            hero, booking, nav, toggle,
            heading: box(".home-top h1"), imageVisible: image && getComputedStyle(image).opacity === "1",
            bookingAfterHero: hero && booking && booking.y >= hero.y + hero.height - 1,
            menuExclusive: (nav?.display !== "none") !== (toggle?.display !== "none"),
          };
        });
        findings.push({ ...state, expectedLocale: locale, palette, theme });
      }
      if (locale === "fa" && width === 390) {
        const menu = page.locator("[data-menu-toggle]");
        await menu.focus();
        await page.keyboard.press("Enter");
        if (await menu.getAttribute("aria-expanded") !== "true" || !(await page.locator("#mobile-menu").isVisible())) throw new Error("Keyboard could not open the mobile navigation");
        await page.keyboard.press("Escape");
        if (await menu.getAttribute("aria-expanded") !== "false" || !(await menu.evaluate(element => element === document.activeElement))) throw new Error("Escape did not close the mobile navigation and restore focus");
        const accommodationLink = page.locator(".page-hero__actions a").first();
        if (!new URL(await accommodationLink.getAttribute("href"), url).pathname.endsWith("/rooms")) throw new Error("Homepage accommodation CTA does not navigate to rooms");
      }
      if (locale === "fa" && width === 1440) await page.screenshot({ path: output, type: "jpeg", quality: 82, fullPage: false });
    }
  }
  const invalid = findings.filter(item => item.locale !== item.expectedLocale || item.direction !== (item.expectedLocale === "en" ? "ltr" : "rtl") || item.scrollWidth > item.viewportWidth || !item.hero || !item.booking || !item.imageVisible || !item.bookingAfterHero || !item.menuExclusive);
  if (invalid.length) throw new Error(`Responsive layout checks failed: ${JSON.stringify(invalid)}`);
  process.stdout.write(JSON.stringify({ url, output, cases: findings.length, locales: [...new Set(findings.map(item => item.locale))], widths: [...new Set(findings.map(item => item.viewportWidth))], palettes: [...new Set(findings.map(item => item.palette))], themes: [...new Set(findings.map(item => item.theme))], checks: "direction, overflow, hero visibility, booking flow, nav exclusivity" }) + "\n");
} finally {
  await browser?.close();
  child.kill();
}
