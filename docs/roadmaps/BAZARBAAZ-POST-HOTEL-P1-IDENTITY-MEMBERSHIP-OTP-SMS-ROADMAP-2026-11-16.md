# BazarBaaz — نقشه راه اجرایی هویت، عضویت، OTP و پیامک پس از فاز اول هتل

> **نوع سند:** برنامه پیشنهادی آماده ثبت در مخزن؛ مجوز شروع پیاده‌سازی یا فعال‌سازی Production نیست.  
> **تاریخ مبنا:** 2026-11-16  
> **مسیر پیشنهادی مخزن:** `docs/roadmaps/BAZARBAAZ-POST-HOTEL-P1-IDENTITY-MEMBERSHIP-OTP-SMS-ROADMAP-2026-11-16.md`  
> **Current source baseline (verified GitHub `main`):** `24604ccc939a64a03b948c2a5b9af40586d817c8` (PR87 merge). The detailed technical inventory below remains a historical planning snapshot from `5b803e561848f5634813effbd90854d772c83da1`; refresh it during G0 before implementation.
> **Owner approval status:** `G0_NOT_APPROVED` — Phase 1 closure is accepted; separate approval is still required to begin G0.
> **Execution status:** `NOT_STARTED` — no OTP/SMS code, migration, Production change, or real SMS was performed in this task.
> **Production database:** PostgreSQL در Runflare؛ دسترسی ریموت مجاز از متغیر `DB_REMOTE_URI` در `.env`، نه Neon.  
> **Canonical hotel domain:** `damoon-hotel.ir`؛ در داده فعلی رابطه دامنه اصلی `www.damoon-hotel.ir` با normalized domain برابر `damoon-hotel.ir` است.

## 0. هدف، محدوده و شرایط شروع

### 0.1 هدف کسب‌وکاری
ایجاد تجربه پایدار و امن «ورود/ثبت‌نام با موبایل»، «عضویت اختیاری در کسب‌وکارها»، «باشگاه مشتریان»، «اعلان تراکنشی» و «پیامک چندمستاجری» برای BazarBaaz و کسب‌وکارهای دارای دامنه/PWA مستقل، با استفاده مجدد از زیرساخت موجود. راهکار باید با هتل دامون، رستوران ۱۳، کافه لئو، آکا شوز و سازمان‌های آینده سازگار باشد؛ نام‌ها صرفاً پایلوت‌اند و نباید در منطق سرویس هاردکد شوند.

### 0.0 Architectural Principle: Guest-First, Identity-Optional
**`OWNER_APPROVED`** — See `docs/architecture/ADR-GUEST-FIRST-IDENTITY-OPTIONAL.md`

All visitors and guests must be able to use maximum safe and permitted functionality without mandatory registration. This principle adds a parallel **GF0–GF5** workstream to the existing G0–G9 roadmap:

| GF Milestone | Name | Priority | Addresses |
|--------------|------|----------|-----------|
| **GF0** | Guest Cart & Checkout Foundation (SHOP) | P0 | Session cart, guest checkout, cart merge |
| **GF1** | Secure Guest Appointment Tracking | P0 (P0-A) | Opaque token lookup, verified ownership, negative tests |
| **GF2** | Hotel Guest Enquiry Decoupling | P0 (P0-B) | Independent feature gate, no operational coupling |
| **GF3** | Guest-to-CUSTOMER Conversion | P1 | Secure, idempotent, non-destructive linking |
| **GF4** | CustomerClubMembership & Consent | P1 | Explicit opt-in, per-tenant, audited |
| **GF5** | Cross-Domain SSO & PWA Integration | P2 | User-mediated, verified domains, no silent creation |

**Critical:** `OWNER_APPROVED` applies to the architectural principle only. GF0–GF5 execution requires separate owner approval per milestone. GF0–GF2 can proceed in parallel; GF3–GF5 are sequential per dependencies. See `plans/guest-first-implementation-plan.md` for engineering contracts.

### 0.2 ترتیب اجباری
1. ~~بستن مرحله اول هتل دامون~~ — **`HOTEL_PHASE1_CLOSED`**؛ مستند نهایی و شواهد در [گزارش closure](../hotel/HOTEL-PHASE1-FINAL-CLOSURE-2026-11-16.md).
2. شروع `G0` فقط پس از **تصویب جداگانه مالک** — ممیزی دقیق و تست مستقل OTP/عضویت/SMS روی baseline همان روز؛ بدون تغییر Production.
3. انجام PRهای کوچک `G1` تا `G9` طبق وابستگی‌ها و دروازه‌ها.
4. ارسال پیامک واقعی **فقط** پس از تأیید مجزای مالک، Canary محدود و رسید واقعی تحویل/رفتار provider.

**`HOTEL_PHASE1_CLOSED` برقرار است؛ با این حال، این سند به‌تنهایی مجوز شروع G0 یا هیچ PR اجرایی نیست.** شروع G0 همچنان نیازمند تصویب جداگانه مالک است. PRهای امنیتی اضطراری که جداگانه تصویب شده‌اند از این قاعده مستثنا هستند.

### 0.3 معیار `HOTEL_PHASE1_CLOSED` — مستقلاً قابل اثبات
- PR85 اصلاح داشبورد هتل را ادغام کرد؛ مالک سپس صریحاً `FINAL LIVE ACCEPTANCE` را تأیید کرد. این تأیید مالک در گزارش closure ثبت شده و از بازپذیرش مستقل مرورگر تفکیک شده است.
- Production read-only علیه PostgreSQL رانفلر، سازمان `cmvbltspu0000jt08zfn7xltj` با `vertical=HOTEL`، حساب `damoon` با عضویت `ADMIN` فعال و property فعال `cmvbltsrc0009jt08k3o8jdip` را تأیید کرد.
- PR87 مسیر اختصاصی و ممیزی‌شده را افزود. پس از فعال‌سازی مجاز، Production read-only تأیید کرد `HOTEL_BOOKING` برابر `ACTIVE` است، `enabledAt` معتبر دارد و `disabledAt=null`؛ ردیف `HOTEL_WEBSITE` نیز فعال و حفظ شده است. شناسه‌های capability و audit در [گزارش closure](../hotel/HOTEL-PHASE1-FINAL-CLOSURE-2026-11-16.md) ثبت شده‌اند.
- CI روی head دقیق PR87 و نتیجه owner acceptance در همان گزارش ثبت شده‌اند. هیچ قابلیت SHOP/APPOINTMENT، رزرو عمومی، پرداخت واقعی یا SMS در این فعال‌سازی تغییر نکرد.
- هیچ شرط بالا به معنی تأیید رزرو عمومی، پرداخت واقعی، نشر سایت یا ارسال SMS نیست؛ گیت‌های مستقل آن‌ها محفوظ‌اند.

