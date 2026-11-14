import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { expect, test } from "playwright/test";
import { seedOperationalGuestFixture } from "./operational-fixture.mjs";

const env = process.env;
const appOrigin = new URL(env.DAMOON_APP_URL || "").origin;
const standaloneOrigin = new URL(env.DAMOON_STANDALONE_URL || "").origin;
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
  if (appOrigin !== "http://127.0.0.1:3000" || tenantHostname !== "damoon-hotel.ir" || standaloneOrigin !== "http://damoon-hotel.ir:8080") throw new Error("Only the synthetic loopback-mapped Damoon test origins are permitted");
  if (!/^\/damoon_[a-f0-9]{16}$/i.test(new URL(env.DATABASE_URL || "https://invalid.local").pathname) || env.DATABASE_URL !== env.DIRECT_URL) throw new Error("Damoon operational acceptance requires the workflow-owned disposable database");
  for (const name of ["DAMOON_MANAGER_USERNAME", "DAMOON_MANAGER_PASSWORD", "DAMOON_ORGANIZATION_ID", "DAMOON_PROPERTY_ID", "DAMOON_FOREIGN_ORGANIZATION_ID", "DAMOON_FOREIGN_PROPERTY_ID", "DAMOON_STANDALONE_URL", "DAMOON_APP_URL"]) {
    if (!env[name]?.trim()) throw new Error(`${name} is required by the Damoon operational acceptance`);
  }
  if (env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED !== "1" || env.HOTEL_GUEST_PORTAL_ENABLED !== "1" || env.HOTEL_OFFLINE_PAYMENT_OPERATIONAL_ENABLED !== "1") throw new Error("Operational reservation, guest portal, and offline payment gates must be enabled for this disposable acceptance");
  if (env.HOTEL_ANONYMOUS_HOLD_OPERATIONAL_ENABLED === "1" || env.HOTEL_PAYMENT_OPERATIONAL_ENABLED === "1" || env.HOTEL_PAYMENT_SIMULATOR_ENABLED === "1" || env.HOTEL_SMS_ENABLED === "1" || env.CUSTOMER_AUTH_SMS_WORKER_ENABLED === "1") throw new Error("Anonymous holds, payment processing/simulation, and SMS must stay disabled");
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

    const checkIn = daysFromNow(3);
    const checkOut = daysFromNow(4);
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
    await staffPage.reload();
    await expect(staffPage.getByText(reservation.reference, { exact: true })).toBeVisible();

    const confirmed = await api(staffPage, reservationsPath(organizationId, propertyId), { method: "POST", key: key("confirm"), body: { action: "confirm-reservation", reservationId: reservation.id } });
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
    expect(confirmed.body.reservation?.status).toBe("CONFIRMED");

    const assigned = await api(staffPage, reservationsPath(organizationId, propertyId), { method: "POST", key: key("assign"), body: { action: "assign-room", reservationId: reservation.id, roomId: fixture.roomId } });
    expect(assigned.status, JSON.stringify(assigned.body)).toBe(200);
    expect(assigned.body.reservation?.status).toBe("CONFIRMED");

    const checkedIn = await api(staffPage, reservationsPath(organizationId, propertyId), { method: "POST", key: key("check-in"), body: { action: "check-in", reservationId: reservation.id } });
    expect(checkedIn.status, JSON.stringify(checkedIn.body)).toBe(200);
    expect(checkedIn.body.reservation?.status).toBe("CHECKED_IN");

    const checkedOut = await api(staffPage, reservationsPath(organizationId, propertyId), { method: "POST", key: key("check-out"), body: { action: "check-out", reservationId: reservation.id } });
    expect(checkedOut.status, JSON.stringify(checkedOut.body)).toBe(200);
    expect(checkedOut.body.reservation?.status).toBe("CHECKED_OUT");

    const staffCrossTenant = await api(staffPage, reservationsPath(foreignOrganizationId, foreignPropertyId));
    expect([403, 404]).toContain(staffCrossTenant.status);
  } finally {
    await Promise.all([guestContext.close(), staffContext.close()]);
  }
});
