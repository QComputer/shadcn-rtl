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