**وضعیت فعلی:** `HOTEL_PHASE1_CLOSED` در `2026-11-16` ثبت شد. `G0` فقط پس از تصویب جداگانه مالک قابل آغاز است. این closure وضعیت OTP/SMS یا مجوز ارسال پیامک واقعی را تغییر نمی‌دهد.

## 1. مبنای بازبینی کد و شواهد

جزئیات این بخش، بازبینی ایستای انجام‌شده روی baseline تاریخی `5b803e561848f5634813effbd90854d772c83da1` است؛ این محتوا در این closure دوباره بررسی نشده است. پیش از هر پیاده‌سازی، G0 باید آن را روی `main` فعلی (`24604ccc939a64a03b948c2a5b9af40586d817c8`) بازتولید یا اصلاح کند. هیچ OTP/SMS در این کار اجرا یا پیاده‌سازی نشده است.

| زیرسامانه | مسیرهای منبع کلیدی | واقعیت مشاهده‌شده در کد | گپ یا وضعیت نامشخص |
|---|---|---|---|
| ثبت‌نام با رمز | `app/api/auth/register/route.ts`, `app/api/auth/register/organization/route.ts`, `lib/auth.ts` | ثبت‌نام Customer؛ عضویت سازمانی در برخی مسیرها | همگرایی امن هویت‌های قدیمی/موبایل و اثر ثبت‌نام سازمان جدید باید آزموده شود |
| درخواست OTP | `app/api/auth/customer/request/route.ts`, `lib/customer-auth/core.server.ts` | ثبت درخواست، quotas، cooldown، hash کد، لینک یکبارمصرف، پاسخ عمومی | IP از headerهای forwarded گرفته می‌شود؛ مرز proxy معتبر و ضدسوءاستفاده نیازمند بازبینی |
| مصرف OTP | `lib/customer-auth/core.server.ts`, `lib/auth.ts` | OTP چهاررقمی، اعتبار ۲دقیقه، ۳ تلاش، session tenant-bound | تراکنش شمارنده تلاش ناموفق ممکن است با throw rollback شود؛ با PostgreSQL ثابت/رفع شود، نه حدس |
| UI ورود موبایلی | `components/auth/customer-phone-login.tsx`, `app/[locale]/login/phone/page.tsx` | دریافت/ورود OTP، resend countdown، نمایش برند | UX خطای ارسال، ورودِ موجود، RTL/موبایل، HTTPS/PWA و بازگشت امن نیازمند بررسی |
| مدل مشتری | `prisma/schema.prisma` | `CustomerPhoneIdentity`, `CustomerAccessLink`, `CustomerPhoneAuthQuota`, `CustomerPhoneSession`, `CustomerClubMembership`, `CustomerSsoTicket` | مهاجرت امن کاربران قدیمی؛ جداسازی عضویت‌ها و رضایت‌ها |
| SMS احراز هویت | `lib/customer-auth/sms-outbox.server.ts`, `sms-runtime.server.ts`, `inoti-token-transport.server.ts`, `scripts/inoti/customer-auth-sms-worker.mts` | Outbox رمزگذاری‌شده، lease، وضعیت UNCERTAIN، کانال اختصاصی OTP با توکن **پلتفرم** | زمان‌بندی Worker، تنظیمات Runflare، تحویل واقعی و مانیتورینگ اثبات نشده |
| SMS کسب‌وکار | `lib/integrations/inoti-sms/routing.ts`, `provider.ts` | مسیریابی سازمانی/پلتفرمی؛ provider عمومی iNoti در بخش‌هایی fail-closed/read-only | یکپارچگی send/reconcile واقعیِ tenant-aware نیازمند پیاده‌سازی و آزمون |
| SMS جایگزین | `lib/sms/*` و `lib/notifications/*` | مسیر مستقل SMS.ir، dry-run و notification routing | provider-fallback و هزینه/رضایت نباید با احراز هویت مخلوط شود |
| SSO دامنه‌ها | `lib/customer-auth/sso.server.ts`, `app/api/auth/customer/sso/*` | ticket یکبارمصرف ۶۰ثانیه‌ای، مبدا/مقصد و session مستقل | HTTPS cookie/redirect و پذیرش واقعی چند PWA تأیید نشده |
| عضویت مشتری | `app/api/customer-club/membership/route.ts`, `lib/services/customer-club.service.ts` | عضویت/خروج و مدیریت باشگاه با scope سازمان | join صریح و رضایت بازاریابی باید از OTP تفکیک شوند |
| عضویت مدیران | `lib/organization-onboarding/*`, `lib/user-provisioning/*`, `app/api/organizations/[id]/members/*` | دعوت هویت‌محور، نقش `ADMIN`/`MANAGER`، provision/reset مجاز | OTP عمومی نباید مدیر ایجاد کند یا bypass دعوت باشد |
| ترجیحات اعلان | `app/api/customer/notification-preferences/route.ts`, `lib/services/notification-preferences.service.ts` | ترجیحات `SMS`, `WEB_PUSH`, `IN_APP` per-tenant؛ marketing SMS پیش‌فرض false | ثبت زمان/منبع رضایت و unsubscribe ساده، گزارش ممیزی و الزامات قانونی محلی باید بازبینی شوند |
| ورودی USSD | `lib/customer-auth/ussd.server.ts`, `lib/integrations/inoti-ussd/*` | بنیاد ثبت‌نام موبایل از مسیر USSD وجود دارد | کنترل correlation، مجوز اپراتور، نرخ و عدم نشت شماره |

