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
  if (env.DATABASE_URL !== env.DIRECT_URL || databaseUrl.protocol !== "postgresql:" || databaseUrl.hostname !== "127.0.0.1" || databaseUrl.port !== "5432" || databaseUrl.username !== "postgres" || databaseUrl.password !== "postgres" || databaseUrl.searchParams.get("schema") !== "public" || !/^damoon_[a-f0-9]{16}$/i.test(databaseName) || env.DAMOON_CI_DATABASE_NAME !== databaseName) {
    throw new Error("Shared Damoon acceptance requires the exact CI postgres role/credential and workflow-owned disposable database");
  }
  const sharedUrl = new URL(env.DAMOON_SHARED_RUNTIME_URL || "");
  if (sharedUrl.protocol !== "http:" || sharedUrl.hostname !== "damoon-hotel.ir" || sharedUrl.port !== "3000" || sharedUrl.pathname !== "/") {
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

function dateAtOffset(offset) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

async function chooseStayDates(page, checkIn, checkOut) {
  await page.locator('[data-date-field="checkIn"]').click();
  let moves = 0;
  while (!(await page.locator(`[data-calendar-day="${checkIn}"]`).count()) && moves++ < 3) await page.locator("[data-month-next]").click();
  await page.locator(`[data-calendar-day="${checkIn}"]`).click();
  moves = 0;
  while (!(await page.locator(`[data-calendar-day="${checkOut}"]`).count()) && moves++ < 3) await page.locator("[data-month-next]").click();
  await page.locator(`[data-calendar-day="${checkOut}"]`).click();
  await expect(page.locator("#booking-calendar")).not.toBeVisible();
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
  const resolutions = await lookup(sharedUrl.hostname, { all: true, verbatim: true });
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

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const appErrors = [];
    page.on("pageerror", error => appErrors.push(error.message));
    await page.goto(new URL("fa/", sharedUrl).href, { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("lang", "fa");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("[data-track-request]")).toBeVisible();
    await chooseStayDates(page, checkIn, checkOut);
    await page.locator("[data-adult-count]").selectOption("2");
    await page.locator("[data-child-count]").selectOption("0");

    const searchResponsePromise = page.waitForResponse(response => response.url().endsWith("/api/hotel/v1/availability/search") && response.request().method() === "POST", { timeout: 15000 });
    await page.locator(".booking-form .booking-submit[type=submit]").click();
    const searchResponse = await searchResponsePromise;
    assert.equal(searchResponse.status(), 200, await searchResponse.text());
    await expect(page.locator("[data-booking-flow] .booking-options")).toBeVisible();
    await page.locator(".booking-option__select").first().click();
    await page.locator("[data-guest-name]").fill("Shared Runtime Test Guest");
    await page.locator("[data-guest-phone]").fill("+989123456789");
    await page.locator("[data-guest-email]").fill(email);
    await page.locator("[data-special-request]").fill("Automated disposable acceptance");

    const requestResponsePromise = page.waitForResponse(response => response.url().endsWith("/api/hotel/v1/requests") && response.request().method() === "POST", { timeout: 15000 });
    await page.locator("[data-create-request]").click();
    const requestResponse = await requestResponsePromise;
    assert.equal(requestResponse.status(), 201, await requestResponse.text());
    const result = await requestResponse.json();
    assert.equal(result.status, "RECEIVED");
    assert.equal(result.inventoryReserved, false);
    assert.equal(result.bookingConfirmed, false);
    assert.ok(typeof result.reference === "string" && result.reference.length >= 40);
    await expect(page.locator("[data-booking-flow] .booking-step--confirmed")).toContainText("درخواست اقامت ثبت شد");

    const statusResponsePromise = page.waitForResponse(response => response.url().endsWith("/api/hotel/v1/requests/status") && response.request().method() === "POST", { timeout: 15000 });
    await page.locator("[data-track-reference]").fill(result.reference);
    await page.locator("[data-track-request] button[type=submit]").click();
    const statusResponse = await statusResponsePromise;
    assert.equal(statusResponse.status(), 200, await statusResponse.text());
    const status = await statusResponse.json();
    assert.equal(status.status, "RECEIVED");
    assert.equal(status.availabilityHint, "AVAILABLE");
    for (const privateField of ["guestName", "guestPhone", "guestEmail", "checkIn", "checkOut", "organizationId"]) assert.equal(privateField in status, false);
    await expect(page.locator("[data-track-result]")).toContainText("دریافت‌شده");

    const persisted = await prisma.hotelGuestBookingRequest.findMany({
      where: { organizationId: input.organizationId, propertyId: input.propertyId, guestEmail: email },
      select: { status: true, availabilityHint: true, roomTypeSlug: true, ratePlanCode: true, checkIn: true, checkOut: true, adults: true, children: true, guestNote: true },
    });
    assert.equal(persisted.length, 1, "one row is durably persisted for the unique synthetic email");
    assert.deepEqual(persisted[0], {
      status: "RECEIVED",
      availabilityHint: "AVAILABLE",
      roomTypeSlug: process.env.DAMOON_ROOM_TYPE_SLUG,
      ratePlanCode: process.env.DAMOON_RATE_PLAN_CODE,
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
