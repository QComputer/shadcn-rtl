import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { chromium, expect } from "playwright/test";

function failClosed() {
  const env = process.env;
  if (env.CI !== "true" || env.NODE_ENV !== "test" || env.DAMOON_E2E_ENABLED !== "1" || env.VERCEL_ENV === "production") {
    throw new Error("Shared Damoon acceptance requires NODE_ENV=test and DAMOON_E2E_ENABLED=1");
  }
  if (env.HOTEL_GUEST_BOOKING_REQUEST_ENABLED !== "1" || env.HOTEL_PUBLICATION_OPERATIONAL_ENABLED !== "1" || env.HOTEL_ANONYMOUS_HOLD_OPERATIONAL_ENABLED !== "0" || env.HOTEL_CRON_SCHEDULER_ENABLED !== "0" || env.HOTEL_PAYMENT_OPERATIONAL_ENABLED !== "0" || env.HOTEL_PAYMENT_SIMULATOR_ENABLED !== "0" || env.HOTEL_SMS_ENABLED !== "0" || env.CUSTOMER_AUTH_SMS_WORKER_ENABLED !== "0") {
    throw new Error("Only disposable guest-request and publication gates may be enabled; hold, scheduler, payment, and SMS gates must stay disabled");
  }
  const databaseUrl = new URL(env.DATABASE_URL || "");
  const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
  const local = env.DAMOON_LOCAL_E2E === "1";
  const validCiDb = databaseUrl.port === "5432" && databaseUrl.username === "postgres" && databaseUrl.password === "postgres" && /^damoon_[a-f0-9]{16}$/i.test(databaseName);
  const validLocalDb = databaseUrl.port === env.LOCAL_PRISMA_EXPECTED_PORT && /^damoon_test_[a-f0-9]{16}$/i.test(databaseUrl.username) && /^damoon_[a-f0-9]{16}$/i.test(databaseName) && Boolean(databaseUrl.password);
  if (env.DATABASE_URL !== env.DIRECT_URL || databaseUrl.protocol !== "postgresql:" || databaseUrl.hostname !== "127.0.0.1" || (!local && !validCiDb) || (local && !validLocalDb) || databaseUrl.searchParams.get("schema") !== "public" || env.DAMOON_CI_DATABASE_NAME !== databaseName) {
    throw new Error("Shared Damoon acceptance requires the exact workflow-owned disposable loopback database");
  }
  const sharedUrl = new URL(env.DAMOON_SHARED_RUNTIME_URL || "");
  const nextPort = local ? env.DAMOON_NEXT_PORT : "3000";
  if (sharedUrl.protocol !== "http:" || sharedUrl.hostname !== "damoon-hotel.ir" || sharedUrl.port !== nextPort || sharedUrl.pathname !== "/") {
    throw new Error("Shared runtime URL must be the test-only Damoon host mapped to Next on port 3000");
  }
  for (const name of ["DAMOON_ORGANIZATION_ID", "DAMOON_PROPERTY_ID", "DAMOON_PROPERTY_SLUG", "DAMOON_ROOM_TYPE_SLUG", "DAMOON_RATE_PLAN_CODE"]) {
    if (!env[name]?.trim()) throw new Error(`${name} is required for the seeded disposable fixture`);
  }
  return { databaseName, sharedUrl };
}

function isLoopbackAddress(address) {
  return address === "::1" || /^127(?:\.\d{1,3}){3}$/.test(address);
}

function localHostResolverArgs() {
  return process.env.DAMOON_LOCAL_E2E === "1"
    ? [`--host-resolver-rules=MAP damoon-hotel.ir 127.0.0.1, MAP ${process.env.DAMOON_FOREIGN_HOST} 127.0.0.1`]
    : [];
}

function dateAtOffset(offset, timeZone = "UTC", at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);

  const read = (type) => parts.find((part) => part.type === type).value;
  const date = new Date(`${read("year")}-${read("month")}-${read("day")}T00:00:00.000Z`);

  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

async function inventorySnapshot(prisma, input, roomTypeId, checkIn, checkOut) {
  const rows = await prisma.hotelInventory.findMany({
    where: { organizationId: input.organizationId, propertyId: input.propertyId, roomTypeId, date: { gte: new Date(`${checkIn}T00:00:00.000Z`), lt: new Date(`${checkOut}T00:00:00.000Z`) } },
    orderBy: { date: "asc" },
    select: { date: true, allotment: true, booked: true, held: true, outOfService: true },
  });
  return rows.map(row => ({ date: row.date.toISOString().slice(0, 10), allotment: row.allotment, booked: row.booked, held: row.held, outOfService: row.outOfService }));
}

