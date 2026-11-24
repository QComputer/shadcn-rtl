<!-- BAZARBAAZ_CURRENT_PRODUCTION_TOPOLOGY_20261123: START -->
> **CURRENT PRODUCTION INFRASTRUCTURE — OWNER CONFIRMED, 2026-11-23:** Runflare project `product` (ID `37622`); application service `87432`; **Production PostgreSQL-PostGIS 17.3 `maindb` service `87429` (active, console observed)**. The application's actual database target/binding is still **UNVERIFIED**. **Neon is NOT Production; Render is unrelated.** All authorized remote DB connection URIs must come only from `DB_REMOTE_URI`, fail closed if missing, never log the value; this does not authorize a connection. Static Damoon 3/17/6/3/2 fallback is verified, but dynamic CMS GET returned Nginx HTML HTTP 503 and Production CMS publication remains unaccepted. PR140, Production writes/migrations, booking/payment and unapproved feature changes remain ON HOLD. Current reference: `docs/BAZARBAAZ-PRODUCTION-TOPOLOGY-2026-11-23.md`. Historical Neon documents are not current operational authority.
<!-- BAZARBAAZ_CURRENT_PRODUCTION_TOPOLOGY_20261123: END -->

# Damoon | معماری اجرایی و قراردادهای مشترک

**مبنای مشاهده:** مخزن `QComputer/shadcn-rtl`، آخرین main ادغام‌شده `9379d82761bea87c20b86be1a96da9dcb9bd7428`؛ برای وضعیت deployment/Production به release register رجوع کنید.

## تصویر معماری فعلی

```text
Guest browser — damoon-hotel.ir
  → host-scoped public routing (lib/damoon-public-route.ts)
  → public/damoon-front/index.html + hashed source assets
  → sites/damoon/{app,accommodation,booking,virtual-tour,content,translations}.js
  ├─ only 4 verified Andarama URLs (iframe on demand)
  └─ API /api/hotel/v1/requests + /requests/status
              ↳ Next.js Host/tenant verification + guest-request service
                       ↳ authorized hotel reception request workspace

Staff browser — authenticated dashboard
  → existing Bazarbaaz session, OrganizationMembership + HOTEL capability
  → Hotel management / reception / CMS services (tenant/property-bound)

Future independent path (NOT public-enabled):
  Room types + inventory + rates → quote → hold → reservation → payment
```

## Host و Tenant

- هدف Host عمومی واقعی `damoon-hotel.ir` با `www` مجاز است. `lib/damoon-public-route.ts` برای GET/HEAD فقط مسیرهای نام‌برده را به shell/asset مستقل می‌فرستد؛ POST/Identity/Dashboard/API عمومی جایگزین host-scoped ندارند.
- Guest-first/identity-optional اصل مصوب عمومی Bazarbaaz است. «بدون ثبت‌نام برای درخواست» ≠ دسترسی بدون مجوز به مدیریت درخواست.
- هر Business/Organization، رسانه، session و داده مالی باید بر اساس Host معتبر یا عضویت احرازشده tenant scope شود. Slug دلخواه، header تزریقی، query `organizationId` یا ظاهر وب authority نیست.
- PR141 نشان داد جاافتادن یک مسیر در allowlist باعث 404 و حتی React Server Component error در Production می‌شود؛ هر route جدید باید همراه واحدهای route test و Browser direct GET برای fa/en/ar باشد.

## فرانت عمومی دامون

- منبع اصلی: `sites/damoon`; خروجی مشترک: `public/damoon-front`; build: `node sites/damoon/build.mjs --shared-runtime --sync-public-direct`.
- منبع محتوا: `content.js` و `translations.js`؛ CSS اصلی `styles.css`, `accommodation.css`, `booking.css`, `hospitality.css`, `theme-tokens.css`؛ صفحات به‌صورت کد واقعی و قابل تعامل رندر می‌شوند.
- manifest عمومی باید با فایل‌هایی که Runtime می‌دهد و Git source برابر باشد. Sync بدون Review کل bundle مجاز نیست.
- تور: `virtual-tour.js` origin allowlist `https://andarama.bazarbaaz.ir` و فقط چهار Scene verified؛ حالت lazy-on-demand و failover به open-direct.
- رسانه: `media-slots.json` و `prepare-media.mjs` برای تولید نسخه WebP خصوصی؛ این ابزار publish نمی‌کند.
- booking gate: `booking-activation.js` به‌صورت explicit `enabled:false`؛ سیاست request-only از دو سوی UI/API باید enforce شود.
- پیشنهادهای جست‌وجوی موجودی صرفاً راهنمایی هستند: رابط FA/EN/AR فقط رتبه و دلیل محلی‌سازی‌شدهٔ همان `roomTypeId` را روی گزینهٔ موجود و منتشرشده نشان می‌دهد؛ این پیشنهاد رزرو یا تضمین موجودی نیست. تا زمان فعال‌سازی مجاز، مسیر request-only اصلاً API موجودی، نرخ، hold، reservation یا پرداخت را فراخوانی نمی‌کند.