### 1.1 مراجع نسخه‌دار
- `docs/roadmaps/BAZARBAAZ-DELIVERY-ROADMAP.md` — نقشه راه عمومی موجود؛ وضعیت مرحله PR64 در این فایل **تاریخی/قدیمی** است و نباید جایگزین main جدید شود.
- `docs/handoffs/BAZARBAAZ-COMPREHENSIVE-TECHNICAL-REPORT-2026-11-05.md` و `docs/handoffs/evidence/2026-11-05/customer-*.json` — شواهد تست محلی قدیمی، نه گواه Runtime فعلی.
- `docs/hotel/HOTEL-SECURE-ONBOARDING.md` — قرارداد دعوت مدیران؛ وضعیت‌های قدیمی حساب دامون را به یافته Production جدید ارجح ندانید.
- `prisma/migrations/20261104170000_customer_phone_auth/`, `20261105100000_customer_sso/`, `20261105110000_customer_auth_sms_acceptance/`, `20261106124758_add_customer_otp/` — تاریخچه schema مرتبط.
- `docs/migration/runflare/*` — سوابق مهاجرت؛ هر ادعای Neon در اسناد اکتبر، مرجع وضعیت Production نوامبر نیست.
- `docs/SMS_IR_INTEGRATION.md`, `docs/PHASE_120D_SMS_IR_PROVIDER_COMPLETION.md` — مسیر SMS.ir جداگانه؛ مرجع SMS OTP iNoti نیست.

## 2. تصمیم‌های معماری و اصول ثابت (Invariants)

### 2.1 هویت، مشتری و عضویت
1. **یک هویت مرکزی برای هر شماره تأییدشده** در صورت امکان، بدون تصاحب خودکار کاربر قدیمی که شماره/نام کاربری مشابه دارد. هر conflict تا احراز هویت مالک به حالت `RECONCILIATION_REQUIRED` برود.
2. **عضویت مشتری در هر tenant مستقل** است: ثبت‌نام در دامنه A نباید customer-club tenant B را فعال کند. بدون اقدام صریح، هیچ cross-tenant join و marketing opt-in انجام نشود.
3. `User` مرکزی، `CustomerPhoneIdentity` برای اثبات موبایل، `CustomerClubMembership` برای رابطه تجاری، و `OrganizationMember` برای نقش کارکنان مفهوم‌های متفاوت‌اند؛ آن‌ها را ادغام نکنید.
4. OTP فقط **اثبات مالکیت شماره** است. هیچ‌گاه نقش `ADMIN`, `MANAGER`, `STAFF`, `SUPER_ADMIN` ایجاد نمی‌کند و جایگزین دعوت معتبر مدیر نمی‌شود.
5. با ورود در یک tenant، session و داده مجاز همان tenant قابل دسترس است؛ سایر دامنه‌ها به SSO با رضایت و اثبات عضویت مستقل نیاز دارند. Logout و revoke باید دقیق و تست‌شده باشند.
6. لینک/OTP هرگز به query string قابل لاگ، Audit، analytics، browser referrer، push، تصاویر و exception منتقل نشود. اگر token در hash URL قدیمی هست، مصرف و پاک‌سازی client-side را نیز ارزیابی کنید.
7. ورود مدیران موجود (`damoon`, `damoon-manager` و دیگران) با credential نباید در rollout OTP مشتری مختل شود.

### 2.2 ارسال پیامک
1. **OTP امنیتی** از حساب پیامک پلتفرم iNoti و gateway مخصوص auth؛ **پیامک تجاری/تراکنشی tenant** از integration مجاز همان tenant، با سیاست fallback صریح و تصویب‌شده؛ ادغام پنهان مسیرها ممنوع.
2. marketing و transactional دو purpose متفاوت‌اند. رضایت SMS تبلیغاتی در هر سازمان پیش‌فرض **غیرفعال**، قابل‌اثبات و قابل‌لغو باشد. OTP هرگز marketing محسوب نشود.
3. `ACCEPTED` provider به معنی تحویل گوشی نیست. وضعیت‌های `PENDING`, `SENDING`, `ACCEPTED`, `DELIVERED` (تنها با شواهد معتبر), `FAILED`, `UNCERTAIN`, `CANCELLED` تفکیک شوند.
4. ارسال مبهم (`UNCERTAIN`) هرگز خودکار و بی‌قید تکرار نشود؛ idempotency و reconcile قبل از resend بررسی شود تا پیام تکراری به کاربر نرسد.
5. هر پیام و هزینه/سهمیه به `organizationId`, purpose, correlationId, provider, account route, consent decision, dispatch attempt و نتیجه گزارش‌دهی قابل ردیابی باشد؛ بدون ذخیره متن OTP/توکن یا شماره کامل در logs.
6. هیچ network send در CI، dry-run، seed، unit/integration/browser synthetic؛ Live Send فقط با Flags و approval و recipient allowlist برای Canary.

### 2.3 امنیت و عملیات
- تمام endpointهای mutation: auth/CSRF یا same-origin مناسب، اعتبارسنجی schema و body size، rate limit متناسب؛ fail closed.
- rate-limit مبتنی بر IP صرفاً از header زنجیره proxy **مورد اعتماد**؛ spoof از client نباید quota دیگران را دور بزند.
- lockout, replay, OTP brute-force, session fixation/revocation, soft-deletion, race و leak بین دامنه‌ها باید آزمون منفی داشته باشند.
- تست‌های PostgreSQL فقط با دیتابیس disposable identity-verified روی loopback. هیچ fixture یا rollback تست در Runflare Production اجرا نشود.
- اتصال `DB_REMOTE_URI` فقط برای preflight read-only مورد تأیید. هیچ CLI/test/migration نباید به شکل خودکار این URI را load کند.
- Runflare منبع استقرار و دیتابیس Production است. Neon منسوخ؛ Vercel preview تعلیق است و معیار قبولی این Roadmap نیست.
- `main` به‌صورت خودکار به Runflare deploy می‌شود؛ Merge هر PR باید تأثیر production را حساب کند و قابلیت‌های Live به‌طور پیش‌فرض خاموش بمانند.

