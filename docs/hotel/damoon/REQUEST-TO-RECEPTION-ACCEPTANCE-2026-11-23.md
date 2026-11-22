# Damoon | قرارداد پذیرش جریان درخواست مهمان تا پذیرش

**هدف:** اثبات زنجیره قابل استفاده، نه فقط سلامت UI. مهمان نباید مجبور به ثبت‌نام شود؛ Guest-first/Identity-optional مطابق `docs/architecture/ADR-GUEST-FIRST-IDENTITY-OPTIONAL.md`. حالت Request Only الزامی است.

## جریان هدف

```text
Room card / Home / Direct booking-start
  -> room category (non-guaranteed) + dates + adults + children/ages
  -> localized coordination form and contact disclosure
  -> POST /api/hotel/v1/requests  [idempotency key]
  -> opaque tracking reference
  -> POST /api/hotel/v1/requests/status [read-only status intent]
  -> authorized reception guest-request queue
  -> staff status update / response -> guest retrieves status
```

**مرز امنیتی:** مسیرهای عمومی نباید Quote، Availability، Hold، Reservation confirmation یا Payment انجام دهند. `GET` عمومی نباید داده حساس مشتری دیگر را افشا کند. پذیرش فقط از نقش/سازمان/Property معتبر، نه از query/header کنترل‌شده مرورگر، وضعیت را تغییر دهد.

## ماتریس تست الزامی

| سناریو | چه چیز را واقعاً باید ثابت کند | سطح تست | وضعیت اولیه |
|---|---|---|---|
| R01 مسیر مستقیم | `/hotel-reservations/start` و `/fa`,`/en`,`/ar` با/بدون query به shell درست rewrite شوند؛ 404/#441 نباشد | Router unit + Browser live | PR141 verified |
| R02 پیوند دسته اقامت | CTA برای هر دسته، انتخاب `category`, تاریخ و مهمان حفظ شود؛ نوع اتاق ادعای موجودی نیست | Browser FA/EN/AR/6 viewport | **Production GET-only passed on v124:** FA/EN/AR, six widths, category CTA, locale and reload preserve dates/counts/ages |
| R03 داده معتبر | جلالی فقط نمایش است، ISO ارسال؛ check-out بعد از check-in، کودک بدون سن مشخص «نامشخص» بماند | pure unit + browser | جزئی پذیرفته‌شده |
| R04 نگه‌داری draft | داده تماس و مقدارهای حساس لازم فقط در same-tab session storage؛ reload/locale/nav حفظ شود؛ بعد از انقضا یا خروج رفتار واضح | browser | PR142 verified |
| R05 ارسال همسان | خطای timeout / پاسخ مبهم با همان idempotency key مجدد؛ `409` fingerprint تغییر‌یافته کنترل شود، duplicate request ساخته نشود | disposable PG + concurrency | PR142 CI passed |
| R06 پاسخ پذیرش | receipt/reference معتبر تنها پس از موفقیت سرور؛ خطای 429/503 و شبکه با پیام سه‌زبانه | disposable PG | **Main workflow 45078447100 passed:** request success, disabled/rate-limited retries and locale copy |
| R07 پیگیری | reference محرمانه و غیرقابل حدس، state بعد از تغییر status، Request دیگری پیدا نشود | PG + browser | **Main workflow 45078447100 passed:** FA/EN/AR status and tracking cases; latest submitted reference regression passed |
| R08 نقش پذیرش | ADMIN/MANAGER/STAFF دارای مجوز درست، foreign tenant denial، تغییر state ممیزی‌شده و مشاهده تاریخچه | disposable PG + auth-browser | **Main workflow 45078447100 passed:** manager review/update, unauthorized and foreign-tenant denial, optimistic concurrency |
| R09 حریم خصوصی | ممنوعیت PII در URL، logs، analytics؛ auto-fill کنترل‌شده؛ حذف/انقضای Draft و رضایت اطلاعات | security+browser review | **نیازمند تأیید نهایی** |
| R10 Isolation | Damoon، Akashoes، Bazarbaaz و Fastfood13 به shell/tenant اشتباه نیفتند | host tests+live GET | اسموک قبلی موفق |
| R11 غیرفعال بودن فروش | هر درخواست public `requestOnly` و noindex، هیچ Availability/Hold/Reservation/PSP | network interception + tests | source gate verified |
| R12 آزمایش عملیاتی مدیر | یک درخواست Synthetic مجاز در محیط غیرProduction به صف برسد، کاربر از Reference وضعیت را ببیند | integrated scenario | **Main workflow 45078447100 passed on disposable PostgreSQL**; no Production guest data created |

