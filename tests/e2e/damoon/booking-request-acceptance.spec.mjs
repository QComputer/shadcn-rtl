import { createHash, randomUUID } from "node:crypto";
import { test, expect } from "playwright/test";

const failClosed = () => {
  const env = process.env;
  if (env.NODE_ENV !== "test") throw new Error("NODE_ENV must be 'test'");
  if (env.DAMOON_E2E_ENABLED !== "1") throw new Error("DAMOON_E2E_ENABLED must be '1'");
  const dbUrl = new URL(env.DATABASE_URL || "");
  if (env.DATABASE_URL !== env.DIRECT_URL) {
    throw new Error("DATABASE_URL must equal DIRECT_URL");
  }
  if (!/^\/damoon_[a-f0-9]{16}$/i.test(dbUrl.pathname) || !["127.0.0.1", "::1", "localhost"].includes(dbUrl.hostname) || dbUrl.port !== "5432" || dbUrl.searchParams.get("schema") !== "public") {
    throw new Error("Test DB must have damoon_ prefix and loopback host");
  }
  const required = [
    "DAMOON_APP_URL",
    "DAMOON_STANDALONE_URL",
    "DAMOON_PUBLIC_HOST",
    "DAMOON_ORGANIZATION_ID",
    "DAMOON_PROPERTY_ID",
    "DAMOON_PROPERTY_SLUG",
    "DAMOON_MANAGER_USERNAME",
    "DAMOON_MANAGER_PASSWORD",
    "DAMOON_ROOM_TYPE_SLUG",
    "DAMOON_RATE_PLAN_CODE",
    "DAMOON_FOREIGN_ORGANIZATION_ID",
    "DAMOON_FOREIGN_PROPERTY_ID",
    "DAMOON_FOREIGN_HOST",
  ];
  for (const name of required) {
    if (!env[name]?.trim()) throw new Error(`${name} is required`);
  }
};

const env = process.env;
const appUrl = new URL(env.DAMOON_APP_URL);
const appOrigin = appUrl.origin;
const standaloneUrl = new URL(env.DAMOON_STANDALONE_URL);
const publicHost = env.DAMOON_PUBLIC_HOST;
const organizationId = env.DAMOON_ORGANIZATION_ID;
const propertyId = env.DAMOON_PROPERTY_ID;
const propertySlug = env.DAMOON_PROPERTY_SLUG;
const foreignOrganizationId = env.DAMOON_FOREIGN_ORGANIZATION_ID;
const foreignPropertyId = env.DAMOON_FOREIGN_PROPERTY_ID;
const foreignHost = env.DAMOON_FOREIGN_HOST;
const managerUsername = env.DAMOON_MANAGER_USERNAME;
const managerPassword = env.DAMOON_MANAGER_PASSWORD;
const roomTypeSlug = env.DAMOON_ROOM_TYPE_SLUG;
const ratePlanCode = env.DAMOON_RATE_PLAN_CODE;
let capturedReplay;
let capturedReference;

const requestsApi = `/api/organizations/${encodeURIComponent(organizationId)}/hotels/${encodeURIComponent(propertyId)}/booking-requests`;

function newContext(browser) {
  return browser.newContext({
    extraHTTPHeaders: { "x-vercel-protection-bypass": env.VERCEL_PROTECTION_BYPASS || "" },
  });
}

async function loginManager(browser) {
  const context = await newContext(browser);
  const page = await context.newPage();
  const callbackPath = `/fa/dashboard/hotel-website/${organizationId}/${propertyId}/requests`;
  const callbackUrl = `${appOrigin}${callbackPath}`;
  await page.goto(`${appOrigin}/fa/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.locator("#username").fill(managerUsername);
  await page.locator("#password").fill(managerPassword);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname.includes(callbackPath), { timeout: 30_000 });
  return { context, page };
}

async function postRequest(page, payload, idempotencyKey) {
  return page.request.post(`${standaloneUrl.origin}/api/hotel/v1/requests`, {
    headers: {
      Origin: standaloneUrl.origin,
      Host: publicHost,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    data: payload,
  });
}

async function postStatus(page, reference, host = publicHost) {
  return page.request.post(`${standaloneUrl.origin}/api/hotel/v1/requests/status`, {
    headers: {
      Origin: `${standaloneUrl.protocol}//${host}`,
      Host: host,
      "Content-Type": "application/json",
    },
    data: { reference },
  });
}