test("shared public Damoon bundle submits and tracks a persisted request through same-origin Next APIs", { timeout: 90000 }, async () => {
  const { databaseName, sharedUrl } = failClosed();
  const resolutions = process.env.DAMOON_LOCAL_E2E === "1" ? [{ address: "127.0.0.1" }] : await lookup(sharedUrl.hostname, { all: true, verbatim: true });
  if (!resolutions.length || resolutions.some(({ address }) => !isLoopbackAddress(address))) {
    throw new Error("Damoon shared-runtime host must resolve exclusively to loopback before browser access");
  }
  const prisma = new PrismaClient();
  let browser;
  try {
    await prisma.$connect();
    const [identity] = await prisma.$queryRaw`SELECT current_database() AS "databaseName", current_user AS "userName", current_schema() AS "schemaName", current_setting('server_version_num')::int AS version`;
    if (identity?.databaseName !== databaseName || identity.userName !== "postgres" || identity.schemaName !== "public" || identity.version < 170000 || identity.version >= 180000) {
      throw new Error("Prisma is not connected to the expected disposable PostgreSQL 17 database");
    }

    const input = {
      organizationId: process.env.DAMOON_ORGANIZATION_ID,
      propertyId: process.env.DAMOON_PROPERTY_ID,
    };
    const property = await prisma.hotelProperty.findFirst({ where: { id: input.propertyId, organizationId: input.organizationId, slug: process.env.DAMOON_PROPERTY_SLUG }, select: { id: true, organizationId: true } });
    assert.ok(property, "seeded Damoon property belongs to the expected synthetic organization");
    const roomType = await prisma.hotelRoomType.findFirst({ where: { organizationId: input.organizationId, propertyId: input.propertyId, slug: process.env.DAMOON_ROOM_TYPE_SLUG }, select: { id: true } });
    assert.ok(roomType, "seeded room type is tenant and property scoped");

    const checkIn = dateAtOffset(7);
    const checkOut = dateAtOffset(9);
    const initialInventory = await inventorySnapshot(prisma, input, roomType.id, checkIn, checkOut);
    assert.equal(initialInventory.length, 2, "seeded fixture covers both requested nights");
    const runId = randomUUID();
    const email = `shared-${runId}@example.test`;
    assert.equal(await prisma.hotelGuestBookingRequest.count({ where: { organizationId: input.organizationId, propertyId: input.propertyId, guestEmail: email } }), 0);

    browser = await chromium.launch({ headless: true, args: localHostResolverArgs() });
    const page = await browser.newPage();
    const appErrors = [];
    page.on("pageerror", error => appErrors.push(error.message));
    const stayQuery = new URLSearchParams({ property: process.env.DAMOON_PROPERTY_SLUG, checkIn, checkOut, adults: "2", children: "0" });
    await page.goto(new URL(`fa/hotel-reservations/start?${stayQuery}`, sharedUrl).href, { waitUntil: "networkidle" });
    assert.equal(new URL(page.url()).pathname, "/fa/hotel-reservations/start", "direct anonymous GET must stay on the standalone request-only route");
    await expect(page.locator("html")).toHaveAttribute("lang", "fa");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("[data-track-request]")).toBeVisible();
    await page.locator("[data-adult-count]").selectOption("2");
    await page.locator("[data-child-count]").selectOption("0");

    const reservationOperations = [];
    page.on("request", request => { if (/\/api\/hotel\/v1\/(availability|holds|reservations|payments)(\/|$)/.test(new URL(request.url()).pathname)) reservationOperations.push(new URL(request.url()).pathname); });
    await page.locator(".booking-form .booking-submit[type=submit]").click();
    await expect(page.locator("[data-coordination-name]")).toBeVisible();
    assert.deepEqual(reservationOperations, [], "request-only stay entry must not query availability or call reservation/payment operations");
    await page.locator("[data-coordination-name]").fill("Shared Runtime Test Guest");
    await page.locator("[data-coordination-phone]").fill("+989123456789");
    await page.locator("[data-coordination-email]").fill(email);
    await page.locator("[data-coordination-note]").fill("Automated disposable acceptance");

    const requestResponsePromise = page.waitForResponse(response => response.url().endsWith("/api/hotel/v1/requests") && response.request().method() === "POST", { timeout: 15000 });
    await page.locator("[data-create-coordination-request]").click();
    const requestResponse = await requestResponsePromise;
    assert.equal(requestResponse.status(), 201, await requestResponse.text());
    assert.deepEqual(reservationOperations, [], "submitting coordination must not call availability, hold, reservation, or payment operations");
    const result = await requestResponse.json();
    assert.equal(result.status, "RECEIVED");
    assert.equal(result.inventoryReserved, false);
    assert.equal(result.bookingConfirmed, false);
    assert.ok(typeof result.reference === "string" && result.reference.length >= 40);
    const submittedPayload = requestResponse.request().postDataJSON();
    assert.equal(submittedPayload.kind, "coordination");
    assert.equal(submittedPayload.property, process.env.DAMOON_PROPERTY_SLUG);
    for (const unapprovedField of ["roomType", "ratePlan", "price", "totalRate", "payment"]) assert.equal(unapprovedField in submittedPayload, false);
    await expect(page.locator("[data-booking-flow] .booking-step--confirmed")).toContainText("درخواست هماهنگی برای پذیرش ارسال شد");

    const statusResponsePromise = page.waitForResponse(response => response.url().endsWith("/api/hotel/v1/requests/status") && response.request().method() === "POST", { timeout: 15000 });
    await page.locator("[data-track-reference]").fill(result.reference);
    await page.locator("[data-track-request] button[type=submit]").click();
    const statusResponse = await statusResponsePromise;
    assert.equal(statusResponse.status(), 200, await statusResponse.text());
    const status = await statusResponse.json();
    assert.equal(status.status, "RECEIVED");
    assert.equal("availabilityHint" in status, false);
    for (const privateField of ["guestName", "guestPhone", "guestEmail", "checkIn", "checkOut", "organizationId"]) assert.equal(privateField in status, false);
    await expect(page.locator("[data-track-result]")).toContainText("دریافت‌شده");

    const persisted = await prisma.hotelGuestBookingRequest.findMany({
      where: { organizationId: input.organizationId, propertyId: input.propertyId, guestEmail: email },
      select: { status: true, availabilityHint: true, roomTypeSlug: true, ratePlanCode: true, checkIn: true, checkOut: true, adults: true, children: true, guestNote: true },
    });
    assert.equal(persisted.length, 1, "one row is durably persisted for the unique synthetic email");
    assert.deepEqual(persisted[0], {
      status: "RECEIVED",
      availabilityHint: "UNKNOWN",
      roomTypeSlug: null,
      ratePlanCode: null,
      checkIn: new Date(`${checkIn}T00:00:00.000Z`),
      checkOut: new Date(`${checkOut}T00:00:00.000Z`),
      adults: 2,
      children: 0,
      guestNote: "Automated disposable acceptance",
    });
    assert.deepEqual(await inventorySnapshot(prisma, input, roomType.id, checkIn, checkOut), initialInventory, "guest request leaves inventory unchanged");
    assert.equal(await prisma.hotelBookingHold.count({ where: { organizationId: input.organizationId, propertyId: input.propertyId } }), 0);
    assert.equal(await prisma.hotelReservation.count({ where: { organizationId: input.organizationId, propertyId: input.propertyId } }), 0);
    assert.equal(await prisma.hotelPaymentAllocation.count({ where: { organizationId: input.organizationId } }), 0);
    assert.equal(await prisma.paymentRequest.count({ where: { organizationId: input.organizationId } }), 0);
    assert.deepEqual(appErrors, [], "shared bundle has no browser module/runtime errors");
  } finally {
    await browser?.close();
    await prisma.$disconnect();
  }
});

