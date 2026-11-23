<!-- BAZARBAAZ_CURRENT_PRODUCTION_TOPOLOGY_20261123: START -->
> **CURRENT PRODUCTION INFRASTRUCTURE — OWNER CONFIRMED, 2026-11-23:** Runflare project `product` (ID `37622`); application service `87432`; **Production PostgreSQL-PostGIS 17.3 `maindb` service `87429` (active, console observed)**. The application's actual database target/binding is still **UNVERIFIED**. **Neon is NOT Production; Render is unrelated.** All authorized remote DB connection URIs must come only from `DB_REMOTE_URI`, fail closed if missing, never log the value; this does not authorize a connection. Static Damoon 3/17/6/3/2 fallback is verified, but dynamic CMS GET returned Nginx HTML HTTP 503 and Production CMS publication remains unaccepted. PR140, Production writes/migrations, booking/payment and unapproved feature changes remain ON HOLD. Current reference: `docs/BAZARBAAZ-PRODUCTION-TOPOLOGY-2026-11-23.md`. Historical Neon documents are not current operational authority.
<!-- BAZARBAAZ_CURRENT_PRODUCTION_TOPOLOGY_20261123: END -->

# Damoon | هَندآف اجرایی Agentها (نسخه فشرده و قابل کپی)

## اصول حاکم

Repo: `QComputer/shadcn-rtl`; latest main recorded `aa38b8c0a6a13de4b40cfe8b60ca7904be8349f7` (PR149, documentation-only; no new runtime behavior). **قبل از هر اقدام git status / origin/main refresh**. سرعت بالا اما بدون آمیختن success CI و Production. یک Checkout مشترک مطابق `AGENTS.md`؛ بدون Worktree جدید و بدون حذف کار Agent دیگر. Runflare انتشار خودکار main، پس هر Merge اثر Production دارد.

## Agent B — Release Owner و Frontend

1. PR145 ادغام‌شده و در Runflare v124 فعال است؛ هر دو hash CSS/JS با `main` برابرند. Deploy دیگری شروع نکن.
2. **M0 تکمیل شده است**؛ پذیرش خواندنی در FA/EN/AR و شش viewport انجام شد: کارت اتاق→درخواست، room/stay parameters، reload/locale، light/dark، noindex، request-only، چهار VTour، health، و Bazarbaaz/Akashoes/Fastfood13. هیچ Production POST انجام نشد. نتایج کامل در `evidence/RELEASE-REGISTER-2026-11-23.json` است.
3. M1 API/browser پذیرش ایزوله با PostgreSQL موقت در PR147/PR148 موفق است؛ صفحات public static fallback در Production نیز به‌صورت read-only پذیرفته شده‌اند. **Dynamic CMS API/read/edit/publish در Production پذیرفته نشده:** GET endpoint پاسخ HTML 503 از Nginx داد. به R09 privacy review و پذیرش عملیاتی مدیر/پذیرش ادامه بده. Production فقط GET/HEAD؛ هیچ درخواست مهمان واقعی نساز.
4. PR148 مالک baseline ۳/۱۷/۶/۳/۲ و CMS کاتالوگ قابل ویرایش/انتشار را پیاده و روی disposable PostgreSQL قبول کرده؛ merge `9379d82761bea87c20b86be1a96da9dcb9bd7428`. PR149 با main `aa38b8c0a6a13de4b40cfe8b60ca7904be8349f7` مستندات-only بود. آخرین شواهد provider: Runflare v128، deployment Completed و فعال با ۱/۱ Pod سالم؛ deployment log SHA انتخاب‌شدهٔ `aa38b8c0a6a13de4b40cfe8b60ca7904be8349f7` را نشان می‌دهد، اما **SHA سورس Pod فعال را اثبات نمی‌کند**. v127 و `Request Initialized` فقط در اسناد/تاریخچهٔ قدیمی‌ترند و وضعیت جاری نیستند. صفحات static fallback PR148 در FA/EN/AR و viewportهای headless 360/390 بدون overflow تأیید شدند؛ CMS endpoint در GET، HTML 503 از Nginx داد، بنابراین dynamic CMS read/edit/publish در Production تأیید نشده است. Deploy موازی نساز؛ فقط تحت گیت‌های release بعدی ادامه بده.
5. عکس‌های دسته همچنان به room-type/media association تأییدشده و provenance/حقوق مالک نیاز دارند؛ noindex و برچسب Concept را حفظ کن. PR145 six-viewport browser acceptance را تاریخی و جدا از PR148 live asset/CMS evidence نگه دار.
6. PRهای مستقل frontend با Required CI موفق و بدون Migration/فعال‌سازی رزرو، تحت standing approval مالک قابل ادغام هستند. در SHA drift یا اثر ناخواسته توقف تشخیصی و اصلاح در همان PR.

## Agent A — بک‌اند و Review

- PR140 فعلاً ON HOLD؛ merge/deploy نکن. بررسی و آماده‌سازی isolated برای ظرفیت تعمیرات، type-level quota، race و row lock و reconciliation برنامه مجاز است.
- از کد `HotelProperty`, `HotelRoomType`, `HotelRoom`, rates, inventory, receptions و CLI موجود استفاده کن؛ گردش جدید موازی داده/Booking نساز.
- M1 را فقط در role/tenant isolation/reception logic به‌صورت read-only review کمک کن؛ به فایل‌های مالکیت B دست نزن. برای آینده M3، preflight گیت داده را به C واگذار کن.

## Agent C — دیتابیس/Infra

- Production migrations ON HOLD. هیچ SQL write، role/grant change، backup operation یا credential inspection غیرمجاز اجرا نکن.
- با دستور Read-only و Role/TLS/endpoint معتبر (در صورت فراهم‌شدن)، فقط ledger/schema identity و ۵ migration absent و ۲۷ checksum قدیمی را به‌روز کن. راهکار Restore/Rehearsal ایزوله ارائه بده.
- پیگیری Runflare GitHub App delay با B هماهنگ باشد؛ Agent C فقط شواهد غیرمحرمانه و route/Network تشخیص دهد؛ محیط را بی‌مجوز تغییر نده.

## معیار گزارش هر Agent

`{feature, sourceSha, prHead, mergeSha, requiredChecks, deploymentVersion, deployedSourceProof, liveSmoke, prodDbWrites, unresolvedDependencies}`. وضعیت‌های متمایز را بر اساس `RUNFLARE-RELEASE-AND-EVIDENCE` اعلام کنید.

## دستور قطعی فاز

**M0** پذیرش تعاملی PR145 روی v124؛ **M1** درخواست تا پذیرش/پیگیری؛ **M2** تایید واقعیت‌های اتاق و عکس‌ها؛ **M3** آماده‌سازی ایزوله رزرو/DB؛ **M4** تحویل عمومی هماهنگی؛ **M5** رسانه/سئو؛ **M6** رزرو/پرداخت با مجوز مستقل. موارد M2/VTour تا زمان ورودی مالک نباید جلوی M1 را بگیرند.
