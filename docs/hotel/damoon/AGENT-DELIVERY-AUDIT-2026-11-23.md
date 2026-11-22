# Damoon | ممیزی مستقل عملکرد Agentها و کیفیت تحویل

**مرجع:** درخت GitHub، اسناد تحویل، صفحات PR 95/97/136/140–145، کد `sites/damoon`، Workflowها و تطبیق Release Manifest عمومی. **عمق ممیزی:** source/contract/process و evidence؛ نه اجرای کامل تست‌ها روی Windows checkout و نه دسترسی کامل به Log/Production DB.

## Agent B — توسعه عمومی و Release

**نقاط قوت اثبات‌شده**

- تحویل PR136، PR141، PR142، PR143، PR144 و PR145 با محدوده‌های نسبتاً مستقل و Tests مربوط: حقایق عمومی/asset build، Route Host، حفظ Draft/Retry، Media review خصوصی، گالری موبایل، CTA دسته اتاق.
- PR141 با HEAD `8c563a...` اجازه داد `hotel-reservations/start` روی Host دامون وارد standalone shell شود؛ بعد از استقرار v120، تست سه‌زبانه خطای 404/React #441 را برطرف نشان داد.
- PR142 با head `7b2bd...` persistence، idempotency و recovery را در آزمون disposable PostgreSQL و مرورگر تقویت کرد؛ هش live booking.js در v121 با source برابری داشت.
- PR143 داده تصویری را private نگه داشت و به‌جای ادعای عکس واقعی، تنها WebP responsive review را افزود. PR144 با تست ۶ viewport و سه‌زبان گالری را بهتر کرد. PR145 در source ادغام شده و فایل‌های CSS/JS آن روی v124 منطبق‌اند؛ Live Browser acceptance جدید باقی است.
- تست‌ها نسبت به Runtime پایدار نوشته شده‌اند: فیلتر Host، مجوز API، خروجی manifest، browser acceptance واقعی با DB disposable؛ Hostهای دیگر در smoke بررسی شده‌اند.
- اجرای مرز عدم دست‌زدن به Migration، Public booking و داده Production مطابق گزارش‌های کنونی رعایت شده است.

**ضعف‌های فرایندی و اصلاح الزامی**

1. گزارش‌های merge گاه قبل از رسیدن نسخه به Runflare ارائه شدند. PR141، PR142، PR144 و PR145 نشان داده‌اند **Auto-pull/event با تأخیر** رخ می‌دهد. از این به بعد «منتشر شد» فقط پس از active source/hash و smoke مجاز است.
2. Server Health دارای `revision:null` است؛ به‌تنهایی اثبات نمی‌کند کدام commit نصب است. Future P1: افزودن provenance غیرمحرمانه build/commit به Health فقط با اصلاح کوچک و test؛ تا آن زمان manifest+provider log کافی است.
3. برای درخواست اقامت، CI واقعی POST و tracking را در محیط ephemeral انجام داده، اما تست نقش Reception در Production و استفادهٔ رسمی مدیر هنوز بسته نشده؛ تحویل عملیاتی کامل ادعا نشود.
4. اسناد `ROADMAP.md`, `STATUS-AND-DECISIONS.md`, `COMPLETION-CHECKLIST` عقب‌تر از PRهای آخر هستند. این Overlay مرجع جدید می‌دهد؛ پس از PR بعدی ثبت آخرین snapshot در یک نقطه واحد لازم است.
5. متن `content.js` در دسته‌بندی واحدهای هتل با شمار ۲۰ اتاق/۱۱ سوئیت نیازمند تطبیق است. تست تعداد جمع کل کافی نیست؛ طبقه‌بندی واقعی و حق انتشار هم بررسی شود.

**حکم:** `STRONG_ENGINEERING_DELIVERY / OPERATIONAL_AND_DOC_GATES_OPEN`. محصول سریع جلو رفته؛ نیازی به ساخت مجدد بخش‌های پذیرفته‌شده نیست.

## Agent A — موتور رزرو، ظرفیت و عملیات هتل

- PR140 (head `e86d99e...`) برای محاسبه تعمیرات زمان‌مند در ظرفیت واقعی `availability/quote/holds`, رد conflict های maintenance و حفظ محاسبات tenant طراحی شده؛ ۱۱ فایل از سرویس و تست‌ها را تغییر می‌دهد و Migration تازه ندارد.
- مواجهه با Oversell بالقوه مهم است و نباید در مسیر رزرو واقعی بدون پذیرش race حذف شود؛ حتی با گذر CI محلی، وجود PR باز به‌معنای Production protection نیست.
- فصل `COMPLETION-CHECKLIST` بعضی امکانات مدیریت اتاق/تعمیرات/پذیرش دستی را در کد پیاده‌شده گزارش می‌کند اما **تکمیل کامل ورود دستی بدون نرخ و ویرایش پس از ثبت را صریحاً ادعا نمی‌کند**.
- گزارش PR140 مبنا را به main قدیمی (`5bbd332...`) متصل کرده؛ هنگام شروع مجدد Review، rebase/merge conflict و CI روی HEAD تازه لازم است، نه ادغام کورکورانه.

**حکم:** `CODE_PROGRESS_VALID / OPEN_PR_NOT_PRODUCTION`; با دستور مالک PR140 فعلاً ON HOLD.

## Agent C — Production DB، Schema و Migration

- تصمیم NO-GO بر اساس نداشتن شناسایی معتبر endpoint، TLS/CA و هویت read-only اختصاصی درست بود. اتصال SQL بدون مدرکِ دامنه/Role، یا استفاده از user صاحب امتیاز، شواهد release محسوب نمی‌شود.
- اسناد ۱۷/۱۹ نوامبر ناهماهنگی Ledger و rehearsalهای PG disposable را جدا نشان می‌دهند: ۲۷ checksum divergence، ۴ rollback، ۱۳ ordering inversion و ۵ Migration منتظر. **هیچ‌کدام با `api/health?deep=1` رفع نمی‌شوند.**
- استقرارهای Frontend PR141–145 شواهد Migration نیستند؛ Agent C باید ابتدا read-only audit و backup/restore rehearsal معتبر را در محیط مجاز آماده کند.

**حکم:** `CORRECTLY_BLOCKED_PRODUCTION_MIGRATION`; توقف تغییر Production صحیح، اما می‌توان آماده‌سازی غیروابسته به مجوز را با Plan قابل اجرا انجام داد.

## شیوه هماهنگی اصلاح‌شده

| مسئول | مالکیت | نباید انجام دهد | سند پذیرش |
|---|---|---|---|
| B | `sites/damoon`, `public/damoon-front`, Frontend/public QA, deploy & post-deploy | رفع PR140 یا Migration، تغییر Flags | این سند + Runflare evidence |
| A | Hotel backend capacity/recep­tion, independent review | merge PR140 بدون آزادشدن Hold، تغییر Host سایت دامون هم‌زمان با B | isolated PG race acceptance |
| C | DB/Schema/ledger/recovery | Production SQL write، تغییر role/credential، استنتاج readiness از health | exact RO/CA/backup lineage evidence |
| مالک/مدیر هتل | صحت داده/رسانه/لوگو، قوانین/ساعت‌ها، فعال‌سازی عمومی | واگذاری حقایق به Agent/مدل زبانی | owner decision receipt |

**بازخورد به Agentها:** سرعت را با PR کوچک و مدرک SHA بالا ببرند، نه با حذف Gateهای داده‌ای یا بازنویسی اسناد تاریخی. فقط مواردی را به مالک ارجاع دهند که واقعاً تصمیم تجاری، حقوق رسانه یا داده Production می‌خواهد.
