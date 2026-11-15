import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
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
  if (appOrigin !== "http://127.0.0.1:3000" || tenantHostname !== "damoon-hotel.localhost" || standaloneOrigin !== "http://damoon-hotel.localhost:8080") throw new Error("Only the synthetic loopback-mapped Damoon test origins are permitted");
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
    expect(reservation.checkIn).toBe(checkIn);
    expect(reservation.checkOut).toBe(checkOut);
    await guestPage.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
    await expect(guestPage.getByText(reservation.reference, { exact: true })).toBeVisible();
    const persisted = await api(guestPage, reservationsPath(organizationId, propertyId));
    expect(persisted.status).toBe(200);
    expect(persisted.body.reservations.some((item) => item.id === reservation.id)).toBe(true);
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
    await staffPage.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
    await expect(staffPage.getByText(reservation.reference, { exact: true })).toBeVisible({ timeout: 10_000 });

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
