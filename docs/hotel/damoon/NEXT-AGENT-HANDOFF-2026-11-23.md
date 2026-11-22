# Damoon | هَندآف اجرایی Agentها (نسخه فشرده و قابل کپی)

## اصول حاکم

Repo: `QComputer/shadcn-rtl`; baseline `main=89e80a6e55b69c1e938674a344d60f46ed327913`; **قبل از هر اقدام git status / origin/main refresh**. سرعت بالا اما بدون آمیختن success CI و Production. یک Checkout مشترک مطابق `AGENTS.md`؛ بدون Worktree جدید و بدون حذف کار Agent دیگر. Runflare انتشار خودکار main، پس هر Merge اثر Production دارد.

## Agent B — Release Owner و Frontend

1. PR145 ادغام‌شده و در Runflare v124 فعال است؛ هر دو hash CSS/JS با `main` برابرند. Deploy دیگری شروع نکن.
2. **M0 تکمیل شده است**؛ پذیرش خواندنی در FA/EN/AR و شش viewport انجام شد: کارت اتاق→درخواست، room/stay parameters، reload/locale، light/dark، noindex، request-only، چهار VTour، health، و Bazarbaaz/Akashoes/Fastfood13. هیچ Production POST انجام نشد. نتایج کامل در `evidence/RELEASE-REGISTER-2026-11-23.json` است.
3. اکنون M1 را در PR کوچک ادامه بده: guest selection/room category/CTA→request→tracking→authorized reception. فقط ایراد واقعی و test gap؛ flow موجود PR142 را از نو نساز. اجرای `damoon-booking-acceptance.yml` روی PostgreSQL disposable، role/tenant denial و Production بدون POST.
4. تصمیم جدید مالک در `OWNER-DECISION-ACCOMMODATION-BASELINE-2026-11-23.md` را اعمال کن: پنج دسته ۳/۱۷/۶/۳/۲، جمع ۲۰ اتاق و ۱۱ سوئیت. کد در حال تغییر M2 را با این تصمیم هماهنگ کن، مسیرهای قدیمی/CTA/URL و تست‌ها را حفظ کن و سپس بر قابلیت ویرایش/انتشار داشبورد تمرکز کن؛ هیچ ثبت فیزیکی/عملیاتی Production انجام نده.
5. اسناد `CURRENT-STATE` و Release receipt را پس از انتشار واقعی به‌روز کن؛ M2 media QA را بدون انتظار برای تور VIP-02 آماده کن.
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
