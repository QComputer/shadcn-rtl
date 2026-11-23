# Damoon | مرجع وضعیت جاری فنی و محصول

**وضعیت:** `CURRENT_SNAPSHOT`؛ **زمان برش:** ۲۰۲۶-۱۱-۲۳؛ **مخزن:** `QComputer/shadcn-rtl`؛ **آخرین GitHub main مشاهده‌شده:** `9379d82761bea87c20b86be1a96da9dcb9bd7428` (merge PR148؛ Runflare v127 فعال با ۱/۱ Pod؛ آخرین deployment log commit main `9379d82761bea87c20b86be1a96da9dcb9bd7428` را نام می‌برد، اما commit فعال Pod مستقیماً در provider expose نمی‌شود).

> این سند برای ناوبریِ وضعیت جاری بر `ROADMAP.md` با برش اکتبر ۲۰۲۶ و `STATUS-AND-DECISIONS.md` با برش ۲۸ اکتبر مقدم است؛ تصمیم‌های دارای منشأ مالک و گیت‌های امنیتی/داده‌ای قدیمی را لغو نمی‌کند. برچسب «در کد»، «تست محلی/CI»، «ادغام» و «Production تأییدشده» معنای متفاوت دارند.

## ۱. وضعیت Release

| موضوع | Git/CI | Production / آخرین مشاهده | جمع‌بندی |
|---|---|---|---|
| سایت مستقل دامون روی `damoon-hotel.ir` | پیاده‌سازی `sites/damoon` و Host allowlist | HTTPS و صفحات اصلی قابل دسترسی؛ noindex فعال | `PUBLIC_SITE_ACTIVE_PRE_INDEX` |
| PR136، محتوای دامون/فایل‌های عمومی | merge `f5e77a34b23901f946efbf5442b879417026a031` | release v119 پیش از اصلاح بعدی | `SUPERSEDED_BY_NEW_RELEASE` |
| PR141، اصلاح `/hotel-reservations/start` | merge `44e6e862301c4b2620c7561c4810241a88ef4115` | v120 تأیید شده | `PRODUCTION_VERIFIED` |
| PR142، مدیریت تلاش مجدد/پایداری Draft | merge `e0c75802cb5aa442c5a0ea3b7b965e76e968ab5b` | v121، هش `booking.js` تطبیق شده | `PRODUCTION_VERIFIED` |
| PR143، ابزار رسانه خصوصی | merge `1901797d71de67bf094f47d900f0f2fd8f33e370` | v122 طبق گزارش Agent B | `PRODUCTION_VERIFIED`؛ صرفاً ابزار بررسی؛ عکس عمومی جدید ندارد |
| PR144، گالری فشرده موبایل | merge `01bd9b6fbb79f93a634849b0e64c63f866aebe82` | v123 فعال طبق گزارش B؛ هش live CSS با source منطبق | `PRODUCTION_VERIFIED` |
| PR145، CTA اختصاصی دسته اتاق→هماهنگی | merge `89e80a6e55b69c1e938674a344d60f46ed327913` | v124 فعال (۱/۱)؛ CSS و JS زنده مطابق `main`؛ پذیرش خواندنی Production تکمیل | **`LIVE_ACCEPTANCE_PASSED_READ_ONLY`** |
| PR146، overlay نقشه راه و شواهد | merge `4090a726f29360a4db4a3dc3249d76eb2aa0f572` | تغییر مستندات/ابزار docs؛ provider هنوز v124، هیچ deployment تازه در فهرست Runflare نبود | `MERGED_DOCS_ONLY_NO_RUNTIME_CHANGE` |
| PR147، تست وضعیت درخواست هماهنگی و اسناد پذیرش ایزوله | merge `f617e007812613a57724264d810832a6f3b13158` | CI پذیرش API/browser با PostgreSQL موقت موفق؛ بدون تغییر runtime | `MERGED_ISOLATED_ACCEPTANCE_ONLY` |
| PR148، کاتالوگ اقامت قابل ویرایش و انتشار CMS | head `65f010bfdd58b3697d6edcb46c47170484d46e0b`; merge `9379d82761bea87c20b86be1a96da9dcb9bd7428` | CI و پذیرش CMS روی PostgreSQL موقت موفق؛ Runflare v127 فعال و log آخرین deployment SHA main را نام می‌برد (commit فعال Pod مستقیماً نمایش داده نمی‌شود)؛ صفحات public از static fallback در FA/EN/AR نمایش یافتند؛ GET مسیر CMS روی دامنه به HTML 503 از Nginx رسید؛ Production CMS read/edit/publish اثبات نشده | `MERGED_CI_ACCEPTED_LIVE_PUBLIC_READ_ACCEPTED_CMS_WRITE_NOT_PRODUCTION_TESTED` |
| تصمیم مالک، baseline پنج‌دسته اقامت | تصمیم صریح مالک ۲۰۲۶-۱۱-۲۳ | مقادیر ۳/۱۷/۶/۳/۲ در صفحات fallback زنده FA/EN/AR دیده شد؛ CMS draft/review/publish فقط در disposable PostgreSQL پذیرفته شده؛ مسیر public CMS روی دامنه HTML 503 داد، بنابراین dynamic public read/edit/publish در Production پذیرفته نشده | `OWNER_BASELINE_PUBLIC_READ_ACCEPTED_CMS_WRITE_DISPOSABLE_ONLY` |
| PR140، ظرفیت شبانه در روزهای تعمیرات | head `e86d99e37e9ba0c9ac799c4dd3083d9775b7249f`، open | نصب نشده | `ON_HOLD`; نگهداری مستقل |