## 3. نقشه راه فازبندی‌شده و وابستگی‌ها

### G0 — Baseline و ممیزی قفل‌شده (بعد از بسته‌شدن هتل؛ بدون تغییر عملکرد)
**هدف:** فاصله بین مستند قدیمی و main روز، تسلط بر feature flags و مدل داده و ابهام‌ها.

**Work items:**
- `G0.1` تعیین HEAD جدید `main`, فایل/مهاجرت مرتبط، دسترسی‌ها و PR باز؛ ثبت dependency graph.
- `G0.2` اجرای read-only Runflare preflight با حداقل metadata: نسخه PostgreSQL، وجود جدول/ستون‌ها، ledger migrationهای مرتبط، وضعیت flagها به شکل boolean (نه مقادیر secret)، و status Worker؛ نه شمارش/خواندن شماره‌های واقعی مگر با دلیل و مجوز.
- `G0.3` اجرای baseline TypeScript + unit + PostgreSQL integration روی fixture مصنوعی و HTTPS browser acceptance در CI.
- `G0.4` risk register برای OTP attempt rollback، spoofable forwarded headers، collision هویت‌های قدیمی، provider URL query redaction و mobile UX.

**Deliverables:** `docs/identity/G0-BASELINE-AND-READINESS.md`, machine-readable evidence با exact SHA، جدول flags و وضعیت‌های `VERIFIED`, `UNVERIFIED`, `BLOCKED`.

**Exit:** تمام فاصله‌های blocking با Test Case/Owner مشخص؛ هیچ Producer واقعی روشن نشده باشد.

### G1 — اصلاح امنیت و یکپارچگی OTP (`P0`)
**Depends on:** G0.

**Work items:**
- `G1.1` آزمون PostgreSQL اثباتی برای ۳ کد غلط متوالی و هم‌زمان؛ اگر `otpAttempts` داخل تراکنش rollback می‌شود، atomic persisted attempt count یا DB-safe pattern اعمال شود.
- `G1.2` cooldown و quota سراسری از DB، نه حافظه فرایند؛ تست چند instance Runflare و resend race؛ policy کنونی (۴ رقم/۲ دقیقه/۳ تلاش/۶۰ثانیه cooldown) حفظ یا فقط با تصمیم امنیتی مستند تغییر کند.
- `G1.3` اصلاح مرز trusted proxy/IP، quota per-phone/per-IP/per-organization، ضد enumeration، origin/domain verification، خطای امن و زمان پاسخ.
- `G1.4` بررسی timing-safe compare، expiry، single-use، atomic consume، invalidation بعد از مصرف، crash/concurrency، session cookie و حفظ نقش‌های مدیریتی.
- `G1.5` اصلاح UI برای request accepted but not delivered، countdown/resend و ارسال دوباره؛ بدون لو دادن وجود حساب.

**Acceptance:** wrong OTP 3x واقعاً مسدود؛ ۱۰ تلاش هم‌زمان حداکثر یک مصرف موفق؛ هیچ replay یا cross-tenant/cross-origin؛ تمام هویت‌های privileged رد؛ هیچ پیامک واقعی.

### G2 — همگرایی ثبت‌نام، هویت قدیمی و عضویت مشتری
**Depends on:** G1.

**Work items:**
- `G2.1` inventory جریان‌های `register`, `register/organization`, `customer-phone`, password login، guest hotel و checkout؛ contract واحد بدون حذف backwards compatibility.
- `G2.2` قواعد matching/claim برای User قدیمی با همان شماره/username؛ non-destructive verified linking، conflict quarantine، عدم تولید حساب دوگانه/تصاحب.
- `G2.3` onboarding customer جدید/قدیمی: verify number -> create/link identity -> **explicit tenant join** -> session -> return-to مجاز.
- `G2.4` اصلاح source/status عضویت (`ACTIVE/PAUSED/LEFT/BLOCKED`): ورود شماره قبلاً خارج‌شده را خودسرانه فعال نکند؛ rejoin فقط از workflow صریح.
- `G2.5` profile و customer membership UI برای مشاهده/پیوستن/خروج با consent جداگانه؛ محافظت از منابع خرید/رزرو با سیاست مالکیّت و حفظ سوابق پس از leave.

**Acceptance:** مشتری در A عضو، در B ناموجود تا درخواست صریح؛ join دوباره با سیاست تأیید، checkout guest حفظ؛ OTP نتواند مدیر شود؛ duplicate conflict امن؛ audit بدون PII حساس.

### G3 — موتور ارسال OTP iNoti پلتفرم و Worker قابل بهره‌برداری
**Depends on:** G1; data contracts G2 as required.

**Work items:**
- `G3.1` حفظ `InotiTokenSmsTransport` مخصوص auth و `INOTI_PLATFORM_SMS_TOKEN/LINE_NO` در server secret؛ بررسی API contract برای پاسخ provider و وضعیت واقعی شماره‌های ایران.
- `G3.2` worker زمان‌بندی‌شده Runflare/cron با lease، concurrency، retry policy، restart، poison-message handling، metrics، alerting، graceful shutdown.
- `G3.3` ردیابی `ACCEPTED` vs delivered و provider callback/report؛ به‌هیچ‌وجه `ACCEPTED` را معادل گوشی دریافت‌کرده اعلام نکنید.
- `G3.4` redaction برای GET provider URL (`Token`, `MobileNumbers`, `Message`), APM/proxy/log/trace؛ transport اگر provider API GET الزام دارد کنترل نشت را قبل از live release مستند و تست کند.
- `G3.5` اجرای dry-run/E2E fake provider؛ سپس Canary واقعی **فقط با approval جداگانه، یک شماره مالک/آزمون مجاز، سقف هزینه و توقف اضطراری**.

