# Bazarbaaz | SnappPay — مستند کشف و آماده‌سازی اتصال

- Mission: `BB-RETAIL-BANK-TRANSFER-AND-SNAPPPAY-01` / Phase B
- Revision: 0.4 — 2026-11-28 (1405/09/07)
- Repository destination (proposed): `docs/integrations/snapppay/SNAPPPAY-INTEGRATION.md`
- Status: **PORTAL_VERIFIED / PAYMENT_AND_FEED_SOURCE_REVIEWED / IP_FORM_REVIEWED / SELF_API_CONTRACT_PENDING / NOT_READY_FOR_LIVE**
- Pilot: Aka Shoes (کفش آکا), `https://akashoes.ir`
- Audience: Bazarbaaz Technical Lead, Retail Payments engineer, merchant administrator.

> این سند شامل اطلاعات محرمانه، شناسه و نام کاربری واقعی API پذیرنده، رمز، توکن یا داده مشتری نیست. مستند رسمی کامل API هنوز دریافت نشده است. یافته‌های سورس پلاگین در بخش 4 مستند شده‌اند؛ نه جایگزین قرارداد API پذیرندگان Self و نه پذیرش Stage.

## 1. شواهد مستقیم از پنل پذیرنده

منبع: [پرتال پذیرندگان، صفحه دسترسی‌های فنی](https://portal.snapppay.ir/credentials)، مشاهده read-only در 2026-11-28. حساب «کفش آکا» با سطح دسترسی «ادمین کل» باز بود. صفحه سفارش‌های وب‌سایت نیز مشاهده شد. هیچ جست‌وجوی تراکنش مشتری، تغییر تنظیمات، تولید کلید، ثبت فرم یا درخواست API پرداخت انجام نشد.

| فیلد پنل | وضعیت مشاهده‌شده | مقصد پیشنهادی پیکربندی |
|---|---|---|
| Production Base URL | `api.snapppay.ir` | `SNAPPPAY_AKA_BASE_URL=https://api.snapppay.ir` |
| Client ID | مقدار موجود، در این مستند حذف شده | `SNAPPPAY_AKA_CLIENT_ID` |
| Client Secret | خالی در محتوای قابل خواندن؛ مقدار قبلی قابل بازیابی نیست | `SNAPPPAY_AKA_CLIENT_SECRET` |
| Username | مقدار موجود، در این مستند حذف شده | `SNAPPPAY_AKA_USERNAME` |
| Password | خالی در محتوای قابل خواندن؛ مقدار قبلی قابل بازیابی نیست | `SNAPPPAY_AKA_PASSWORD` |

طرح HTTPS برای Base URL با [راهنمای رسمی فعال‌سازی](https://academy.snapppay.ir/2026/04/21/activation/) تأیید شده است. نام متغیرهای محیطی بالا پیشنهاد بازارباز هستند، نه نام قراردادی پارامترهای HTTP اسنپ‌پی و نه الزاماً متغیرهای فعلی سورس بازارباز. Codex باید پس از بررسی زیرساخت موجود، نام‌گذاری و نگاشت را قطعی کند.

پنل گزارش‌گیری و حساب فنی API جدا هستند؛ برای اتصال API از مشخصات ورود پرتال گزارش‌گیری استفاده نکنید. در صفحه سفارش وب‌سایت فیلترهای شماره موبایل، شناسه تراکنش، Payment Token و بازه ثبت سفارش مشاهده شد. این فیلترها سند ساختار API یا نشانه موفقیت مالی نیستند.

### مدیریت کلید و رمز

پنل تصریح می‌کند کلید و رمز قبلی دوباره نمایش داده نمی‌شود و تولید مقدار جدید، مقدار قبلی را غیرفعال می‌کند. راهنمای رسمی [دریافت اطلاعات فنی](https://academy.snapppay.ir/2026/06/06/snapppay-gateway-tech-guide/) نیز درباره قطع ارتباط درگاه در صورت جایگزین نکردن مقادیر جدید هشدار می‌دهد.

- مالک در 2026-11-28 تأیید کرد این نخستین اتصال درگاه اسنپ‌پی برای آکاشوز است؛ مهاجرت CMS یا اتصال قبلی فرض نشود. پیش از تولید کلید یا رمز همچنان مجوز مالک و بررسی مصرف‌کننده‌های احتمالی لازم است.
- مشخصات قبلی از کانال امن دریافت اولیه یا secret store مجاز بازیابی شوند؛ در صورت عدم دسترسی، برنامه چرخش با تأیید مالک تنظیم شود.
- تولید کلید یا رمز جدید فقط با مجوز صریح مالک و آمادگی جایگزینی در تمام مصرف‌کننده‌های مجاز انجام شود.
- فایل `.env.snapppay.local` خصوصی است؛ مقادیر موجود Client ID و Username از پنل در نسخه خصوصی قرار دارند؛ Client Secret و Password عمداً خالی‌اند. فایل `.env.snapppay.example` فاقد مقادیر واقعی پذیرنده است.
- رمز ورود پرتال، OTP، Cookie، توکن موقت، اطلاعات حساب بانکی و مشخصات مشتری نباید وارد مخزن یا لاگ شوند.

## 2. فهرست منابع رسمی

### لینک‌های مشاهده‌شده در پرتال (2026-11-28)

| منبع | URL | کاربرد / وضعیت |
|---|---|---|
| صفحه دسترسی فنی | https://portal.snapppay.ir/credentials | مشاهده مستقیم؛ فیلدهای بالا |
| آکادمی | https://academy.snapppay.ir/ | مطالعه راهنماهای عمومی |
| فرم اعلام فعال‌سازی | https://survey.porsline.ir/s/Qb9dY5IH | متن آغاز فرم مشاهده شد؛ فرم تکمیل یا ارسال نشد |
| ویدئوی تکمیل فرم | https://aparat.com/v/iulg0v2 | لینک رسمی از فرم؛ ویدئو بررسی نشده |
| پلاگین پرداخت WooCommerce 1.4.2 | https://academy.snapppay.ir/wp-content/uploads/2026/03/snapppay-woocommerce-gateway-v1.4.2.zip | لینک رسمی؛ ZIP ارسالی مالک دریافت و بررسی ایستا شد؛ بخش 4 |
| افزونه SearchWise | https://academy.snapppay.ir/wp-content/uploads/2026/03/searchwise-woocommerce-plugin-1.0.2_2.zip | ZIP ارسالی مالک بررسی ایستا شد؛ بخش 10 |
| راهنمای نمایش کالا در سرچ (غیر WooCommerce) | https://academy.snapppay.ir/wp-content/uploads/2026/04/%D8%AF%D8%B3%D8%AA%D9%88%D8%B1%D8%A7%D9%84%D8%B9%D9%85%D9%84-%D8%A8%D8%B1%D8%A7%DB%8C-%D8%AC%D9%85%D8%B9_%D8%A2%D9%88%D8%B1%DB%8C-%D8%AF%D8%A7%D8%AF%D9%87_%D9%87%D8%A7%DB%8C-%D9%81%D8%B1%D9%88%D8%B4%DA%AF%D8%A7%D9%87_%D9%87%D8%A7-updated.pdf | PDF پنج‌صفحه‌ای ارسالی مالک بررسی شد؛ بخش 10 |
| فرم تغییر IP | https://academy.snapppay.ir/wp-content/uploads/2026/04/Change-IP.docx | فرم ارسالی مالک بررسی شد؛ بخش 9 |

### راهنماهای رسمی عمومی تکمیلی (خوانده‌شده)

- [راهنمای پذیرندگان با توسعه اختصاصی / Self](https://academy.snapppay.ir/2026/03/18/%D8%B1%D8%A7%D9%87%D8%A7%D9%86%D8%AF%D8%A7%D8%B2%DB%8C-%D9%BE%D8%B0%DB%8C%D8%B1%D9%86%D8%AF%D9%87-%D8%A8%D8%A7-%D8%B2%D8%A8%D8%A7%D9%86-%D8%A8%D8%B1%D9%86%D8%A7%D9%85%D9%87%D9%86/) — همچنین در فهرست رسمی [فعال‌سازی فنی](https://academy.snapppay.ir/category/%D8%A2%D9%85%D9%88%D8%B2%D8%B4-%D9%BE%D8%B0%DB%8C%D8%B1%D9%86%D8%AF%DA%AF%D8%A7%D9%86/%D8%A2%D9%85%D9%88%D8%B2%D8%B4-%D9%81%D9%86%DB%8C/) قابل مشاهده است؛ عنوان: «راه‌اندازی پذیرنده با زبان برنامه‌نویسی اختصاصی». تیم فعال‌سازی Stage، مستند API، سناریوها و فرایند دمو را ارائه می‌کند.
- [راه‌اندازی و دسترسی به سرویس](https://academy.snapppay.ir/2026/04/21/activation/) — آدرس‌های API/پرتال، مسیر اختصاصی، فرایند فعال‌سازی و حداکثر سه IP فعال در راهنمای عمومی.
- [دریافت اطلاعات فنی از پرتال](https://academy.snapppay.ir/2026/06/06/snapppay-gateway-tech-guide/) — پنج فیلد و مدیریت کلید/رمز.
- [فهرست فرم‌های درخواست](https://academy.snapppay.ir/2026/03/15/snapppay-forms-list/) — اطلاعات فنی اولیه، فعال‌سازی، تغییر CMS، Callback و IP.
- [تست درگاه پیش از انتشار](https://academy.snapppay.ir/2026/06/03/gateway-test-before-launch/) — راهنمای عمومی آزمون پرداخت، انصراف، خطا، callback و بازگشت وجه؛ مثال‌های این مقاله قرارداد دقیق API نیستند. تست مالی واقعی نیازمند مجوز جداگانه است.
- [تغییر IP پذیرنده](https://academy.snapppay.ir/2026/04/07/%D9%86%D8%AD%D9%88%D9%87-%D8%AF%D8%B1%DB%8C%D8%A7%D9%81%D8%AA-%D9%88-%D8%A7%D8%B9%D9%84%D8%A7%D9%85-ip-%D9%BE%D8%B0%DB%8C%D8%B1%D9%86%D8%AF%D9%87-%D8%A8%D9%87-%D8%A7%D8%B3%D9%86%D9%BE%D9%BE/) — IP عمومی ثابت و ثبت تیکت.
- [تغییر Callback](https://academy.snapppay.ir/2026/03/18/%D8%AA%D8%BA%DB%8C%DB%8C%D8%B1-%DA%A9%D8%A7%D9%84%D8%A8%DA%A9-%DA%86%DB%8C%D8%B3%D8%AA-%D9%88-%DA%86%DA%AF%D9%88%D9%86%D9%87-%D8%A8%D8%A7%DB%8C%D8%AF-%D8%A2%D9%86-%D8%B1%D8%A7-%D8%A7%D8%B7/) — ثبت قبلی URL و اعلام رسمی تغییر.

پشتیبانی: `02196862222` (پنل/فرم و آکادمی)؛ ایمیل درج‌شده در صفحه اصلی آکادمی: `merchant-support@snapppay.ir`. برای دریافت قرارداد API از مسیر تیکت پرتال استفاده شود. این سند بازنویسی تحلیلی منابع است، نه کپی کامل مستند رسمی.

## 3. الزامات رسمی قابل تأیید برای سایت اختصاصی

Bazarbaaz یک فروشگاه‌ساز اختصاصی است؛ پلاگین WooCommerce قابل نصب مستقیم روی Next.js نیست. طبق راهنمای پذیرندگان Self، دریافت مستند API و دسترسی Stage از تیم فنی، شماره تست دارای اعتبار در Stage، IP مجاز، سناریوهای مورد توافق، بررسی نتایج و دمو برای پذیرش ضروری‌اند. اعطای Production و تأیید نهایی مسیر جدید آکاشوز باید جداگانه احراز شود؛ نمایش اطلاعات Production در پنل به‌تنهایی این تأیید را ثابت نمی‌کند.

### IP و Callback

- طبق راهنمای عمومی اسنپ‌پی، IP خروجی سرور فراخواننده API باید عمومی و ثابت و در فهرست مجاز باشد؛ راهنمای فعال‌سازی حداکثر سه IP فعال ذکر می‌کند. سقف و ثبت واقعی حساب آکا هنوز بررسی نشده است.
- در Runflare باید **egress IP** واقعی سرویس یا راهکار خروجی ثابت بررسی شود؛ IP دامنه، CDN یا مرورگر کاربر الزاماً IP خروجی نیست. هیچ IP فرضی ثبت نشود.
- IPهای موجود، نیاز به افزودن/حذف و Callback ثبت‌شده قبلی از اسنپ‌پی استعلام شوند. راهنمای عمومی مسیر تیکت را بیان می‌کند؛ فرم رسمی دریافتی ارسال از ایمیل ثبت‌شده به merchant@snapppay.ir را تصریح می‌کند. کانال مورد قبول برای همین پذیرنده با پشتیبانی تطبیق داده شود (بخش 9).
- آدرس Callback نهایی پس از بررسی مسیر واقعی Retail، دامنه canonical و قرارداد API مشخص می‌شود. تغییر آن از فرم رسمی یا تیکت، همراه مدارک موردنیاز ارائه‌دهنده، قابل درخواست است. هیچ URL حدسی به اسنپ‌پی اعلام نشود.

### فعال‌سازی نهایی

متن آغاز فرم رسمی فعال‌سازی، آزمایش مسیر خرید روی دسکتاپ و موبایل تا ورود به درگاه اعتباری، تهیه تصاویر مطابق راهنما و ارسال فرم را درخواست می‌کند. ارسال و تأیید فرم برای نمایش فروشگاه در اپلیکیشن اسنپ‌پی لازم است. فیلدهای مراحل بعد فرم هنوز بررسی نشده‌اند. هیچ آزمون واقعی، ارسال فرم یا فعال‌سازی بدون مجوز مالک انجام نشود.

## 4. قرارداد مشاهده‌شده در پلاگین رسمی — شواهد پیاده‌سازی v1.4.2

**درجه اعتبار:** SOURCE_OBSERVED؛ نه قرارداد رسمی Self و نه نتیجه درخواست زنده. منبع: فایل `snapppay-woocommerce-gateway-v1.4.2.zip` ارسالی مالک، مطابق نام و نسخه لینک پنل. SHA-256 فایل دریافت‌شده: `1e51615ecfa9fd3d7ff8733239a800c4077abaea536c479dbf6780c470b23e71`. هدر `index.php` نسخه 1.4.2 و Author: Snapp! Pay را نشان می‌دهد. اصالت باینری با امضای مستقل ارائه‌دهنده تأیید نشده است. تمام پنج فایل PHP به‌صورت static read-only بررسی شدند؛ نصب یا اجرا و هیچ فراخوانی API انجام نشد.

### 4.1 فهرست سورس

| فایل | مسئولیت |
|---|---|
| `index.php` | هدر نسخه، ثبت سازگاری HPOS، include فایل‌ها و حذف اعلان بروزرسانی افزونه |
| `class-snapppay-api.php` | auth، ساخت cart، 8 endpoint، HTTP wrapper |
| `class-wc-gateway-snapppay.php` | تنظیمات پذیرنده، شروع پرداخت، callback، verify و settle |
| `functions.php` | وضعیت‌ها، لغو، مبالغ ریالی، موبایل، IP و telemetry |
| `hooks.php` | eligibility، تغییر وضعیت/ویرایش سفارش، checkout fields، TLS، widget قیمت و activation hooks |

### 4.2 جدول Endpointها

Base URL تأییدشده پنل: `https://api.snapppay.ir`. مسیرهای زیر از سورس API استخراج شده‌اند؛ method و casing را دقیق نگه دارید. هیچ تماس شبکه‌ای با آنها انجام نشده.

| Operation | Verb | Path | Auth | Payload |
|---|---|---|---|---|
| OAuth | POST | `/api/online/v1/oauth/token` | Basic | form-urlencoded: grant_type, scope, username, password |
| Eligibility | GET | `/api/online/offer/v1/eligible` | Bearer | query: amount |
| Payment token | POST | `/api/online/payment/v1/token` | Bearer | JSON: amount, paymentMethodTypeDto, returnURL, transactionId, mobile (conditional), cartList, discountAmount |
| Verify | POST | `/api/online/payment/v1/verify` | Bearer | JSON: paymentToken |
| Settle | POST | `/api/online/payment/v1/settle` | Bearer | JSON: paymentToken |
| Cancel | POST | `/api/online/payment/v1/cancel` | Bearer | JSON: paymentToken |
| Status | GET | `/api/online/payment/v1/status` | Bearer | query: paymentToken |
| Update | POST | `/api/online/payment/v1/update` | Bearer | JSON: amount, paymentMethodTypeDto, paymentToken, cartList, discountAmount |

Source anchors: `class-snapppay-api.php` methods `get_request_bearer_token`, `is_merchant_eligible`, `get_payment_token`, `build_cart_list`, `verify`, `settle`, `cancel`, `status`, `update`, `request` (approx lines 35–334).

### 4.3 OAuth and HTTP contract observed

- `Authorization: Basic base64(client_id + ':' + client_secret)`; `Content-Type: application/x-www-form-urlencoded`.
- Body: `grant_type=password&scope=online-merchant&username=<API_USERNAME>&password=<API_PASSWORD>`; encode fields properly. No real values in this document.
- Response fields consumed directly: `access_token`, `expires_in`. No refresh_token contract observed. Plugin stores token in WordPress transient with supplied TTL; clears cache on credentials change and HTTP 401, then retries once.
- Resource requests: `Authorization: Bearer <access_token>`; `Content-Type: application/json`; GET uses query parameters; POST JSON. Plugin adds `User-Agent: SnappPay, <client_id>`. Confirm UA requirement with provider.
- Plugin strips literal `amp;` from two secret fields. Do not port that transformation: preserve actual provider-issued credential bytes, unless provider explicitly documents encoding requirements.
- Do not implement a generic automatic replay of financial operations on 401/timeouts without confirmed semantics; distinguish auth renewal from payment retry. Cache by tenant + merchant + environment + credential version; early expiry, single-flight refresh and safe invalidation. Never output secrets or raw token/query values in logs.

### 4.4 Eligibility

GET query `amount` (integer IRR). `hooks.php:133–197` checks enabled gateway, calculates amount from cart/order, then reads `response.eligible`, `response.title_message`, `response.description`. If ineligible/error, gateway removed. No customer identity input in this request observed. This is merchant/cart eligibility, not guaranteed approval of customer's credit. Treat returned UI text as untrusted plain text; do not render provider HTML. Fail closed for SnappPay only; other methods remain available. Recheck at payment initiation as appropriate under official rules.

### 4.5 Create token — synthetic example

This is a source-derived illustrative request, not a captured provider response or an executable production request. Placeholder returnURL must be replaced by the approved canonical callback. Monetary example is consistent without tax/shipping/discount. Actual field types, limits and formulas pending official confirmation.

```json
{
  "amount": 20000000,
  "paymentMethodTypeDto": "INSTALLMENT",
  "returnURL": "https://merchant.example/approved-callback",
  "transactionId": "synthetic-attempt-001",
  "cartList": [{
    "cartId": 101,
    "totalAmount": 20000000,
    "cartItems": [{"name": "Synthetic shoe", "count": 2, "amount": 10000000, "id": 201, "category": "Synthetic category"}],
    "taxAmount": 0,
    "shippingAmount": 0,
    "isShipmentIncluded": false,
    "isTaxIncluded": false
  }],
  "discountAmount": 0
}
```

`mobile` included conditionally when plugin normalizer returns a value; format commonly `+989...`. Bazarbaaz retains required valid guest phone and uses existing verified normalization (Persian/Arabic/Latin digits); never treats supplied number as verified ownership. Provider-required phone/postal fields pending confirmation. `commissionType` optional per cart item when plugin commission option enabled; no official values found. Cart contains one entry in observed WooCommerce flow, but limits/cardinality are unknown. Plugin item amount uses current product price rather than immutable order line snapshot: DO NOT copy; use frozen reviewed checkout and exact server-side accounting. Cart total and top-level amount use order total. Need provider confirmation of tax/discount/shipping inclusion formulas, commission codes and ID types. Plugin's integer cast may truncate fractions; use exact integer IRR, reject ambiguity rather than silently round. `functions.php:282–325` converts TOMAN/IRT ×10, IRHT ×10000, IRHR ×1000; other codes pass through. Bazarbaaz must explicitly check allowed currencies and avoid double conversion.

Create response consumed by plugin: `successful` boolean; on success `response.paymentToken`, `response.paymentPageUrl`; on error `errorData.message`. Store attempt before redirect with immutable tenant/merchant/order/amount/currency context. Use opaque merchant-generated durable ID under confirmed length/charset limits (plugin's `time()-order_id` not reliable durable idempotency). Validate provider redirect HTTPS and approved host(s) against provider-confirmed allowlist; do not accept arbitrary URLs. Protect token at rest; no exposure to client/logs. Response schema is partial: no invented additional fields.

### 4.6 Callback, verification, settlement and reconciliation

`class-wc-gateway-snapppay.php:294–425` creates transaction ID, stores returned paymentToken, redirects to paymentPageUrl. Plugin returnURL uses WooCommerce callback with `wc_order` query; callback reads `$_POST['state']`, compares with `OK`, obtains order via query/session, then uses stored token. It calls Verify then Settle. Only successful settle calls `payment_complete()` and records `SETTLE`; on settle failure records `VERIFY` but still emits success message (do not reproduce). No signature, complete callback field list, encoding, HTTP response/ack or return redirect rules can be established from this source. Do not assume other callback fields are required or absent. Bazarbaaz must bind callback to opaque scoped attempt, verify trusted stored token and provider result, handle cross-site POST without requiring browser session cookie, never allow callback to reveal private order details or mark paid alone; customer status UI remains ownership-gated. Confirm authoritative callback contract, allowed methods and replay rules before live.

`functions.php:5–109` reads `response.status` from Status and branches on `REVERT`, `VERIFY`, `SETTLE`, `PENDING` (not a complete provider enum). Pending cancel path queries status: REVERT -> failed; VERIFY -> settle; SETTLE -> processing; PENDING -> verify then settle. Other cancellation path calls Cancel. `hooks.php:43–131,241–265` invokes Update when order changed under specified WooCommerce conditions; cancelled/refunded hooks call cancellation helper. Update body excludes transactionId, returnURL and mobile in observed code, includes paymentToken + same cart/discount/amount fields. No standalone Revert or Refund endpoint, partial refund semantics, reconciliation window or allowed transitions documented by plugin. Do not implement guessed routes or silently equate Cancel to refund. Manual financial operations remain disabled until contract validated.

**Proposed Bazarbaaz internal model** (not provider enum): CREATED -> REDIRECT_READY -> AWAITING_PROVIDER -> VERIFIED_UNSETTLED -> SETTLED; side paths UNKNOWN/RECONCILIATION_REQUIRED, terminal failed/cancelled only with authoritative evidence. Enforce compare-and-set transitions, unique attempt identifiers, durable operation records, one final order payment and inventory transitions. Financial settlement success is not the same as merchant payout/reconciliation. Network timeout or malformed response may mean operation committed; use Status and provider-agreed recovery, do not immediately create a second attempt or release inventory. Cross-tenant mismatch deny and audit. Provider status reconciliation must not require user account membership. Keep guest cart/order access scoped to existing guest owner.

### 4.7 Response/error handling and limits

`class-snapppay-api.php:259–318` returns decoded JSON even on non-2xx (except special 401 retry); non-JSON creates WP_Error. Business response checks in gateway/functions read `successful`, `response`, `errorData.message`; OAuth consumes top-level access_token/expires_in. Implement explicit HTTP status checks, bounded JSON size, per-operation runtime schemas, semantic error mapping and safe unknown states. Actual error codes, status meanings, retry/backoff and rate limits, idempotency support, token lifetime units/limits, redirect hosts and payload schema are pending. Plugin sets curl connection and request timeout to 30s in `hooks.php:312–319`; this is observed client behavior, not SLA. Prefer bounded configurable timeouts and no unsafe mutation retry. Do not expose upstream raw messages containing secrets.

### 4.8 Security findings — do NOT port plugin implementation

| Finding / source | Risk and required mitigation |
|---|---|
| `hooks.php:312–319` globally disables CURLOPT_SSL_VERIFYHOST and CURLOPT_SSL_VERIFYPEER on WordPress HTTP cURL; `functions.php:367–385` similarly disables TLS checks for IP lookup | High severity source finding. Require validated HTTPS everywhere; never disable certificate validation; no global network hooks. |
| `functions.php:388–470`, `hooks.php:4–30`: activation/deactivation telemetry sends site name, site URL, UA, WordPress/PHP versions, locale, timezone, action to external Google Apps Script and logs payload/response; hardcoded plugin_version 1.0.2 | Do not copy telemetry, endpoint or log content. No telemetry without explicit consent and privacy review. No evidence of actual transmission here because plugin never executed. |
| `class-wc-gateway-snapppay.php:337–345`: raw payment token and transaction ID written in customer-visible order note | Never expose provider token to customer notes/logs. |
| `class-wc-gateway-snapppay.php:398–418`: success notice even when settle fails | Present pending/reconciliation, no paid status before authoritative completion. |
| `class-snapppay-api.php` shared bearer transient | Partition by tenant/merchant/environment/credential version. |
| `functions.php:215–270`: permissive prefix normalization and reversed Arabic digits array paired with ascending replacement array | Reuse validated Bazarbaaz phone normalization; add Persian and Arabic digit tests. |
| `class-snapppay-api.php:190–195`: current product price used instead of checkout snapshot | Immutable order/quote-based calculation; test price change after order. |
| `class-wc-gateway-snapppay.php:323–325`: time + order ID attempt identifier; callback trusts order query/session to find token; no signature verification observed | Durable scoped IDs and concurrency/replay controls; obtain authoritative callback/security rules. |
| `class-snapppay-api.php:259–318`: partial HTTP/schema handling and replay on 401 | Validate transport and response separately; reconcile ambiguous operations; no blind retries. |
| `index.php` suppresses update notification | Do not copy; track provider contract/version and security updates. |

Optional product-page widget (`hooks.php:360–430`) displays four installments, calculates one quarter of price, uses local min/max and hardcoded promotional claims; these are plugin UI behavior, not confirmed merchant eligibility, credit terms or limits. Do not advertise until official rules and brand permission confirmed.

### 4.9 Remaining official-contract blockers

- Self API document, version/date, Stage URL/credentials/test user/scenarios, registered callback and egress IP/whitelist; production onboarding/approval.
- Exact full request/response schemas, field limits/types, IDs and monetary reconciliation formula; commission categories; allowed payment types and actual eligibility restrictions.
- Callback method/content type/signature/required fields/ack/retry; provider redirect allowlist; authentication expiry and errors; formal status machine, settlement windows, idempotency semantics and retry/timeout rules.
- Cancel/update/revert/refund/partial refund availability and allowed state transitions; payout and financial reconciliation contract; merchant-specific fee/terms. Do not build unverified financial operations.
- Obtain official approval for provider-specific UI/branding, and confirm whether CMS change request needed. Credentials still incomplete (previous secrets cannot be retrieved from portal). Do not rotate until owner authorizes.


## 5. پیشنهاد معماری بازارباز (نه الزام مستند SnappPay)

- Provider مستقل در Retail Payment Core با binding ثابت به tenant/merchant، order و payment attempt. Aka اولین پذیرنده؛ فعال‌سازی به‌صورت tenant-specific و default-off. عدم fallback اعتبارنامه بین مستأجرها.
- بررسی زیرساخت فعلی credentials/integration، استفاده از secret reference یا مکانیزم امن موجود. متغیرهای فایل نمونه صرفاً bootstrap اختصاصی پایلوت‌اند؛ تنظیمات مشترک به معنی استفاده همه مستأجرها از حساب آکا نیست.
- محاسبه مبلغ و اقلام از سفارش و quote سمت سرور؛ واحد پول مطابق قرارداد رسمی و بدون تبدیل تقریبی. Callback غیرقابل اعتماد؛ نهایی شدن مالی فقط پس از نتیجه قطعی server-to-server طبق قرارداد.
- Idempotency پایدار، قفل/تراکنش مناسب، کنترل تکرار callback، تغییرات وضعیت monotonic در محدوده ماشین وضعیت واقعی، تطبیق tenant/merchant/order/amount/currency. Timeout یا نتیجه مبهم نیازمند reconciliation؛ تلاش مجدد غیرایمن ممنوع.
- دسترسی API فقط سمت سرور، HTTPS، محدودیت میزبان خروجی و redirect/return URL، عدم ثبت password/secret/token/اطلاعات حساس در URL، لاگ، فایل عمومی و Client Bundle. نمایش و ثبت اطلاعات پرداخت در حد ضرورت.
- مهمان و عضو هر دو قابل استفاده باشند، بدون اجبار عضویت بازارباز. حفظ مالکیت سفارش، شرایط واقعی احراز هویت خریدار در درگاه، خروج و بازگشت از PWA، نمایش وضعیت واقعی فارسی و RTL.
- حفظ CASH، BANK_TRANSFER و iNoti؛ انتقال به کارت طبق اعلام مالک فعال شده است، پذیرش مستقل کامل آن هنوز در این سند انجام نشده. `RETAIL_GUEST_CHECKOUT_ENABLED=1` تغییر نکند.
- هیچ real payment / verify / settle / refund / SMS یا تغییر Production، Merge به main یا فعال‌سازی ارائه‌دهنده بدون مجوز جداگانه. Agent 2 در workspace و شاخه مستقل با PostgreSQL آزمایشی اختصاصی کار کند؛ تعارض مهاجرت با Agent 1 قبل از ادغام بررسی شود.

## 6. برنامه تحویل به Codex و گیت‌ها

1. **Discovery:** ثبت همین سند و الگوی بدون مقادیر در مخزن پس از ممیزی نام متغیرها؛ فایل خصوصی خارج از Git. بررسی معماری فعلی، عدم بازنویسی انتقال به کارت. اخذ مستند رسمی API اختصاصی، نسخه/تاریخ، Stage و سناریوها.
2. **Contract review:** استخراج verb/path/auth/request/response/error/state/units برای تمام عملیات تأییدشده؛ نمونه‌های بی‌خطر و ساختگی، ثبت موارد نامعلوم. مقایسه با یافته‌های بررسی ایستای پلاگین رسمی در بخش 4. ثبت تصمیم‌های معماری و گیت‌های مالی.
3. **Implementation:** adapter با readiness/feature gate و secret binding مستقل؛ تست‌های deterministic فقط بر پایه قرارداد معلوم؛ پیاده‌سازی آزمایشی محدود به شواهد بخش 4؛ مسیرها و رفتارهای تأییدنشده ساخته نشوند؛ فعال‌سازی واقعی پس از قرارداد Self و Stage.
4. **Acceptance:** synthetic browser/HTTP + isolated PostgreSQL، guest و signed-in، amount mismatch، replay، duplicate callback، cross-tenant، timeout و reconciliation، regression سایر پرداخت‌ها. Stage با داده و دسترسی تأییدشده فقط طبق مجوز. CI روی exact head.
5. **Release:** تأیید callback/egress IP، secret provisioning امن، آمادگی Production/rollback، گیت انتشار مشترک با Agent 1، تأیید مالک. تست لایو و فرم فعال‌سازی طبق دستور ارائه‌دهنده با مجوز جداگانه.

## 7. متن پیشنهادی تیکت برای اسنپ‌پی (ارسال نشده)

موضوع: دریافت مستندات API و دسترسی Stage برای اتصال اختصاصی فروشگاه کفش آکا

سلام. قصد اتصال درگاه پرداخت اعتباری فروشگاه کفش آکا با دامنه akashoes.ir به زیرساخت اختصاصی Node.js/Next.js را داریم. لطفاً آخرین مستند فنی کامل API پذیرندگان Self، نسخه و تاریخ آن، فایل OpenAPI/Postman در صورت وجود، محیط Stage و روند امن دریافت اعتبارنامه آزمایشی، شماره تست، سناریوهای پذیرش و هماهنگی دمو را ارائه فرمایید. همچنین وضعیت فعلی پذیرندگی وب‌سایت، Callback و IPهای ثبت‌شده، روند ثبت تغییرات، قرارداد مبلغ/واحد پول، عملیات پرداخت و تعیین وضعیت و قوانین لغو/بازگشت/تسویه را مشخص کنید. لطفاً تأیید کنید آیا برای انتقال به زیرساخت جدید، تغییر CMS یا پذیرش مجدد لازم است. مقادیر محرمانه از کانال امن رسمی تحویل شوند و در متن تیکت عمومی درج نشوند. با تشکر.

## 8. وضعیت پرداخت در این نسخه

- صفحه credentials و فرم اولیه فعال‌سازی: مشاهده‌شده.
- Base URL و وجود شناسه/نام کاربری API: تأییدشده.
- Secret و Password: در دسترس نبوده‌اند، عمداً خالی.
- مستند رسمی کامل API: دریافت نشده؛ مانع اتصال واقعی.
- Source ZIP: فایل ارسالی مالک بررسی ایستا شد؛ هشت Endpoint و ساختارهای مشاهده‌شده در بخش 4؛ قرارداد رسمی Self همچنان دریافت نشده.
- Stage و قرارداد تجاری، Callback و whitelist واقعی: تأیید نشده.
- هیچ تغییر در حساب یا Production انجام نشده؛ فایل‌ها هنوز در Git ثبت نشده‌اند.

## 9. فرم رسمی تغییر IP — Production payment ingress allowlist

**Source:** `Change-IP.docx`, متن و جدول اصلی Word بررسی‌شده در 2026-11-28. فرم خالی است؛ هیچ IP فعلی پذیرنده در آن ثبت نشده است. این فرم اطلاعات محرمانه ندارد.

- فرم می‌گوید دسترسی خرید در محیط اصلی به IP معرفی‌شده محدود است و درخواست از سایر IPها مسدود می‌شود.
- در صورت مغایرت یا تغییر، اطلاعات فرم باید از ایمیل اصلی ثبت‌شده پذیرنده به `merchant@snapppay.ir` ارسال شود.
- اطلاعات پذیرنده: نام فروشگاه، آدرس سایت، نام و نام خانوادگی درخواست‌کننده. جدول شامل سه جایگاه IP فعال و سه جایگاه حذف IP است. فرم به‌تنهایی سیاست سقف کلی IP یا نحوه اعمال فوری تغییر را اثبات نمی‌کند.
- فرم آماده برای تکمیل توسط مالک است؛ هیچ IP حدسی، نام درخواست‌کننده تأییدنشده یا درخواست ارسال نشده است.

### Bazarbaaz implementation gate (recommendation)

1. Read-only: تأیید IPهای فعلی ثبت‌شده، وجود مصرف‌کننده قبلی اعتبارنامه و نیاز به افزودن/حذف IP. هیچ حذف خودکار IP قدیمی انجام نشود.
2. از Runflare درباره IP عمومی ثابت خروجی (egress/SNAT) سرویس 87432، ثبات پس از restart/rollout/scale، IPv4/IPv6 و امکان تخصیص IP ثابت سؤال شود. IP DNS دامنه، IP ورودی Load Balancer، IP داخلی pod و IP لپ‌تاپ جایگزین IP خروجی نیستند. IP مشاهده‌شده یک‌باره، ثبات را اثبات نمی‌کند. تشخیص runtime با مجوز read-only و مقصد مورد اعتماد انجام شود؛ هیچ secret ارسال نشود.
3. در صورت تأیید ثبات و مجوز مالک، فرم با IP واقعی تکمیل و از ایمیل ثبت‌شده ارسال شود. ابتدا افزودن IP جدید و پذیرش، سپس حذف IP قدیمی فقط در صورت اطمینان از نبود مصرف‌کننده. وضعیت Stage جداگانه از ارائه‌دهنده سؤال شود.
4. ثبت تأیید کتبی ارائه‌دهنده و آزمون Stage قبل از Production. عدم دسترسی IP یا قرارداد رسمی، مانع لایو است؛ کارهای mock/local ادامه یابد.

**Do not confuse with Searchwise inbound crawler IPs (section 10).** این دو allowlist از نظر جهت شبکه، دامنه مجوز و سرویس کاملاً متفاوت‌اند.

## 10. Searchwise — catalog discovery (separate from payment)

Sources: official five-page PDF `دستورالعمل-برای-جمع_آوری-داده_های-فروشگاه_ها-updated.pdf`; official portal-linked ZIP `searchwise-woocommerce-plugin-1.0.2_2.zip`. PDF guidance applies to custom stores; plugin behavior is evidence for WooCommerce interoperability only. No plugin installed or executed; no external API called.

### 10.1 Official PDF requirements (pages 1–5)

Three ingestion modes:

| Mode | Official guidance | Bazarbaaz decision proposal |
|---|---|---|
| Direct crawl | Daily crawler; daily updated sitemap with all product links; name/category/price/stock/images/description/features visible without JS or via meta tags. Notify changes to URLs, names, attributes, images or layout; changes to names/features/images are not automatically applied. | Reuse SEO/sitemap infrastructure; avoid crawler-first for high-frequency variant inventory. |
| File feed | JSON/XML/CSV/TSV; stable submitted URL; update at least daily; ZIP/GZIP optional. | Fast first pilot if accepted; JSON from existing catalog projection, no duplication of inventory. |
| API feed | Real-time or near-real-time data for frequent price/stock changes; pagination via `page` and `size`; auth in headers; ID/slug lookup recommended for faster updates of popular products. | Preferred for ongoing Aka variant/stock freshness. Agree exact interface with Searchwise. |

All modes: complete unique informative titles (type, model, brand and key details); ensure crawler access. PDF p1 lists these **incoming Searchwise crawler IPs**: `185.206.93.115`, `185.206.94.25`, `37.152.176.176`, `188.121.106.231`. Confirm freshness with provider before modifying WAF. Do not allow unrestricted admin/payment endpoints or bypass application authentication. Do not submit these as merchant payment egress IPs.

### 10.2 Official product fields (PDF pp3–5)

| Field | Meaning |
|---|---|
| `id` | Unique product ID or SKU, stable |
| `title` | Accurate complete product name |
| `subtitle` | English title or subtitle |
| `link` | Product URL |
| `image_link` | Array of full-sized images, primary image first, no small thumbnails |
| `availability` | `in stock` / `out of stock` in PDF; exact wire enum confirm |
| `regular_price` | Pre-discount price in IRR for discounted product |
| `sale_price` | Actual selling price in IRR |
| `category` | Detailed taxonomy ending in actual product type |
| `description` | Key-value object of product specifications; structured attributes preferred |
| `brand` | Product brand |
| `GTIN` | Global trade item identifier if available; never fabricate |
| `color`, `size` | Optional |
| `shipping_cost`, `delivery_time` | Optional; delivery time in days |

PDF does not define exact JSON envelope, category wire type, variant-level identifiers, sold-out/archived deletion rules, API verb/path, key issuance or pagination bounds. Do not infer these as official requirements. Service products can use adapted fields per PDF; pilot limited to Retail.

### 10.3 Searchwise plugin source — observed v1.0.2

Archive contains `Readme.md`, `Readme.txt`, `searchwise-api-data-feed.php` (GPLv2 or later). Reviewed all three text files statically. Independent implementation should not copy PHP/GPL source into Bazarbaaz without license review.

- `POST /wp-json/v1/product/feed`, `x-api-key` header (source reads `x_api_key` through WP normalization). WordPress permission callback sends a POST to `https://merchants.searchwise.ir/api/v1/feed/validate-token`, form body `merchant_domain`, `api_key`, `plugin_version`; domain comes from site URL, timeout 5s. `success === true` grants access; transport error returns 503, invalid response/key returns 401. The code does not check upstream HTTP status explicitly. This is plugin-specific validation, not a mandate for custom-store API; confirm provider key handling and cache/availability policies first.
- Request: `limit` (actual default 100), `page` (1), comma-separated `products` IDs, comma-separated `slugs`, `include_content` sanitized boolean. IDs take precedence over slugs, else paginated list. Readme says default 10; Readme.txt mentions `variation`, but source does not consume it. PDF proposes `size`, plugin uses `limit`; provider contract must decide.
- List query uses `publish` and product post type, order ID descending, returns `count`, `max_pages`, `products`; ID/slug lookups return `products` only. All include `plugin_version`, `wc_version`, `wp_version` metadata, which must not be spoofed by Bazarbaaz. No explicit maximum page size or filter-list bound in plugin. Visibility filtering by publish alone is not sufficient for Bazarbaaz.
- Response item: `id`, `slug`, `title`, optional `content`, `regular_price`, `sale_price`, `availability`, category name array, `image_link`, `link`, `short_description`, structured `description`, `shipping_cost`, `delivery_time`, `brand`. Readme example uses `cost_shipping`/`time_delivery`; actual PHP and PDF use `shipping_cost`/`delivery_time`. `subtitle`, `GTIN`, separate `color`/`size` absent in actual source. Availability is raw WooCommerce stock status, e.g. `instock`, not normalized PDF wording.
- Variable products: takes first in-stock available variation and assigns its prices. Fallback computes local min price variables but fails to assign them to response object. Non-variable price fields use `floatval`; no explicit IRR conversion; missing sale price may become zero. Variation attributes are excluded from `description`; no per-variant rows. These are limitations, not desirable behavior for shoe sizes/colors. Use canonical sellable variant data and exact monetary conversion; agree parent vs variant schema with Searchwise.
- Activation hook sends site domain, admin email and plugin version to a Google Apps Script webhook (blocking, 10s). Do not replicate this telemetry; no external calls occurred during this review.

### 10.4 Proposed Bazarbaaz integration (not official contract)

Mission `BB-RETAIL-SEARCHWISE-CATALOG-01`, independent after/alongside payment work only if no shared file conflicts. Default OFF per tenant; Aka pilot. Reuse existing public tenant catalog, media, canonical host resolution, variant availability/pricing and SEO rather than duplicate product storage. No need to emulate WordPress routes unless provider explicitly requires them.

Candidate API path `/api/public/v1/organizations/[organizationIdentifier]/feeds/searchwise` (proposal only); evaluate actual existing catalog route/contracts first. Host + organization binding, active tenant and SHOP entitlement, published and publicly visible products only; stable IDs and canonical product links, primary full image first. Use read-only API or versioned JSON file with deterministic pagination and provider-approved `size`/`limit`, key lookup and envelope. Bound all request sizes, authorize key per merchant/server-side, prevent cross-tenant access, no internal IDs unless intentionally public/stable, no costs, customer data, supplier/private inventory or secrets. Tenant-scoped cache, freshness and validators; no stale cross-tenant responses. Return correct selling price IRR without floats or guessed discounts. Parent/variant policy confirmed; do not show unavailable variants as purchasable or synthesize GTIN/brand. Provide provider-approved inventory removal/update semantics, observability and per-tenant disable switch. Confirm fee/click-through, search admission and brand permissions separately; enabling feed is not enabling payment.

Candidate tests: published/unpublished/archived products, exact IRR, discounts, absent sale price, multiple color/size variants, no-stock/mixed stock, canonical URLs, media, stable pagination and single item, tenant/domain/key isolation, bounds, cache freshness, unavailable provider auth, existing catalog/SEO/PWA/checkout regressions. Actual ingestion acceptance with Searchwise and owner authorization before activation.

### 10.5 Open provider questions

- Official custom feed verb/path, envelope, `page`/`size` vs `limit`, maximums, exact availability enum, category representation, required fields and missing-value handling, per-variant IDs and images, price for parent products, GTIN absence, deletions, refresh cadence and authentication/key issuance.
- Whether provider requires `validate-token` for custom integrations, how to issue/rotate feed keys, approved crawler IPs, sample acceptance and onboarding procedure. Never reuse SnappPay payment secrets for feed access.
- Product feed, direct crawl or API acceptance; choose API if approved. No claim of Searchwise merchant registration or live catalog visibility yet.

## 11. Delivery status (discovery baseline v0.3)

Payment plugin, Searchwise plugin, PDF and IP-change form reviewed. Official Self payment API spec, Stage access, test scenarios, registered callback/IPs, settlement/refund contract and previous secret values remain missing. Catalog contract questions are separate, not blockers for local payment engineering. Owner reports card-transfer enabled; no independent end-to-end bank-transfer acceptance claimed. No live requests or config changes; no commits made to repository. Private env file unchanged; only a secret-free separate Searchwise example is added, all variable names proposed and not wired.

### Source integrity (uploaded bytes, SHA-256)

- `snapppay-woocommerce-gateway-v1.4.2.zip`: `1e51615ecfa9fd3d7ff8733239a800c4077abaea536c479dbf6780c470b23e71`
- `searchwise-woocommerce-plugin-1.0.2_2.zip`: `cd478719dc0c1ca0e0581ca574fb362bfc1c315bd04099eb736aac1fd4a890a7`
- `دستورالعمل-برای-جمع_آوری-داده_های-فروشگاه_ها-updated.pdf`: `f7e27e09ad4d88680d8b0b4203ccaf45bbd9aa89e889ccb4f979986754e7ba18`
- `Change-IP.docx`: `f3209e326586af12d2a38f2b4e316782c007c3f6ed1f7dc9ae8d4318108b3828`


## 12. Owner decisions — v0.4 (2026-11-28)

These decisions supersede earlier discovery suggestions wherever they conflict. Read `OWNER-REQUIREMENTS.md` alongside this document.

- Aka Shoes is a **first-time SnappPay gateway integration**; no previous gateway migration is presumed.
- Owner enabled BANK_TRANSFER in Production. Preserve it and the operational guest checkout. Regression test; do not redo activation.
- SnappPay is **installment-only**, using the provider-confirmed INSTALLMENT contract. No full-price immediate SnappPay payment mode.
- Installment product pricing is **11% above ordinary price**. Normal payment methods and ordinary catalog prices remain unchanged. This is an owner-requested business rule, not provider approval or a provider fee claim. Validate merchant contract and applicable pricing/disclosure rules before live activation; if not permitted, stop activation and report, do not hide or recategorize the uplift.
- Advanced storefront search must include a first-class product tag facet. This is a local Retail search requirement, independent of Searchwise's external feed. Implement via existing tenant-aware catalog/search infrastructure.
- Searchwise remains independently gated, optional follow-up after installment payment and advanced tag search. No live feed activation without authorization.
- Official Self contract, Stage, missing secrets, egress IP and callback registration remain open. All features requiring provider acceptance default OFF.
