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
| R05 ارسال همسان | خطای timeout / پاسخ مبهم با همان idempotency key مجدد؛ `409` fingerprint تغییر‌یافته کنترل شود، duplicate request ساخته نشود | disposable PG + concurrency | PR142 CI passed; local regressions on `codex/damoon-cms503-local-20261123` assert the unique-constraint race recovery, cross-tenant key/reference isolation, and fail-closed rejection of missing/malformed API idempotency keys before rate limiting/service access (unit passed; fresh PostgreSQL integration not run because Docker engine is unavailable) |
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

## OWNER_ACCOMMODATION_AMENDMENT_20261123 — Current owner-selected category baseline

The implementation now targets **3 single rooms, 17 double rooms, 6 three-person suites, 3 four-person suites and 2 five-person suites**, aggregate **20 rooms + 11 suites = 31 units**. This is the owner-selected editable **product default**, not certified physical capacity. Dashboard/website category edits must follow existing tenant-scoped publication/revision rules, preserve slugs/CTAs and remain separate from operational room inventory. Refer to `OWNER-DECISION-ACCOMMODATION-BASELINE-2026-11-23.md` and `ACCOMMODATION-ADMIN-AND-CONTENT-CONTRACT-2026-11-23.md`. No Production writes, migration, PR140 merge or booking activation are authorized.

## Local guest request regression — 2026-11-23

The focused guest-request service unit suite passes with an explicit concurrent create-race assertion: two simultaneous requests reach persistence, the tenant-scoped unique constraint yields one stored request and one replay. A shared idempotency key creates independent requests for separate synthetic tenants, and each opaque tracking reference returns 404 under the other tenant. Booking-flow pure tests also pass. This is unit/mocked-DB evidence only; disposable PostgreSQL integration remains unverified because the local Docker engine is unavailable. No Production requests or data were created.
# CMS/public accommodation acceptance update — PR148

PR148 head `65f010bfdd58b3697d6edcb46c47170484d46e0b` passed workflow `45088093245` against workflow-owned disposable PostgreSQL. Acceptance covers draft invisibility, owner-manager draft followed by independent-admin review/approval/publication/public read, 3/17/6/3/2 baseline, FA/EN/AR content, tenant isolation, no `HotelRoomType.totalAllotment` dependency, no editorial `visible` leakage, and read-only public projection. CI passed; merge commit/main is `9379d82761bea87c20b86be1a96da9dcb9bd7428`. Production writes were none. The public manifest now hash-matches; Damoon/Bazarbaaz basic and deep health were HTTP 200 with DB connected; FA/EN/AR room and VTour routes and request-start routes returned HTTP 200/noindex. At the time this CMS workflow evidence was recorded, Runflare version and live browser acceptance had not been verified. The later read-only Production acceptance is recorded below; Production CMS editing/publication remains untested.


## PR148 public category acceptance — 2026-11-23 (Production read-only)

Runflare v127 was active (1/1 healthy pod); the latest completed GitHub App deployment log identified main `9379d82761bea87c20b86be1a96da9dcb9bd7428`. Read-only browser checks observed all five category names and owner-selected counts (3/17/6/3/2) in the static fallback in FA/EN/AR, conceptual-image labels, request-only language, category-specific coordination navigation, and preservation of check-in/out `2026-12-01`/`2026-12-29`, adults 3, child count 1 and age 8 through FA→EN→AR. At 360px and 390px in all three locales, document width equaled viewport width; no horizontal overflow appeared, and concept images loaded after scrolling. However the live GET to `/api/hotel/v1/website/properties/damoon?locale=fa` returned Nginx HTML HTTP 503 rather than application JSON; the upstream/configuration cause is unconfirmed, so dynamic Production CMS reads/publication are not accepted. No guest request, CMS change or other Production write was made. Basic/deep health returned `status: ok`; Damoon deep health reported database checked/OK. The mobile layout check was performed in a headless browser; the interactive in-app browser itself did not offer a viewport override. This public category read is separate from PR145's earlier six-viewport UI acceptance and from PR148's disposable-PostgreSQL CMS publication acceptance; no privileged Production CMS edit/publish was attempted.