test('shared accommodation tour preserves category and stay across locales and viewports', { timeout: 90000 }, async () => {
  const { sharedUrl } = failClosed();
  const browser = await chromium.launch({ headless: true, args: localHostResolverArgs() });
  try {
    const checkIn = dateAtOffset(7);
    const checkOut = dateAtOffset(8);
    for (const locale of ['fa','en','ar']) {
      for (const viewport of [{width:375,height:800},{width:1280,height:800}]) {
        const page = await browser.newPage({ viewport });
        await page.route('https://andarama.bazarbaaz.ir/**', route => route.fulfill({status:200, contentType:'text/html', body:'<title>Conceptual tour fixture</title>'}));
        const query = new URLSearchParams({checkIn,checkOut,adults:'2',guests:'2',children:'0'});
        await page.goto(new URL(`${locale}/rooms/studio-suite?${query}`, sharedUrl).href, {waitUntil:'domcontentloaded'});
        await page.locator('.accommodation-gallery a[href*="/virtual-tour"]').click();
        await page.waitForURL('**/virtual-tour?**');
        assert.equal(new URL(page.url()).searchParams.get('room'), 'studio-suite');
        assert.equal(new URL(page.url()).searchParams.get('checkIn'), checkIn);
        assert.equal(new URL(page.url()).searchParams.get('checkOut'), checkOut);
        assert.equal(new URL(page.url()).searchParams.get('adults'), '2');
        await page.locator('a[href*="/rooms/studio-suite"]').first().click();
        await page.waitForURL('**/rooms/studio-suite?**');
        assert.equal(new URL(page.url()).searchParams.get('checkIn'), checkIn);
        await page.goto(new URL(`${locale}/contact?room=studio-suite&${query}`, sharedUrl).href, {waitUntil:'domcontentloaded'});
        await expect(page.locator('[data-coordination-request]')).toBeVisible();
        await page.close();
      }
    }
  } finally { await browser.close(); }
});