**Acceptance:** یک و تنها یک dispatch برای درخواست، persistent idempotency across crash، UNCERTAIN بدون blind retry، مشاهده ack واقعی و handset نتیجه جدا، قابلیت خاموش‌کردن سریع، بدون ارسال تبلیغاتی.

### G4 — Messaging Core چندمستاجری و اتصال حساب‌های iNoti سازمانی
**Depends on:** G0, G3 readiness; آغاز مستقل کد فقط پس از Hotel Gate.

**Work items:**
- `G4.1` مشخص‌کردن interface واحد `purpose + organizationId + recipient + template + idempotencyKey`؛ تفکیک مسیر `PLATFORM_OTP` و مسیر `ORG_TRANSACTIONAL`, `ORG_MARKETING`, `ORG_SECURITY`.
- `G4.2` تکمیل adapter ارسال واقعی iNoti سازمانی (در حال حاضر `lib/integrations/inoti-sms/provider.ts` برای `sendMessage` fail-closed است). تست قرارداد provider با fixture و پاسخ malformed.
- `G4.3` tenant-owned integration credential routing؛ عدم fallback پنهان از حساب tenant به حساب پلتفرم؛ اولویت‌ها و سیاست alternative provider را قبل از پیاده‌سازی تصویب کنید.
- `G4.4` صف Outbox سازمانی، retry classification، reconciler، delivery reports، unsubscribe، quota/cost ledger و dashboard پشتیبانی.
- `G4.5` نگه‌داشتن `lib/sms/*` (SMS.ir) به‌عنوان adapter مستقل؛ duplicate routing/charging را با contract test منع کنید.

**Acceptance:** پیام tenant A با credential tenant B/Platform هرگز ارسال نشود؛ failure tenant A بر B/OTP اثر نگذارد؛ گزارش تحویل و هزینه tenant-scoped، multi-origin-safe، no real sends in CI.

### G5 — تجربه مشتری در PWA و دامنه‌های مستقل
**Depends on:** G2/G3؛ برای SSO کامل G4 اختیاری است.

**Work items:**
- `G5.1` UI واکنش‌گرا برای فارسی RTL و EN/AR، ورودی شماره ایران، ارقام فارسی/لاتین، keyboard/auto-fill، loading و accessibility.
- `G5.2` tenant-branded login/register/logout/account؛ manifest/host/cookie isolation، redirect allowlist و کنترل `returnTo`.
- `G5.3` SSO ticket ۶۰ثانیه‌ای بین دامنه‌های تأییدشده فقط با گام کاربری/عضویت مقصد؛ consent و revocation، بدون silent cross-tenant account creation.
- `G5.4` کارکرد آنلاین/آفلاین PWA: عدم cache OTP/session/PII، نمایش درست هنگام offline، refresh token/session expiry.
- `G5.5` مرورگر Chromium واقعی HTTPS در CI + Android واقعی برای حداقل یک دامنه خارجی؛ در آینده پایلوت‌های دیگر.

**Acceptance:** هیچ cookie/token/برند tenant دیگر نمایش داده نشود؛ login/logout/reload/back همگی امن؛ checkout/booking legacy بدون regression.

### G6 — رضایت، باشگاه مشتریان و پیامک رویدادی
**Depends on:** G2 + G4 برای SMS واقعی؛ dry-run ممکن است زودتر تست شود.

**Work items:**
- `G6.1` مدل consent per-tenant/per-channel/per-purpose با نسخه متن، source، time و audit؛ SMS marketing به‌صورت opt-in صریح پیش‌فرض false.
- `G6.2` transactional templates برای سفارش، رزرو، وضعیت پرداخت و رویداد امنیتی؛ event idempotency، no sensitive content و localization.
- `G6.3` UI مشاهده و لغو عضویت/لغو SMS تبلیغاتی و توضیح مجزای پیامک ضروری؛ عدم ارسال پس از opt-out/blocked/left.
- `G6.4` dashboard tenant برای اعضای فعال، وضعیت رضایت، سلامت پیامک، هزینه‌ها و export مجاز؛ staff RBAC.
- `G6.5` جلوگیری از افزودن خودکار مشتری به کمپین از روی شمارهِ guest یا USSD؛ عضویت و مجوز مستقل نیاز است.

**Acceptance:** ۰ پیام marketing بدون رضایت معتبر، opt-out فوری و ماندگار، شکستن رویدادهای تراکنشی مجاز بر اثر opt-out تبلیغاتی ممنوع، tenant isolation.

### G7 — ورودی‌های جایگزین: USSD و QR و لینک عضویت
**Depends on:** G2/G3/G6.

**Work items:**
- `G7.1` اتصال iNoti USSD customer enrollment route با phone proof، route binding و idempotency.
- `G7.2` QR/link campaign با signed attribution و expiry؛ ممنوعیت افشای شماره یا join خودکار با redirect.
- `G7.3` ثبت منبع عضویت و consent در صورت اظهار صریح؛ جلوگیری از استفاده از marketing consent در کانال دیگر.
- `G7.4` refund/retry/provider outage/duplicate callback و security negative tests.

**Acceptance:** USSD تنها گام آغاز ثبت‌نام است نه مالکیت تاییدشده؛ داده سازمان دیگر نشت نکند؛ هیچ activation بدون OTP.

### G8 — رصد، SLO، پشتیبانی و نگهداری
**Depends on:** G3/G4/G6.

