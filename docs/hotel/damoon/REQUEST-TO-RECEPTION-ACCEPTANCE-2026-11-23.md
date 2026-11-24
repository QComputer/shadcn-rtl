<!-- BAZARBAAZ_CURRENT_PRODUCTION_TOPOLOGY_20261123: START -->
> **CURRENT PRODUCTION INFRASTRUCTURE — OWNER CONFIRMED, 2026-11-23:** Runflare project `product` (ID `37622`); application service `87432`; **Production PostgreSQL-PostGIS 17.3 `maindb` service `87429` (active, console observed)**. The application's actual database target/binding is still **UNVERIFIED**. **Neon is NOT Production; Render is unrelated.** All authorized remote DB connection URIs must come only from `DB_REMOTE_URI`, fail closed if missing, never log the value; this does not authorize a connection. Static Damoon 3/17/6/3/2 fallback is verified, but dynamic CMS GET returned Nginx HTML HTTP 503 and Production CMS publication remains unaccepted. PR140, Production writes/migrations, booking/payment and unapproved feature changes remain ON HOLD. Current reference: `docs/BAZARBAAZ-PRODUCTION-TOPOLOGY-2026-11-23.md`. Historical Neon documents are not current operational authority.
<!-- BAZARBAAZ_CURRENT_PRODUCTION_TOPOLOGY_20261123: END -->

# Damoon | قرارداد پذیرش جریان درخواست مهمان تا پذیرش

## پذیرش مرکز رزرواسیون — الحاقیهٔ ۲۰۲۶-۱۱-۲۴

### محدوده و شواهد فعلی

- Source commit: `6de206ba94cf3d08ec7ae5f2957163d330f733be`، بر پایهٔ main `98896a24126d0c482d4fae434bf5c36f7c20143b`.
- شواهد محلی: TypeScript موفق، ESLint محدودشده موفق و ۵ تست واحد ناوبری/room-board موفق. PostgreSQL موقت محلی روی پورت محافظت‌شدهٔ `127.0.0.1:55439` در دسترس نبود؛ پذیرش PostgreSQL و مرورگر در hosted CI منتظر است.
- عملیات از API رزرو موجود استفاده می‌کنند؛ occupancy از یک GET محدود read model می‌آید. Migration و تغییر Production data نداریم.

### سناریوهای لازم در hosted acceptance

1. مدیر از کارت property وارد «رزرواسیون» شود و گردش دستی رزرو قبلی را ببیند.
2. جست‌وجوی نام مهمان/کد رزرو و فیلتر وضعیت و محدودهٔ نمایشی/عملیاتی؛ جزئیات باید با رکورد انتخاب‌شده منطبق باشند.
3. ثبت تلفنی/حضوری، تخصیص اتاق، ورود/خروج و لغو از تراکنش موجود کار کند؛ هیچ پرداخت اضافی ایجاد نشود.
4. تقویم هفت‌ستونه و ردیف‌های اتاق فیزیکی؛ پیمایش قبل/بعد دقیقاً هفت روز ISO جابه‌جا شود. FA با تاریخ فارسی و RTL، EN با LTR و AR با RTL نمایش داده شود.
5. خالی، رزروشده، اشغال، تعمیرات، خارج سرویس، تداخل و context نمایشی جدا باشند. اگر خواندن تعمیرات شکست بخورد، خطای صریح نمایش داده شود و خانهٔ خالی ساخته نشود.
6. STAFF مجاز بتواند صفحه و تقویم scoped را باز کند؛ درخواست tenant/property خارجی رد شود. کاربر ناشناس/مشتری به dashboard دسترسی نداشته باشد.
7. در موبایل overflow سراسری صفحه نباشد و خود جدول در صورت نیاز اسکرول افقی کند؛ keyboard, labels, light/dark بررسی شود.
8. جداسازی demo و رزرو عملیاتی حفظ شود؛ Production رزرو/موجودی نسازید، booking عمومی را فعال نکنید و سرویس پرداخت را فراخوانی نکنید.

