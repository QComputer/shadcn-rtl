## PMS Professional 1C-F — reception waitlist (proposed; CI pending)
- Reported PR181 squash `5d63e480f6aedbca8c1aa642330caae4310f03d8`, four reported successful runs 45838494379, 45838494242, 45838494426, 45838494233; local authored blobs match 10/10. Direct GitHub refresh unavailable at authoring; verify exact PR head, main SHA, and CI before applying. Do not reconstruct a SHA from a short hash.
- Staff-only property-scoped waitlist: one requested room, dates and party, Iranian mobile contact, bounded status pages, idempotent intake, versioned contact/requeue/cancel/expire, explicit confirmed reservation reference matching date/type/party (no automatic identity matching). Completion is a historical reference, not a live reservation status or guarantee. No hold, reservation, price, payment, capacity mutation or automated notification. Contact number is stored for staff manual callback, private/no-store, not copied to audit records. No automatic expiration, availability alerts or conversion. Default-off `HOTEL_RECEPTION_WAITLIST_ENABLED` plus existing manual-room gate; only disposable HTTP test enables it. Additive migration `20261126180000_hotel_reception_waitlist` requires owner-authorized production release; do not merge if deployment auto-migrates production without permission.
- Next: final PMS Professional acceptance and consolidated production-readiness evidence; STOP before Housekeeping for owner-defined intervening phase. Playbook v1.1 canonical `docs/handoffs/KILO-OVERLAY-PLAYBOOK.md` and exact local checks.

## PMS Professional 1C-E — atomic manual group reservations (proposed; CI pending)
- Accepted base: PR180 squash `46a30dc0d6c92f49294f8146b5f4ab99a73cc940`, head `b0012e45bf449584bc80f8d2b356ef02d2b67232`; four hosted workflows independently confirmed successful (45830423460, 45830423736, 45830423451, 45830423424). Prisma validation/generation and disposable migration step succeeded. Production application of guest-profile migration is not verified or authorized by this package. Vercel preview blocked under the existing exception.
- E: 2–8 distinct physical rooms with shared dates, independent room/rate/guest details; one serializable transaction reuses manual pricing, inventory and reservation creation. Unpaid reservations only; stable lock order, scoped idempotent receipt, recent 25 groups and exact group-reference lookup with current member status. Group receipt is stored in the existing durable HotelInventoryIdempotency record under its own operation scope, not a new mutable group model; preserve these records. No schema change or production writes.
- No group-wide amendment, cancellation, check-in/out, combined quote or settlement; use existing per-reservation workflows. No automated contact, discount, group-wide payment or allocation outside the existing manual reception contract. Remaining: waitlist and final PMS acceptance; STOP before Housekeeping for owner-defined intervening phase.

## PMS Professional 1C-D2 — individual guest profiles (proposed in functional PR)
- Accepted base: PR179 squash `de8e2e2f0605cdc7fd794679ff969054c8b3dff9`, head `1f2a55b1aa2550c05a59530c355cdb626d1b51bf`; four hosted CI workflows independently confirmed successful. Vercel Preview blocked under existing exception; deployment SHA not verified.
- D2: property-scoped individual dossiers separate from booking contacts/accounts; explicit manager-confirmed create/link/unlink and versioned rename, staff read-only, paged list and linked stays, audit identifiers without copying names or phone hashes, original guest snapshots unchanged. No automatic name/phone/account matching, profile merge, CRM account mutation or cross-property identity.
- Additive migration `20261126170000_hotel_guest_profiles`: disposable CI only. Production migration requires explicit owner authorization and verified backup/restore path. Existing reception/directory remains independent of the new tables until profile endpoint is used. No production writes, real payments or SMS.
- Remaining after acceptance: group reservations, waitlist, PMS final acceptance; STOP before Housekeeping for the owner-directed intervening phase. No Housekeeping implementation.

