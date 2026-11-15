import { lookup } from "node:dns/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { expect, test } from "playwright/test";
import { seedOperationalGuestFixture } from "./operational-fixture.mjs";

const env = process.env;
const appOrigin = new URL(env.DAMOON_APP_URL || "").origin;
const standaloneOrigin = new URL(env.DAMOON_STANDALONE_URL || "").origin;
const guestOrigin = `http://${new URL(standaloneOrigin).hostname}:3000`;
const organizationId = env.DAMOON_ORGANIZATION_ID;
const propertyId = env.DAMOON_PROPERTY_ID;

const copy = {
  fa: { direction: "rtl", title: "رزروهای هتل", checkIn: "تاریخ ورود", checkOut: "تاریخ خروج", quote: "دریافت قیمت", hold: "نگه‌داری موقت", guest: "نام کامل مهمان 1", reserve: "ثبت رزرو", reservation: "رزروها", payment: "پرداخت اقامت", transfer: "واریز بانکی", amount: "مبلغ واریز (تومان)", reference: "شماره پیگیری واریز", submit: "ثبت واریز برای بررسی", submitted: "ثبت‌شده؛ تأییدنشده", ledgerSubmitted: "ثبت‌شده؛ تأییدنشده", receptionPayment: "پرداخت‌های خارج از درگاه", verify: "تأیید و ثبت واریز" },
  en: { direction: "ltr", title: "Hotel reservations", checkIn: "Check-in", checkOut: "Check-out", quote: "Get quote", hold: "Place temporary hold", guest: "Guest full name 1", reserve: "Create reservation", reservation: "Reservations", payment: "Stay payment", transfer: "Bank transfer", amount: "Transfer amount (Toman)", reference: "Transfer reference", submit: "Submit transfer for review", submitted: "Submitted; unverified", ledgerSubmitted: "Submitted; not verified", receptionPayment: "Offline payments", verify: "Verify and record transfer" },
  ar: { direction: "rtl", title: "حجوزات الفندق", checkIn: "تاريخ الوصول", checkOut: "تاريخ المغادرة", quote: "طلب السعر", hold: "حجز مؤقت", guest: "الاسم الكامل للضيف 1", reserve: "إنشاء الحجز", reservation: "الحجوزات", payment: "دفع الإقامة", transfer: "تحويل بنكي", amount: "مبلغ التحويل (تومان)", reference: "مرجع التحويل", submit: "إرسال التحويل للمراجعة", submitted: "مرسل؛ غير مؤكد", ledgerSubmitted: "مُرسل؛ غير مؤكد", receptionPayment: "المدفوعات غير الإلكترونية", verify: "تأكيد التحويل وتسجيله" },
};

function assertIsolatedTarget() {
  if (env.CI !== "true" || env.NODE_ENV !== "test" || env.DAMOON_E2E_ENABLED !== "1" || env.VERCEL_ENV === "production" || env.VERCEL) throw new Error("Localization acceptance requires isolated CI test mode");
  if (appOrigin !== "http://127.0.0.1:3000" || new URL(standaloneOrigin).hostname !== "damoon-hotel.localhost" || standaloneOrigin !== "http://damoon-hotel.localhost:8080") throw new Error("Only synthetic loopback Damoon origins are permitted");
  if (env.DATABASE_URL !== env.DIRECT_URL || !/^\/damoon_[a-f0-9]{16}$/i.test(new URL(env.DATABASE_URL || "https://invalid.local").pathname)) throw new Error("Localization acceptance requires the workflow-owned disposable database");
  if (env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED !== "1" || env.HOTEL_GUEST_PORTAL_ENABLED !== "1" || env.HOTEL_OFFLINE_PAYMENT_OPERATIONAL_ENABLED !== "1") throw new Error("Disposable operational gates must be explicitly enabled");
  if (env.HOTEL_PAYMENT_OPERATIONAL_ENABLED === "1" || env.HOTEL_PAYMENT_SIMULATOR_ENABLED === "1" || env.HOTEL_SMS_ENABLED === "1" || env.CUSTOMER_AUTH_SMS_WORKER_ENABLED === "1") throw new Error("Payment processing, simulation, and SMS must stay disabled");
}

function daysFromNow(offset) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

async function enableTransferForDisposableProperty() {
  const database = new URL(env.DATABASE_URL);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: database.toString(), max: 2 }), log: [] });
  try {
    await db.$connect();
    const [identity] = await db.$queryRaw`SELECT current_database()::text AS database, current_user::text AS role, inet_server_port() AS port`;
    if (identity?.database !== decodeURIComponent(database.pathname.slice(1)) || identity.role !== decodeURIComponent(database.username) || Number(identity.port) !== 5432) throw new Error("Localization test connected outside the disposable database");
    await db.hotelProperty.update({ where: { id: propertyId }, data: { manualConfirmationPolicy: "MINIMUM_VERIFIED_DEPOSIT", allowedOfflinePaymentMethods: ["CASH", "BANK_TRANSFER"], minimumVerifiedDepositAmount: BigInt(1) } });
  } finally {
    await db.$disconnect();
  }
}

