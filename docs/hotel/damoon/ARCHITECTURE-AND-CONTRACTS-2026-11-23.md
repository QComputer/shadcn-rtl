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

## قرارداد درخواست مهمان

- `booking-flow.js`: helperهای حفظ تاریخ ISO، بزرگسال/کودک/سن، selected room/category و idempotency key رمزنگارانه؛ داده هویتی یا مبلغ نباید وارد URL سفر شود.
- `booking.js`: تاریخ/ترکیب مهمان و مرحله فرم در `sessionStorage`؛ برای retry فقط کلید تصادفی `Idempotency-Key` ذخیره می‌شود. نام، تلفن، ایمیل، یادداشت، بدنه درخواست و tracking reference فقط در حافظه صفحه می‌مانند. داده حساس legacy از نسخه قدیمی هنگام بارگذاری به‌صورت فوری از `sessionStorage` پاک‌سازی می‌شود؛ این ذخیره‌سازی را نباید رمزنگاری یا مخزن امن فرض کرد.
- `tests/e2e/damoon/shared-runtime-booking-acceptance.spec.mjs` و Workflow `damoon-booking-acceptance.yml` به backend واقعی ولی **PostgreSQL 17 disposable** متصل می‌شوند. نتیجه آن‌ها به DB Production تعمیم داده نمی‌شود.
- استفاده واقعی با پذیرش نیازمند کنترل نقش، وضعیت/تاریخچه، ضدتکرار و محافظت reference در هر دو endpoint است. صفحه زنده بدون Submit، این زنجیره را تست نمی‌کند.

## مدیریت/رزرو عملیاتی جداست

- قراردادهای مشترک `HotelProperty`, `HotelRoomType`, physical room, nightly inventory, rate plan, dated maintenance، `HotelGuestBookingRequest` و lifecycle در Backend و Prisma وجود دارند؛ **وجود مدل‌ها دلیل populated بودن Production نیست**.
- `docs/hotel/operations/RECEPTION-MANUAL-ROOM-MANAGEMENT-2026-11-21.md` مرحله‌بندی مدیریت اتاق/پذیرش دستی را شرح می‌دهد. وضعیت کد جاری در `COMPLETION-CHECKLIST` جدیدتر است؛ برای شکاف دستی بدون نرخ و ویرایش پس از ثبت، هنوز کار مستقل لازم است.
- PR140 برای کسر هم‌زمان maintenance از type-level capacity و Quote/Hold/Availability مطرح است اما ON HOLD. نباید فعال‌سازی فروش عمومی از این نقص عبور کند.

## Release و CI

- CI منتخب: `request-to-reception`, `build-public-assets`, `focused-regressions`, `RunFlare TypeScript`; Vercel preview طبق سیاست suspended ممکن است مسدود باشد.
- Runflare GitHub App می‌تواند با تأخیر از merge به نسخه active برسد. Receipt حتماً Git SHA، نسخه Runflare و public manifest match را جدا نگه دارد.
- `api/health?deep=1` فقط smoke پیکربندی/DB ساده است؛ migration schema readiness، عملیات پرداخت یا request POST را تأیید نمی‌کند.

## اصول طراحی آینده

هر feature باید از قبل مشخص کند: `(tenant authority, source data, feature flag, API contract, idempotency, persistence, public surface, tests, release receipts, recovery path)`. توسعه UI تا زمان دریافت عکس/تورِ منتشرنشده نباید معطل شود؛ ساخت داده عملیاتی و قیمت از تصاویر یا متن مفهومی ممنوع است.

## OWNER_ACCOMMODATION_AMENDMENT_20261123 — Current owner-selected category baseline

The implementation now targets **3 single rooms, 17 double rooms, 6 three-person suites, 3 four-person suites and 2 five-person suites**, aggregate **20 rooms + 11 suites = 31 units**. This is the owner-selected editable **product default**, not certified physical capacity. Dashboard/website category edits must follow existing tenant-scoped publication/revision rules, preserve slugs/CTAs and remain separate from operational room inventory. Refer to `OWNER-DECISION-ACCOMMODATION-BASELINE-2026-11-23.md` and `ACCOMMODATION-ADMIN-AND-CONTENT-CONTRACT-2026-11-23.md`. No Production writes, migration, PR140 merge or booking activation are authorized.

PR148 implements the baseline through the existing tenant-scoped Hotel CMS draft/review/approval/publication architecture. Public category quantities come from the published editorial projection and have no dependency on `HotelRoomType.totalAllotment`; physical inventory and reservation records are unaffected. CI plus disposable PostgreSQL acceptance passed (workflow `45088093245`, PR head `65f010bfdd58b3697d6edcb46c47170484d46e0b`). The merge SHA is `9379d82761bea87c20b86be1a96da9dcb9bd7428`. Live static manifest hashes match that merge, but provider deployment version/source and interactive CMS acceptance remain unverified.
