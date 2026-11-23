<!-- BAZARBAAZ_CURRENT_PRODUCTION_TOPOLOGY_20261123: START -->
> **CURRENT PRODUCTION INFRASTRUCTURE — OWNER CONFIRMED, 2026-11-23:** Runflare project `product` (ID `37622`); application service `87432`; **Production PostgreSQL-PostGIS 17.3 `maindb` service `87429` (active, console observed)**. The application's actual database target/binding is still **UNVERIFIED**. **Neon is NOT Production; Render is unrelated.** All authorized remote DB connection URIs must come only from `DB_REMOTE_URI`, fail closed if missing, never log the value; this does not authorize a connection. Static Damoon 3/17/6/3/2 fallback is verified, but dynamic CMS GET returned Nginx HTML HTTP 503 and Production CMS publication remains unaccepted. PR140, Production writes/migrations, booking/payment and unapproved feature changes remain ON HOLD. Current reference: `docs/BAZARBAAZ-PRODUCTION-TOPOLOGY-2026-11-23.md`. Historical Neon documents are not current operational authority.
<!-- BAZARBAAZ_CURRENT_PRODUCTION_TOPOLOGY_20261123: END -->

# Damoon | مرزبندی و شروط لازم رزرو قطعی و تغییر دیتابیس Production

**حکم فعلی:** `PRODUCTION_MIGRATION_NO_GO` + `PUBLIC_RESERVATION_DISABLED` + `PR140_ON_HOLD`.

## شواهد تاریخی متمایز از وضعیت امروز

- بررسی read-only مورخ ۱۷ نوامبر در `PRODUCTION-SCHEMA-PREFLIGHT-2026-11-17.md` هدف Runflare PostgreSQL 17 را با سازمان و Property دامون و `HOTEL_BOOKING`/`HOTEL_WEBSITE` فعال گزارش کرده است. همان snapshot تاریخچه ۱۲۰ Migration موفق، ۴ rolled-back، ۲۷ checksum متفاوت و ۱۳ وارونگی ترتیب، به‌علاوه ۵ migration منبع غایب در Ledger را گزارش کرد. **این گزارش زمان‌دار است؛ مدرک تازه DB نیست.**
- `MIGRATION-LINEAGE-RECONCILIATION-AND-REHEARSAL-2026-11-19.md`: پنج migration additive روی دیتابیس موقت/شکل مشابه Production rehearsal شده‌اند ولی **نه روی full Production lineage clone**. پس مرور تست‌ها اجازه `prisma migrate deploy` یا `migrate resolve` در Production نیست.
- گزارش جدیدتر Agent C فاقد شناسایی کامل endpoint/CA/TLS، principal read-only محدود و recheck تازه Ledger بود؛ این توقف درست است. `api/health?deep=1` تنها connection smoke است.
- `checkOutTime=12:00` تایید مالک دارد، ولی snapshot تاریخی DB = `11:00`، اعمال به هدف واقعی هنوز اثبات نشده. تغییر آن write مستقل با مجوز scope و پس از سازگاری schema است.

## PR140 و خطر ظرفیت

- PR140 یک اصلاح ظرفیت برای maintenance block تاریخ‌دار است؛ باید روی `main` فعلی بازبینی، رفع conflict، تست `reservation/hold/quote/public availability/dated maintenance` و raceهای Serializable/locking آن دوباره انجام شود.
- `OPEN` یا `CI_PASS` به‌معنای deploy نیست. در حالت ON HOLD ادغام نمی‌شود؛ ولی کد می‌تواند offline/isolated آماده بررسی باشد.

## تعریف اجازه کار

| نوع عملیات | وضعیت |
|---|---|
| کد UI/UX دامون، منبع ثابت و unit tests | مجاز تحت شرایط standing approval و CI |
| تست PostgreSQL موقت با synthetic fixture و پاک‌سازی | مجاز و توصیه‌شده |
| خواندن محدود DB واقعی | فقط با هویت endpoint و TLS امن و principal read-only مجاز/تاییدشده |
| PR140 merge | فعلاً ممنوع تا رفع Hold صریح |
| `prisma migrate deploy` روی Production | ممنوع تا GO مکتوب گیت‌ها |
| نوشتن room/rate/availability/guest/request روی Production | نیازمند مجوز داده‌ای و فاز مشخص |
| فعال‌سازی booking/hold/online payment/SMS/cron | ممنوع تا GO مستقل |

## گیت GO واقعی، به ترتیب

1. **Target identity:** اپراتور به‌صورت غیرمحرمانه DB/Host/branch/Role/TLS/CA را تایید کند و کمینه نقش RO به viewهای audit داشته باشد. هیچ Credential در Git، لاگ، یا این سند نیست.
2. **Ledger and schema:** snapshot تازه read-only با SHA source، فهرست کامل نام/چک‌سام/status/timestamps و object catalog؛ ریشه هر divergence/rollback/order/pending مشخص و اصلاح lineage با روش مصوب، نه حذف آثار تاریخی.
3. **Backup/restore:** قابلیت واقعی provider backup و بازیابی در یک محیط ایزوله، زمان cutover، log و rollback forward/compatibility ثابت شود.
4. **Full-lineage rehearsal:** کپی sanitized با Ledger معتبر، تمام migrationهای لازم، seed synthetic و حساسیت tenant روی PostgreSQL staging. تمام عملیات Quote/Hold/Reservation/Payment audited، شکست race و rollback با آن بررسی شوند.
5. **Owner data:** فهرست فیزیکی واقعی ۳۱ واحد/دسته‌ها، نرخ، برنامه نرخ شب، سیاست کنسلی، ظرفیت/کودک، Check-in/out و مسئول پذیرش تایید شده؛ هر داده imported قابل ردیابی باشد.
6. **Source readiness:** PR140 پس از آزادشدن Hold و CI معتبر، tests no-oversell و operational paths؛ smoke tenant دیگر و غیر فعال‌بودن Gate عمومی.
7. **Operator release:** برنامه تک‌مقصدی migration با maintenance window، recovery، exact SHA، plan مجوز و ثبت before/after. تغییر configuration/feature flag جدا از Migration.
8. **Canary/operational acceptance:** رزرو/پرداخت با sandbox و بعد canary واقعی محدود، PSP reconciliation، refund، duplicate/replay، customer rights و no-show/cancellation، سپس rollout.

**تا اتمام این هشت مورد، تحویل اول سایت عمومی و هماهنگی اقامت می‌تواند با Gateهای خودش مستقل ادامه یابد.**

## OWNER_ACCOMMODATION_AMENDMENT_20261123 — Current owner-selected category baseline

The implementation now targets **3 single rooms, 17 double rooms, 6 three-person suites, 3 four-person suites and 2 five-person suites**, aggregate **20 rooms + 11 suites = 31 units**. This is the owner-selected editable **product default**, not certified physical capacity. Dashboard/website category edits must follow existing tenant-scoped publication/revision rules, preserve slugs/CTAs and remain separate from operational room inventory. Refer to `OWNER-DECISION-ACCOMMODATION-BASELINE-2026-11-23.md` and `ACCOMMODATION-ADMIN-AND-CONTENT-CONTRACT-2026-11-23.md`. No Production writes, migration, PR140 merge or booking activation are authorized.

PR148 implements the baseline and CMS publication flow; disposable PostgreSQL acceptance passed at run `45088093245` and merge SHA is `9379d82761bea87c20b86be1a96da9dcb9bd7428`. Live public asset hashes now match that source, but the provider's post-merge active version and interactive CMS publication are not verified; the latest portal view was v126 with a GithubApp request initialized and no build log. Database and booking gates remain unchanged.