## قرارداد درخواست مهمان

- `booking-flow.js`: helperهای حفظ تاریخ ISO، بزرگسال/کودک/سن، selected room/category و idempotency key رمزنگارانه؛ داده هویتی یا مبلغ نباید وارد URL سفر شود.
- قراردادهای API برای هر occupancy با `children > 0` دقیقاً یک سن معتبر ۰ تا ۱۷ برای هر کودک لازم دارند؛ این فقط صحت دادهٔ ظرفیت/رزرو را تضمین می‌کند و هیچ آستانهٔ سنی، نرخ یا سیاست اختصاصی کودک را فرض نمی‌کند.
- `booking.js`: تاریخ/ترکیب مهمان و مرحله فرم در `sessionStorage`؛ برای retry فقط کلید تصادفی `Idempotency-Key` ذخیره می‌شود. نام، تلفن، ایمیل، یادداشت، بدنه درخواست و tracking reference فقط در حافظه صفحه می‌مانند. داده حساس legacy از نسخه قدیمی هنگام بارگذاری به‌صورت فوری از `sessionStorage` پاک‌سازی می‌شود؛ این ذخیره‌سازی را نباید رمزنگاری یا مخزن امن فرض کرد.
- `tests/e2e/damoon/shared-runtime-booking-acceptance.spec.mjs` و Workflow `damoon-booking-acceptance.yml` به backend واقعی ولی **PostgreSQL 17 disposable** متصل می‌شوند. نتیجه آن‌ها به DB Production تعمیم داده نمی‌شود.
- استفاده واقعی با پذیرش نیازمند کنترل نقش، وضعیت/تاریخچه، ضدتکرار و محافظت reference در هر دو endpoint است. صفحه زنده بدون Submit، این زنجیره را تست نمی‌کند.

## مدیریت/رزرو عملیاتی جداست

### قرارداد Reservation Center — ۲۰۲۶-۱۱-۲۴

- مسیر dashboard با عضویت فعال سازمان Hotel، capability `HOTEL_BOOKING` و property فعال محدود می‌شود؛ نقش‌های ADMIN/MANAGER/STAFF/SUPER_ADMIN مجازند. STAFF از همان booking-actor authorization مجاز به GET رزرو و occupancy است؛ role تنها authority نیست.
- `GET /api/organizations/{organizationId}/hotels/{propertyId}/occupancy?from=YYYY-MM-DD&to=YYYY-MM-DD` پاسخ فقط‌خواندنی شامل property identity محدود، بازهٔ حداکثر ۳۱ شب و room board می‌دهد. PII، نرخ و inventory config برنمی‌گردد. درخواست maintenance هم جزو read اجباری است؛ اگر schema/table در دسترس نباشد، کل board شکست می‌خورد تا ظرفیت نامعلوم به اتاق خالی تعبیر نشود.
- نمایش تقویم هفت روز است و مرز تاریخ ISO را برای API حفظ می‌کند؛ برچسب FA از تقویم فارسی در timezone UTC برای جلوگیری از جابه‌جایی روز استفاده می‌کند. رزروهای demo با نشان مستقل مشخص می‌شوند.
- ایجاد تلفنی/حضوری، تخصیص، check-in/out و لغو از API و تراکنش‌های رزرو موجود می‌گذرند. این dashboard امکان عمومی reservation/payment را فعال نمی‌کند و schema/migration جدیدی ندارد.
- Implementation source `71973488b93c15945d1e4f9b261bd8e4c3f53285` (مرکز read رزرو نیز از `GET .../reservations?view=center` استفاده می‌کند تا فهرست پذیرش به gate عمومی وابسته نباشد؛ mutationها همچنان قرارداد/gate موجود را دارند). CI/disposable PostgreSQL/browser هنوز pending تا اجرای hosted PR workflow.

