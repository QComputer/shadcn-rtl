import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { expect, test } from "playwright/test";
import { seedOperationalGuestFixture } from "./operational-fixture.mjs";

const env = process.env;
const appOrigin = new URL(env.DAMOON_APP_URL || "").origin;
const standaloneOrigin = new URL(env.DAMOON_STANDALONE_URL || "").origin;
const publicRuntimeOrigin = new URL(env.DAMOON_OPERATIONAL_RUNTIME_URL || "").origin;
const tenantHostname = new URL(standaloneOrigin).hostname;
const guestOrigin = `http://${tenantHostname}:3000`;
const organizationId = env.DAMOON_ORGANIZATION_ID;
const propertyId = env.DAMOON_PROPERTY_ID;
const foreignOrganizationId = env.DAMOON_FOREIGN_ORGANIZATION_ID;
const foreignPropertyId = env.DAMOON_FOREIGN_PROPERTY_ID;
const reservationsPath = (organization, property) => `/api/organizations/${encodeURIComponent(organization)}/hotels/${encodeURIComponent(property)}/reservations`;
const paymentPath = (reservationId) => `${reservationsPath(organizationId, propertyId)}/${encodeURIComponent(reservationId)}/offline-payments`;

function assertTestTarget() {
  if (env.CI !== "true" || env.NODE_ENV !== "test" || env.DAMOON_E2E_ENABLED !== "1" || env.VERCEL_ENV === "production" || env.VERCEL) throw new Error("Damoon operational acceptance requires isolated CI test mode");
  if (appOrigin !== "http://127.0.0.1:3000" || tenantHostname !== "damoon-hotel.localhost" || standaloneOrigin !== "http://damoon-hotel.localhost:8080" || publicRuntimeOrigin !== "http://damoon-hotel.ir:3000") throw new Error("Only the synthetic loopback-mapped Damoon test origins are permitted");
  if (!/^\/damoon_[a-f0-9]{16}$/i.test(new URL(env.DATABASE_URL || "https://invalid.local").pathname) || env.DATABASE_URL !== env.DIRECT_URL) throw new Error("Damoon operational acceptance requires the workflow-owned disposable database");
  for (const name of ["DAMOON_MANAGER_USERNAME", "DAMOON_MANAGER_PASSWORD", "DAMOON_ORGANIZATION_ID", "DAMOON_PROPERTY_ID", "DAMOON_FOREIGN_ORGANIZATION_ID", "DAMOON_FOREIGN_PROPERTY_ID", "DAMOON_STANDALONE_URL", "DAMOON_APP_URL", "DAMOON_OPERATIONAL_RUNTIME_URL"]) {
    if (!env[name]?.trim()) throw new Error(`${name} is required by the Damoon operational acceptance`);
  }
  if (env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED !== "1" || env.HOTEL_GUEST_PORTAL_ENABLED !== "1" || env.HOTEL_OFFLINE_PAYMENT_OPERATIONAL_ENABLED !== "1") throw new Error("Operational reservation, guest portal, and offline payment gates must be enabled for this disposable acceptance");
  if (env.HOTEL_ANONYMOUS_HOLD_OPERATIONAL_ENABLED === "1" || env.HOTEL_PAYMENT_OPERATIONAL_ENABLED === "1" || env.HOTEL_PAYMENT_SIMULATOR_ENABLED === "1" || env.HOTEL_SMS_ENABLED === "1" || env.CUSTOMER_AUTH_SMS_WORKER_ENABLED === "1") throw new Error("Anonymous holds, payment processing/simulation, and SMS must stay disabled");
}

async function choosePublicStayDates(page, checkIn, checkOut) {
  const arrival = page.locator('[data-date-field="checkIn"]');

  await arrival.click();
  let moves = 0;
  while (!(await page.locator(`[data-calendar-day="${checkIn}"]`).count()) && moves++ < 3) await page.locator("[data-month-next]").click();
  await page.locator(`[data-calendar-day="${checkIn}"]`).click();
  moves = 0;
  while (!(await page.locator(`[data-calendar-day="${checkOut}"]`).count()) && moves++ < 3) await page.locator("[data-month-next]").click();
  await page.locator(`[data-calendar-day="${checkOut}"]`).click();
}

