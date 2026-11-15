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
const actionTimeout = 8_000;
const assertUI = expect.configure({ timeout: actionTimeout });

const copy = {
  fa: { direction: "rtl", title: "رزروهای هتل", checkIn: "تاریخ ورود", checkOut: "تاریخ خروج", adults: "بزرگسالان", quote: "دریافت قیمت", hold: "نگه‌داری موقت", guest: "نام کامل مهمان 1", reserve: "ثبت رزرو", reservation: "رزروها", payment: "پرداخت اقامت", transfer: "واریز بانکی", amount: "مبلغ واریز (تومان)", reference: "شماره پیگیری واریز", submit: "ثبت واریز برای بررسی", submitted: "ثبت‌شده؛ تأییدنشده", ledgerSubmitted: "ثبت‌شده؛ تأییدنشده", receptionPayment: "پرداخت‌های خارج از درگاه", verify: "تأیید و ثبت واریز" },
  en: { direction: "ltr", title: "Hotel reservations", checkIn: "Check-in", checkOut: "Check-out", adults: "Adults", quote: "Get quote", hold: "Place temporary hold", guest: "Guest full name 1", reserve: "Create reservation", reservation: "Reservations", payment: "Stay payment", transfer: "Bank transfer", amount: "Transfer amount (Toman)", reference: "Transfer reference", submit: "Submit transfer for review", submitted: "Submitted; unverified", ledgerSubmitted: "Submitted; not verified", receptionPayment: "Offline payments", verify: "Verify and record transfer" },
  ar: { direction: "rtl", title: "حجوزات الفندق", checkIn: "تاريخ الوصول", checkOut: "تاريخ المغادرة", adults: "البالغون", quote: "طلب السعر", hold: "حجز مؤقت", guest: "الاسم الكامل للضيف 1", reserve: "إنشاء الحجز", reservation: "الحجوزات", payment: "دفع الإقامة", transfer: "تحويل بنكي", amount: "مبلغ التحويل (تومان)", reference: "مرجع التحويل", submit: "إرسال التحويل للمراجعة", submitted: "مرسل؛ غير مؤكد", ledgerSubmitted: "مُرسل؛ غير مؤكد", receptionPayment: "المدفوعات غير الإلكترونية", verify: "تأكيد التحويل وتسجيله" },
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
  await page.goto(`${origin}/${locale}/login?callbackUrl=${encodeURIComponent(callback)}`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.locator("#username").fill(username, { timeout: actionTimeout });
  await page.locator("#password").fill(password, { timeout: actionTimeout });
  await page.locator('form button[type="submit"]').click({ timeout: actionTimeout });
  await page.waitForURL((url) => url.origin === origin && url.pathname === callbackPath, { timeout: 15_000 });
}

async function closeContextBounded(context) {
  let timer;
  try {
    return await Promise.race([
      context.close(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Browser context cleanup exceeded 5 seconds")), 5_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

test("guest reservation and offline payment UI preserve fa/en/ar direction across mobile and desktop", async ({ browser }) => {
  test.setTimeout(300_000);
  assertIsolatedTarget();
  const resolved = await lookup("damoon-hotel.localhost", { all: true, verbatim: true });
  if (!resolved.length || resolved.some(({ address }) => address !== "::1" && !/^127(?:\.\d{1,3}){3}$/.test(address))) throw new Error("Damoon test hostname must resolve exclusively to loopback");

  let scenarioIndex = 0;
  for (const locale of ["fa", "en", "ar"]) {
    for (const viewport of [{ name: "mobile", width: 390, height: 844 }, { name: "desktop", width: 1440, height: 1000 }]) {
      const checkInOffset = 6 + scenarioIndex;
      scenarioIndex += 1;
      const fixture = await seedOperationalGuestFixture();
      await enableTransferForDisposableProperty();
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      let scenarioError;
      try {
        const guest = await context.newPage();
        guest.setDefaultTimeout(actionTimeout);
        guest.setDefaultNavigationTimeout(15_000);
        const path = `/${locale}/hotel-reservations/${organizationId}/${propertyId}`;
        await login(guest, guestOrigin, locale, fixture.username, fixture.password, path);
        const t = copy[locale];
        const guestPanel = guest.getByRole("region", { name: t.title });
        await assertUI(guestPanel).toBeVisible();
        await assertUI(guestPanel).toHaveAttribute("dir", t.direction);
        expect(await guestPanel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
        await assertUI(guestPanel.getByText(t.reservation, { exact: true })).toBeVisible();
        const checkIn = daysFromNow(checkInOffset);
        await guestPanel.getByLabel(t.checkIn).fill(checkIn, { timeout: actionTimeout });
        await guestPanel.getByLabel(t.checkOut).fill(daysFromNow(checkInOffset + 1), { timeout: actionTimeout });
        await guestPanel.getByLabel(t.adults).fill("1", { timeout: actionTimeout });
        const [quoteResponse] = await Promise.all([
          guest.waitForResponse((response) => response.url().includes("/reservations") && response.request().method() === "POST" && response.request().postDataJSON()?.action === "quote", { timeout: 12_000 }),
          guestPanel.getByRole("button", { name: t.quote }).click({ timeout: actionTimeout }),
        ]);
        expect(quoteResponse.status()).toBe(200);
        await guestPanel.getByRole("button", { name: t.hold }).click({ timeout: actionTimeout });
        await guestPanel.getByLabel(t.guest).fill(`Synthetic ${locale} ${viewport.name}`, { timeout: actionTimeout });
        const [reservationResponse] = await Promise.all([
          guest.waitForResponse((response) => response.url().includes("/reservations") && response.request().method() === "POST" && response.request().postDataJSON()?.action === "reserve", { timeout: 12_000 }),
          guestPanel.getByRole("button", { name: t.reserve }).click({ timeout: actionTimeout }),
        ]);
        expect(reservationResponse.status()).toBe(200);
        const reservation = (await reservationResponse.json()).reservation;
        expect(reservation?.reference).toBeTruthy();
        const reservationCard = guest.locator("li").filter({ hasText: reservation.reference });
        await assertUI(reservationCard).toBeVisible();
        await reservationCard.getByRole("button", { name: t.transfer }).click({ timeout: actionTimeout });
        const payment = reservationCard.getByRole("region", { name: t.payment });
        await assertUI(payment).toBeVisible();
        const errorMessage = locale === "fa" ? "دریافت یا ثبت اطلاعات پرداخت انجام نشد." : locale === "ar" ? "تعذر تحميل معلومات الدفع أو إرسالها." : "Payment information could not be loaded or submitted.";
        await payment.getByRole("button", { name: t.submit }).click({ timeout: actionTimeout });
        await assertUI(payment.getByRole("alert")).toContainText(errorMessage);
        await payment.getByLabel(t.amount).fill("100", { timeout: actionTimeout });
        await payment.getByLabel(t.reference).fill(`TEST-${locale}-${viewport.name}`, { timeout: actionTimeout });
        const [transferResponse] = await Promise.all([
          guest.waitForResponse((response) => response.url().includes("/offline-payments") && response.request().method() === "POST", { timeout: 12_000 }),
          payment.getByRole("button", { name: t.submit }).click({ timeout: actionTimeout }),
        ]);
        expect(transferResponse.status()).toBe(200);
        await assertUI(payment).toContainText(t.submitted);
        const upload = locale === "fa" ? "بارگذاری رسید" : locale === "ar" ? "رفع الإيصال" : "Upload receipt";
        const viewReceipt = locale === "fa" ? "مشاهده رسید" : locale === "ar" ? "عرض الإيصال" : "View receipt";
        await payment.locator('input[type="file"]').first().setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l0sAAAAASUVORK5CYII=", "base64") });
        const [receiptResponse] = await Promise.all([
          guest.waitForResponse((response) => response.url().endsWith("/receipt") && response.request().method() === "POST", { timeout: 12_000 }),
          payment.getByRole("button", { name: upload }).click({ timeout: actionTimeout }),
        ]);
        expect(receiptResponse.status()).toBe(201);
        await assertUI(payment.getByRole("link", { name: viewReceipt })).toBeVisible();

        const staff = await context.newPage();
        staff.setDefaultTimeout(actionTimeout);
        staff.setDefaultNavigationTimeout(15_000);
        const staffPath = `/${locale}/hotel-reservations/${organizationId}/${propertyId}`;
        await login(staff, appOrigin, locale, env.DAMOON_MANAGER_USERNAME, env.DAMOON_MANAGER_PASSWORD, staffPath);
        const reception = staff.getByRole("region", { name: t.title });
        await assertUI(reception).toHaveAttribute("dir", t.direction);
        const staffCard = staff.locator("li").filter({ hasText: reservation.reference });
        const ledger = staffCard.getByRole("region", { name: t.receptionPayment });
        await assertUI(ledger).toContainText(t.ledgerSubmitted);
        const [verifyResponse] = await Promise.all([
          staff.waitForResponse((response) => response.url().includes("/offline-payments") && response.request().method() === "POST", { timeout: 12_000 }),
          ledger.getByRole("button", { name: t.verify }).click({ timeout: actionTimeout }),
        ]);
        expect(verifyResponse.status()).toBe(200);
        const verified = locale === "fa" ? "تأییدشده و پرداخت‌شده" : locale === "ar" ? "مؤكد ومدفوع" : "Verified and paid";
        await assertUI(ledger).toContainText(verified);
        await assertUI(ledger).toContainText(new Intl.NumberFormat(locale === "fa" ? "fa-IR" : locale === "ar" ? "ar" : "en").format(100));
        expect(await reception.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
        const confirmLabel = locale === "fa" ? "تأیید رزرو" : locale === "ar" ? "تأكيد الحجز" : "Confirm reservation";
        await staffCard.getByRole("button", { name: confirmLabel }).click({ timeout: actionTimeout });
        await assertUI(staffCard).toContainText("CONFIRMED");
        const cancelLabel = locale === "fa" ? "لغو رزرو" : locale === "ar" ? "إلغاء الحجز" : "Cancel reservation";
        await staffCard.getByRole("button", { name: cancelLabel }).click();
        await assertUI(staffCard).toContainText("CANCELLED");
      } catch (error) {
        scenarioError = new Error(`Localization scenario ${locale}/${viewport.name} failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
      const cleanup = await Promise.allSettled([closeContextBounded(context)]);
      if (scenarioError) throw scenarioError;
      const cleanupFailure = cleanup.find((result) => result.status === "rejected");
      if (cleanupFailure) throw cleanupFailure.reason;
    }
  }
});