**Work items:**
- `G8.1` داشبورد counters: requested OTP, accepted, authenticated, expired, rate-limited, unknown-send, provider delivery، بدون متن/شماره خام.
- `G8.2` audit history redacted و trace correlation across request/outbox/provider/report؛ retention/purge کدها و queue.
- `G8.3` alert thresholds, operational runbooks (provider outage, credential rotation, backlog, refunds, abuse), backoff/jitter/circuit breaker.
- `G8.4` backup/restore rehearsal و DB migration preflight روی staging/isolated، بدون دستکاری ledger تولید.
- `G8.5` observability برای quotas و billing هر tenant؛ قابلیت pause per provider/tenant و global emergency stop.

**Acceptance:** خرابی provider با test قابل تشخیص، بازیابی قابل تکرار، هیچ credential یا OTP در log/export، انقضای داده به‌موقع.

### G9 — بهره‌برداری تدریجی و پذیرش چند سازمان
**Depends on:** G1–G8 به مقدار لازم برای هر capability.

**Rollout sequence (پیشنهادی، نیازمند تأیید مالک):**
1. تست synthetic / dry-run در CI.
2. Canary واقعی با شماره مجاز، فقط OTP، یک tenant پایلوت، بودجه محدود.
3. ثبت‌نام/ورود موبایلی pilot دامون **بعد از** بسته‌شدن فاز اول هتل و تأیید دامنه/مهاجرت.
4. توسعه پایلوت مرحله‌ای به آکا شوز، کافه لئو، رستوران ۱۳؛ هر دامنه گیت مستقل.
5. پیامک تراکنشی tenant-aware.
6. پیامک بازاریابی فقط بعد از رضایت‌سنجی و approval مجزا.

**Acceptance:** برای هر tenant رسید URL، SHA، وضعیت نسخه Runflare، operator، env flags غیرحساس، migration ledger، HTTPS browser, mobile PWA, provider acceptance/delivery و rollback.

## 4. PR decomposition پیشنهادی

هر PR فقط یک هدف، فایل‌های مالک خود، migration additive در صورت لزوم و تست‌های exact-SHA داشته باشد. شماره PR در زمان اجرا تعیین می‌شود.

| PR slice | وابستگی | محدوده | حداقل آزمون الزامی |
|---|---|---|---|
| `AUTH-G0-BASELINE` | Hotel Phase1 closed | فقط docs/evidence/decision log | inventory paths, flags, read-only evidence |
| `AUTH-G1-OTP-ATTEMPTS` | G0 | OTP consume attempt persistence + concurrency | PostgreSQL wrong 3x, replay, race |
| `AUTH-G1-REQUEST-ABUSE` | G1 attempts | trusted proxy, quotas, origin/host, cooldown | forged headers, multi-instance fixture |
| `AUTH-G2-IDENTITY-LINKING` | G1 | existing customer linking/conflict resolution | duplicate/legacy/staff negative cases |
| `AUTH-G2-MEMBERSHIP` | G2 linking | explicit join/leave, membership status and audit | 2-tenant fixture, blocked/left/rejoin |
| `SMS-G3-WORKER` | G1 | platform OTP queue scheduling + redaction + safety | injected provider, lease/restart/uncertain |
| `SMS-G3-CANARY-PREFLIGHT` | G3 worker | docs + one-shot guard, owner approval separate | check-only, no sends in CI |
| `SMS-G4-INOTI-TENANT` | G3 + approved contracts | tenant iNoti transport + routing | cross-account deny, provider contract |
| `SMS-G4-DELIVERY-OPS` | G4 adapter | outbox/reports/cost/ops | provider replay, reconciliation, no doubles |
| `AUTH-G5-PWA-SSO` | G2/G3 | branding, login PWA, domain SSO | FA/EN/AR HTTPS browser, Android checklist |
| `MEM-G6-CONSENT` | G2 | tenant SMS opt-in/out + versions | zero marketing without explicit consent |
| `MEM-G6-LIFECYCLE` | G4/G6 consent | transactional events + club UX | idempotency, no campaign crossover |
| `MEM-G7-USSD-QR` | G2/G6 | inbound enrollment & attribution | callback replay/origin/revocation |
| `OPS-G8-OBSERVABILITY` | G3/G4 | SLO/metrics/runbooks/retention | redaction, alert drill, pause/rollback |
| `ROLL-G9-TENANT-CANARY` | approved preceding slices | pilot rollout, no source redesign | owner signoff per tenant |

### PR completion protocol
- Isolated clone/branch؛ **هیچ تغییر در checkout مشترک** یا کار دیگر Agentها؛ preserved worktrees.
- قبل از کدنویسی، دقیقاً مسیرهای تحت مالکیت و تست‌ها اعلام شوند؛ نه re-audit مکرر.
- Tests: unit + focused PostgreSQL disposable + real API/browser + TypeScript + scoped lint + migration replay (اگر وجود دارد).
- CI exact head SHA، رفع failure واقعی، ثبت شواهد، GitHub PR، review و merge عادی؛ status `PASS` فقط با artifact واقعی.
- هیچ تغییر خودکار Runflare env/DB/SMS/permissions، حتی اگر PR merged باشد.
- هر feature flag جدید پیش‌فرض OFF، با rollback و operator checklist.

## 5. Test matrix — منفی‌ها الزامی‌اند

| حوزه | حالت سالم | حالت شکست که باید صریح آزموده شود |
|---|---|---|
| OTP issue | یک OTP در هر cooldown | over-quota, 2 concurrent requests, forged IP, invalid host/origin |
| OTP verify | یک مصرف موفق | 3 wrong persisted, replay, expiry, concurrent consume, cross-origin, cross-tenant |
| هویت | شماره جدید/قدیمی با اثبات مالکیت | pre-existing privileged user، collision با username/phone، inactive/soft-deleted |
| عضویت | explicit join A | عدم join خودکار B، LEFT/PAUSED/BLOCKED، unauthorized management |
| SSO | user-approved A→B ticket | ticket replay/expiry/wrong verifier/wrong domain, no membership at B |
| cookie/PWA | HTTPS same-origin sessions | cookie leak, service-worker cache, cross-brand, back navigation after logout |
| auth-SMS | idempotent accepted | timeout/unknown, provider 5xx, malformed response, worker crash, double send |
| tenant-SMS | tenant account owns message | cross-tenant routing, missing account, disabled line, fallback leakage |
| consent | verified opt-in | marketing default false, after opt-out/leave, changed purpose, import-only phone |
| Operations | queue drain and audit | backlog, stalled leases, pause switch, secret leakage in logs |
| Hotel regression | manager and guest existing flows | no role escalation or booking/payment gate bypass |

