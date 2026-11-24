<!-- BAZARBAAZ_CURRENT_PRODUCTION_TOPOLOGY_20261123: START -->
> **CURRENT PRODUCTION INFRASTRUCTURE — OWNER CONFIRMED, 2026-11-23:** Runflare project `product` (ID `37622`); application service `87432`; **Production PostgreSQL-PostGIS 17.3 `maindb` service `87429` (active, console observed)**. The application's actual database target/binding is still **UNVERIFIED**. **Neon is NOT Production; Render is unrelated.** All authorized remote DB connection URIs must come only from `DB_REMOTE_URI`, fail closed if missing, never log the value; this does not authorize a connection. Static Damoon 3/17/6/3/2 fallback is verified, but dynamic CMS GET returned Nginx HTML HTTP 503 and Production CMS publication remains unaccepted. PR140, Production writes/migrations, booking/payment and unapproved feature changes remain ON HOLD. Current reference: `docs/BAZARBAAZ-PRODUCTION-TOPOLOGY-2026-11-23.md`. Historical Neon documents are not current operational authority.
<!-- BAZARBAAZ_CURRENT_PRODUCTION_TOPOLOGY_20261123: END -->

# Damoon | نقشه راه اجرایی قطعی با گیت‌های پذیرش

**تصمیم:** سرعت بالا با PRهای کوچک، CI الزام‌آور، انتشار خودکار قابل ردیابی و توقف فقط روی شکست واقعی/داده حساس/تعارض مالک. آخرین main `9379d82761bea87c20b86be1a96da9dcb9bd7428`; اولویت تحویل اول = **سایت عمومی معتبر + هماهنگی اقامت قابل استفاده توسط پذیرش**؛ تحویل دوم = رزرو قطعی/پرداخت.

## اولویت و جریان موازی

```text
M0 پذیرش تعاملی PR145 (v124) ──> M1 تکمیل تجربه مهمان تا پذیرش ──> M4 آمادگی بهره‌برداری سایت عمومی
                                           ↘ M5 فعال‌سازی محتوا/SEO پس از تأیید واقعیت‌ها
M2 ممیزی داده و رسانه ──────────────────────┘
M3 آماده‌سازی عملیاتی رزرو/دیتابیس (شاخه مستقل، بدون Production) ──> M6 رزرو قطعی مجاز
```