**برهان Release و پذیرش زنده (۲۰۲۶-۱۱-۲۳):** داشبورد Runflare، سرویس `87432` را روی `v124` با یک Pod فعال نشان داد. manifest زنده `accommodation.css` برابر `788e851522eb9ababfd29c5dc56514ff27387cbb3db7863116a03ee1a0393963` و `accommodation.js` برابر `28bdecc388aee1509058b73711463034485967b805793329c151951953763b74` است؛ هر دو با کد اجرایی PR145 در main هنگام ادغام (`89e80a6e55b69c1e938674a344d60f46ed327913`) برابرند. PR146 و PR147 اسناد/تست را تغییر دادند و runtime عوض نکردند؛ v124 مربوط به پذیرش PR145 است و provider منبع Git را نشان نمی‌دهد. Health revision همچنان `null` است. پذیرش مرورگر زنده فقط GET انجام داد: CTA از صفحهٔ گروه اقامتی به فرم هماهنگی رفت، گروه و پارامترهای تاریخ/مهمان حفظ شدند، تغییر زبان و reload آن‌ها را نگه داشتند، و فرم/پیگیری و متن «رزرو قطعی نیست» قابل مشاهده بودند. هیچ فرم Production ارسال نشد.

**مشاهدهٔ تاریخی Runflare پیش از PR148 (superseded by v127):** داشبورد نشان می‌دهد v126 فعال با ۱/۱ Pod سالم است. اتصال Git به `QComputer/shadcn-rtl`، شاخه `main`، برقرار و سوییچ اتصال خودکار روشن است؛ آخرین commit قابل مشاهده `f617e0078126` است. تاریخچه در عین حال یک ردیف حل‌نشدهٔ `Request Initialized` برای انتخاب commit قدیمی `4090a726f29360a4db4a3dc3249d76eb2aa0f572` دارد؛ وضعیت و اثر استقرار آن روشن نیست، پس PR148 merge نشد و هیچ deployment تازه‌ای آغاز نشد. Health پایه و عمیق Bazarbaaz/Damoon HTTP 200 و `status: ok` بود؛ deep Damoon اتصال دیتابیس را هم تأیید کرد. صفحات `/fa/rooms`, `/en/rooms`, `/ar/rooms`, `/fa/virtual-tour` همگی HTTP 200 و noindex بودند. manifest زنده و بایت `content.js` هر دو SHA-256 برابر `a9fc9dd0e94806b26a7108cc2a91b301464ffee8f957aadf1d61715ac67441a1` دارند؛ بنابراین تغییر محتوای PR148 هنوز در Production نیست. provider منبع دقیق Git فعال را نشان نمی‌دهد.

**ثبت ادغام PR148 و وضعیت پس از آن (۲۰۲۶-۱۱-۲۳):** PR148 با head دقیق `65f010bfdd58b3697d6edcb46c47170484d46e0b` روی main مورد انتظار `f617e007812613a57724264d810832a6f3b13158`، با merge commit/main جدید `9379d82761bea87c20b86be1a96da9dcb9bd7428` ادغام شد. پذیرش workflow CMS روی PostgreSQL موقت با run `45088093245` موفق بود؛ شش check مرتبط GitHub Actions روی همان head موفق بودند: `request-to-reception`، `hotel-phase1-operational-pg`، `RunFlare TypeScript`، `build-public-assets`، `focused-regressions` و `Vercel Preview Comments`. وضعیت Vercel Preview با خطای شناخته‌شدهٔ policy تعلیق preview مسدود است و به‌عنوان شکست منبع/کد منظور نشد؛ CodeRabbit skipped است.