## 6. Data model و API contract پیشنهادی

**ابتدا reuse، سپس migration در صورت اثبات گپ.** migrationهای قبلی یا Prisma ledger را دستکاری نکنید. طرح مفهومی:

```text
User (identity principal)
  ├─ CustomerPhoneIdentity (verified phone; unique)
  ├─ CustomerPhoneSession (user + organization + expiry + revocation)
  ├─ CustomerClubMembership (user + organization + status + source)
  ├─ OrganizationMember (user + organization + privileged role, invitation/RBAC)
  └─ NotificationPreference (organization + channel + purpose/consent)

CustomerAccessLink (org + phone + origin + OTP digest + expiry + attempts)
  └─ CustomerAuthSmsOutbox (encrypted payload + lease + provider ack)

OrganizationIntegration (tenant-owned iNoti credentials reference)
  └─ SmsDelivery/DeliveryAttempt (tenant + purpose + idempotency + provider state)
```

**Contract constraints:**
- `POST /api/auth/customer/request`: پاسخ generic anti-enumeration؛ no secret; session-less restricted by trusted origin.
- `customer-phone` NextAuth authorize: consume-only؛ active customer, tenant-scoped session؛ global role guard.
- `GET /api/auth/customer/config`: availability/readiness بدون credential و PII؛ `Cache-Control: private,no-store`, host-bound.
- `POST/DELETE /api/customer-club/membership`: تنها برای همان کاربر مگر admin tenant؛ action صریح و audited.
- `NotificationPreference`: نسخه رضایت و source و زمان (اگر در مدل موجود ناقص است، additive extension طراحی شود).
- `INOTI PLATFORM OTP`: از organization sender جدا؛ مصرف credential صرفاً server-side.
- تمام APIهای فعلی backwards compatible بمانند؛ تغییر پاسخ‌ها versioned یا تست‌شده.

## 7. Environment و پیکربندی — بدون ارائه secret

### 7.1 Flags فعلی که باید **وجود/مقدار boolean** آن‌ها سنجیده شود
- `CUSTOMER_PHONE_AUTH_ENABLED`
- `CUSTOMER_AUTH_SMS_WORKER_ENABLED`
- `INOTI_PLATFORM_SMS_TOKEN` (فقط موجودبودن، هرگز نمایش مقدار)
- `INOTI_PLATFORM_SMS_LINE_NO` (فقط معتبر بودن فرمت/دسترسی مجاز)
- `INOTI_ALLOW_LIVE_SMS`
- `INOTI_RUNTIME_MUTATIONS_APPROVED`
- `CUSTOMER_SSO_ENABLED`
- `NEXTAUTH_SECRET` (فقط length/وجود، هرگز مقدار)
- SMS.ir متغیرهای `SMS_PROVIDER`, `SMS_DRY_RUN`, `DEPLOYED_ALLOW_REAL_SMS` برای مسیر جداگانه.

### 7.2 قواعد Runflare
- Secrets در Runflare secrets/variables و source مجاز local `.env`، نه در Git/log/chat/evidence.
- Live OTP نیازمند approval جداگانه، برنامه توقف اضطراری و budget/recipient cap.
- Worker scheduling، پایداری Runflare، health checks و lease ownership قبل از live release مشخص شوند.
- از `DB_REMOTE_URI` تنها در preflight read-only تأییدشده استفاده شود؛ قبل از connection با `SHOW transaction_read_only` و fingerprint غیرحساس target و rollback.
- Production write برای business config، migration، activation یا ارسال SMS صرفاً بعد از تأیید مشخص مالک و عملیات ثبت‌شده.

## 8. Definition of Done برای هر Feature و برای کل پروژه

**DoD slice:** مشخصات و risk reviewed؛ کد در scope؛ تست unit/integration/brower موردنیاز روی exact SHA PASS؛ no secrets؛ migration additive/rollback documented؛ review؛ PR merged؛ feature flag OFF در Production مگر approval مجزا؛ evidence linkage.

**DoD platform OTP:** پایداری issuance/consume در برابر race، crash، multi-instance؛ no privilege escalation؛ پیامک auth iNoti با approved canary؛ آمار دلیوری و رفتار خطا؛ tenant isolation؛ recovery/runbook.

**DoD membership:** ورود مشتری جدید/قدیمی، self-join و leave، حفظ سوابق قانونی، رضایت مستقل، profile/club tenant-based، عدم ساخت عضویت متقاطع.

**DoD tenant SMS:** provider routing جدا برای هر سازمان، ارسال تراکنشی، consent marketing، delivery reconciliation/cost، fail-closed و عملیات رفع خطا.

**DoD rollout:** حداقل یک پایلوت مرورگر موبایل واقعی و کنترل هزینه/پیامک، owner sign-off، ثبت Runflare rollback reference، فعال‌سازی تدریجی.

## 9. Decision register — نیازمند تصویب مالک قبل از اجرا