| فاز | هدف و خروجی مشخص | پیش‌نیاز | معیار خروج (DoD) | مالک اجرایی |
|---|---|---|---|---|
| **M0 — پذیرش تعاملی تکمیل (read-only)** | PR145 روی v124 فعال؛ live CSS/JS hashes برابر main؛ مسیر CTA→درخواست در Production مرور شد | Git SHA `89e80a6...` و v124 (۱/۱)؛ provider source SHA در dashboard موجود نبود | FA/EN/AR × شش عرض، حفظ category/stay، reload/locale، theme، noindex، request-only، چهار VTour، health و routing tenants؛ no Production POST | B / Release |
| **M1 — زنجیره کامل هماهنگی** | CTA اتاق→انتخاب تاریخ/افراد→Draft→ارسال ایمن→رسید→پیگیری وضعیت→مشاهده توسط پذیرش | M0 فقط برای ادعای Live؛ اجرای CI مستقل مجاز | پوشش Playwright موبایل/دسکتاپ و ۳ زبان، `POST/status` واقعی روی PG disposable، رد tenant خارجی، idempotency در خطای شبکه، Rate-limit، محرمانگی، دسترسی‌پذیری، تست نقش پذیرش و بستن loop؛ Production smoke بدون PII | B؛ A reviewer |
| **M2 — محتوا و واقعیت هتل** | Fact-sheet دسته اتاق، تماس، صبحانه، عکس، ترجمه و گالری آماده صاحب‌نظر | PR148 کاتالوگ و CMS را پیاده و CI با disposable PostgreSQL پذیرفته؛ manifest زنده hash-match است؛ Runflare version و interactive CMS acceptance pending | baseline مالک ۳/۱۷/۶/۳/۲ و گردش draft→review→approve→publish→public read در CI پذیرفته؛ پس از احراز version، read-only browser acceptance؛ category photos نیازمند association/approval معتبر | مدیر هتل + B |
| **M3 — مسیر مستقل رزرو عملیاتی** | بازبینی PR140، ظرفیت شبانه/تعمیرات، schema ledger و داده اتاق واقعی | فقط محیط isolated/staging با DB و role مشخص | race tests در quote/hold/assignment، بازیابی backup، lineage کامل و نقش RO/TLS، سیاست نرخ و کنسلی مصوب؛ هیچ تغییر Production قبل از GO صریح | A کد، C دیتابیس |
| **M4 — نسخه عمومی هماهنگی** | پذیرش واقعی سناریوها توسط مدیر پذیرش و پشتیبانی | M1 + حداقل اطلاعات تماس/حریم خصوصی تأییدشده | مدیر هتل مسیر درخواست را عملی تست و تحویل بگیرد؛ برای Production POST واقعی فقط اجازه داده‌ای محدود و راه حذف/مدیریت آن؛ لاگ‌های بدون PII؛ راهنمای پذیرش | B + مدیریت |
| **M5 — انتشار محتوایی و SEO** | جایگزینی عکس مفهومی با عکس تأییدشده، ترجمه نهایی، canonical/schema/sitemap/Index | M2 + M4 + تصویب عمومی‌سازی | تایید صفحه‌به‌صفحه سه‌زبانه، Asset حقوقی/مکانی، Lighthouse/Accessibility، crawler تست، noindex فقط با تصمیم صریح رفع شود | B + مالک محتوا |
| **M6 — رزرو قطعی + پرداخت** | موجودی، تعرفه، سیاست، Hold، تایید رزرو، PSP، لغو، حساب کاربری اختیاری | M3 GO + داده معتبر + تست پرداخت و بازگشت مالی | E2E full با رقابت و replay، audit، reconciliation، لغو، policy، isolate، rollout مرحله‌ای و امکان rollback ایمن | A/C + مالک عملیات |

## اجرای فشرده پیشنهادی

- **بسته ۱ (کامل):** M0 روی Runflare v124 با مرورگر Live/GET-only و hashهای CSS/JS تطبیق‌یافته تکمیل شد؛ Release Register را ببین. هیچ Deployment جدیدی برای PR145 لازم نیست.
- **بسته ۲:** رفع شکاف‌های واقعی M1 (نه بازنویسی کامل flow)، یک PR محدود، CI+PG disposable+ مرورگر، merge تحت مجوز دائمی اصلاحات کم‌ریسک و استقرار تاییدشده.
- **بسته ۳ (پیشرفت):** PR148 merged و CI/CMS disposable-PG passed؛ live manifest asset hashes اکنون با main `9379d82761...` منطبق‌اند. آخرین portal snapshot همچنان `Request Initialized` و v126 را نشان می‌داد و health revision تهی است، پس Runflare version/active source هنوز تأیید نشده. قدم بعدی تعیین provider version و read-only browser acceptance؛ از deployment موازی پرهیز شود تا صف روشن شود. عکس‌های M2 مستقل‌اند؛ برچسب Concept و noindex پابرجا.
- **بسته ۴:** ممیزی مجدد C از دیتابیس با access امن و مالکیت درست، و رفع PR140 با Review و تست؛ هیچ وابستگی متقابل غیرضروری با سایت عمومی ایجاد نشود.
- **بسته ۵:** در صورت آماده‌شدن M3/محتوا، مسیر M6 به‌صورت canary و با قرارداد مالی واقعی انجام شود.

## اصول غیرقابل مصالحه و سرعت‌محور