وضعیت هنگام این الحاقیه: `CODE_IMPLEMENTED_LOCAL_TYPECHECK_ESLINT_UNIT_PASS_HOSTED_PG_BROWSER_PENDING`؛ GET مرکز پذیرش با `view=center` مستقل از public booking flags است، اما mutationها همان guardهای فعلی را دارند.

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
| R04 نگه‌داری draft | انتخاب تاریخ/مهمان و مرحله فرم در same-tab storage؛ اطلاعات تماس فقط در حافظه صفحه و در reload دوباره وارد شود؛ داده‌های نسخه قدیمی هنگام بازدید بعدی scrub شوند | browser | stay selection/reload PR142 verified; new privacy migration and legacy-draft browser cases are in PR151 current CI |
| R05 ارسال همسان | خطای timeout / پاسخ مبهم با همان idempotency key مجدد؛ `409` fingerprint تغییر‌یافته کنترل شود، duplicate request ساخته نشود | disposable PG + concurrency | PR142 CI passed; PR151 head `5500c5129e5a285efad37f8118b5f5cdb6760823` workflow [45115004813](https://github.com/QComputer/shadcn-rtl/actions/runs/45115004813) passed with disposable PostgreSQL and synthetic Damoon/foreign-tenant fixtures. New lost-response-after-commit, reload/replay, double-click, concurrent replay, changed-payload `409`, foreign tracking and reception exactly-once browser scenarios are added on the current PR151 revision; current-head hosted CI is pending |
| R06 پاسخ پذیرش | receipt/reference معتبر تنها پس از موفقیت سرور؛ خطای 429/503 و شبکه با پیام سه‌زبانه | disposable PG | **Main workflow 45078447100 passed:** request success, disabled/rate-limited retries and locale copy |
| R07 پیگیری | reference محرمانه و غیرقابل حدس، state بعد از تغییر status، Request دیگری پیدا نشود | PG + browser | **Main workflow 45078447100 passed:** FA/EN/AR status and tracking cases; latest submitted reference regression passed |
| R08 نقش پذیرش | ADMIN/MANAGER/STAFF دارای مجوز درست، foreign tenant denial، تغییر state ممیزی‌شده و مشاهده تاریخچه | disposable PG + auth-browser | **Main workflow 45078447100 passed:** manager review/update, unauthorized and foreign-tenant denial, optimistic concurrency |
| R09 حریم خصوصی | ممنوعیت PII در URL، logs، analytics و browser storage؛ auto-fill کنترل‌شده؛ حذف/انقضای Draft و رضایت اطلاعات | security+browser review | **نیازمند تأیید نهایی**; current request flow keeps contact, note, body and tracking reference in page memory and persists only non-sensitive stay state plus the opaque retry key; current-head legacy-storage migration/browser assertions are pending CI |
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

The focused guest-request service unit suite passes with an explicit concurrent create-race assertion: two simultaneous requests reach persistence, the tenant-scoped unique constraint yields one stored request and one replay. A shared idempotency key creates independent requests for separate synthetic tenants, and each opaque tracking reference returns 404 under the other tenant. The API route rejects missing, too-short and oversized idempotency keys before rate limiting or service access. PR151 exact head `5500c5129e5a285efad37f8118b5f5cdb6760823` passed hosted workflow `45115004813`, which used disposable PostgreSQL and synthetic tenants and completed real API plus browser acceptance. No Production requests or data were created. Local Docker remains unavailable; the hosted workflow supplies the database/browser evidence.

## Lost-response retry and storage privacy implementation — PR151 current revision

`booking.js` now migrates the previous coordination storage format and persists only flow step plus the opaque idempotency key. Contact fields, special-request text, serialized POST body and tracking reference are kept in page memory only. A reloaded guest re-enters the contact values; the same key is reused for the same body, and the server's existing fingerprint check returns the original receipt or its established `409` conflict. Browser acceptance injects a lost response after the real API commits, retries after reload, tests a double-click and concurrent replays, checks the reception inbox and one-row persistence, and verifies localized accessible retry messages. PR151 head `a173439d8c2b0e683541e865608d8be21404337c` passed hosted workflow `45120518119` and merged as `c1ccd3955e8c030df915c0d9274543fa35e6801d`. After merge, Damoon and Bazarbaaz deep health returned HTTP 200 with database check OK, but live Damoon `booking.js` manifest SHA `1b14d05865e7ab1c5f741528e864fe3b3f1ebdff1eb91fa7e5475cd4822fb0d5` did not match the PR151 merged manifest SHA `1235fa4208e08c4a9ff0c21709f08c98a96f0eb0f40da418ca4c1811bed11835`; deployment of the runtime change is therefore not verified. No Production guest requests or data were created.

## Changed-payload idempotency conflict guard — local follow-up

The follow-up keeps a pending coordination idempotency key when the guest changes form details after an ambiguous response. The server's existing fingerprint contract returns `409` for a changed payload after a committed request; the UI now explains in FA/EN/AR that the key is already bound and directs the guest to reception. It does not silently mint a new key that could create a duplicate. Browser regression injects this conflict between a rate-limited retry and successful same-key retry. The local browser test also confirms that a full locale navigation does not restore contact details or a tracking reference from browser storage; guests must re-enter private contact data after a full navigation. Safe preservation across full reloads remains unresolved without a secure state design. This local implementation is not yet merged or Production-tested.

## PR151 and PR152 release evidence — 2026-11-23

A cache-bypassing GET at `06:21:27Z` returned both live `/damoon-front/release-manifest.json` and `/damoon-front/booking.js` SHA `1235fa4208e08c4a9ff0c21709f08c98a96f0eb0f40da418ca4c1811bed11835`, matching PR151's merged manifest. Both responses were HTTP 200 with `Cache-Control: public, max-age=0`, `Last-Modified: 05:57:31 GMT`, and no `Age`, `Via` or cache-status header; this supersedes the earlier pre-deployment mismatch snapshot above and verifies PR151's booking asset publication. PR152 exact head `e4b95d4e47dd65b4e554abee7a1f4fe16d25b489` passed required Actions (`45122318149`, `45122318168`, `45122318249`, `45122318331`) with the established Vercel suspended-preview exception and merged as `4a57718d5d7e33849a120372ebcc9e8399d07d9b`. At `06:24:29Z`, the same cache-bypassing requests still returned PR151's `1235fa...` SHA, while the PR152 manifest expects `eeeada94459ec762bfaa7fe5134dbf672b7758d0a64ff381d8a2e712c3d9b4b1`; `Last-Modified` remained `05:57:31 GMT`. With unique query parameters and no-cache request headers, this points to PR152's automatic deployment not yet publishing the new asset, rather than a browser cache. The provider deployment version/source is not exposed by these checks. Damoon deep health was `ok` with database check true and `revision: null`; health does not prove the PR152 runtime release. No manual deployment or Production mutation was made.

The next local regression verifies that an explicit new request clears the prior idempotency attempt and receives a fresh key, while retries of the original request retain the same key. The post-submission action is labeled “Start a new request” in the active locale rather than a generic back-navigation label. It uses the standalone browser harness and synthetic responses; it does not create Production data.

## Tracking-reference copy control — local follow-up

The request receipt now provides an explicit FA/EN/AR copy control for the tracking reference, with an accessible live status for success and manual-copy guidance when clipboard access is denied. The reference remains out of browser storage. The standalone browser test covers successful user-initiated copying and the denied-clipboard fallback. This change is local and not yet merged or Production-accepted.
# CMS/public accommodation acceptance update — PR148

PR148 head `65f010bfdd58b3697d6edcb46c47170484d46e0b` passed workflow `45088093245` against workflow-owned disposable PostgreSQL. Acceptance covers draft invisibility, owner-manager draft followed by independent-admin review/approval/publication/public read, 3/17/6/3/2 baseline, FA/EN/AR content, tenant isolation, no `HotelRoomType.totalAllotment` dependency, no editorial `visible` leakage, and read-only public projection. CI passed; merge commit/main is `9379d82761bea87c20b86be1a96da9dcb9bd7428`. Production writes were none. The public manifest now hash-matches; Damoon/Bazarbaaz basic and deep health were HTTP 200 with DB connected; FA/EN/AR room and VTour routes and request-start routes returned HTTP 200/noindex. At the time this CMS workflow evidence was recorded, Runflare version and live browser acceptance had not been verified. The later read-only Production acceptance is recorded below; Production CMS editing/publication remains untested.


## PR148 public category acceptance — 2026-11-23 (Production read-only)

Runflare v127 was active (1/1 healthy pod); the latest completed GitHub App deployment log identified main `9379d82761bea87c20b86be1a96da9dcb9bd7428`. Read-only browser checks observed all five category names and owner-selected counts (3/17/6/3/2) in the static fallback in FA/EN/AR, conceptual-image labels, request-only language, category-specific coordination navigation, and preservation of check-in/out `2026-12-01`/`2026-12-29`, adults 3, child count 1 and age 8 through FA→EN→AR. At 360px and 390px in all three locales, document width equaled viewport width; no horizontal overflow appeared, and concept images loaded after scrolling. However the live GET to `/api/hotel/v1/website/properties/damoon?locale=fa` returned Nginx HTML HTTP 503 rather than application JSON; the upstream/configuration cause is unconfirmed, so dynamic Production CMS reads/publication are not accepted. No guest request, CMS change or other Production write was made. Basic/deep health returned `status: ok`; Damoon deep health reported database checked/OK. The mobile layout check was performed in a headless browser; the interactive in-app browser itself did not offer a viewport override. This public category read is separate from PR145's earlier six-viewport UI acceptance and from PR148's disposable-PostgreSQL CMS publication acceptance; no privileged Production CMS edit/publish was attempted.