async function login(page, origin, username, password, callbackPath) {
  const callbackUrl = `${origin}${callbackPath}`;
  await page.goto(`${origin}/fa/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => url.origin === origin && url.pathname === callbackPath, { timeout: 30_000 });
}

async function api(page, path, { method = "GET", body, key } = {}) {
  return page.evaluate(async ({ path, method, body, key }) => {
    const headers = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (key) headers["idempotency-key"] = key;
    const response = await fetch(path, { method, credentials: "same-origin", cache: "no-store", headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, { path, method, body, key });
}

function key(name) { return `damoon-phase1-${name}-${randomUUID()}`; }
function daysFromNow(offset) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

test("new Damoon customer registers, joins the host-bound tenant, and resumes the selected stay", async ({ browser }) => {
  test.setTimeout(90_000);
  assertTestTarget();
  const resolved = await lookup(new URL(publicRuntimeOrigin).hostname, { all: true, verbatim: true });
  if (!resolved.length || resolved.some(({ address }) => address !== "::1" && !/^127(?:\.\d{1,3}){3}$/.test(address))) throw new Error("Public Damoon runtime must resolve exclusively to loopback");
  const fixture = await seedOperationalGuestFixture();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`${publicRuntimeOrigin}/fa/`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-booking-slot]")).toBeVisible();
    const checkIn = daysFromNow(15);
    const checkOut = daysFromNow(16);
    await choosePublicStayDates(page, checkIn, checkOut);
    await page.getByLabel("تعداد بزرگسالان").selectOption("1");
    const startPath = "/fa/hotel-reservations/start";
    await Promise.all([
      page.waitForURL((url) => url.origin === publicRuntimeOrigin && url.pathname === "/fa/login"),
      page.getByRole("button", { name: /ادامه برای رزرو و مشاهده جزئیات نمونه/ }).click(),
    ]);
    const loginUrl = new URL(page.url());
    const callbackValue = loginUrl.searchParams.get("callbackUrl");
    expect(callbackValue).toBeTruthy();
    const callbackUrl = new URL(callbackValue || "", publicRuntimeOrigin);
    expect(callbackUrl.origin).toBe(publicRuntimeOrigin);
    expect(callbackUrl.pathname).toBe(startPath);
    expect(callbackUrl.searchParams.get("property")).toBe("damoon-hotel");
    expect(callbackUrl.searchParams.get("checkIn")).toBe(checkIn);
    expect(callbackUrl.searchParams.get("checkOut")).toBe(checkOut);
    expect(callbackUrl.searchParams.get("adults")).toBe("1");

    const callbackPath = `${callbackUrl.pathname}${callbackUrl.search}`;
    const registerLink = page.getByRole("link", { name: "ثبت نام", exact: true });
    const registerUrl = new URL(await registerLink.getAttribute("href") || "", publicRuntimeOrigin);
    expect(registerUrl.searchParams.get("callbackUrl")).toBe(callbackPath);
    await registerLink.click();
    await page.waitForURL((url) => url.origin === publicRuntimeOrigin && url.pathname === "/fa/register");
    const newUsername = `${fixture.username}-new`;
    await page.locator("#username").fill(newUsername);
    await page.locator("#password").fill(fixture.password);
    await page.locator("#confirmPassword").fill(fixture.password);
    const guestReservationsResponses = [];
    page.on("response", (response) => {
      if (new URL(response.url()).pathname === reservationsPath(organizationId, propertyId) && response.request().method() === "GET") {
        guestReservationsResponses.push(response);
      }
    });
    const registrationResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/auth/register") && response.request().method() === "POST", { timeout: 20_000 });
    await page.getByRole("button", { name: "ثبت نام" }).click();
    const registrationResponse = await registrationResponsePromise;
    const registration = await registrationResponse.json();
    expect(registrationResponse.status(), JSON.stringify(registration)).toBe(201);
    let guestResponse;
    const isGuestReservationsSnapshot = (response) => new URL(response.url()).pathname === reservationsPath(organizationId, propertyId) && response.request().method() === "GET";
    if (registration.autoLogin) {
      await page.waitForURL((url) => url.origin === publicRuntimeOrigin && url.pathname === startPath && url.searchParams.get("checkIn") === checkIn, { timeout: 45_000 });
      guestResponse = guestReservationsResponses.at(-1) ?? await page.waitForResponse(isGuestReservationsSnapshot, { timeout: 20_000 });
    } else {
      await page.waitForURL((url) => url.origin === publicRuntimeOrigin && url.pathname === "/fa/login", { timeout: 30_000 });
      await page.locator("#username").fill(newUsername);
      await page.locator("#password").fill(fixture.password);
      const guestReservationsResponse = page.waitForResponse(isGuestReservationsSnapshot, { timeout: 20_000 });
      await page.locator("form button[type='submit']").click();
      await page.waitForURL((url) => url.origin === publicRuntimeOrigin && url.pathname === startPath && url.searchParams.get("checkIn") === checkIn, { timeout: 45_000 });
      guestResponse = guestReservationsResponses.at(-1) ?? await guestReservationsResponse;
    }
    expect(guestResponse.status(), await guestResponse.text()).toBe(200);
    await expect(page.getByRole("note")).toContainText("پیش‌نمایش هتل دامون");
    await expect(page.locator("section[aria-label='رزروهای هتل']")).toBeVisible();
    await expect(page.getByLabel("تاریخ ورود")).toHaveValue(checkIn);
    await expect(page.getByLabel("تاریخ خروج")).toHaveValue(checkOut);

    const reservation = await createReservationThroughGuestControls(page, checkIn, checkOut, "Synthetic Public Journey Guest", fixture);
    expect(reservation.status).toBe("PENDING_PAYMENT");
  } finally {
    await context.close();
  }
});

test("existing Damoon customer without membership can join this host tenant and keep the selected stay", async ({ browser }) => {
  test.setTimeout(60_000);
  assertTestTarget();
  const fixture = await seedOperationalGuestFixture();
  const checkIn = daysFromNow(18);
  const checkOut = daysFromNow(19);
  const returnPath = `/fa/hotel-reservations/start?property=damoon-hotel&checkIn=${checkIn}&checkOut=${checkOut}&adults=1`;
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const browserErrors = [];
    const expectedHttpCoopWarnings = [];
    const nextAssetStatuses = [];
    const nextSockets = [];
    const socketErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (text.startsWith("The Cross-Origin-Opener-Policy header has been ignored, because the URL's origin was untrustworthy.")) expectedHttpCoopWarnings.push(text);
      else browserErrors.push(text);
    });
    page.on("response", (response) => { if (response.url().includes("/_next/static/") && response.request().resourceType() === "script") nextAssetStatuses.push(response.status()); });
    page.on("websocket", (socket) => {
      if (socket.url().includes("/_next/")) {
        nextSockets.push(socket.url());
        socket.on("socketerror", (error) => socketErrors.push(error));
      }
    });
    await page.goto(`${publicRuntimeOrigin}${returnPath}`);
    await page.waitForURL((url) => url.origin === publicRuntimeOrigin && url.pathname === "/fa/login");
    await expect(page.locator("#username")).toBeVisible();
    await expect(page.locator("#username")).toBeEnabled();
    expect(nextAssetStatuses.length, "Next client assets should load before login interaction").toBeGreaterThan(0);
    expect(nextAssetStatuses.every((status) => status === 200), JSON.stringify(nextAssetStatuses)).toBe(true);
    expect(nextSockets.some((url) => url.includes("/_next/")), JSON.stringify(nextSockets)).toBe(true);
    await page.locator("#username").fill(fixture.unjoinedUsername);
    await page.locator("#password").fill(fixture.password);
    await expect(page.getByRole("checkbox", { name: /اگر هنوز عضو نیستم/ })).toBeVisible();
    await page.getByRole("checkbox", { name: /اگر هنوز عضو نیستم/ }).check();
    await page.locator("form button[type='submit']").click();
    await page.waitForURL((url) => url.origin === publicRuntimeOrigin && url.pathname === "/fa/hotel-reservations/start" && url.searchParams.get("checkIn") === checkIn, { timeout: 30_000 });

    await expect(page.locator("section[aria-label='رزروهای هتل']")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel("تاریخ ورود")).toHaveValue(checkIn);
    await expect(page.getByLabel("تاریخ خروج")).toHaveValue(checkOut);
    const guestReservations = await page.request.get(`${publicRuntimeOrigin}/api/hotel/v1/guest-reservations?property=damoon-hotel`);
    expect(guestReservations.status(), await guestReservations.text()).toBe(200);
    expect(socketErrors, "The allowed Next development HMR socket should not fail").toEqual([]);
    expect(expectedHttpCoopWarnings.length, "Only the known COOP warning from the synthetic HTTP host may be present").toBeGreaterThan(0);
    expect(expectedHttpCoopWarnings.every((warning) => warning.startsWith("The Cross-Origin-Opener-Policy header has been ignored, because the URL's origin was untrustworthy."))).toBe(true);
    expect(browserErrors, "The interactive login and onboarding flow should hydrate without application errors").toEqual([]);
  } finally {
    await context.close();
  }
});

async function createReservationThroughGuestControls(page, checkIn, checkOut, guestName, fixture) {
  const reservations = page.locator("section[aria-label='رزروهای هتل']");
  await expect(reservations).toBeVisible({ timeout: 10_000 });
  await expect(page.getByLabel("نوع اتاق").locator(`option[value="${fixture.roomTypeId}"]`)).toHaveCount(1);
  await page.getByLabel("نوع اتاق").selectOption(fixture.roomTypeId);
  await expect(page.getByLabel("طرح نرخ").locator(`option[value="${fixture.ratePlanId}"]`)).toHaveCount(1);
  await page.getByLabel("طرح نرخ").selectOption(fixture.ratePlanId);
  await page.getByLabel("تاریخ ورود").fill(checkIn);
  await page.getByLabel("تاریخ خروج").fill(checkOut);
  await page.getByLabel("بزرگسالان").fill("1");

  const quotePath = reservationsPath(organizationId, propertyId);
  const [quoteResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes(quotePath) && response.request().method() === "POST" && response.request().postDataJSON()?.action === "quote", { timeout: 15_000 }),
    reservations.getByRole("button", { name: "دریافت قیمت" }).click({ timeout: 10_000 }),
  ]);
  expect(quoteResponse.status(), await quoteResponse.text()).toBe(200);
  const quoteBody = await quoteResponse.json();
  expect(quoteBody.simulated).toBe(false);
  expect(quoteBody.quote?.id).toBeTruthy();
  await expect(reservations).toContainText(String(quoteBody.quote.totalAmount), { timeout: 10_000 });

  const [holdResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes(quotePath) && response.request().method() === "POST" && response.request().postDataJSON()?.action === "hold", { timeout: 15_000 }),
    reservations.getByRole("button", { name: "نگه‌داری موقت" }).click({ timeout: 10_000 }),
  ]);
  expect(holdResponse.status(), await holdResponse.text()).toBe(200);
  const holdBody = await holdResponse.json();
  expect(holdBody.simulated).toBe(false);
  expect(holdBody.hold?.id).toBeTruthy();
  await expect(reservations).toContainText("انقضای نگه‌داری", { timeout: 10_000 });

  await reservations.getByLabel("نام کامل مهمان 1").fill(guestName);
  const [reservationResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes(quotePath) && response.request().method() === "POST" && response.request().postDataJSON()?.action === "reserve", { timeout: 15_000 }),
    reservations.getByRole("button", { name: "ثبت رزرو" }).click({ timeout: 10_000 }),
  ]);
  expect(reservationResponse.status(), await reservationResponse.text()).toBe(200);
  const reservationBody = await reservationResponse.json();
  const reservation = reservationBody.reservation;
  expect(reservation?.id).toBeTruthy();
  expect(reservation?.status).toBe("PENDING_PAYMENT");
  expect(reservation?.simulated).toBe(false);
  await expect(reservations.getByText(reservation.reference, { exact: true })).toBeVisible({ timeout: 10_000 });
  return reservation;
}

test("authenticated Damoon guest creates a reservation through quote, hold, and reservation controls", async ({ browser }) => {
  test.setTimeout(90_000);
  assertTestTarget();
  const resolved = await lookup(tenantHostname, { all: true, verbatim: true });
  if (!resolved.length || resolved.some(({ address }) => address !== "::1" && !/^127(?:\.\d{1,3}){3}$/.test(address))) throw new Error("Damoon test domain must resolve exclusively to loopback");
  const fixture = await seedOperationalGuestFixture();
  const guestContext = await browser.newContext();
  try {
    const guestPage = await guestContext.newPage();
    const guestCallback = `/fa/hotel-reservations/${organizationId}/${propertyId}`;
    await login(guestPage, guestOrigin, fixture.username, fixture.password, guestCallback);
    const checkIn = daysFromNow(15);
    const checkOut = daysFromNow(16);
    const reservation = await createReservationThroughGuestControls(guestPage, checkIn, checkOut, "Synthetic UI Guest", fixture);
    await guestPage.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
    await expect(guestPage.getByText(reservation.reference, { exact: true })).toBeVisible();
    const persisted = await api(guestPage, reservationsPath(organizationId, propertyId));
    expect(persisted.status).toBe(200);
    const saved = persisted.body.reservations.find((item) => item.id === reservation.id);
    expect(saved?.checkIn).toBe(checkIn);
    expect(saved?.checkOut).toBe(checkOut);
  } finally {
    await Promise.allSettled([guestContext.close()]);
  }
});

test("authenticated Damoon guest lifecycle reaches reception check-out with tenant isolation", async ({ browser }) => {
  test.setTimeout(90_000);
  assertTestTarget();
  const resolved = await lookup(tenantHostname, { all: true, verbatim: true });
  if (!resolved.length || resolved.some(({ address }) => address !== "::1" && !/^127(?:\.\d{1,3}){3}$/.test(address))) throw new Error("Damoon test domain must resolve exclusively to loopback");
  const fixture = await seedOperationalGuestFixture();
  const guestContext = await browser.newContext();
  const staffContext = await browser.newContext();
  try {
    const guestPage = await guestContext.newPage();
    const guestCallback = `/fa/hotel-reservations/${organizationId}/${propertyId}`;
    await login(guestPage, guestOrigin, fixture.username, fixture.password, guestCallback);
    await expect(guestPage.locator("section[aria-label='رزروهای هتل']")).toBeVisible();

    const parts = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const part = type => parts.find(value => value.type === type)?.value;
    const checkIn = `${part("year")}-${part("month")}-${part("day")}`;
    const followingDay = new Date(`${checkIn}T00:00:00Z`);
    followingDay.setUTCDate(followingDay.getUTCDate() + 1);
    const checkOut = followingDay.toISOString().slice(0,10);
    const quote = await api(guestPage, reservationsPath(organizationId, propertyId), { method: "POST", key: key("quote"), body: {
      action: "quote", roomTypeId: fixture.roomTypeId, ratePlanId: fixture.ratePlanId, checkIn, checkOut, adults: 1, childAges: [],
    } });
    expect(quote.status, JSON.stringify(quote.body)).toBe(200);
    expect(quote.body.simulated).toBe(false);
    expect(quote.body.quote?.id).toBeTruthy();

    const hold = await api(guestPage, reservationsPath(organizationId, propertyId), { method: "POST", key: key("hold"), body: { action: "hold", quoteId: quote.body.quote.id } });
    expect(hold.status, JSON.stringify(hold.body)).toBe(200);
    expect(hold.body.simulated).toBe(false);
    expect(hold.body.hold?.id).toBeTruthy();

    const reservationResult = await api(guestPage, reservationsPath(organizationId, propertyId), { method: "POST", key: key("reserve"), body: {
      action: "reserve", quoteId: quote.body.quote.id, holdId: hold.body.hold.id, guests: [{ fullName: "Synthetic CI Guest", isPrimary: true }],
    } });
    expect(reservationResult.status, JSON.stringify(reservationResult.body)).toBe(200);
    const reservation = reservationResult.body.reservation;
    expect(reservation?.status).toBe("PENDING_PAYMENT");
    expect(reservation?.simulated).toBe(false);

    const selectedCash = await api(guestPage, reservationsPath(organizationId, propertyId), { method: "POST", key: key("cash-choice"), body: { action: "select-payment-method", reservationId: reservation.id, method: "CASH" } });
    expect(selectedCash.status, JSON.stringify(selectedCash.body)).toBe(200);
    expect(selectedCash.body.reservation?.paymentMethod).toBe("CASH");
    await guestPage.reload();
    await expect(guestPage.getByText(reservation.reference, { exact: true })).toBeVisible();

    const guestCrossTenant = await api(guestPage, reservationsPath(foreignOrganizationId, foreignPropertyId));
    expect([403, 404]).toContain(guestCrossTenant.status);

    const staffPage = await staffContext.newPage();
    const staffCallback = `/fa/hotel-reservations/${organizationId}/${propertyId}`;
    await login(staffPage, appOrigin, env.DAMOON_MANAGER_USERNAME, env.DAMOON_MANAGER_PASSWORD, staffCallback);

    const cash = await api(staffPage, paymentPath(reservation.id), { method: "POST", key: key("cash-record"), body: { action: "RECORD_CASH", amountToman: String(reservation.totalAmount) } });
    expect(cash.status, JSON.stringify(cash.body)).toBe(200);
    expect(cash.body.outcome).toBe("APPLIED");
    expect(cash.body.entry?.method).toBe("CASH");
    expect(cash.body.entry?.status).toBe("VERIFIED");
    await staffPage.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
    await expect(staffPage.getByText(reservation.reference, { exact: true })).toBeVisible({ timeout: 10_000 });

    const confirmed = await api(staffPage, reservationsPath(organizationId, propertyId), { method: "POST", key: key("confirm"), body: { action: "confirm-reservation", reservationId: reservation.id } });
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
    expect(confirmed.body.reservation?.status).toBe("CONFIRMED");

    const assigned = await api(staffPage, reservationsPath(organizationId, propertyId), { method: "POST", key: key("assign"), body: { action: "assign-room", reservationId: reservation.id, roomId: fixture.roomId } });
    expect(assigned.status, JSON.stringify(assigned.body)).toBe(200);
    expect(assigned.body.reservation?.status).toBe("CONFIRMED");

    const checkedIn = await api(staffPage, reservationsPath(organizationId, propertyId), { method: "POST", key: key("check-in"), body: { action: "check-in", reservationId: reservation.id, allowEarlyArrival: true } });
    expect(checkedIn.status, JSON.stringify(checkedIn.body)).toBe(200);
    expect(checkedIn.body.reservation?.status).toBe("CHECKED_IN");

    const checkedOut = await api(staffPage, reservationsPath(organizationId, propertyId), { method: "POST", key: key("check-out"), body: { action: "check-out", reservationId: reservation.id } });
    expect(checkedOut.status, JSON.stringify(checkedOut.body)).toBe(200);
    expect(checkedOut.body.reservation?.status).toBe("CHECKED_OUT");

    const staffCrossTenant = await api(staffPage, reservationsPath(foreignOrganizationId, foreignPropertyId));
    expect([403, 404]).toContain(staffCrossTenant.status);
  } finally {
    await Promise.allSettled([guestContext.close(), staffContext.close()]);
  }
});

test("guest submits a bank transfer and receipt for authorized reception verification", async ({ browser }) => {
  test.setTimeout(90_000);
  assertTestTarget();
  const resolved = await lookup(tenantHostname, { all: true, verbatim: true });
  if (!resolved.length || resolved.some(({ address }) => address !== "::1" && !/^127(?:\.\d{1,3}){3}$/.test(address))) throw new Error("Damoon test domain must resolve exclusively to loopback");

  const fixture = await seedOperationalGuestFixture();
  const otherGuestFixture = await seedOperationalGuestFixture();
  const databaseUrl = new URL(env.DATABASE_URL);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl.toString(), max: 2 }), log: [] });
  const guestContext = await browser.newContext();
  const staffContext = await browser.newContext();
  const otherGuestContext = await browser.newContext();
  let originalPolicy;
  try {
    await db.$connect();
    const [identity] = await db.$queryRaw`SELECT current_database()::text AS database, current_user::text AS role, current_schema()::text AS schema, inet_server_port() AS port`;
    const expectedDatabase = decodeURIComponent(databaseUrl.pathname.slice(1));
    const expectedRole = decodeURIComponent(databaseUrl.username);
    if (identity?.database !== expectedDatabase || identity.role !== expectedRole || identity.schema !== "public" || Number(identity.port) !== 5432) throw new Error("Bank-transfer fixture did not connect to its disposable loopback database");
    const property = await db.hotelProperty.findFirst({ where: { id: propertyId, organizationId }, select: { allowedOfflinePaymentMethods: true, manualConfirmationPolicy: true, minimumVerifiedDepositAmount: true } });
    if (!property) throw new Error("Synthetic Damoon property is unavailable");
    originalPolicy = property;
    await db.hotelProperty.update({ where: { id: propertyId }, data: { allowedOfflinePaymentMethods: ["CASH", "BANK_TRANSFER"], manualConfirmationPolicy: "MINIMUM_VERIFIED_DEPOSIT", minimumVerifiedDepositAmount: BigInt(1) } });

    const guestPage = await guestContext.newPage();
    const guestCallback = `/fa/hotel-reservations/${organizationId}/${propertyId}`;
    await login(guestPage, guestOrigin, fixture.username, fixture.password, guestCallback);
    await expect(guestPage.locator("section[aria-label='رزروهای هتل']")).toBeVisible();

    const checkIn = daysFromNow(3);
    const checkOut = daysFromNow(4);
    const quote = await api(guestPage, reservationsPath(organizationId, propertyId), { method: "POST", key: key("transfer-quote"), body: {
      action: "quote", roomTypeId: fixture.roomTypeId, ratePlanId: fixture.ratePlanId, checkIn, checkOut, adults: 1, childAges: [],
    } });
    expect(quote.status, JSON.stringify(quote.body)).toBe(200);
    const hold = await api(guestPage, reservationsPath(organizationId, propertyId), { method: "POST", key: key("transfer-hold"), body: { action: "hold", quoteId: quote.body.quote.id } });
    expect(hold.status, JSON.stringify(hold.body)).toBe(200);
    const created = await api(guestPage, reservationsPath(organizationId, propertyId), { method: "POST", key: key("transfer-reserve"), body: {
      action: "reserve", quoteId: quote.body.quote.id, holdId: hold.body.hold.id, guests: [{ fullName: "Synthetic Transfer Guest", isPrimary: true }],
    } });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    const reservation = created.body.reservation;
    expect(reservation.status).toBe("PENDING_PAYMENT");

    await guestPage.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
    await guestPage.getByRole("button", { name: "واریز بانکی" }).click();
    const paymentPanel = guestPage.locator("section[aria-label='پرداخت اقامت']");
    await expect(paymentPanel).toBeVisible();
    const total = BigInt(reservation.totalAmount);
    const partialAmount = (total / BigInt(2)).toString();
    expect(BigInt(partialAmount)).toBeGreaterThan(BigInt(0));
    await expect(paymentPanel).toContainText(`مانده (تومان): ${total}`);

    await paymentPanel.getByLabel("مبلغ واریز (تومان)").fill(partialAmount);
    const bankReference = `CI-${randomUUID()}`;
    await paymentPanel.getByLabel("شماره پیگیری واریز").fill(bankReference);
    const [transferResponse] = await Promise.all([
      guestPage.waitForResponse((response) => response.url().includes(paymentPath(reservation.id)) && response.request().method() === "POST"),
      paymentPanel.getByRole("button", { name: "ثبت واریز برای بررسی" }).click(),
    ]);
    expect(transferResponse.status()).toBe(200);
    expect((await transferResponse.json()).entry.bankReference).toBe(bankReference);
    await expect(paymentPanel).toContainText("ثبت‌شده؛ تأییدنشده");
    await expect(paymentPanel).toContainText(`مانده (تومان): ${total}`);

    const receiptInput = paymentPanel.locator('input[type="file"]').first();
    await receiptInput.setInputFiles({ name: "synthetic-hotel-receipt.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l0sAAAAASUVORK5CYII=", "base64") });
    const [uploadResponse] = await Promise.all([
      guestPage.waitForResponse((response) => response.url().endsWith("/receipt") && response.request().method() === "POST"),
      paymentPanel.getByRole("button", { name: "بارگذاری رسید" }).click(),
    ]);
    expect(uploadResponse.status(), await uploadResponse.text()).toBe(201);
    await expect(paymentPanel.getByRole("link", { name: "مشاهده رسید" })).toBeVisible();

    const receiptLink = paymentPanel.getByRole("link", { name: "مشاهده رسید" });
    const receiptUrl = await receiptLink.getAttribute("href");
    expect(receiptUrl).toBeTruthy();
    const ownReceipt = await guestPage.request.get(`${guestOrigin}${receiptUrl}`);
    expect(ownReceipt.status()).toBe(200);
    const otherGuestPage = await otherGuestContext.newPage();
    await login(otherGuestPage, guestOrigin, otherGuestFixture.username, otherGuestFixture.password, guestCallback);
    const otherGuestReceipt = await otherGuestPage.request.get(`${guestOrigin}${receiptUrl}`);
    expect([403, 404]).toContain(otherGuestReceipt.status());
    const foreignPaymentPath = `${reservationsPath(foreignOrganizationId, foreignPropertyId)}/${encodeURIComponent(reservation.id)}/offline-payments`;
    const foreignPayment = await api(guestPage, foreignPaymentPath);
    expect([403, 404]).toContain(foreignPayment.status);
    const foreignReceiptPath = receiptUrl.replace(reservationsPath(organizationId, propertyId), reservationsPath(foreignOrganizationId, foreignPropertyId));
    expect(foreignReceiptPath).not.toBe(receiptUrl);
    const foreignReceipt = await guestPage.request.get(`${guestOrigin}${foreignReceiptPath}`);
    expect([403, 404]).toContain(foreignReceipt.status());
    const anonymousContext = await browser.newContext();
    try {
      const anonymousReceipt = await anonymousContext.request.get(`${guestOrigin}${receiptUrl}`);
      expect(anonymousReceipt.status()).toBe(401);
    } finally { await anonymousContext.close(); }

    const staffPage = await staffContext.newPage();
    await login(staffPage, appOrigin, env.DAMOON_MANAGER_USERNAME, env.DAMOON_MANAGER_PASSWORD, guestCallback);
    const receptionCard = staffPage.locator("li").filter({ hasText: reservation.reference });
    const receptionPanel = receptionCard.locator("section[aria-label='پرداخت‌های خارج از درگاه']");
    await expect(receptionPanel).toBeVisible();
    await expect(receptionPanel).toContainText("ثبت‌شده؛ تأییدنشده");
    await expect(receptionPanel.getByRole("link", { name: "مشاهده رسید" })).toBeVisible();
    const authorizedReceipt = await staffPage.request.get(`${appOrigin}${receiptUrl}`);
    expect(authorizedReceipt.status()).toBe(200);
    expect(authorizedReceipt.headers()["content-type"]).toContain("image/png");
    await receptionPanel.getByRole("button", { name: "تأیید و ثبت واریز" }).click();
    await expect(receptionPanel).toContainText("تأییدشده و پرداخت‌شده");
    await expect(receptionPanel).toContainText(new Intl.NumberFormat("fa-IR").format(BigInt(partialAmount)));

    const finalGuestSummary = await api(guestPage, paymentPath(reservation.id));
    expect(finalGuestSummary.status).toBe(200);
    expect(finalGuestSummary.body.paidToman).toBe(partialAmount);
    expect(finalGuestSummary.body.outstandingToman).toBe((total - BigInt(partialAmount)).toString());
    expect(finalGuestSummary.body.entries).toHaveLength(1);
    expect(finalGuestSummary.body.entries[0]).toMatchObject({ method: "BANK_TRANSFER", status: "VERIFIED", hasReceipt: true });
    const refreshedReservations = await api(guestPage, reservationsPath(organizationId, propertyId));
    expect(refreshedReservations.body.reservations.find((item) => item.id === reservation.id)?.status).toBe("PENDING_PAYMENT");
    await guestPage.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
    const refreshedGuestPanel = guestPage.locator("section[aria-label='پرداخت اقامت']");
    await expect(refreshedGuestPanel).toContainText("تأییدشده");
    await expect(refreshedGuestPanel).toContainText(`مانده (تومان): ${total - BigInt(partialAmount)}`);

    await receptionCard.getByRole("button", { name: "تأیید رزرو" }).click();
    await expect(receptionCard).toContainText("CONFIRMED");
    await receptionPanel.getByLabel("مبلغ نقدی (تومان)").fill((total - BigInt(partialAmount)).toString());
    await receptionPanel.getByRole("button", { name: "ثبت دریافت نقدی" }).click();
    await expect(receptionPanel).toContainText("نقدی");
    const settled = await api(guestPage, paymentPath(reservation.id));
    expect(settled.status).toBe(200);
    expect(settled.body.paidToman).toBe(total.toString());
    expect(settled.body.outstandingToman).toBe("0");
    expect(settled.body.entries.filter((entry) => entry.status === "VERIFIED")).toHaveLength(2);
  } finally {
    await Promise.allSettled([guestContext.close(), staffContext.close(), otherGuestContext.close()]);
    if (originalPolicy) await db.hotelProperty.update({ where: { id: propertyId }, data: originalPolicy }).catch(() => undefined);
    await db.$disconnect().catch(() => undefined);
  }
});

test("nullable room board falls back to unavailable state without crashing hotel operations", async ({ browser }) => {
  test.setTimeout(90_000);
  assertTestTarget();
  const resolved = await lookup(tenantHostname, { all: true, verbatim: true });
  if (!resolved.length || resolved.some(({ address }) => address !== "::1" && !/^127(?:\.\d{1,3}){3}$/.test(address))) throw new Error("Damoon test domain must resolve exclusively to loopback");
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const browserErrors = [];
    const operationsStatuses = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    const path = reservationsPath(organizationId, propertyId).replace(/\/reservations$/, "/operations");
    await page.route((url) => url.origin === appOrigin && url.pathname === path, async (route) => {
      if (route.request().method() !== "GET") { await route.continue(); return; }
      // Preserve the actual authenticated fixture and contract. Inject only the schema-gap read model.
      const response = await route.fetch({ maxRedirects: 0 });
      operationsStatuses.push(response.status());
      if (!response.ok()) { await route.fulfill({ response }); return; }
      const body = await response.json();
      await route.fulfill({ status: 200, json: {
        ...body,
        maintenanceStatus: { state: "UNAVAILABLE", code: "HOTEL_MAINTENANCE_SCHEMA_NOT_READY" },
        roomBoard: null,
        maintenanceBlocks: null,
        roomTypes: body.roomTypes.map((room) => ({ ...room, physicalCapacity: { ...room.physicalCapacity, sellableRooms: null } })),
        inventory: body.inventory.map((night) => ({ ...night, available: null })),
      } });
    });
    const operationsCallback = `/fa/dashboard/hotel-operations/${organizationId}/${propertyId}`;
    await login(page, appOrigin, env.DAMOON_MANAGER_USERNAME, env.DAMOON_MANAGER_PASSWORD, operationsCallback);
    const board = page.getByRole("heading", { name: "وضعیت روزانه اتاق‌ها", exact: true }).locator("..");
    await expect(board.getByRole("alert")).toContainText("داده تعمیرات قابل بررسی نیست");
    expect(operationsStatuses.length).toBeGreaterThan(0);
    expect(operationsStatuses.every((status) => status === 200)).toBe(true);
    await expect(board.getByRole("table")).toHaveCount(0);
    await expect(board.getByText("رکوردی موجود نیست.", { exact: true })).toHaveCount(0);
    const types = page.getByRole("heading", { name: "انواع اتاق", exact: true }).locator("..");
    await types.getByLabel("شناسه نوع اتاق", { exact: true }).fill("schema-gap-test");
    await types.getByLabel("نام", { exact: true }).fill("Synthetic regression room type");
    await expect(types.getByRole("button", { name: "افزودن", exact: true })).toBeEnabled();
    await types.getByLabel("شناسه امکان", { exact: true }).fill("schema-gap-test");
    await types.getByLabel("نام امکان", { exact: true }).fill("Synthetic regression amenity");
    await expect(types.getByRole("button", { name: "افزودن امکان", exact: true })).toBeEnabled();
    const physicalRooms = page.getByRole("heading", { name: "اتاق‌های فیزیکی", exact: true }).locator("..");
    await expect(physicalRooms.getByLabel("کد اتاق", { exact: true })).toBeEditable();
    const rates = page.getByRole("heading", { name: "نرخ‌ها", exact: true }).locator("..");
    await rates.getByLabel("نرخ پایه (تومان)", { exact: true }).fill("125000");
    await expect(rates.getByLabel("نرخ پایه (تومان)", { exact: true })).toHaveValue("125000");
    await expect(page.getByRole("heading", { name: "ظرفیت شبانه", exact: true })).toBeVisible();
    expect(browserErrors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("nullable occupancy board clears stale data after failed refresh", async ({ browser }) => {
  test.setTimeout(90_000);
  assertTestTarget();
  const resolved = await lookup(tenantHostname, { all: true, verbatim: true });
  if (!resolved.length || resolved.some(({ address }) => address !== "::1" && !/^127(?:\.\d{1,3}){3}$/.test(address))) throw new Error("Damoon test domain must resolve exclusively to loopback");
  const context = await browser.newContext();
  let releaseRecovery = () => {};
  try {
    const page = await context.newPage();
    const browserErrors = [];
    const requests = [];
    let mode = "success";
    let recoveryGate = null;
    page.on("pageerror", (error) => browserErrors.push(error.message));
    const path = reservationsPath(organizationId, propertyId).replace(/\/reservations$/, "/occupancy");
    await page.route((url) => url.origin === appOrigin && url.pathname === path, async (route) => {
      if (route.request().method() !== "GET") { await route.continue(); return; }
      const url = new URL(route.request().url());
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const phase = mode;
      const nights = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
      const dates = Array.from({ length: nights }, (_, index) => new Date(Date.parse(`${from}T00:00:00Z`) + index * 86_400_000).toISOString().slice(0, 10));
      requests.push({ phase, from, to });
      if (phase === "recovery" && recoveryGate) await recoveryGate;
      // Matches getOccupancyBoard's response contract, with a deterministic synthetic room.
      await route.fulfill({ status: 200, json: {
        property: { id: propertyId, name: "Damoon", timezone: "Asia/Tehran" },
        range: { from, to, nights: dates.length },
        demoProperty: true,
        roomBoard: phase === "null" ? null : {
          dates,
          rooms: [{ id: "room-1", code: "D-101", roomTypeId: "type-1", isOutOfService: false,
            nights: dates.map((date, index) => ({ date, status: phase === "reserved" && index === 0 ? "RESERVED" : "VACANT", reference: phase === "reserved" && index === 0 ? "HD-TEST-REFRESH" : null })) }],
          unassignedReservationNights: 0,
        },
      } });
    });
    const receptionCallback = `/fa/dashboard/hotel-operations/${organizationId}/${propertyId}/reservations`;
    await login(page, appOrigin, env.DAMOON_MANAGER_USERNAME, env.DAMOON_MANAGER_PASSWORD, receptionCallback);
    const region = page.getByRole("region", { name: "تقویم اشغال اتاق‌ها", exact: true });
    const room = region.getByRole("rowheader", { name: "D-101", exact: true });
    const alert = region.getByRole("alert");
    const next = region.getByRole("button", { name: "هفته بعد", exact: true });
    const previous = region.getByRole("button", { name: "هفته قبل", exact: true });
    await expect(room).toBeVisible();
    await expect(region.getByText(/شب رزرو بدون تخصیص اتاق فیزیکی/)).toHaveCount(0);
    expect(requests.length).toBeGreaterThan(0);
    const firstRange = requests.at(-1).from;
    mode = "null";
    await next.click();
    await expect(alert).toHaveCount(1);
    await expect(alert).toContainText("تقویم در دسترس نیست");
    await expect(region.getByRole("table")).toHaveCount(0);
    await expect(room).toHaveCount(0);
    const failedRequest = requests.at(-1);
    expect(failedRequest.phase).toBe("null");
    expect(failedRequest.from).not.toBe(firstRange);
    // Return to the original range, but hold the replacement response. Old data must not reappear.
    recoveryGate = new Promise((resolve) => { releaseRecovery = resolve; });
    mode = "recovery";
    await previous.click();
    await expect.poll(() => requests.at(-1)).toMatchObject({ phase: "recovery", from: firstRange });
    await expect(region.getByRole("table")).toHaveCount(0);
    await expect(room).toHaveCount(0);
    releaseRecovery();
    await expect(room).toBeVisible();
    await expect(alert).toHaveCount(0);
    // A successful retry of the previously failed range must clear the old failure state.
    mode = "success";
    await next.click();
    await expect.poll(() => requests.at(-1)).toMatchObject({ phase: "success", from: failedRequest.from });
    await expect(room).toBeVisible();
    await expect(alert).toHaveCount(0);
    // The reservation-center refresh invalidates the occupancy board without reloading the page.
    mode = "reserved";
    await page.getByRole("button", { name: "بارگذاری دوباره", exact: true }).click();
    await expect.poll(() => requests.at(-1)).toMatchObject({ phase: "reserved", from: failedRequest.from });
    await expect(region.getByRole("row", { name: /D-101/ })).toContainText("رزروشده");
    const range = region.getByLabel("بازه تقویم", { exact: true });
    await range.selectOption("1");
    await expect.poll(() => (Date.parse(requests.at(-1).to) - Date.parse(requests.at(-1).from)) / 86_400_000).toBe(1);
    await expect(region.getByRole("columnheader")).toHaveCount(2);
    await range.selectOption("31");
    await expect.poll(() => (Date.parse(requests.at(-1).to) - Date.parse(requests.at(-1).from)) / 86_400_000).toBe(31);
    await expect(region.getByRole("columnheader")).toHaveCount(32);
    await expect(alert).toHaveCount(0);
    expect(browserErrors).toEqual([]);
  } finally {
    releaseRecovery();
    await context.close();
  }
});