| ID | سؤال/تصمیم | پیش‌فرض پیشنهادی | وضعیت |
|---|---|---|---|
| `D01` | اولویت پایلوت پس از هتل | Damoon پس از بسته‌شدن؛ سپس Aka / Leo / 13 | PROPOSED |
| `D02` | OTP طول کد | حفظ ۴رقمی موجود تنها با rate-limit مؤثر و تست؛ تغییر به ۶ رقم پس از ارزیابی UX/ریسک | PROPOSED |
| `D03` | حساب ارسال OTP | iNoti پلتفرم، بدون وابستگی به اعتبار tenant | PROPOSED مطابق معماری فعلی |
| `D04` | حساب پیامک تجاری | iNoti همان tenant، بدون fallback خودکار به پلتفرم | PROPOSED |
| `D05` | provider fallback به SMS.ir | خاموش تا تصمیم جدا | OPEN |
| `D06` | بازاریابی | consent صریح per-tenant/per-channel، پیش‌فرض OFF | PROPOSED |
| `D07` | ورود یکپارچه | user-mediated, only verified domains/memberships | PROPOSED |
| `D08` | اکانت‌های قدیمی بدون phone proof | conflict quarantine و linking امن، نه overwrite | PROPOSED |
| `D09` | فعال‌سازی واقعی پیامک | canary یک شماره مجاز + حد سقف هزینه | OWNER_APPROVAL_REQUIRED |
| `D10` | چرخه عمر داده/OTP/log | retention حداقلی و مستند بر اساس مقررات قابل‌اعمال | OPEN |
| `D11` | اضافه‌شدن Staff به login OTP | در این برنامه ممنوع؛ طراحی مستقل امنیتی لازم دارد | PROPOSED |
| `D12` | consent در USSD و checkout مهمان | اثبات صریح، قابل ممیزی، غیرپیش‌فرض | PROPOSED |

## 10. ممنوعیت‌ها و کنترل تداخل با کار هتل

1. `HOTEL_PHASE1_CLOSED` ثبت شده است. بااین‌حال هیچ G0 یا PR اجرایی این نقشه راه بدون تصویب جداگانه مالک آغاز نشود.
2. PR85 و PR87 ادغام شده‌اند؛ برای این Roadmap دوباره بازبینی‌شان نکنید. گزارش نهایی در `docs/hotel/HOTEL-PHASE1-FINAL-CLOSURE-2026-11-16.md` است.
3. وضعیت تأییدشدهٔ Runflare شامل سازمان فعال HOTEL، ملک فعال، عضویت فعال `damoon` با نقش `ADMIN`، `HOTEL_BOOKING=ACTIVE` و حفظ `HOTEL_WEBSITE=ACTIVE` است. شناسه‌ها و رسید audit در گزارش closure ثبت شده‌اند.
4. فعال‌سازی هتل یک عملیات مستقلِ ممیزی‌شده بود و به rollout OTP/SMS وابسته نشد؛ هیچ SMS واقعی ارسال نشده است.
5. `organizationPublicRouteCapabilities` عمداً محدود به SHOP/APPOINTMENT است؛ هیچ دستکاری عمومی برای پشتیبانی auth هتل بدون بررسی routing انجام ندهید.
6. حفظ worktreeهای سایر Agentها، سرعت Build و فضای دیسک ویندوز؛ ترجیح runner ایزوله GitHub با PostgreSQL disposable.
7. هیچ secret، URI دیتابیس، پسورد `damoon` یا شماره موبایل واقعی در مستند/fixture/CI منتشر نشود.

## 11. Instruction for the next Codex agent (copy/paste)

```text
Read docs/roadmaps/BAZARBAAZ-POST-HOTEL-P1-IDENTITY-MEMBERSHIP-OTP-SMS-ROADMAP-2026-11-16.md and the Hotel Phase 1 closure record.
Hotel Phase 1 is closed, but this file is still a proposed roadmap, not permission to implement OTP or send SMS.
Do not begin G0 until the owner separately authorizes it.
After that authorization, refresh against current main and execute G0 only:
- enumerate source contracts and exact test commands;
- gather authorized nonsecret Runflare read-only schema/flag evidence;
- use disposable PostgreSQL/browser fixtures for regressions;
- investigate and prove the suspected OTP wrong-attempt rollback issue;
- produce a versioned evidence + risk/decision report.
Do not implement G1-G9 before G0 review and owner approval.
Never use Neon, modify production records, enable live iNoti, leak .env credentials,
revisit PR85, or alter other agents' worktrees.
``` 

## 12. وضعیت و ثبت پیشرفت (قالب، هر گام مستقل)

```yaml
roadmap_version: "2026-11-16-v2"
status: ROADMAP_PROPOSED
baseline_main: 24604ccc939a64a03b948c2a5b9af40586d817c8
hotel_phase1: HOTEL_PHASE1_CLOSED
source_audit: STATIC_REVIEWED
production_otp_sms: UNVERIFIED
production_database: RUNFLARE_POSTGRESQL
runtime_implementation: NOT_STARTED
live_sms_approval: NOT_GRANTED
next_permitted_action: REQUEST_G0_OWNER_APPROVAL
phases:
  G0: NOT_STARTED
  G1: NOT_STARTED
  G2: NOT_STARTED
  G3: NOT_STARTED
  G4: NOT_STARTED
  G5: NOT_STARTED
  G6: NOT_STARTED
  G7: NOT_STARTED
  G8: NOT_STARTED
  G9: NOT_STARTED
guest_first_workstream:
  architectural_principle: OWNER_APPROVED
  gf0_guest_cart_checkout: PLANNED
  gf1_secure_appointment_tracking: PLANNED
  gf2_hotel_enquiry_decoupling: PLANNED
  gf3_guest_to_customer_conversion: PLANNED
  gf4_customer_club_consent: PLANNED
  gf5_cross_domain_sso_pwa: PLANNED
  p0_a_appointment_pii: IDENTIFIED_IN_GF1
  p0_b_hotel_enquiry_coupling: IDENTIFIED_IN_GF2
```

---

**Change control:** هنگام اتمام هر gate، وضعیت همان gate را به‌روزرسانی و SHA/CI/رسید را لینک کنید. وضعیت‌ها را به‌خاطر موفقیت تست‌های قدیمی یا Merge صرفاً کد تغییر ندهید. این سند راه اجرای آینده است و جایگزین master/ledger/مجوزهای عملیاتی نیست.
