> **CURRENT HANDOFF — 2026-11-26.** Read [current status and decisions](STATUS-AND-DECISIONS.md) and [current roadmap](ROADMAP.md) first. The dated 2026-11-23 documents below remain historical evidence; their obsolete PR145 and pending-maintenance status does not override the newer explicitly authorized demonstration and migration. Existing production data, payment, tenant-isolation and content-approval boundaries remain in force.

<!-- BAZARBAAZ_CURRENT_PRODUCTION_TOPOLOGY_20261123: START -->
> **CURRENT PRODUCTION INFRASTRUCTURE — OWNER CONFIRMED, 2026-11-23:** Runflare project `product` (ID `37622`); application service `87432`; **Production PostgreSQL-PostGIS 17.3 `maindb` service `87429` (active, console observed)**. The application's actual database target/binding is still **UNVERIFIED**. **Neon is NOT Production; Render is unrelated.** All authorized remote DB connection URIs must come only from `DB_REMOTE_URI`, fail closed if missing, never log the value; this does not authorize a connection. Static Damoon 3/17/6/3/2 fallback is verified, but dynamic CMS GET returned Nginx HTML HTTP 503 and Production CMS publication remains unaccepted. PR140, Production writes/migrations, booking/payment and unapproved feature changes remain ON HOLD. Current reference: `docs/BAZARBAAZ-PRODUCTION-TOPOLOGY-2026-11-23.md`. Historical Neon documents are not current operational authority.
<!-- BAZARBAAZ_CURRENT_PRODUCTION_TOPOLOGY_20261123: END -->

> **OWNER_ACCOMMODATION_AMENDMENT_20261123** — A newer owner decision selects a five-category initial accommodation baseline (3 single + 17 double + 6 three-person suites + 3 four-person suites + 2 five-person suites = 31). See `OWNER-DECISION-ACCOMMODATION-BASELINE-2026-11-23.md`. This does not authorize production inventory/migrations or remove historical evidence.

<!-- DAMOON_CURRENT_REFERENCE_2026_11_23 -->
> **مرجع وضعیت اجرایی دامون — ۲۰۲۶-۱۱-۲۳:** این سند شامل شواهد تاریخی و تصمیم‌های معتبر زمان نگارش خود است. برای آخرین وضعیت Git/Runflare، وضعیت PR145، اختلاف واقعیت‌های اتاق، آخرین نقشه راه و گیت‌های انتشار به [مرجع جاری](./CURRENT-STATE-2026-11-23.md) و [نقشه راه اجرایی](./EXECUTION-ROADMAP-2026-11-23.md) رجوع کنید. تصمیم‌های مالک و گیت‌های امنیتی قدیمی با این ارجاع حذف یا لغو نشده‌اند.

# دامون هتل — نقطهٔ شروع اجرای اختصاصی

**جدیدترین تصمیم مالک درباره صبحانه (۲۰ نوامبر ۲۰۲۶):** [سالن صبحانه فعال و صبحانه رایگان مهمانان](OWNER-DECISION-BREAKFAST-2026-11-20.md). این تصمیم بر وضعیت تاریخی «در دست آماده‌سازی» مقدم است.

آخرین به‌روزرسانی مدخل جاری: ۲۰۲۶-۱۱-۱۰

**نقطه شروع جاری:** [Master یکپارچه دامون](DAMOON-ORG-MASTER.md)، سپس [ماتریس فاز اول](PHASE1-2026-11-10.md). نسخه اصلی ۱٫۱ و پاسخ‌های خام خارج Git محفوظ‌اند؛ این نسخه پالایش‌شده مجوز انتشار خودکار همه اطلاعات نیست.

**تصمیم‌های عمومی جدیدتر:** [تصمیم مالک در ۲۰۲۶-۱۱-۱۷](OWNER-DECISION-OVERRIDE-2026-11-17.md) بر هر متن متعارض در اسناد تاریخی اولویت دارد.

متن زیر سابقه تحویل اکتبر است؛ توضیح ورک‌تری‌ها، آخرین انتشار و اولویت‌های آن snapshot جاری محسوب نمی‌شود. اکنون یک checkout و شاخه توسعه دامون داریم؛ چهار محور جدید مالک مقدم‌اند.

این پوشه مرجع جاری تصمیم‌های محصول و اجرای سایت اختصاصی `damoon-hotel.ir` است. اسناد قدیمی H1 تا F5 سوابق معماری و شواهد همان مراحل‌اند؛ عبارت‌های «شروع نشده» یا «blocked» در آن‌ها لزوماً وضعیت فعلی نیستند.

- [خلاصه تاریخی چت‌ها؛ نه اصل مکالمه یا مجوز انتشار](DAMOON-CHAT-KNOWLEDGE-HANDOFF.md)
- [وضعیت و تصمیم‌های تأییدشده](./STATUS-AND-DECISIONS.md)
- [نقشهٔ راه و معیار تحویل](./ROADMAP.md)
- [گزارش اجرای ۲۰۲۶-۱۰-۲۸](./DELIVERY-2026-10-28.md)

## دامنهٔ شروع

ابتدا لندینگ اختصاصی با کد و هویت دامون، سپس صفحات و اتصال سرویس‌ها. سایت‌ساز بازارباز ابزار ساخت ظاهر این سایت نیست. استفادهٔ مجدد از اجزای رابط کاربری و زیرساخت معتبر بازارباز مجاز و مطلوب است. میزبانی هدف RunFlare است؛ Vercel فقط در سوابق تاریخی ذکر می‌شود.

## وضعیت این تحویل مستندات

تحویل اولیهٔ این پوشه صرفاً مستندسازی بود؛ اجرای بعدی، تست‌ها و انتشار در گزارش تاریخ‌دار بالا ثبت شده است. تجمیع کلی ورک‌تری‌های پروژه هنوز کامل نشده است. شروع تمیز به معنی حذف تغییرات قدیمی یا بازنشانی مخزن نیست.

آخرین انتشار: بازطراحی مطابق مرجع روی RunFlare v46؛ گزارش و محدودیت‌ها در [DELIVERY-2026-10-29.md](DELIVERY-2026-10-29.md)، پذیرش عمومی ۲۰۱/۲۰۱ موفق.