**ثبت hashهای read-only دامنه پس از ادغام PR148 (تکمیل‌شده با پذیرش جدید زیر):** manifest زندهٔ `https://damoon-hotel.ir/damoon-front/release-manifest.json` اکنون دقیقاً با PR148 مطابقت دارد: `accommodation.css=c3e3d4662b729ae0a767f604c0e54268c243138213401a1ba555b51f8778c064`, `accommodation.js=223850efecc9fbd65eb35af473956747b04a46e237198b3e65712a2d72b0bb0e`, `app.js=d29e0273ced081f2f0d5ceb248e50f3607b11d139de6ac6d90ec9cdeb48f9010`, `content.js=727636d03129b83bd40711764dca4c8e70f9db2980829c204b02b4d14fa71c2c`; `translations.js` و `virtual-tour.js` نیز با manifest منبع منطبق‌اند. چهار basic/deep health روی Damoon و Bazarbaaz HTTP 200 با status `ok` بودند؛ deep checks database `{checked:true,ok:true}` را گزارش کردند. مسیرهای FA/EN/AR اتاق و تور و مسیرهای start (بدون locale و FA/EN/AR) GET HTTP 200 و `noindex` داشتند. این ثبت، hashهای public asset را در snapshot پس از ادغام ثابت می‌کند، اما provider version یا UI تعاملی را تأیید نمی‌کرد. این نتیجه با پذیرش تازهٔ زیر تکمیل و supersede شده است؛ هیچ guest/Production write انجام نشد.



**پذیرش read-only کاتالوگ PR148 (۲۰۲۶-۱۱-۲۳):** Runflare سرویس `87432` را روی `v127` با ۱/۱ Pod فعال نشان داد. آخرین GitHub App deployment برابر Completed بود و جزئیات provider عبارت `Reverted To commit 9379d82761bea87c20b86be1a96da9dcb9bd7428` را نشان می‌داد؛ این متن در Runflare نام کنترل انتخاب commit برای deploy است، نه Git revert. اتصال Git همچنان `QComputer/shadcn-rtl/main` و auto-pull روشن است؛ ردیف قدیمی `Request Initialized` در تاریخچه مانده اما build/deploy جاری دیده نشد. Health پایه/عمیق Damoon و Bazarbaaz `status: ok` بود؛ deep health در Damoon `database.checked=true`, `ok=true` بود (revision همچنان null). صفحات اتاق و تور FA/EN/AR همگی HTTP 200 و `noindex,nofollow,noarchive` داشتند. در مرورگر Production، پنج گروه و شمارش ۳، ۱۷، ۶، ۳، ۲ در صفحات fallback ایستا در FA/EN/AR مشاهده شد؛ مفهوم‌بودن تصاویر و پیام request-only دیده شد. GET مسیر `/api/hotel/v1/website/properties/damoon?locale=fa` پاسخ HTML 503 از Nginx داد، نه JSON برنامه؛ دلیل upstream/configuration از این بررسی مشخص نشد، پس dynamic CMS public read در Production تأیید نشده است. CTA اتاق single در FA به فرم هماهنگی رفت و تاریخ‌های ۲۰۲۶-۱۲-۰۱ تا ۲۰۲۶-۱۲-۲۹، ۳ بزرگسال، ۱ کودک با سن ۸ و category حفظ شد؛ تغییر زبان به EN و AR نیز همان پارامترها و متن درخواست را حفظ کرد. هیچ درخواست مهمان یا CMS write ارسال نشد. آزمون headless Production در widthهای 360 و 390 برای FA/EN/AR انجام شد؛ `documentElement.scrollWidth` با viewport برابر بود و هیچ horizontal overflow دیده نشد. هر پنج concept image پس از پیمایش lazy-load و با ابعاد طبیعی 420px بار شدند؛ درخواست API یادشده با 503 ثبت شد. مرورگر in-app نیز navigation را بررسی کرد. **این پذیرش public static fallback PR148 را از پذیرش PR145 جدا می‌کند:** آزمون شش‌عرضی PR145 فقط برای همان پذیرش تاریخی معتبر است؛ این بررسی جدید widthهای 360/390 را برای صفحات fallback تأیید کرد. CMS workflow فقط در run موقت `45088093245` پذیرفته شد؛ dynamic Production CMS read/edit/publish به علت پاسخ 503 تأیید نشده است.

## ۲. آنچه مهمان می‌تواند انجام دهد