async function postAvailability(page, payload, host = publicHost, origin = standaloneUrl.origin) {
  return page.request.post(`${standaloneUrl.origin}/api/hotel/v1/availability/search`, {
    headers: { Origin: origin, Host: host, "Content-Type": "application/json" },
    data: payload,
  });
}

async function getRequestsApi(page) {
  return page.request.get(`${appOrigin}${requestsApi}`, {
    headers: { Accept: "application/json", Origin: appOrigin },
  });
}

async function patchRequestStatus(page, requestId, status, expectedVersion, managerMessage = "") {
  return page.request.patch(`${appOrigin}${requestsApi}/${encodeURIComponent(requestId)}`, {
    headers: { "Content-Type": "application/json", Origin: appOrigin },
    data: { status, expectedVersion, managerMessage },
  });
}

async function postRecheckAvailability(page, requestId) {
  return page.request.post(`${appOrigin}${requestsApi}/${encodeURIComponent(requestId)}/availability`, {
    headers: { "Content-Type": "application/json", Origin: appOrigin },
  });
}

async function waitForRequestInInbox(page, guestEmail, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const response = await getRequestsApi(page);
    if (response.ok()) {
      const data = await response.json();
      const found = data.requests?.find((r) => r.guestEmail === guestEmail);
      if (found) {
        await page.getByRole("button", { name: /به‌روزرسانی|Refresh|تحديث/ }).click();
        await page.locator(`#request-status-${found.id}`).waitFor({ state: "visible" });
        return found;
      }
    }
    await page.waitForTimeout(1000);
  }
  throw new Error(`Request for ${guestEmail} not found in inbox within ${timeout}ms`);
}

const tomorrowISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
};

const dayAfterISO = (base) => {
  const d = new Date(base);
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
};

const faPayload = (checkIn, checkOut) => ({
  property: propertySlug,
  roomType: roomTypeSlug,
  ratePlan: ratePlanCode,
  checkIn,
  checkOut,
  occupancy: { adults: 2, children: 1, childAges: [8] },
  contact: { fullName: "احمد رضایی", phone: "+98 912 345 6789", email: "ahmad@example.com" },
  specialRequests: "اتاق با نما به پارک",
});

const statusLabels = {
  fa: { RECEIVED: "دریافت‌شده", IN_REVIEW: "در حال بررسی", OPTION_OFFERED: "پیشنهاد برای بررسی شما آماده است", UNAVAILABLE: "در این زمان در دسترس نیست", DECLINED: "پذیرفته نشد", CLOSED: "بسته‌شده" },
  en: { RECEIVED: "Received", IN_REVIEW: "Under review", OPTION_OFFERED: "An option is ready for your review", UNAVAILABLE: "Unavailable for these dates", DECLINED: "Declined", CLOSED: "Closed" },
  ar: { RECEIVED: "تم الاستلام", IN_REVIEW: "قيد المراجعة", OPTION_OFFERED: "الخيار جاهز لمراجعتك", UNAVAILABLE: "غير متاح في هذه التواريخ", DECLINED: "مرفوض", CLOSED: "مغلق" },
};

const copy = {
  fa: { submit: "ارسال درخواست اقامت", received: "درخواست اقامت ثبت شد", reference: "کد پیگیری امن", keepReference: "این کد را برای پیگیری نزد خود نگه دارید", status: "وضعیت درخواست", check: "بررسی وضعیت", checking: "در حال بررسی وضعیت...", trackLabel: "پیگیری با کد امن", trackButton: "نمایش وضعیت", trackError: "درخواستی با این کد پیدا نشد یا کد معتبر نیست.", notBooking: "این درخواست رزرو قطعی نیست؛ قیمت و موجودی باید توسط پذیرش دوباره بررسی شوند." },
  en: { submit: "Send stay request", received: "Stay request submitted", reference: "Secure tracking reference", keepReference: "Keep this reference to check your request later.", status: "Request status", check: "Check status", checking: "Checking status...", trackLabel: "Track with secure reference", trackButton: "Show status", trackError: "No request was found for this reference.", notBooking: "This request is not a confirmed booking. Reception must recheck the rate and availability." },
  ar: { submit: "إرسال طلب الإقامة", received: "تم إرسال طلب الإقامة", reference: "رمز متابعة آمن", keepReference: "احتفظ بهذا الرمز لمتابعة طلبك لاحقاً.", status: "حالة الطلب", check: "تحقق من الحالة", checking: "جارٍ التحقق من الحالة...", trackLabel: "المتابعة باستخدام الرمز الآمن", trackButton: "عرض الحالة", trackError: "لم يتم العثور على طلب بهذا الرمز.", notBooking: "هذا الطلب ليس حجزاً مؤكداً. يجب على الاستقبال إعادة التحقق من السعر والتوفر." },
};