- پاسخ جست‌وجوی تاریخ‌محور علاوه بر گزینه‌ها، رتبه و کدهای دلیل توصیهٔ قطعی/توضیح‌پذیر را فقط از اتاق‌ها و نرخ‌های تأییدشده برمی‌گرداند؛ توصیه موجودی را رزرو نمی‌کند و تضمین رزرو نیست.
- قراردادهای مشترک `HotelProperty`, `HotelRoomType`, physical room, nightly inventory, rate plan, dated maintenance، `HotelGuestBookingRequest` و lifecycle در Backend و Prisma وجود دارند؛ **وجود مدل‌ها دلیل populated بودن Production نیست**.
- `docs/hotel/operations/RECEPTION-MANUAL-ROOM-MANAGEMENT-2026-11-21.md` مرحله‌بندی مدیریت اتاق/پذیرش دستی را شرح می‌دهد. وضعیت کد جاری در `COMPLETION-CHECKLIST` جدیدتر است؛ برای شکاف دستی بدون نرخ و ویرایش پس از ثبت، هنوز کار مستقل لازم است.
- PR140 برای کسر هم‌زمان maintenance از type-level capacity و Quote/Hold/Availability مطرح است اما ON HOLD. نباید فعال‌سازی فروش عمومی از این نقص عبور کند.

## Release و CI

- CI منتخب: `request-to-reception`, `build-public-assets`, `focused-regressions`, `RunFlare TypeScript`; Vercel preview طبق سیاست suspended ممکن است مسدود باشد.
- Runflare GitHub App می‌تواند با تأخیر از merge به نسخه active برسد. Receipt حتماً Git SHA، نسخه Runflare و public manifest match را جدا نگه دارد.
- `api/health?deep=1` فقط smoke پیکربندی/DB ساده است؛ migration schema readiness، عملیات پرداخت یا request POST را تأیید نمی‌کند.

## اصول طراحی آینده

هر feature باید از قبل مشخص کند: `(tenant authority, source data, feature flag, API contract, idempotency, persistence, public surface, tests, release receipts, recovery path)`. توسعه UI تا زمان دریافت عکس/تورِ منتشرنشده نباید معطل شود؛ ساخت داده عملیاتی و قیمت از تصاویر یا متن مفهومی ممنوع است.

For guest coordination retries, once a pending idempotency key exists it is reused even if the re-entered payload differs. The existing server fingerprint contract must return `409`; the client keeps the key and gives localized guidance instead of silently rotating it and risking a duplicate. An explicit guest action to start a new request clears the prior attempt so the next submission creates a fresh key. Guest names, contact details, notes, request bodies and tracking references remain out of browser storage, so a full-page locale navigation requires guests to re-enter those values. Preserving them across reloads needs a separately reviewed secure state contract.

The guest may copy a tracking reference only through an explicit accessible control. Clipboard denial produces localized manual-copy guidance; the reference is not persisted to browser storage.

## OWNER_ACCOMMODATION_AMENDMENT_20261123 — Current owner-selected category baseline

The implementation now targets **3 single rooms, 17 double rooms, 6 three-person suites, 3 four-person suites and 2 five-person suites**, aggregate **20 rooms + 11 suites = 31 units**. This is the owner-selected editable **product default**, not certified physical capacity. Dashboard/website category edits must follow existing tenant-scoped publication/revision rules, preserve slugs/CTAs and remain separate from operational room inventory. Refer to `OWNER-DECISION-ACCOMMODATION-BASELINE-2026-11-23.md` and `ACCOMMODATION-ADMIN-AND-CONTENT-CONTRACT-2026-11-23.md`. No Production writes, migration, PR140 merge or booking activation are authorized.

PR148 implements the baseline through the existing tenant-scoped Hotel CMS draft/review/approval/publication architecture. Public category quantities come from the published editorial projection and have no dependency on `HotelRoomType.totalAllotment`; physical inventory and reservation records are unaffected. CI plus disposable PostgreSQL acceptance passed (workflow `45088093245`, PR head `65f010bfdd58b3697d6edcb46c47170484d46e0b`). The merge SHA is `9379d82761bea87c20b86be1a96da9dcb9bd7428`. Live static manifest hashes match that merge, but provider deployment version/source and interactive CMS acceptance remain unverified.