- دیدن سایت در فارسی، انگلیسی و عربی؛ تعامل با تقویم جلالی و انتخاب ترکیب مهمان؛ صفحات اتاق و گالری responsive.
- مشاهده و اجرای چهار تور تأییدشده: `https://andarama.bazarbaaz.ir/t/vip-01`, `/t/vip-3`, `/t/lobby`, `/t/303` با بارگذاری تنبل/تمام‌صفحه/لینک مستقیم. VIP-02 برابر 404؛ سالن غذاخوری هنوز به‌عنوان تور منتشر نشده است.
- اجرای فرم **درخواست هماهنگی** (نه رزرو قطعی) و مدیریت Draft/Retry/Tracking در کد. تست‌های POST و پیگیری در CI روی PostgreSQL موقت انجام شده‌اند؛ **در Production درخواست واقعی برای پذیرش عملیاتی ثبت نشده است**. وضعیت کامل «ارسال واقعی مهمان و اقدام پذیرش» `OPERATIONAL_ACCEPTANCE_PENDING` است.
- PR145 مسیر CTA از کارت دسته اقامتی به درخواست را پیاده کرده است؛ در ۳ زبان و ۶ viewport (عرض‌های 360، 390، 640، 768، 1024، 1440) مسیر category CTA→فرم و ماندگاری query روی reload در Production تست شد. تم روشن/تیره با reload حفظ شد، ورودی تماس accessible label و keyboard focus داشت، overflow افقی/خطای JS/network مشاهده نشد. بررسی کاملاً عملیاتی ارسال/پیگیری و اقدام پذیرش در Production عمداً انجام نشد؛ این‌ها نیازمند synthetic disposable DB هستند و درخواست واقعی مهمان ممنوع است.

## ۳. مرزهای فعال

- `sites/damoon/booking-activation.js`: `enabled:false`, `ownerApproval:null`; رزرو/موجودی/hold/quote/پرداخت عمومی روشن نیست. `HOTEL_BOOKING` فعال‌بودن capability در DB به‌معنای فعال‌بودن مسیر عمومی نیست.
- وب‌سایت و مسیرهای هماهنگی عمداً `noindex,nofollow,noarchive` و فایل robots محدودکننده دارند؛ عکس‌های سایت مفهوم‌پردازانه‌اند و به همین عنوان مشخص شده‌اند.
- Host allowlist در `lib/damoon-public-route.ts` فقط GET/HEAD عمومی و فایل‌ها را روی Host دامون rewrite می‌کند؛ API و صفحات مدیریتی نباید به static shell بیفتند. اصلاح PR141 این قرارداد را پوشش داد.
- `api/health?deep=1` اتصال پایه دیتابیس را با `SELECT 1` بررسی می‌کند، نه کامل‌بودن `HotelStayRequest`، Ledger، Role اختصاصی، نرخ‌ها، موجودی یا قابلیت پرداخت.

## ۴. واقعیت‌های محتوایی و تصمیم‌های مرجع

- تصمیم مالک در ۱۷ نوامبر: **۳۱ واحد اقامتی (۲۰ اتاق، ۱۱ سوئیت)**؛ چک‌این ۱۴:۰۰ و چک‌اوت ۱۲:۰۰؛ بدون رستوران فعال، تالار یا کافه مستقل. پذیرایی کافه‌مانند در اتاق.
- تصمیم جدیدتر در ۲۰ نوامبر: **سالن صبحانه فعال و صبحانه رایگان برای مهمان هتل**، ساعت سرو هنوز تأیید نشده. این تصمیم فقط درباره صبحانه بر تصمیم ۱۷ نوامبر مقدم است.
- **تطبیق محتوای M2:** PR148 اعداد متعارض قبلی ۷ VIP / ۱۷ استاندارد / ۷ استودیو را با baseline انتخاب‌شدهٔ مالک جایگزین می‌کند: ۳ تک‌نفره، ۱۷ دونفره، ۶ سوئیت سه‌نفره، ۳ سوئیت چهارنفره و ۲ سوئیت پنج‌نفره؛ جمع ۲۰ اتاق + ۱۱ سوئیت = ۳۱. برچسب تعداد در کاتالوگ عمومی و گردش محتوای CMS پیاده شده و تست شده است؛ مقادیر در static fallback Production به‌صورت read-only دیده شدند؛ dynamic public CMS endpoint در GET HTML 503 داد؛ جریان edit/review/publish فقط در PostgreSQL موقت آزمون شده و در داشبورد Production تغییری داده نشد. این baseline گروه‌بندی محتوایی است، نه موجودی فیزیکی/ظرفیت عملیاتی. داده‌های عملیاتی اتاق دست‌نخورده‌اند.
- لوگوی اصلی و عکاسی امروزی با حق انتشار تأییدشده در مخزن حاضر موجود نیست؛ رجیستری رسانه `OWNER_INPUT_PENDING` است. حضور عکس مفهومی یا تور مجازی حق استفاده از آن به‌عنوان عکاسی هتل ایجاد نمی‌کند.
- شماره/نشانی و ساعت پاسخگویی در کد وجود دارد؛ بخشی از آنها با منابع عمومی/گزارش‌های قبلی تطبیق شده، اما سند قدیمی `D-010` تأیید رسمی همه داده‌ها را باز گذاشته است. در هر انتشار عمومی، fact-sheet فعلی باید از مدیریت امضا شود.