async function login(page, origin, locale, username, password, callbackPath) {
  const callback = `${origin}${callbackPath}`;
  await page.goto(`${origin}/${locale}/login?callbackUrl=${encodeURIComponent(callback)}`);
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => url.origin === origin && url.pathname === callbackPath, { timeout: 30_000 });
}

test("guest reservation and offline payment UI preserve fa/en/ar direction across mobile and desktop", async ({ browser }) => {
  test.setTimeout(300_000);
  assertIsolatedTarget();
  const resolved = await lookup("damoon-hotel.localhost", { all: true, verbatim: true });
  if (!resolved.length || resolved.some(({ address }) => address !== "::1" && !/^127(?:\.\d{1,3}){3}$/.test(address))) throw new Error("Damoon test hostname must resolve exclusively to loopback");

  for (const locale of ["fa", "en", "ar"]) {
    for (const viewport of [{ name: "mobile", width: 390, height: 844 }, { name: "desktop", width: 1440, height: 1000 }]) {
      const fixture = await seedOperationalGuestFixture();
      await enableTransferForDisposableProperty();
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      try {
        const guest = await context.newPage();
        const path = `/${locale}/hotel-reservations/${organizationId}/${propertyId}`;
        await login(guest, guestOrigin, locale, fixture.username, fixture.password, path);
        const t = copy[locale];
        const guestPanel = guest.getByRole("region", { name: t.title });
        await expect(guestPanel).toBeVisible();
        await expect(guestPanel).toHaveAttribute("dir", t.direction);
        await expect(guestPanel.getByText(t.reservation, { exact: true })).toBeVisible();
        const checkIn = daysFromNow(3);
        await guestPanel.getByLabel(t.checkIn).fill(checkIn);
        await guestPanel.getByLabel(t.checkOut).fill(daysFromNow(4));
        await guestPanel.getByRole("button", { name: t.quote }).click();
        await guestPanel.getByRole("button", { name: t.hold }).click();
        await guestPanel.getByLabel(t.guest).fill(`Synthetic ${locale} ${viewport.name}`);
        const [reservationResponse] = await Promise.all([
          guest.waitForResponse((response) => response.url().includes("/reservations") && response.request().method() === "POST" && response.request().postDataJSON()?.action === "reserve"),
          guestPanel.getByRole("button", { name: t.reserve }).click(),
        ]);
        expect(reservationResponse.status()).toBe(200);
        const reservation = (await reservationResponse.json()).reservation;
        expect(reservation?.reference).toBeTruthy();
        const reservationCard = guest.locator("li").filter({ hasText: reservation.reference });
        await expect(reservationCard).toBeVisible();
        await reservationCard.getByRole("button", { name: t.transfer }).click();
        const payment = reservationCard.getByRole("region", { name: t.payment });
        await expect(payment).toBeVisible();
        await payment.getByLabel(t.amount).fill("100");
        await payment.getByLabel(t.reference).fill(`TEST-${locale}-${viewport.name}`);
        await payment.getByRole("button", { name: t.submit }).click();
        await expect(payment).toContainText(t.submitted);

        const staff = await context.newPage();
        const staffPath = `/${locale}/hotel-reservations/${organizationId}/${propertyId}`;
        await login(staff, appOrigin, locale, env.DAMOON_MANAGER_USERNAME, env.DAMOON_MANAGER_PASSWORD, staffPath);
        const reception = staff.getByRole("region", { name: t.title });
        await expect(reception).toHaveAttribute("dir", t.direction);
        const staffCard = staff.locator("li").filter({ hasText: reservation.reference });
        const ledger = staffCard.getByRole("region", { name: t.receptionPayment });
        await expect(ledger).toContainText(t.ledgerSubmitted);
        await ledger.getByRole("button", { name: t.verify }).click();
        const verified = locale === "fa" ? "تأییدشده و پرداخت‌شده" : locale === "ar" ? "مؤكد ومدفوع" : "Verified and paid";
        await expect(ledger).toContainText(verified);
        const cancelLabel = locale === "fa" ? "لغو رزرو" : locale === "ar" ? "إلغاء الحجز" : "Cancel reservation";
        await staffCard.getByRole("button", { name: cancelLabel }).click();
        await expect(staffCard).toContainText("CANCELLED");
      } finally {
        await context.close();
      }
    }
  }
});