## PMS Professional 1C-D1 — property-wide reception directory (proposed; CI pending)
- Accepted baseline: PR178 squash merge `eca6b80721113d9e73b460164fdd860f2d58b3c0`; head `0316f4ffc20f3e4faa066ceb0bf2def38dee5b85`; all four hosted gates verified (45809441111, 45809441082, 45809441342, 45809440895); Vercel preview blocked, live deployment unverified. UTF-8 repair verified on merged main.
- D1 adds read-only server-side search of all reservations in the selected property, literal normalized guest/companion/reference/room search, exact hashed phone search, bounded pages of 25 and related-stay projection via existing customer linkage or shared primary contact. Neither shared account nor contact is proof of individual identity; no name-only linking. No schema change, no payment or inventory mutation. Existing recent-reservation list/filters and actions remain unchanged.
- Remaining: persistent editable guest identity dossier (explicit linking), group reservations, waitlist, final PMS acceptance, mandatory owner diversion gate before Housekeeping. Do not claim full guest identity resolution or complete audit history.

## PMS Professional 1C-C — reception lifecycle (proposed; CI pending)
- Base main `5e1819c9746e125aeab28b22fb35aade5b19e1ca`: PR176 merged, three PR-head gates successful and manually dispatched request-to-reception on merged main successful ([run 45729895850](https://github.com/QComputer/shadcn-rtl/actions/runs/45729895850)). Vercel Preview suspended; live Runflare not verified.
- 1C-C: property-local arrival window and early-arrival acknowledgement; late arrival inside the booked dates; block arrival/move to a room still occupied by a checked-in guest (including overdue). Actual timestamps, localized FA/EN/AR controls and existing idempotency audit. Early checkout of unpaid manual stays may shorten via versioned amount preview and atomic checkout, retaining today's night. Explicit retain-all departure records physical checkout without financial or inventory changes; finance reconciliation remains deferred. No same-day inventory release or automatic late charges. CI trigger includes all hotel-operations components.
- Remaining: global search, durable guest dossier, grouped reservations, waitlist, PMS acceptance, then mandatory owner diversion gate before any Housekeeping. No migration, production mutation, real payment or SMS.

> **۱C-B — تقویم پذیرش (پیشنهاد اجرایی، در انتظار CI):** PR175 با merge `54dcbfc82de5f6548dfb6bb0572015474c864e06` و چهار گیت اجرایی موفق ادغام شد. انتخابگر تک‌تاریخ شمسی در ثبت رزرو پذیرش، تغییر اقامت و تاریخ شروع تقویم اشغال، با موتور مشترک جلالی، تاریخ ISO، و کنترل حدود تاریخ؛ ورودی میلادی نیز حفظ شده است. بازه ۳۱روزه همچنان بازه متحرک است، نه نمای ماه واقعی. ورود/خروج زودهنگام و قواعد مالی/ظرفیت، جست‌وجوی سراسری، پرونده مستقل مهمان، رزرو گروهی و لیست انتظار باز هستند. هیچ Migration یا فعال‌سازی عملیاتی واقعی در این بسته انجام نمی‌شود. توقف مالک پیش از Housekeeping برقرار است.

## PMS Professional 1C-A — پیشنهاد اجرایی (در انتظار CI)
- مبنا: dabe8b52d9a81e3ad05de6b26ed75e78d5ddce04؛ PR174 ادغام‌شده و چهار گیت روی head تأیید شده‌اند.
- محدوده: عدم مراجعه دستیِ پرداخت‌نشده پس از روز ورود محلی، آزادسازی اتمیک همه شب‌های رزرو و حفظ نرخ/مبالغ و تاریخچه؛ نمایش مهمانان همان رزرو و رخدادهای پذیرش از ۲۰۰ رکورد اخیر، جست‌وجوی همراهان و کد اتاق در لیست بارگذاری‌شده.
- بدون Migration، پرداخت واقعی، فعال‌سازی Feature Flag یا تغییر داده تولید. سه آزمون واحد خالص در محیط تولید بسته پاس شده؛ پذیرش کامل TypeScript/CI و Runflare هنوز تأیید نشده.
- باقیمانده PMS: ورود/خروج زودهنگام، انتخابگر کامل شمسی، پرونده مستقل مهمان، جست‌وجوی سراسری، گروه و انتظار؛ بعد از تکمیل PMS توقف الزامی مالک.

## به‌روزرسانی PMS Professional 1B — ۲۰۲۶-۱۱-۲۶

- مبنا: main 0e34f38b5a658920fe64e1f882999130cd00a697؛ PR173 با merge c9d6ea2ca98bc4d2b47e74cb2fe4a75e05d5d241 و هر چهار گیت اجرایی موفق، طبق GitHub API مستقل. SHA دقیق استقرار 1A هنوز مشاهده نشده است.
- بسته 1B (ادغام شده): پیش‌نمایش/تأیید تغییر تاریخ رزرو دستی پرداخت‌نشده، تمدید و کوتاه‌کردن با حفظ نرخ شب‌های مشترک، همگام‌سازی شب‌ها/موجودی/hold/مبلغ، انتقال شب جاری و آینده مهمان مقیم به اتاق هم‌نوع، FA/EN/AR، ثبت رخداد در idempotency موجود. PR #174 ادغام شده: merge `3ec5967e102e840bfb84eb1afeb5d1d57b6fe63a` (head `b689070e5f686fe9f6c3a1bf330d3c64842a61da`). گیت‌های CI: RunFlare TypeScript موفق، focused-regressions موفق، hotel-phase1-operational-pg موفق، request-to-reception موفق. Vercel Preview معلق است (استثنا suspended-preview). بدون Migration و پرداخت واقعی.
- باقی‌مانده: تست واقعی محیط نمایش، تکمیل چرخه پذیرش/خروج زودهنگام/عدم مراجعه، 1C (گروه، پرونده، جست‌وجو، انتظار و تاریخچه)، تسویه تغییر رزرو پرداخت‌دار در فاز مالی.
- **تصمیم قطعی مالک:** قبل از Housekeeping توقف کنید؛ فاز انحرافی با دستور مالک تعریف خواهد شد. پس از تکمیل PMS Professional بدون مجوز مالک هیچ توسعه Housekeeping آغاز نشود.

# وضعیت جاری دامون — ۲۰۲۶-۱۱-۲۶

**مرجع ادامه:** [نقشه راه جاری](ROADMAP.md). نقطه شروع این بسته main/PR172 merge = 935b26b1e48ca3f31b49fc42409d693979d04cb4 (GitHub API مشاهده‌شده). شواهد قبلی و تصمیم‌های تاریخی زیر حفظ شده‌اند، اما وضعیت اجرایی فعلی بر این بخش تکیه دارد.

- PR160–172: موتور رزرو نمایشی، پذیرش/مدیریت نرخ و امکانات، تقویم، آماده‌سازی کاتالوگ و Hotfix null-safe. PR171 و PR172 در main ادغام شدند؛ چهار گیت اجرایی CI PR172 موفق گزارش و مستقل از metadata GitHub تأیید شدند. Vercel Preview معلق است و تنها در صورت مجاز بودن قواعد مخزن استثنای قبلی معتبر است.
- محیط واقعی: دامون نمایش آزمایشی جداگانه است، نه فعال‌سازی رزرو واقعی. org cmvbltspu0000jt08zfn7xltj؛ demo property cmwugpopd0007kj0j7q25vrsy؛ operational property cmvbltsrc0009jt08k3o8jdip بدون مجوز فعال نشود. Runflare project 37622/app 87432/PG service 87429؛ Neon Production نیست. نسخه و SHA دقیق pod فعال هنوز از provider تأیید نشده‌اند؛ از رفتار مشاهده‌شده نتیجه محدود بگیرید.
- ۳۱ اتاق فیزیکی و پنج دسته (۳/۱۷/۶/۳/۲)، نرخ ساختگی ۱۲۵۰۰۰ تومان، ظرفیت شبانه، و حفظ رزروهای قبلی از پنل مدیر مشاهده شدند. هشدار تعمیرات قبلی بعد از Migration در مرکز رزرو برطرف شد.
- Migration 20261122110000_hotel_room_maintenance_blocks: مالک اجرای همان Migration را مجاز کرد. Kilo گزارش داد اتصال Runflare PG، ۱۳۰ Migration، یک معلق، اجرای prisma migrate deploy موفق، سپس migrate status: Database schema is up to date. این گزارش اجرایی است؛ وضعیت پشتیبان/Restore کامل جمع‌آوری نشد. خود UI مرکز رزرواسیون پس از اجرا فعال شدن فرم و تقویم را نشان داد. هیچ Migration دیگری در این بسته لازم نیست.
- پذیرش واقعی نمایش: رزرو حضوری HD-E6F42A57-8CB، ۲۷–۲۸ نوامبر ۲۰۲۶، DEMO_DOUBLE-001، ۱۲۵۰۰۰ تومان، پرداخت واقعی صفر. کد رزرو و تخصیص در UI مدیر مستقیماً مشاهده شد. بعد از Refresh تقویم ۲۷ نوامبر را رزروشده و روز خروج را خالی نشان داد. رزروهای قبلی حفظ شدند. تلاش قبلی ناموفق با تاریخ اولیه و پیام کلی؛ پاسخ دقیق API در دسترس نبود، بنابراین علت قطعی خطای تاریخ تأیید نشده است. Check-in/out زنده هنوز آزمایش نشده؛ مانع توسعه نیست.
- P1A (این تغییر، ادغام شده): اشتراک تاریخ محلی پایدار ISO در UI و سرویس، اعتبارسنجی تاریخ قبل از ثبت، کنترل ۱/۷/۳۱ روز و تازه‌سازی scoped تقویم بعد از عملیات/Refresh، پیام خطای FA/EN/AR مبتنی بر allowlist، انتخاب مجدد اتاق فقط هم‌نوع، و حذف برچسب اشتباه پرداخت شبیه‌سازی‌شده موفق برای رزرو دستی پرداخت‌نشده. PR #173 Edغام شده: merge `c9d6ea2ca98bc4d2b47e74cb2fe4a75e05d5d241` (head `d88cbcc70e8f91dffdedcfee882f02f6b9e796cf`). گیت‌های CI: RunFlare TypeScript موفق، focused-regressions موفق، hotel-phase1-operational-pg موفق، request-to-reception موفق. Vercel Preview معلق است (استثنا suspended-preview).
- بعدی: P1B عملیات تراکنشی تغییر تاریخ و انتقال اتاق مقیم و تکمیل جریان پذیرش. P1C گروه/پرونده/لیست انتظار. بدون تغییر schema یا فعال کردن پرداخت واقعی در 1A.

قانون مالک: سرعت اولویت اصلی؛ هر PR کاربردی مستندات موجود را به‌روز کند. ایجنت جدید از README، ROADMAP، STATUS-AND-DECISIONS و AGENTS شروع کند. از ساخت گزارش‌ها و PRهای تکراری پرهیز شود؛ امنیت مستاجر، اطلاعات واقعی و پرداخت حفظ شوند.

<!-- DAMOON_CURRENT_REFERENCE_2026_11_23 -->
> **مرجع وضعیت اجرایی دامون — ۲۰۲۶-۱۱-۲۳:** این سند شامل شواهد تاریخی و تصمیم‌های معتبر زمان نگارش خود است. برای آخرین وضعیت Git/Runflare، وضعیت PR145، اختلاف واقعیت‌های اتاق، آخرین نقشه راه و گیت‌های انتشار به [مرجع جاری](./CURRENT-STATE-2026-11-23.md) و [نقشه راه اجرایی](./EXECUTION-ROADMAP-2026-11-23.md) رجوع کنید. تصمیم‌های مالک و گیت‌های امنیتی قدیمی با این ارجاع حذف یا لغو نشده‌اند.

# وضعیت و تصمیم‌های دامون

> یادداشت تاریخی: تصمیم‌های عمومی جدیدتر در [OWNER-DECISION-OVERRIDE-2026-11-17.md](OWNER-DECISION-OVERRIDE-2026-11-17.md) جایگزین هر بند متعارض این snapshot هستند؛ به‌ویژه ادعاهای رستوران و کافی‌شاپ.

آخرین به‌روزرسانی: ۲۰۲۶-۱۰-۲۸. مبنا: درخواست‌های مستقیم صاحب پروژه، پرسشنامه، تصاویر بازنویسی و ممیزی کد.

## تصمیم‌های قطعی محصول

- مقصد عمومی: `https://damoon-hotel.ir`؛ لندینگ باید اولین خروجی قابل مشاهده روی این دامنه باشد.
- ظاهر اختصاصی در کد؛ مستقل از قالب‌سازی و سایت‌ساز پروژه.
- فارسی و RTL در اولویت، طراحی مناسب موبایل؛ مسیر توسعه برای انگلیسی و عربی حفظ شود.
- لوگوی فعلی حفظ شود. مرجع تصویری ارسالی مبنای چیدمان است، نه سند صحت تصاویر یا متن داخل تصویر.
- تم روشن: سفید/کرم گرم، هدر سفید یا بی‌رنگ، نارنجی هرمسی برای اقدامات اصلی، سبز روشن و زنده به‌جای یشمی. تم تاریک: قهوه‌ای چوبی. کد دقیق رنگ‌ها در اجرای بصری تثبیت شود.
- شخصیت برند: گرم، صمیمی و آرام؛ تأکید بر موقعیت مکانی و مهمان‌نوازی، بدون اغراق.
- رستوران هتل آماده است و از نسخهٔ اول معرفی می‌شود. این تأیید مستقیم کاربر، برداشت قبلی از پرسشنامه مبنی بر آینده‌بودن رستوران را اصلاح می‌کند.
- کافی‌شاپ لوکس در حال تکمیل است؛ در سایت با همین وضعیت معرفی شود، بدون تاریخ افتتاح یا خدمات اختراعی.
- هتل سرویس VTour دارد؛ اتصال آن به فرانت‌اند سایت هنوز اثبات نشده است. وجود سرویس با آماده‌بودن اتصال کد یکی نیست.
- نسخهٔ نهایی مطلوب شامل رزرو مستقیم و پرداخت است؛ آماده‌بودن عملیات رزرو از وجود فرم تقویم استنباط نشود.

## آنچه در کد موجود است

مبنای ممیزی `origin/main` در SHA `c03176f2d884bc167e8544b98a941d1d633325b4` است؛ پیش از اجرا دوباره بررسی شود.

| بخش | وضعیت و حد ادعا |
| --- | --- |
| اجزای تقویم، مهمان و گالری | موجود با شواهد تست تاریخی؛ برای ظاهر جدید باید ارزیابی و آزموده شوند |
| رندر عمومی سازمان هتل | مسیر مورد اعتماد سازمان و محتوای منتشرشده در main ادغام شده |
| مدیریت محتوا | پیش‌نویس، بازبینی، انتشار، لغو انتشار و رسانه در کد موجود است |
| F5 | گزارش بعدی LIVE و موفقیت تست محیط آزمایشی، گزارش قدیمی BLOCKED را پشت سر گذاشته؛ دلیل سلامت فعلی Production نیست |
| پیش‌نمایش مفهومی | موجود؛ تصاویر مفهومی و داده‌های synthetic محتوای واقعی عمومی نیستند |
| فرانت اختصاصی مطابق مرجع جدید | لندینگ، صفحات داخلی و سه زبان روی RunFlare v45 فعال؛ D2 عمومی ۱۰۵/۱۰۵ موفق و پذیرش عمومی زبان‌ها ۱۲۷/۱۲۷ موفق |
| VTour | قرارداد نوع بخش موجود؛ پلیر، مقصد و اتصال واقعی در ممیزی پیدا نشد |
| رزرو و پرداخت دامون | زیرساخت بخشی موجود؛ عملیات واقعی دامون و پذیرش نهایی تأیید نشده |

مسیرهای کلیدی در نسخهٔ ممیزی‌شده: `components/damoon-home.tsx`، `components/published-hotel-website-page.tsx`، `lib/hotel/organization-site-public.server.ts`، `app/[locale]/[slug]/page.tsx` و `app/[locale]/dashboard/hotel-website/`.

## ادغام‌های لازم و غیرلازم

- F2 و F5 و اتصال عمومی سازمان، عمدتاً در main موجودند؛ شاخهٔ قدیمی هتل یکجا مرج نشود.
- اتصال ارائهٔ اختصاصی دامون به مسیر و دامنهٔ انتخاب‌شده، رسانه و صفحات سرویس‌ها کار جدید لازم است.
- H4.1 ترکیب پیشنهاد اتاق هنوز جداست؛ اختیاری است و مانع لندینگ نیست.
- مخزن اصلی محلی در بررسی، قدیمی و دارای تغییرات ثبت‌نشده بود. پیش از تغییر شاخه یا انتقال کد، کارهای موجود حفظ و اختلاف با مبنای جاری تعیین شود. کار تجمیع ورک‌تری‌ها ناتمام است؛ ورک‌تری جدید صرفاً برای این شروع ساخته نشود.

## محتوا و منابع

- پرسشنامهٔ محلی: `C:/Users/disso/Downloads/Damoon-Questionnaire-Typed-Updated-2026-10-10.pdf`؛ ۹ صفحه، شامل خوانش‌های نامطمئن و ارقام نیازمند تأیید.
- بازنویسی پاسخ‌ها: `photo_2026-10-27_17-52-56.jpg` و `photo_2026-10-27_17-52-46.jpg` در Downloads؛ سؤال‌های ۱۸–۲۰ و ۲۷ باید همراه PDF تطبیق داده شوند.
- تصویر مرجع فعلی: `C:/Users/disso/AppData/Local/Temp/codex-clipboard-35073af3-9340-4e09-af8f-43e387070498.png`؛ مسیر موقت است و برای اتکا درازمدت باید نسخهٔ پروژه‌ای آن حفظ شود.
- تعداد اتاق/سوئیت، ظرفیت، تاریخچه، شماره‌ها، آدرس دقیق، نرخ‌ها و سیاست‌ها تا رفع اختلاف، دادهٔ عملیاتی قطعی نیستند.
- وجود ورودی مالک به معنی آماده‌بودن همهٔ محتوای عمومی نیست. تصاویر قدیمی یا مفهومی به‌عنوان وضعیت فعلی هتل معرفی نشوند.
- جزئیات بازنویسی‌ها هنوز رونویسی قطعی کامل نیستند؛ برای پرکردن فاصله‌ها حدس زده نشود.

## دامنه و انتشار

### پیشرفت اجرای ۲۰۲۶-۱۰-۲۷

- D0 بررسی شد: مبنای کد `c03176f` در ورک‌تری موجود آکاشوز انتخاب و شاخهٔ `codex/damoon-coded-front` از آن ساخته شد؛ ورک‌تری جدید ایجاد نشد و تغییرات قبلی پوشهٔ اصلی حفظ شدند.
- فرانت مستقل بدون وابستگی جدید در `sites/damoon` شروع شده است. میزبانی مستقل ترجیح اولیه بود، اما درخواست ساخت سرویس `damoon-front` با خطای سقف دو سرویس پلن رد شد؛ سرویس تازه‌ای ساخته نشد و پلن ارتقا نیافت.
- تصمیم اجرای فعلی: بستهٔ استاتیک `/damoon-front` روی سرویس موجود بازارباز، با مسیریابی عمومی محدود به Host واقعی دامون؛ API، ورود، داشبورد و میزبان‌های دیگر از مسیر قبلی استفاده می‌کنند. این ظاهر با سایت‌ساز تولید نمی‌شود.
- دامنه در RunFlare پروژهٔ `36927`، رکورد `85480`، به سرویس `85798` و پورت ثبت‌شدهٔ `99717` متصل است؛ DNS connected، SSL Free. درخواست HTTPS روت به www و سپس مسیر قدیمی `/fa/damoon-hotel` ریدایرکت می‌شد. این مشاهده وضعیت قبل از انتشار جدید است.
- اولین تست مرورگر ۱۴ مسیر و تصاویر، تم تیره و گالری را پاس کرد؛ یک ایراد بازگرداندن فوکوس منوی موبایل پیدا و اصلاح شد. پذیرش نهایی پس از تغییرات بصری و بازآزمایی ثبت می‌شود.
- دو مرجع جدید دسکتاپ و موبایل در پوشهٔ `references/` حفظ شده‌اند؛ جزئیات چیدمان آن‌ها بر طرح عمومی اولیه اولویت دارد. پالت قابل توسعه و حالت روشن/تاریک از هم جدا هستند.
- تصاویر فعلی سایت مفهومی‌اند و با همین عنوان نمایش داده می‌شوند. هیچ خروجی آمادهٔ پلیر VTour یا لوگوی اصلی مستقل در بررسی محدود پیدا نشد؛ سرویس VTour طبق تأیید کاربر وجود دارد.
- تست کامل محلی فرانت: ۶۸ بررسی مرورگر، PASSED و exitCode=0؛ ۱۴ مسیر و aliasهای /fa، شش ترکیب پالت/حالت، ذخیره و reload، تقویم، مهمان، منو، گالری و overflow. فایل شواهد بیرون از بستهٔ سایت در `Documents/Codex/2026-10-27/damoon-browser/result.json` حفظ شده است. ایراد فوکوس منو رفع شد؛ ترتیب تصویر موبایل نیز بازبینی متمرکز دارد.
- شمارهٔ عمومی پذیرش `+98 38 3226 1988` در Waze و اعلان عمومی استخدام هتل همخوان بود؛ نشانی خیابان دوازده محرم شمالی/میدان بسیج در منابع عمومی و Master Data همخوان بود و برای تماس/مسیریابی وارد شد. این تطبیق منابع است، نه تماس آزمایشی یا تأیید دوبارهٔ مالک. جزئیات ورود ۱۴/خروج ۱۲ و امکانات منتخب از پرسشنامه گرفته شد.
- مرجع برگشت انتشار: RunFlare v40، image `609725`، مبنای `c03176f`. قبل از جایگزینی دوباره بررسی شود. درخواست ساخت سرویس اضافی نتیجهٔ موفق نداشت؛ هزینهٔ پلن ارتقا داده نشد.

در بررسی ۲۰۲۶-۱۰-۲۷، A دامنه `178.239.147.37` بود؛ ابزار وب نتوانست صفحه را باز کند. این مشاهده به‌تنهایی مقصد سرویس، TLS، وضعیت www یا سلامت سایت را اثبات نمی‌کند. اتصال دامنه، سرویس RunFlare، مسیر میزبان و گواهی باید جدا تأیید شوند. اطلاعات دسترسی در اسناد یا Git ثبت نشود.

## اجرای جاری ۲۰۲۶-۱۰-۲۸

- D2: متن صفحات خدمات و جزئیات اقامت تکمیل؛ مرورگر محلی ۴۳/۴۳ موفق. PR #39 با main `11c55c08ef426d5f7ea4f707729171c338ef7cea` ادغام شده؛ v44 image612265 فعال شد؛ پذیرش عمومی تازه ۱۰۵/۱۰۵ با exitCode=0 و cleanup=PASSED پاس شد.
- انتخاب زبان و متن انگلیسی/عربی با ۱۱۳/۱۱۳ بررسی محلی آماده و در PR #40 ادغام شد؛ v45 image612360 فعال است، پذیرش عمومی ۱۲۷/۱۲۷ با exitCode=0 موفق است.
- فعال‌سازی رزرو واقعی، تعیین نرخ و موجودی یا انتشار عکس واقعی از این مرحله استنباط نمی‌شود.

## بازطراحی ۲۰۲۶-۱۰-۲۹

ظاهر v45 توسط صاحب پروژه رد و D1 بصری بازگشایی شد. بازسازی PR #41 روی RunFlare v46، image613731 فعال است؛ ۱۸۱ بررسی محلی و ۲۰۱ بررسی عمومی موفق‌اند. گزارش `DELIVERY-2026-10-29.md` مرجع جدید این انتشار است. تأیید بصری صاحب پروژه از تست عملکرد استنباط نمی‌شود.