## ۵. وضعیت عملیات و دیتابیس

- کد مدیریت اتاق/نرخ/موجودی، پذیرش و Room board تا حدی وجود دارد و در CIهای isolated آزمون شده، اما داده فیزیکی/نرخ/سیاست معتبر برای استفاده واقعی دامون در Production اثبات نشده است.
- گزارش Read-only مورخ ۱۷ نوامبر از Production برای آن زمان **۰ رکورد عملیاتی اتاق/نرخ/موجودی** و چک‌اوت Property برابر `11:00` ثبت می‌کند؛ اصلاح به `12:00` تأیید مالک دارد ولی اعمال آن اثبات نشده. این **نتیجه تاریخی** است، نه بررسی تازه DB.
- Ledger مورخ ۱۷ نوامبر: ۲۷ checksum متفاوت، ۴ rollback، ۱۳ وارونگی در ترتیب و ۵ migration جدیدِ absent؛ بازخوانی اخیر به دلیل عدم احراز هویت RO/TLS/endpoint قطعی انجام نشد. **Production migration = NO_GO**، صرف موفقیت CI به معنی رفع نیست.
- PR140 اصلاح خطر ظرفیت تعمیرات در Quote/Hold/Availability را پیشنهاد می‌کند، ولی هنوز merge نشده. گیت رزرو عمومی تا حل و آزمون تداخل ظرفیت بسته می‌ماند.

## ۶. منع تعبیرهای نادرست

`MERGED` ≠ `DEPLOYED`; `CI_SUCCESS` ≠ `PRODUCTION_ACCEPTANCE`; `HEALTH_OK` ≠ `SCHEMA_READY`; `HOTEL_BOOKING_CAPABILITY_ACTIVE` ≠ `PUBLIC_BOOKING_ENABLED`; `DRAFT_MANIFEST` ≠ `VALIDATED_HOTEL_ROOM_DATA`; `VTour_AVAILABLE` ≠ `APPROVED_HOTEL_PHOTOGRAPHY`.

## ۷. قدم بعدی دقیق

1. **M0: کامل (read-only):** PR145 روی Runflare v124 فعال و hashهای زندهٔ CSS/JS با main تطبیق دارند؛ CTA، locale، stay selection، mobile/desktop، theme، noindex و VTourها در مرورگر Production بررسی شدند. جزئیات در Release Register است.
2. **M1:** CI ایزولهٔ API/browser با PostgreSQL موقت برای ارسال/پیگیری، نقش پذیرش و جداسازی tenant موفق شد (PR147)؛ R09 بازبینی حریم خصوصی و پذیرش عملیاتی مالک/پذیرش همچنان لازم است. Production صرفاً GET/HEAD.
3. **M2:** PR148 merged، CI/CMS disposable-PG accepted و چهار اصلی live asset hashes با source منطبق‌اند؛ نسخه Runflare فعال از provider تأیید نشده و CMS/room browser acceptance هنوز انجام نشده. قدم بعدی: read-only browser acceptance و نسخه‌ای که provider گزارش می‌کند را ثبت کن؛ از duplicate deployment پرهیز شود تا Runflare state روشن شود. عکس‌های دسته هنوز نیازمند association/media approval؛ fact-sheet تماس/ساعات/سیاست‌ها و عکس‌های مجاز همچنان owner input هستند.
4. **M3:** یک جریان مستقل و آماده رزرو واقعی بر مبنای Schema/Rate/Capacity/Policy معتبر طراحی کنید؛ تا رفع NO_GO دیتابیس/PR140 و تأیید فعال‌سازی، فقط در staging.

پیوندها: [نقشه راه قطعی](EXECUTION-ROADMAP-2026-11-23.md)، [گیت‌های داده](PRODUCTION-BOOKING-AND-DB-GATES-2026-11-23.md)، [ثبت تصمیم‌ها](OWNER-DECISION-DELTA-2026-11-23.md).