test("Damoon DEMO_BOOKING completes simulated payment and is visible in authorized reception", { timeout: 90000 }, async () => {
  const { databaseName, sharedUrl } = failClosed();
  const env = process.env;
  for (const name of ["DAMOON_ORGANIZATION_ID", "DAMOON_DEMO_PROPERTY_ID", "DAMOON_DEMO_ROOM_TYPE_ID", "DAMOON_MANAGER_USERNAME", "DAMOON_MANAGER_PASSWORD", "DAMOON_APP_URL"]) assert.ok(env[name], `${name} is required`);
  const prisma = new PrismaClient();
  const browser = await chromium.launch({ headless: true, args: localHostResolverArgs() });
  let managerContext;
  try {
    await prisma.$connect();
    const [identity] = await prisma.$queryRaw`SELECT current_database() AS "databaseName", current_user AS "userName"`;
    assert.equal(identity?.databaseName, databaseName);
    assert.equal(identity?.userName, "postgres");
    const orgId = env.DAMOON_ORGANIZATION_ID;
    const propertyId = env.DAMOON_DEMO_PROPERTY_ID;
    const before = await prisma.hotelReservation.count({ where: { organizationId: orgId, propertyId } });
    const paymentsBefore = await prisma.paymentRequest.count({ where: { organizationId: orgId } });
    const checkIn = dateAtOffset(7), checkOut = dateAtOffset(9);
    const url = new URL("fa/hotel-reservations/start", sharedUrl);
    url.search = new URLSearchParams({ mode: "DEMO_BOOKING", property: "damoon-demo", checkIn, checkOut, adults: "2", children: "0" }).toString();
    const guest = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const appErrors = [];
    guest.on("pageerror", error => appErrors.push(error.message));
    const apiPaths = [];
    guest.on("request", request => { const path = new URL(request.url()).pathname; if (path.startsWith("/api/hotel/v1/")) apiPaths.push(path); });
    await guest.goto(url.href, { waitUntil: "networkidle" });
    await expect(guest.locator("html")).toHaveAttribute("lang", "fa");
    await expect(guest.locator(".booking-demo-entry")).toHaveCount(0);
    await guest.locator(".booking-form .booking-submit[type=submit]").click();
    await expect(guest.locator("[data-select-option]").first()).toBeVisible({ timeout: 15000 });
    await guest.locator("[data-select-option]").first().click();
    await expect(guest.locator("[data-policy-accept]")).toBeVisible();
    await guest.locator("[data-policy-accept]").check();
    const holdResponse = guest.waitForResponse(response => response.url().endsWith("/api/hotel/v1/holds") && response.request().method() === "POST");
    await guest.locator("[data-create-hold]").click();
    const hold = await holdResponse;
    assert.ok([200, 201].includes(hold.status()), await hold.text());
    await expect(guest.locator(".booking-step--demo")).toContainText("کد نمایشی");
    await expect(guest.locator(".booking-step--demo")).toContainText("آمادهٔ پرداخت شبیه‌سازی‌شده");
    const demoPayment = guest.waitForResponse(response => response.url().endsWith("/api/hotel/v1/demo-payments") && response.request().method() === "POST");
    await guest.locator('[data-demo-payment="SUCCESS"]').click();
    const paymentResponse = await demoPayment;
    assert.equal(paymentResponse.status(), 200, await paymentResponse.text());
    const payment = await paymentResponse.json();
    assert.equal(payment.mode, "DEMO_BOOKING");
    assert.equal(payment.charged, false);
    assert.equal(payment.reservationStatus, "CONFIRMED");
    await expect(guest.locator(".booking-step--demo")).toContainText("رزرو نمایشی تأیید شد");
    assert.ok(apiPaths.includes("/api/hotel/v1/availability/search"));
    assert.ok(apiPaths.includes("/api/hotel/v1/holds"));
    assert.ok(apiPaths.includes("/api/hotel/v1/reservations"));
    assert.ok(apiPaths.includes("/api/hotel/v1/demo-payments"));
    assert.equal(apiPaths.some(path => /sandbox-payments|\/payments(?:\/|$)/.test(path)), false, "demo does not call real or sandbox payment processing APIs");

    const rows = await prisma.hotelReservation.findMany({ where: { organizationId: orgId, propertyId }, orderBy: { createdAt: "desc" }, take: 1, include: { guests: true } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "CONFIRMED");
    assert.equal(rows[0].totalAmount, BigInt(250_000));
    assert.deepEqual(rows[0].guests.map(row => row.fullName), ["Demo Guest"]);
    assert.equal(await prisma.hotelBookingHold.count({ where: { organizationId: orgId, propertyId, status: "CONSUMED" } }), 1);
    assert.equal(await prisma.paymentRequest.count({ where: { organizationId: orgId } }), paymentsBefore, "simulated payment creates no payment request");
    assert.equal(await prisma.hotelPaymentAllocation.count({ where: { organizationId: orgId, hotelReservationId: rows[0].id } }), 0, "simulated payment creates no ledger allocation");

    const manager = await browser.newContext();
    managerContext = manager;
    const managerPage = await manager.newPage();
    const appOrigin = new URL(env.DAMOON_APP_URL).origin;
    const receptionPath = `/fa/hotel-reservations/${orgId}/${propertyId}`;
    const callbackUrl = `${appOrigin}${receptionPath}`;
    await managerPage.goto(`${appOrigin}/fa/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    await managerPage.locator("#username").fill(env.DAMOON_MANAGER_USERNAME);
    await managerPage.locator("#password").fill(env.DAMOON_MANAGER_PASSWORD);
    await managerPage.locator('form button[type="submit"]').click();
    await managerPage.waitForURL(url => url.pathname === receptionPath, { timeout: 30000 });
    await expect(managerPage.locator("text=رزرو نمایشی").first()).toBeVisible({ timeout: 15000 });
    await expect(managerPage.locator("text=Demo Guest")).toBeVisible();
    await expect(managerPage.getByText("Demo Guest · DEMO — Synthetic double room", { exact: true })).toBeVisible();
    await expect(managerPage.locator("text=موفق (شبیه‌سازی)")).toBeVisible();
    const catalogRates = { "demo-single": 110000, "demo-double": 125000, "demo-suite-3": 175000, "demo-suite-4": 210000, "demo-suite-5": 240000 };
    const provisionUrl = new URL("/api/hotel/v1/demo-bookings/provision", env.DAMOON_APP_URL).href;
    const unconfiguredCatalog = await managerPage.request.get(provisionUrl);
    assert.equal(unconfiguredCatalog.status(), 200, await unconfiguredCatalog.text());
    assert.equal((await unconfiguredCatalog.json()).configured, false, "a partial catalog cannot be reported as ready");
    const catalogBody = { catalogVersion: "DAMOON_31_UNIT_V1", rates: catalogRates };
    const provision = await managerPage.request.post(provisionUrl, { headers: { Origin: appOrigin, "Content-Type": "application/json" }, data: catalogBody });
    assert.equal(provision.status(), 200, await provision.text());
    const catalog = await provision.json();
    assert.equal(catalog.propertyId, propertyId);
    assert.equal(catalog.catalogVersion, "DAMOON_31_UNIT_V1");
    assert.equal(catalog.totalUnits, 31);
    assert.deepEqual(catalog.categories.map(category => [category.slug, category.quantity, category.physicalRoomCount]), [
      ["demo-single", 3, 3], ["demo-double", 17, 17], ["demo-suite-3", 6, 6], ["demo-suite-4", 3, 3], ["demo-suite-5", 2, 2],
    ]);
    assert.deepEqual(Object.fromEntries(catalog.categories.map(category => [category.slug, Number(category.nightlyRate)])), catalogRates);
    const configuredCatalog = await managerPage.request.get(provisionUrl);
    assert.equal(configuredCatalog.status(), 200, await configuredCatalog.text());
    const configured = await configuredCatalog.json();
    assert.equal(configured.configured, true);
    assert.equal(configured.physicalRoomCount, 31);
    assert.deepEqual(configured.categories.map(category => [category.slug, category.quantity, category.physicalRoomCount]), [
      ["demo-single", 3, 3], ["demo-double", 17, 17], ["demo-suite-3", 6, 6], ["demo-suite-4", 3, 3], ["demo-suite-5", 2, 2],
    ]);
    const repeat = await managerPage.request.post(provisionUrl, { headers: { Origin: appOrigin, "Content-Type": "application/json" }, data: catalogBody });
    assert.equal(repeat.status(), 200, await repeat.text());
    assert.equal(await prisma.hotelRoom.count({ where: { organizationId: orgId, propertyId } }), 31, "repeat setup does not duplicate synthetic physical rooms");
    assert.equal(await prisma.hotelReservation.count({ where: { organizationId: orgId, propertyId } }), before + 1, "catalog setup preserves existing demo bookings");
    const crossPropertyRoomCount = await prisma.hotelRoom.count({ where: { organizationId: env.DAMOON_FOREIGN_ORGANIZATION_ID } });
    assert.equal(crossPropertyRoomCount, 0, "synthetic room setup does not create rooms for another tenant");
    await managerPage.reload({ waitUntil: "domcontentloaded" });
    await expect(managerPage.getByText(/کاتالوگ پیشنهادی: 31 واحد آزمایشی/)).toBeVisible();
    await expect(managerPage.getByText(/اتاق یک‌نفره: 3/)).toBeVisible();
    await expect(managerPage.getByText(/اتاق دونفره: 17/)).toBeVisible();
    await expect(managerPage.getByRole("region", { name: "ثبت رزرو حضوری" })).toBeVisible();
    const reservationApi = new URL(`/api/organizations/${orgId}/hotels/${propertyId}/reservations`, env.DAMOON_APP_URL);
    const snapshotResponse = await managerPage.request.get(`${reservationApi.href}?view=center`);
    assert.equal(snapshotResponse.status(), 200, await snapshotResponse.text());
    const snapshot = await snapshotResponse.json();
    assert.equal(snapshot.demoBooking, true);
    assert.equal(snapshot.maintenanceAvailable, true, "disposable PostgreSQL includes maintenance integrity schema");
    assert.equal(snapshot.manualRoomManagementEnabled, true, "manual reception actions are enabled for the isolated demo only");
    assert.equal(snapshot.rooms.length, 31);
    const demoDouble = catalog.categories.find(category => category.slug === "demo-double");
    const demoRoom = await prisma.hotelRoom.findFirstOrThrow({ where: { organizationId: orgId, propertyId, roomTypeId: demoDouble.roomTypeId }, orderBy: { code: "asc" }, select: { id: true } });
    const assign = await managerPage.request.post(reservationApi.href, { headers: { Origin: appOrigin, "Content-Type": "application/json", "Idempotency-Key": randomUUID() }, data: { action: "assign-room", reservationId: rows[0].id, roomId: demoRoom.id } });
    assert.equal(assign.status(), 200, await assign.text());
    const manualUrl = new URL(`/api/organizations/${orgId}/hotels/${propertyId}/reservations/manual`, env.DAMOON_APP_URL).href;
    const manualKey = randomUUID();
    const manualProperty = await prisma.hotelProperty.findFirstOrThrow({
      where: { id: propertyId, organizationId: orgId },
      select: { timezone: true },
    });
    const manualNow = new Date();
    const manualPayload = { roomId: demoRoom.id, roomTypeId: demoDouble.roomTypeId, ratePlanId: demoDouble.ratePlanId, checkIn: dateAtOffset(0, manualProperty.timezone, manualNow), checkOut: dateAtOffset(1, manualProperty.timezone, manualNow), adults: 1, childAges: [], source: "PHONE", guests: [{ fullName: "Synthetic Telephone Guest", isPrimary: true }] };
    const manual = await managerPage.request.post(manualUrl, { headers: { Origin: appOrigin, "Content-Type": "application/json", "Idempotency-Key": manualKey }, data: manualPayload });
    assert.equal(manual.status(), 200, await manual.text());
    const manualResult = await manual.json();
    assert.equal(manualResult.status, "CONFIRMED");
    const manualReplay = await managerPage.request.post(manualUrl, { headers: { Origin: appOrigin, "Content-Type": "application/json", "Idempotency-Key": manualKey }, data: manualPayload });
    assert.equal(manualReplay.status(), 200, await manualReplay.text());
    assert.equal((await manualReplay.json()).reference, manualResult.reference, "phone reservation retries return the original reference");
    const conflictReplay = await managerPage.request.post(manualUrl, { headers: { Origin: appOrigin, "Content-Type": "application/json", "Idempotency-Key": manualKey }, data: { ...manualPayload, source: "WALK_IN" } });
    assert.equal(conflictReplay.status(), 409, "a changed payload cannot silently create another manual reservation");
    // P1B: real transaction on the disposable fixture. Same-day dates use property time.
    const changeAction = (data, key = randomUUID()) => managerPage.request.post(reservationApi.href, { headers: { Origin: appOrigin, "Content-Type": "application/json", "Idempotency-Key": key }, data });
    // No-show cannot be recorded on the scheduled arrival day.
    const prematureNoShow = await changeAction({ action: "mark-no-show", reservationId: manualResult.reservationId });
    assert.equal(prematureNoShow.status(), 422, await prematureNoShow.text());
    assert.equal((await prisma.hotelReservation.findUniqueOrThrow({ where: { id: manualResult.reservationId } })).status, "CONFIRMED");
    const extendedOut = dateAtOffset(2, manualProperty.timezone, manualNow);
    const extendedDate = dateAtOffset(1, manualProperty.timezone, manualNow);
    const addedInventory = await prisma.hotelInventory.findFirstOrThrow({ where: { organizationId: orgId, propertyId, roomTypeId: demoDouble.roomTypeId, date: new Date(extendedDate + "T00:00:00.000Z") } });
    const previewCommand = { action: "preview-amend-stay", reservationId: manualResult.reservationId, checkIn: manualPayload.checkIn, checkOut: extendedOut };
    const previewResponse = await changeAction(previewCommand);
    assert.equal(previewResponse.status(), 200, await previewResponse.text());
    const preview = (await previewResponse.json()).amendment;
    assert.equal(preview.previousTotal, "125000");
    assert.equal(preview.total, "250000");
    assert.deepEqual(preview.added, [extendedDate]);
    assert.equal((await prisma.hotelInventory.findUniqueOrThrow({ where: { id: addedInventory.id } })).booked, addedInventory.booked, "preview does not claim inventory");
    const extendCommand = { ...previewCommand, action: "amend-stay", expectedVersion: preview.version, expectedTotal: preview.total };
    const extendKey = randomUUID();
    const extend = await changeAction(extendCommand, extendKey);
    assert.equal(extend.status(), 200, await extend.text());
    const extended = await prisma.hotelReservation.findFirstOrThrow({ where: { id: manualResult.reservationId, organizationId: orgId, propertyId }, include: { nights: true, hold: true } });
    assert.equal(extended.totalAmount, 250000n);
    assert.equal(extended.nights.length, 2);
    assert.equal(extended.hold.checkOut.toISOString().slice(0,10), extendedOut);
    assert.equal((await prisma.hotelInventory.findUniqueOrThrow({ where: { id: addedInventory.id } })).booked, addedInventory.booked + 1);
    const replayExtend = await changeAction(extendCommand, extendKey);
    assert.equal(replayExtend.status(), 200, await replayExtend.text());
    assert.equal((await prisma.hotelInventory.findUniqueOrThrow({ where: { id: addedInventory.id } })).booked, addedInventory.booked + 1, "amendment retry must not duplicate inventory");
    const staleExtend = await changeAction(extendCommand);
    assert.equal(staleExtend.status(), 409, "stale preview rejected");
    const checkInAction = await managerPage.request.post(reservationApi.href, { headers: { Origin: appOrigin, "Content-Type": "application/json", "Idempotency-Key": randomUUID() }, data: { action: "check-in", reservationId: manualResult.reservationId } });
    assert.equal(checkInAction.status(), 200, await checkInAction.text());
    assert.equal((await checkInAction.json()).reservation.status, "CHECKED_IN");
    const destination = await prisma.hotelRoom.findFirstOrThrow({ where: { organizationId: orgId, propertyId, roomTypeId: demoDouble.roomTypeId, id: { not: demoRoom.id } }, orderBy: { code: "asc" }, select: { id: true } });
    const move = await changeAction({ action: "move-room", reservationId: manualResult.reservationId, roomId: destination.id, expectedRoomId: demoRoom.id });
    assert.equal(move.status(), 200, await move.text());
    const movedNights = await prisma.hotelReservationRoom.findMany({ where: { organizationId: orgId, reservationId: manualResult.reservationId } });
    assert.equal(movedNights.length, 2);
    assert.ok(movedNights.every(night => night.roomId === destination.id));
    const shortenCommand = { action: "preview-amend-stay", reservationId: manualResult.reservationId, checkIn: manualPayload.checkIn, checkOut: manualPayload.checkOut };
    const shortenResponse = await changeAction(shortenCommand);
    assert.equal(shortenResponse.status(), 200, await shortenResponse.text());
    const shorten = (await shortenResponse.json()).amendment;
    assert.equal(shorten.total, "125000");
    assert.deepEqual(shorten.removed, [extendedDate]);
    const shortenApply = await changeAction({ ...shortenCommand, action: "amend-stay", expectedVersion: shorten.version, expectedTotal: shorten.total });
    assert.equal(shortenApply.status(), 200, await shortenApply.text());
    assert.equal((await prisma.hotelInventory.findUniqueOrThrow({ where: { id: addedInventory.id } })).booked, addedInventory.booked, "shortening releases only removed nights");
    const shortened = await prisma.hotelReservation.findFirstOrThrow({ where: { id: manualResult.reservationId, organizationId: orgId, propertyId }, include: { nights: true, hold: true } });
    assert.equal(shortened.totalAmount, 125000n);
    assert.equal(shortened.nights.length, 1);
    assert.equal(shortened.nights[0].roomId, destination.id);
    assert.equal(shortened.hold.checkOut.toISOString().slice(0,10), manualPayload.checkOut);
    assert.equal(await prisma.paymentRequest.count({ where: { organizationId: orgId } }), paymentsBefore);
    const checkOutAction = await managerPage.request.post(reservationApi.href, { headers: { Origin: appOrigin, "Content-Type": "application/json", "Idempotency-Key": randomUUID() }, data: { action: "check-out", reservationId: manualResult.reservationId } });
    assert.equal(checkOutAction.status(), 200, await checkOutAction.text());
    assert.equal((await checkOutAction.json()).reservation.status, "CHECKED_OUT");
    // P1C-A: make a past-due fixture through the existing manual path, then move only
    // that synthetic fixture to yesterday inside this already fail-closed disposable DB.
    const noShowCreated = await managerPage.request.post(manualUrl, { headers: { Origin: appOrigin, "Content-Type": "application/json", "Idempotency-Key": randomUUID() }, data: { ...manualPayload, guests: [{ fullName: "Synthetic Absent Guest", isPrimary: true }] } });
    assert.equal(noShowCreated.status(), 200, await noShowCreated.text());
    const noShowId = (await noShowCreated.json()).reservationId;
    const pastDate = new Date(dateAtOffset(-1, manualProperty.timezone, manualNow) + "T00:00:00.000Z");
    const currentDate = new Date(manualPayload.checkIn + "T00:00:00.000Z");
    const pastInventory = await prisma.$transaction(async tx => {
      const fixture = await tx.hotelReservation.findFirstOrThrow({ where: { id: noShowId, organizationId: orgId, propertyId }, include: { nights: true, hold: true } });
      assert.equal(fixture.nights.length, 1);
      assert.ok(fixture.holdId);
      const currentInventory = await tx.hotelInventory.findFirstOrThrow({ where: { organizationId: orgId, propertyId, roomTypeId: demoDouble.roomTypeId, date: currentDate } });
      const past = await tx.hotelInventory.upsert({ where: { roomTypeId_date: { roomTypeId: demoDouble.roomTypeId, date: pastDate } }, create: { organizationId: orgId, propertyId, roomTypeId: demoDouble.roomTypeId, date: pastDate, allotment: currentInventory.allotment, booked: 1 }, update: { booked: { increment: 1 } } });
      await tx.hotelInventory.update({ where: { id: currentInventory.id }, data: { booked: { decrement: 1 } } });
      await tx.hotelReservationRoom.update({ where: { id: fixture.nights[0].id }, data: { date: pastDate } });
      await tx.hotelBookingHold.update({ where: { id: fixture.holdId }, data: { checkIn: pastDate, checkOut: currentDate } });
      await tx.hotelReservation.update({ where: { id: noShowId }, data: { checkIn: pastDate, checkOut: currentDate } });
      return past;
    });
    const noShowCommand = { action: "mark-no-show", reservationId: noShowId };
    const noShowKey = randomUUID();
    const noShow = await changeAction(noShowCommand, noShowKey);
    assert.equal(noShow.status(), 200, await noShow.text());
    assert.equal((await noShow.json()).reservation.status, "NO_SHOW");
    const absent = await prisma.hotelReservation.findFirstOrThrow({ where: { id: noShowId, organizationId: orgId, propertyId }, include: { nights: true } });
    assert.equal(absent.totalAmount, 125000n);
    assert.equal(absent.paidAmount, 0n);
    assert.equal(absent.nights[0].roomId, null);
    assert.equal((await prisma.hotelInventory.findUniqueOrThrow({ where: { id: pastInventory.id } })).booked, pastInventory.booked - 1);
    const noShowReplay = await changeAction(noShowCommand, noShowKey);
    assert.equal(noShowReplay.status(), 200, await noShowReplay.text());
    const duplicateNoShow = await changeAction(noShowCommand);
    assert.equal(duplicateNoShow.status(), 422, await duplicateNoShow.text());
    assert.equal((await prisma.hotelInventory.findUniqueOrThrow({ where: { id: pastInventory.id } })).booked, pastInventory.booked - 1);
    assert.equal(await prisma.paymentRequest.count({ where: { organizationId: orgId } }), paymentsBefore);
    const professionalCenter = await managerPage.request.get(`${reservationApi.href}?view=center`);
    assert.equal(professionalCenter.status(), 200, await professionalCenter.text());
    const professionalSnapshot = await professionalCenter.json();
    const absentDetails = professionalSnapshot.reservations.find(row => row.id === noShowId);
    assert.equal(absentDetails.guests[0].fullName, "Synthetic Absent Guest");
    assert.ok(!Object.hasOwn(absentDetails.guests[0], "phoneHash"));
    assert.equal(professionalSnapshot.receptionHistory.filter(event => event.reservationId === noShowId && event.action === "mark-no-show").length, 1);
    assert.ok(professionalSnapshot.receptionHistory.every(event => !Object.hasOwn(event, "resultJson") && !Object.hasOwn(event, "actorUserId")));
    const foreignCenter = await managerPage.request.get(new URL(`/api/organizations/${env.DAMOON_FOREIGN_ORGANIZATION_ID}/hotels/${env.DAMOON_FOREIGN_PROPERTY_ID}/reservations?view=center`, env.DAMOON_APP_URL).href);
    assert.equal(foreignCenter.status(), 403, "manager cannot read the sibling tenant reception center");
    assert.equal((await prisma.hotelReservation.findFirstOrThrow({ where: { reference: manualResult.reference, organizationId: orgId, propertyId } })).status, "CHECKED_OUT");
    const foreignUrl = new URL("/api/hotel/v1/demo-payments", sharedUrl);
    foreignUrl.hostname = env.DAMOON_FOREIGN_HOST;
    const crossTenant = await guest.request.post(foreignUrl.href, { data: { property: "damoon-demo", reference: rows[0].reference, outcome: "SUCCESS", idempotencyKey: randomUUID() } });
    assert.equal(crossTenant.status(), 404, "a foreign tenant host cannot act on Damoon demo reservations");
    assert.equal(await prisma.hotelReservation.count({ where: { organizationId: orgId, propertyId } }), before + 3, "one online demo and two phone reservations are added without changing prior bookings");
    assert.deepEqual(appErrors, []);
    await guest.close();
  } finally {
    await managerContext?.close();
    await browser.close();
    await prisma.$disconnect();
  }
});