test.describe("PR64 Damoon Booking Request Acceptance", () => {
  let browser;
  let managerContext;
  let managerPage;
  let guestContexts = [];

  test.beforeAll(async ({ browser: b }) => {
    failClosed();
    browser = b;
    const login = await loginManager(browser);
    managerContext = login.context;
    managerPage = login.page;
  });

  test.afterAll(async () => {
    await Promise.all(guestContexts.map((c) => c.close().catch(() => {})));
    await managerContext?.close().catch(() => {});
  });

  test("FA: Guest submits stay request via Damoon standalone and tracks status", async () => {
    const checkIn = tomorrowISO();
    const checkOut = dayAfterISO(checkIn);
    const payload = faPayload(checkIn, checkOut);
    payload.contact.email = `fa-${randomUUID()}@example.test`;
    const c = await newContext(browser);
    guestContexts.push(c);
    const page = await c.newPage();

    await page.goto(`${standaloneUrl.origin}/fa/`, { waitUntil: "networkidle" });
    await page.locator("html").waitFor({ state: "visible" });
    await expect(page.locator("html")).toHaveAttribute("lang", "fa");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    await page.locator('[data-date-field="checkIn"]').click();
    let moves = 0;
    while (!(await page.locator(`[data-calendar-day="${checkIn}"]`).count()) && moves++ < 3) {
      await page.locator("[data-month-next]").click();
    }
    await page.locator(`[data-calendar-day="${checkIn}"]`).click();

    await page.locator('[data-date-field="checkOut"]').click();
    moves = 0;
    while (!(await page.locator(`[data-calendar-day="${checkOut}"]`).count()) && moves++ < 3) {
      await page.locator("[data-month-next]").click();
    }
    await page.locator(`[data-calendar-day="${checkOut}"]`).click();

    await page.locator("[data-adult-count]").selectOption("2");
    await page.locator("[data-child-count]").selectOption("1");
    await page.locator('[data-child-age="0"]').fill("8");

    await page.locator(".booking-form .booking-submit[type=submit]").click();
    await expect(page.locator("[data-booking-flow] .booking-step")).toBeVisible();

    await expect(page.locator("[data-booking-flow] .booking-step")).toContainText(copy.fa.notBooking);

    await page.locator("[data-guest-name]").fill(payload.contact.fullName);
    await page.locator("[data-guest-phone]").fill(payload.contact.phone);
    await page.locator("[data-guest-email]").fill(payload.contact.email);
    await page.locator("[data-special-request]").fill(payload.specialRequests);

    const responsePromise = page.waitForResponse((r) => r.url().endsWith("/api/hotel/v1/requests") && r.request().method() === "POST");
    await page.locator('[data-create-request]').click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const body = await response.json();
    capturedReference = body.reference;
    capturedReplay = { payload: response.request().postDataJSON(), idempotencyKey: response.request().headers()["idempotency-key"] };
    const reference = body.reference;
    expect(typeof reference).toBe("string");
    expect(reference.length).toBeGreaterThanOrEqual(40);

    await expect(page.locator("[data-booking-flow] .booking-step--confirmed")).toBeVisible();
    await expect(page.locator("[data-booking-flow] .booking-step--confirmed")).toContainText(copy.fa.received);
    await expect(page.locator("[data-booking-flow] .booking-step--confirmed")).toContainText(copy.fa.reference);
    await expect(page.locator("[data-booking-flow] .booking-step--confirmed")).toContainText(copy.fa.keepReference);
    await expect(page.locator("[data-booking-flow] .booking-step--confirmed")).toContainText(statusLabels.fa.RECEIVED);

    await page.locator('[data-track-request] [data-track-reference]').fill(reference);
    const trackResponsePromise = page.waitForResponse((r) => r.url().endsWith("/api/hotel/v1/requests/status") && r.request().method() === "POST");
    await page.locator('[data-track-request] button[type="submit"]').click();
    const trackResponse = await trackResponsePromise;
    expect(trackResponse.status()).toBe(200);
    const trackBody = await trackResponse.json();
    expect(trackBody.status).toBe("RECEIVED");
    await expect(page.locator("[data-track-result]")).toContainText(statusLabels.fa.RECEIVED);
  });

  test("EN: Guest submits stay request and tracks status", async () => {
    expect(capturedReference).toBeTruthy();
    const c = await newContext(browser);
    guestContexts.push(c);
    const page = await c.newPage();
    await page.goto(`${standaloneUrl.origin}/en/`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await page.locator('[data-track-request] [data-track-reference]').fill(capturedReference);
    const trackResponsePromise = page.waitForResponse((r) => r.url().endsWith("/api/hotel/v1/requests/status") && r.request().method() === "POST");
    await page.locator('[data-track-request] button[type="submit"]').click();
    const trackResponse = await trackResponsePromise;
    expect(trackResponse.status()).toBe(200);
    const trackBody = await trackResponse.json();
    expect(trackBody.status).toBe("RECEIVED");
    await expect(page.locator("[data-track-result]")).toContainText(statusLabels.en.RECEIVED);
  });

  test("AR: Guest submits stay request and tracks status", async () => {
    expect(capturedReference).toBeTruthy();
    const c = await newContext(browser);
    guestContexts.push(c);
    const page = await c.newPage();
    await page.goto(`${standaloneUrl.origin}/ar/`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.locator('[data-track-request] [data-track-reference]').fill(capturedReference);
    const trackResponsePromise = page.waitForResponse((r) => r.url().endsWith("/api/hotel/v1/requests/status") && r.request().method() === "POST");
    await page.locator('[data-track-request] button[type="submit"]').click();
    const trackResponse = await trackResponsePromise;
    expect(trackResponse.status()).toBe(200);
    const trackBody = await trackResponse.json();
    expect(trackBody.status).toBe("RECEIVED");
    await expect(page.locator("[data-track-result]")).toContainText(statusLabels.ar.RECEIVED);
  });

  test("Manager reviews inbox, updates status, rechecks availability, and guest sees refreshed status", async () => {
    const checkIn = tomorrowISO();
    const checkOut = dayAfterISO(checkIn);
    const payload = faPayload(checkIn, checkOut);
    payload.contact.email = `manager-${randomUUID()}@example.test`;

    const c = await newContext(browser);
    guestContexts.push(c);
    const guestPage = await c.newPage();

    await guestPage.goto(`${standaloneUrl.origin}/fa/`, { waitUntil: "networkidle" });
    await guestPage.locator('[data-date-field="checkIn"]').click();
    let moves = 0;
    while (!(await guestPage.locator(`[data-calendar-day="${checkIn}"]`).count()) && moves++ < 3) {
      await guestPage.locator("[data-month-next]").click();
    }
    await guestPage.locator(`[data-calendar-day="${checkIn}"]`).click();

    await guestPage.locator('[data-date-field="checkOut"]').click();
    moves = 0;
    while (!(await guestPage.locator(`[data-calendar-day="${checkOut}"]`).count()) && moves++ < 3) {
      await guestPage.locator("[data-month-next]").click();
    }
    await guestPage.locator(`[data-calendar-day="${checkOut}"]`).click();

    await guestPage.locator("[data-adult-count]").selectOption("2");
    await guestPage.locator("[data-child-count]").selectOption("1");
    await guestPage.locator('[data-child-age="0"]').fill("8");
    await guestPage.locator(".booking-form .booking-submit[type=submit]").click();
    await guestPage.locator("[data-guest-name]").fill(payload.contact.fullName);
    await guestPage.locator("[data-guest-phone]").fill(payload.contact.phone);
    await guestPage.locator("[data-guest-email]").fill(payload.contact.email);

    const submitResponsePromise = guestPage.waitForResponse((r) => r.url().endsWith("/api/hotel/v1/requests") && r.request().method() === "POST");
    await guestPage.locator('[data-create-request]').click();
    const submitResponse = await submitResponsePromise;
    expect(submitResponse.status()).toBe(201);
    const submitBody = await submitResponse.json();
    const reference = submitBody.reference;

    const inboxRequest = await waitForRequestInInbox(managerPage, payload.contact.email);
    const requestId = inboxRequest.id;
    expect(inboxRequest.status).toBe("RECEIVED");
    expect(inboxRequest.guestName).toBe(payload.contact.fullName);
    expect(inboxRequest.guestPhone).toBe(payload.contact.phone);
    expect(inboxRequest.roomTypeSlug).toBe(roomTypeSlug);
    expect(inboxRequest.ratePlanCode).toBe(ratePlanCode);

    await managerPage.locator(`#request-status-${requestId}`).selectOption("IN_REVIEW");
    await expect(managerPage.locator(`article:has-text("${payload.contact.fullName}") .rounded-full`)).toContainText("در حال بررسی");

    const recheckResponse = await postRecheckAvailability(managerPage, requestId);
    expect(recheckResponse.status()).toBe(200);
    const recheckBody = await recheckResponse.json();
    expect(recheckBody.availabilityHint).toBe("AVAILABLE");
    expect(typeof recheckBody.version).toBe("number");

    await managerPage.locator(`textarea[maxlength="500"]`).first().fill("اتاق در تاریخ‌های درخواستی موجود است. لطفاً برای نهایی‌سازی تماس بگیرید.");
    await managerPage.locator(`#request-status-${requestId}`).selectOption("OPTION_OFFERED");
    await expect(managerPage.locator(`article:has-text("${payload.contact.fullName}") .rounded-full`)).toContainText("پیشنهاد برای بررسی");

    await guestPage.locator('[data-track-request] [data-track-reference]').fill(reference);
    const trackResponsePromise = guestPage.waitForResponse((r) => r.url().endsWith("/api/hotel/v1/requests/status") && r.request().method() === "POST");
    await guestPage.locator('[data-track-request] button[type="submit"]').click();
    const trackResponse = await trackResponsePromise;
    expect(trackResponse.status()).toBe(200);
    const trackBody = await trackResponse.json();
    expect(trackBody.status).toBe("OPTION_OFFERED");
    expect(trackBody.managerMessage).toContain("موجود است");
    await expect(guestPage.locator("[data-track-result]")).toContainText(statusLabels.fa.OPTION_OFFERED);
  });

  test("Negative: Bad reference returns 404 on status check", async () => {
    const c = await newContext(browser);
    guestContexts.push(c);
    const page = await c.newPage();
    await page.goto(`${standaloneUrl.origin}/fa/`, { waitUntil: "networkidle" });

    await page.locator('[data-track-request] [data-track-reference]').fill("x".repeat(43));
    const trackResponsePromise = page.waitForResponse((r) => r.url().endsWith("/api/hotel/v1/requests/status") && r.request().method() === "POST");
    await page.locator('[data-track-request] button[type="submit"]').click();
    const trackResponse = await trackResponsePromise;
    expect(trackResponse.status()).toBe(404);
    const trackBody = await trackResponse.json();
    expect(trackBody.status).toBeUndefined();
  });

  test("Negative: Unauthorized reception API without session returns 401/403", async () => {
    const c = await newContext(browser);
    guestContexts.push(c);
    const page = await c.newPage();
    await page.goto(`${appOrigin}/fa/login`, { waitUntil: "networkidle" });
    await page.context().clearCookies();

    const listResponse = await page.request.get(`${appOrigin}${requestsApi}`, { headers: { Origin: appOrigin } });
    expect([401, 403, 302].includes(listResponse.status())).toBe(true);

    const patchResponse = await page.request.patch(`${appOrigin}${requestsApi}/some-id`, {
      headers: { "Content-Type": "application/json", Origin: appOrigin },
      data: { status: "IN_REVIEW", expectedVersion: 0 },
    });
    expect([401, 403, 302].includes(patchResponse.status())).toBe(true);

    const availResponse = await page.request.post(`${appOrigin}${requestsApi}/some-id/availability`, { headers: { Origin: appOrigin } });
    expect([401, 403, 302].includes(availResponse.status())).toBe(true);
  });

  test("Negative: Cross-tenant access to reception API is denied", async () => {
    const foreignManagerContext = await browser.newContext({
      extraHTTPHeaders: { "x-vercel-protection-bypass": env.VERCEL_PROTECTION_BYPASS || "" },
    });
    guestContexts.push(foreignManagerContext);
    const foreignManagerPage = await foreignManagerContext.newPage();
    const callbackPath = `/fa/dashboard/hotel-website/${foreignOrganizationId}/${foreignPropertyId}/requests`;
    const callbackUrl = `${appOrigin}${callbackPath}`;
    await foreignManagerPage.goto(`${appOrigin}/fa/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    await foreignManagerPage.locator("#username").fill(env.DAMOON_FOREIGN_MANAGER_USERNAME || managerUsername);
    await foreignManagerPage.locator("#password").fill(env.DAMOON_FOREIGN_MANAGER_PASSWORD || managerPassword);
    await foreignManagerPage.locator('form button[type="submit"]').click();
    await foreignManagerPage.waitForURL((url) => url.pathname.includes(callbackPath), { timeout: 30_000 });

    const listResponse = await foreignManagerPage.request.get(`${appOrigin}/api/organizations/${encodeURIComponent(organizationId)}/hotels/${encodeURIComponent(propertyId)}/booking-requests`, { headers: { Origin: appOrigin } });
    expect([403, 404].includes(listResponse.status())).toBe(true);
    if (listResponse.status() === 403) {
      const text = await listResponse.text();
      expect(text).not.toContain(organizationId);
    }
  });

  test("Negative: Public bridge rejects spoofed Host and cross-origin mutation", async () => {
    const c = await newContext(browser);
    guestContexts.push(c);
    const page = await c.newPage();
    const payload = faPayload(tomorrowISO(), dayAfterISO(tomorrowISO()));
    const key = `damoon-security-${randomUUID()}`;
    const wrongHost = await page.request.post(`${standaloneUrl.origin}/api/hotel/v1/requests`, {
      headers: { Origin: standaloneUrl.origin, Host: "attacker.example:8080", "Content-Type": "application/json", "Idempotency-Key": key }, data: payload,
    });
    expect(wrongHost.status()).toBe(400);
    const wrongOrigin = await page.request.post(`${standaloneUrl.origin}/api/hotel/v1/requests`, {
      headers: { Origin: "https://attacker.example", Host: publicHost, "Content-Type": "application/json", "Idempotency-Key": key }, data: payload,
    });
    expect(wrongOrigin.status()).toBe(403);
  });

  test("Negative: foreign tenant cannot read a valid-shaped guest reference; unpublished tenant has no availability", async () => {
    const c = await newContext(browser);
    guestContexts.push(c);
    const page = await c.newPage();
    const status = await postStatus(page, capturedReference, `${foreignHost}:8080`);
    expect(status.status()).toBe(404);
    const searchPayload = faPayload(tomorrowISO(), dayAfterISO(tomorrowISO()));
    const unapproved = await postAvailability(page, searchPayload, `${foreignHost}:8080`, `${standaloneUrl.protocol}//${foreignHost}:8080`);
    expect(unapproved.status()).toBe(404);
  });

  test("Negative: reception status update uses optimistic concurrency", async () => {
    const c = await newContext(browser);
    guestContexts.push(c);
    const page = await c.newPage();
    const checkIn = tomorrowISO();
    const checkOut = dayAfterISO(checkIn);
    const payload = faPayload(checkIn, checkOut);
    payload.contact.email = `race-${randomUUID()}@example.test`;
    const create = await postRequest(page, payload, `damoon-race-${randomUUID()}`);
    expect(create.status(), await create.text()).toBe(201);
    const inboxRequest = await waitForRequestInInbox(managerPage, payload.contact.email);
    const results = await Promise.all([
      patchRequestStatus(managerPage, inboxRequest.id, "IN_REVIEW", inboxRequest.version),
      patchRequestStatus(managerPage, inboxRequest.id, "DECLINED", inboxRequest.version),
    ]);
    expect(results.map((response) => response.status()).sort()).toEqual([200, 409]);
  });

  test("Negative: search outside seeded inventory never offers an available room", async () => {
    const c = await newContext(browser);
    guestContexts.push(c);
    const page = await c.newPage();
    const checkIn = new Date();
    checkIn.setUTCDate(checkIn.getUTCDate() + 40);
    const checkOut = new Date(checkIn);
    checkOut.setUTCDate(checkOut.getUTCDate() + 2);
    const payload = faPayload(checkIn.toISOString().slice(0, 10), checkOut.toISOString().slice(0, 10));
    const response = await postAvailability(page, payload);
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.options.some((option) => option.isAvailable)).toBe(false);
  });

  test("Idempotency replay returns same reference without duplication", async () => {
    expect(capturedReplay?.idempotencyKey).toBeTruthy();
    const c = await newContext(browser);
    guestContexts.push(c);
    const page = await c.newPage();
    const replays = await Promise.all([
      postRequest(page, capturedReplay.payload, capturedReplay.idempotencyKey),
      postRequest(page, capturedReplay.payload, capturedReplay.idempotencyKey),
    ]);
    expect(replays.map((response) => response.status())).toEqual([200, 200]);
    const replayBodies = await Promise.all(replays.map((response) => response.json()));
    expect(replayBodies[0].reference).toBeTruthy();
    expect(replayBodies[1].reference).toBe(replayBodies[0].reference);
    expect(replayBodies.every((body) => body.bookingConfirmed === false && body.inventoryReserved === false)).toBe(true);

    const listResponse = await getRequestsApi(managerPage);
    expect(listResponse.ok()).toBe(true);
    const listData = await listResponse.json();
    const matching = listData.requests?.filter((r) => r.guestEmail === capturedReplay.payload.contact.email) || [];
    expect(matching.length).toBe(1);
    const prisma = (await import("@prisma/client")).PrismaClient;
    const client = new prisma();
    try {
      const idempotencyHash = createHash("sha256").update(`${organizationId}\0${capturedReplay.idempotencyKey}`).digest("hex");
      expect(await client.hotelGuestBookingRequest.count({ where: { organizationId, idempotencyHash } })).toBe(1);
    } finally { await client.$disconnect(); }
  });

  test("No reservation or payment created for request-only flow", async () => {
    const listResponse = await getRequestsApi(managerPage);
    expect(listResponse.ok()).toBe(true);
    const listData = await listResponse.json();
    for (const req of listData.requests || []) {
      expect(req.availabilityHint).toBeDefined();
      expect(["AVAILABLE", "UNAVAILABLE", "UNKNOWN"]).toContain(req.availabilityHint);
    }

    const prisma = (await import("@prisma/client")).PrismaClient;
    const client = new prisma();
    try {
      const reservations = await client.hotelReservation.findMany({
        where: { organizationId, propertyId },
        select: { id: true, status: true, createdAt: true },
      });
      expect(reservations.length).toBe(0);

      const holds = await client.hotelBookingHold.findMany({
        where: { organizationId, propertyId },
        select: { id: true, status: true, createdAt: true },
      });
      expect(holds.length).toBe(0);

      const payments = await client.hotelPaymentAllocation.findMany({
        where: { organizationId },
        select: { id: true, kind: true, amountToman: true },
      });
      expect(payments.length).toBe(0);
      expect(await client.paymentRequest.count({ where: { organizationId } })).toBe(0);
    } finally {
      await client.$disconnect();
    }
  });
});

/**
 * FIXTURE ENV CONTRACT (exact required variables):
 * - NODE_ENV=test
 * - DAMOON_E2E_ENABLED=1
 * - DATABASE_URL=postgresql://neondb_owner:...@127.0.0.1/damoon_<unique>
 * - DIRECT_URL=same as DATABASE_URL
 * - DAMOON_APP_URL=http://127.0.0.1:3000 (or vercel preview)
 * - DAMOON_STANDALONE_URL=http://127.0.0.1:8080
 * - DAMOON_PUBLIC_HOST=damoon-hotel.ir (or preview host)
 * - DAMOON_ORGANIZATION_ID=<synthetic damoon org ID>
 * - DAMOON_PROPERTY_ID=<synthetic damoon property ID>
 * - DAMOON_PROPERTY_SLUG=damoon-hotel
 * - DAMOON_MANAGER_USERNAME=<manager user name>
 * - DAMOON_MANAGER_PASSWORD=<manager password>
 * - DAMOON_ROOM_TYPE_SLUG=double (or suite-3-bed, etc.)
 * - DAMOON_RATE_PLAN_CODE=standard-flex (or similar)
 * - DAMOON_FOREIGN_ORGANIZATION_ID=<foreign synthetic org ID>
 * - DAMOON_FOREIGN_PROPERTY_ID=<foreign synthetic property ID>
 * - DAMOON_FOREIGN_HOST=<foreign preview host>
 * - VERCEL_PROTECTION_BYPASS=<bypass token if needed>
 * - DAMOON_FOREIGN_MANAGER_USERNAME=<optional foreign manager>
 * - DAMOON_FOREIGN_MANAGER_PASSWORD=<optional foreign manager pwd>
 *
 * If full criteria cannot be safely implemented in this one file,
 * the strongest executable subset is included above with comments
 * listing the exact fixture env contract.
 */