## شواهد تکمیل فنی M1 (2026-11-23)

- GitHub Actions: [Damoon booking request isolated acceptance, run 45078447100](https://github.com/QComputer/shadcn-rtl/actions/runs/45078447100), source SHA `89e80a6e55b69c1e938674a344d60f46ed327913`, conclusion `success`.
- این run روی PostgreSQL 17 موقت، دیتابیس نام‌تصادفی، داده‌های synthetic برای دامون و tenant خارجی، migration فقط در همان DB، تست واقعی API و browser، request bridge، disabled gate و cleanup اجرا شد.
- `booking-request-acceptance.spec.mjs` پوشش می‌دهد: درخواست بدون inventory و رزرو/پرداخت، idempotency replay، پیگیری، مسیر پذیرش، عدم دسترسی مهمان بی‌نقش و tenant خارجی، host/origin spoofing و هم‌زمانی تغییر وضعیت.
- Production فقط با درخواست‌های `GET/HEAD` بررسی شد. هیچ guest request یا داده‌ای به Production ارسال/ساخته نشد. بنابراین پذیرش عملیاتی واقعی توسط مدیریت هتل همچنان مجوز و اجرای جدا می‌خواهد.

## اجرای تست بدون رکورد واقعی Production

- استفاده از `.github/workflows/damoon-booking-acceptance.yml`، سرویس PostgreSQL 17 موقت، ایجاد دیتابیس تصادفی مجزا، اجرای migration فقط همان‌جا و پاک‌سازی پس از تست.
- دستورهای مرجع: `node --test sites/damoon/tests/guest-coordination-request.test.mjs sites/damoon/tests/stay-contact-state.test.mjs`، `node --test tests/damoon-public-booking-module.test.mjs`، `node sites/damoon/build.mjs --shared-runtime --sync-public-direct` و `playwright.damoon.config.mjs`. قبل از اجرا از نصب وابستگی‌های قفل‌شده و عدم اشاره env به Production اطمینان حاصل شود.
- پذیرش فنی M1 برای مسیر synthetic تا صف پذیرش در CI سبز است؛ R09 (حریم خصوصی/حذف داده) نیازمند بازبینی مستقل است. تحویل Production واقعی همچنان نیازمند رضایت/مجوز داده‌ای صریح و پذیرش مدیر هتل است.
- Production فقط GET/HEAD و بررسی UI/Network بدون submit مگر با **مجوز داده‌ای صریح** شامل هویت Property، نوع داده مصنوعی، هدف، TTL و روش پاک‌سازی. «اجازه دائمی merge» مجوز ایجاد اطلاعات مهمان در Production نیست.

## قرارداد قابلیت درخواست

- مهمان حق دارد درخواست را ثبت کند، اما ثبت درخواست به‌تنهایی رزرو یا پذیرش قیمت نیست؛ وضعیت ارسالی به پذیرش، زمان پاسخ یا موجودی تضمین‌شده نیست.
- `HOTEL_BOOKING` capability در DB ممکن است ACTIVE باشد، ولی `DAMOON_PUBLIC_BOOKING_ACTIVATION.enabled=false` جدا باقی می‌ماند.
- اگر schema مورد نیاز request در Production absent باشد، API باید fail-closed و پیام قابل فهم نمایش دهد؛ نمی‌توان با CI موفق وجود جدول را نتیجه گرفت. از 503 انتظارخورده یا خطای عملیاتی واقعی گزارش مجزا تهیه شود.

## خروجی تحویل

یک Receipt با `{sourceSha, environment, dbFixtureId, tests, rolesVerified, noLiveGuestWrites, liveAssetSha, status}` تولید شود. فقط در صورت سبز بودن تست گردش واقعی پذیرش و بازبینی حریم خصوصی، `COORDINATION_OPERATIONAL_ACCEPTED` اعلام گردد.
