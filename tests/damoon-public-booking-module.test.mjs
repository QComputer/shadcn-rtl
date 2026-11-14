import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { extname, resolve, sep } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { mountBooking } from "../public/damoon-front/booking.js";
import {
  buildGuestRequestPayload,
  createIdempotencyKey,
  requestAttemptFingerprint,
} from "../public/damoon-front/booking-flow.js";

test("shared Damoon browser module graph loads its guest-request entry points", () => {
  assert.equal(typeof mountBooking, "function");
  assert.equal(typeof buildGuestRequestPayload, "function");
  assert.equal(typeof requestAttemptFingerprint, "function");
});

test("shared guest request payload carries the selected stay without hold or payment claims", () => {
  const stay = {
    property: "damoon-hotel",
    range: { checkIn: "2026-11-20", checkOut: "2026-11-22" },
    adults: 2,
    children: 1,
    childAges: [8],
    option: {
      roomType: { slug: "suite-3-bed" },
      ratePlan: { code: "flexible" },
      totalRate: "5000000",
    },
    contact: { fullName: "Guest Example", phone: "+989123456789", email: "guest@example.test" },
    specialRequests: "  Late arrival  ",
  };

  assert.deepEqual(buildGuestRequestPayload(stay), {
    property: "damoon-hotel",
    roomType: "suite-3-bed",
    ratePlan: "flexible",
    checkIn: "2026-11-20",
    checkOut: "2026-11-22",
    occupancy: { adults: 2, children: 1, childAges: [8] },
    contact: stay.contact,
    specialRequests: "Late arrival",
  });
  assert.equal("acceptedTotalRate" in buildGuestRequestPayload(stay), false);
  assert.equal("payment" in buildGuestRequestPayload(stay), false);
  assert.match(requestAttemptFingerprint(stay), /Late arrival/);
  assert.match(createIdempotencyKey(), /^damoon-[a-f0-9]{64}$/);
});

test("shared-runtime home page opts into guest requests and includes tracking UI styles", async () => {
  const root = new URL("../public/damoon-front/", import.meta.url);
  const [home, app, booking, styles] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("booking.js", root), "utf8"),
    readFile(new URL("booking.css", root), "utf8"),
  ]);

  assert.match(home, /src="\/damoon-front\/app\.js"/);
  assert.match(app, /mountBooking\(bookingSlot, \{ routeHref, locale, coordinationOnly: false, requestOnly: true \}\)/);
  assert.match(booking, /\/api\/hotel\/v1\/requests/);
  assert.match(booking, /data-create-\$\{requestOnly \? "request" : "hold"\}/);
  assert.match(booking, /data-track-request/);
  assert.match(styles, /booking-step--confirmed/);
  assert.match(styles, /booking-field--text textarea/);
});

test("shared-runtime browser loads tracking UI and posts status to the shared API path", { timeout: 30000 }, async () => {
  const bundleRoot = resolve("public/damoon-front");
  const requests = [];
  const mime = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".ttf": "font/ttf", ".webp": "image/webp" };
  const server = createServer(async (request, response) => {
    if (request.url === "/api/hotel/v1/requests/status" && request.method === "POST") {
      let body = "";
      for await (const chunk of request) body += chunk;
      requests.push(JSON.parse(body));
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "RECEIVED" }));
      return;
    }
    if (request.method !== "GET") { response.writeHead(405).end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const relative = pathname === "/" ? "index.html" : pathname.startsWith("/damoon-front/") ? pathname.slice("/damoon-front/".length) : "";
    const file = resolve(bundleRoot, relative || "index.html");
    if (!file.startsWith(bundleRoot + sep)) { response.writeHead(404).end(); return; }
    try {
      const content = await readFile(file);
      response.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream" });
      response.end(content);
    } catch { response.writeHead(404).end(); }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle" });
    await page.locator("[data-track-request]").waitFor();
    await page.locator("[data-track-reference]").fill("r".repeat(48));
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith("/api/hotel/v1/requests/status") && response.status() === 200),
      page.locator("[data-track-request] button[type=submit]").click(),
    ]);
    await page.locator("[data-track-result]").getByText("دریافت‌شده").waitFor();
    assert.deepEqual(requests, [{ reference: "r".repeat(48) }]);
  } finally {
    await browser?.close();
    await new Promise(resolveClose => server.close(resolveClose));
  }
});