1. PRهای کوچک، تک‌مسئله، ساخت asset public دقیقاً از `sites/damoon` و تطبیق manifest.
2. برای اصلاح frontend بدون Migration و بدون تغییر Feature Gate، **مجوز ایستاده مالک** برای ادغام پس از Required CI و بررسی SHA برقرار است؛ نیاز به تایید تکراری نیست. تغییر داده/Schema/پرداخت/حریم خصوصی/فعال‌سازی رزرو خارج این مجوز است.
3. PR140 و Production migrations بنا به دستور جاری **ON HOLD**؛ تا دستور جدید ادغام/اجرا نشوند. A می‌تواند فقط Review/آماده‌سازی isolated انجام دهد.
4. هیچ آزمایش POST مهمان روی Production بدون برنامه داده‌ای و مجوز آن؛ از PG disposable با synthetic fixture استفاده کن.
5. انتشار فقط با `DEPL_SHA_VERIFIED` و آزمون عمومی، نه با Git merge/CI/HTTP200. به‌روزرسانی Runflare نسبت به GitHub ممکن است تأخیر داشته باشد.
6. بدون worktree جدید، reset/clean روی checkout مشترک، یا Docker بی‌دلیل؛ قرارداد `AGENTS.md` و `docs/handoffs/SINGLE-MAIN-2026-10-29.md` مقدم است.
7. دامون باید با tenantهای Aka Shoes، Fastfood13 و Bazarbaaz مشترک ایزوله باشد؛ هر انتشار smoke همه را بپوشاند.

## تعاریف پایان فازها

- `CODE_COMPLETE`: کد/تست و source SHA ثبت.
- `CI_ACCEPTED`: jobهای مورد نیاز روی همان HEAD موفق‌اند.
- `MERGED`: `main` SHA ثبت.
- `DEPLOYMENT_STARTED`: provider request با SHA یا نسخه مرتبط.
- `ACTIVE_SOURCE_VERIFIED`: provider source SHA و active pod اثبات شده، یا هش فایل‌های immutable عمومی با source برابر است.
- `PRODUCTION_SMOKE_ACCEPTED`: مرورگر واقعی روی hostname+role هدف؛ بدون خطای JS و regressions.
- `OWNER_CONTENT_APPROVED`: مجوز داده/رسانه/کپی متمایز از CI.
- `OPERATIONAL_DATA_APPROVED`: مجوز جداگانه برای عملیات داده؛ هرگز از مجوز merge استنباط نشود.

## معیار اولویت‌بندی Backlog

اول بازگشت Guest/Revenue/Reception و خطای P0، سپس UX موبایل و انتشار صحیح، سپس محتوای واقعی، سپس سئو و قابلیت‌های پیشرفته. موضوعاتی که منتظر صاحب عکس، VIP-02 یا تور سالن غذاخوری‌اند مسیر M1 را مسدود نکنند. اعداد زمان/درصد پیشرفت ساختگی ارائه نشود؛ وضعیت با Gate و Evidence سنجیده شود.

## الحاقیه ۲۰۲۶-۱۱-۲۴ — مرکز رزرواسیون

- **هدف تحویل:** یک dashboard قابل استفاده برای مدیر و STAFF مجاز، با ناوبری مستقیم، manual reservation موجود، سرچ و فیلتر وضعیت/نوع، پنل جزئیات، ورود/خروج امروز و occupancy calendar هفت‌روزه با جابه‌جایی تاریخ.
- **وضعیت کد:** پیاده‌سازی نهایی `54d899a62e790b52ba3cca592f95e53d6d95082f`; TypeScript، ESLint بدون هشدار و ۵ تست واحد محلی پاس شده‌اند. PR و hosted acceptance هنوز pending است.
- **قرارداد دسترسی:** mutationها از همان سرویس/تراکنش قبلی استفاده می‌کنند. `GET .../reservations?view=center` فهرست مجاز پذیرش را مستقل از gate عمومی می‌خواند؛ `GET /api/organizations/{id}/hotels/{propertyId}/occupancy` فقط board را برمی‌گرداند و عضویت/tenant/property را دوباره بررسی می‌کند؛ خروجی تعمیرات نامعلوم را به VACANT تبدیل نمی‌کند. schema change ندارد.
- **دروازه‌های ادامه:** GitHub CI باید PostgreSQL/browser acceptance روی disposable fixtures برای manager و reception، tenant isolation، jalali labels، سه locale و mobile layout را بگذراند. Production data/migration, public booking, inventory activation و payments خارج از این milestone هستند.
