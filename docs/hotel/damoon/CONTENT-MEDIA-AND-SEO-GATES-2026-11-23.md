# Damoon | راهنمای کنترل حقیقت، رسانه و انتشار عمومی/SEO

## اصل بنیادی

استودیو و تصاویر مفهومی هنوز راه‌حل موقت نمایشی‌اند، نه تصاویر واقعی هتل. Runflare می‌تواند سایت `noindex` را منتشر کند ولی انتشار در موتور جست‌وجو (رفع noindex) نیازمند تایید جداگانه محتوا، حقوق رسانه و اطلاعات تماس است.

## مسیر عکس و لوگو از دریافت تا نمایش

1. ورودی از صاحب حق: فایل اصلی عکس/نشان، نام فضا، زمان عکاسی، عکاس/مالک، نوع حق استفاده در دامنه هتل، عدم حضور اطلاعات/اشخاص نامجاز، SHA256، تأیید مسئول هتل.
2. فایل خام فقط در مسیر خصوصی مورد کنترل مالک خارج Git نگهداری شود. **عکس اصلی دارای EXIF/IPTC/XMP را مستقیماً به `/public` یا PR عمومی وارد نکنید**؛ داده GPS/دستگاه/چهره را بررسی کنید.
3. مسیر موجود `sites/damoon/prepare-media.mjs` روی `media-slots.json` با `sharp` نسخه‌های responsive WebP (عرض 320/640/960/1280/1920، بدون بزرگ‌نمایی) تولید می‌کند و نتیجه را صرفاً در review bundle خصوصی قرار می‌دهد. `PREPARED_NOT_PUBLISHED` به‌معنای تایید نیست.
4. بسته Review باید مورد عکس و Caption/alt در FA/EN/AR را به فضا/صفحه/اسلات متصل کند. سرپرست هتل «اصالت، ظاهر فعلی، حقوق، عنوان و مناسب‌بودن» را ثبت کند؛ مالک فنی مستقل «dimensions, conversion, EXIF, quality, file size» را تأیید کند.
5. در PR انتشار رسانه، فقط جایگزینی تاییدشده و متن وابسته را عوض کنید: `currentAsset/currentKind/approval`, responsive srcset و image alt/caption؛ `noindex` تا تصمیم SEO پابرجا.
6. `node sites/damoon/build.mjs --shared-runtime --sync-public-direct` و آزمون تطبیق public bundle اجرا شود؛ هش SHA فایل‌های منتشرشده در manifest و live برابر گردد.
7. اگر تصویر جدیدی لازم نیست یا تصویری پیدا نشد، برچسب «تصویر مفهومی» را حذف نکنید؛ از stock به‌جای واقعیت هتل استفاده نکنید.

## ورودی‌های اصلی فعلاً ناتمام

| اسلات‌ها | وضعیت منبع | شرط انتشار |
|---|---|---|
| `logo` | نشان متنی/موقت | فایل لوگوی اصل هندسی تاییدشده، SVG/PNG و دارایی favicon/PWA مستقل |
| `hero`, `architecture`, `lobby` | Concept | عکس واقعی مطابق فضای فعلی + مجوز + alt |
| `single`, `double`, `suite`, `gallery` | Concept | نگاشت صحیح اتاق/دسته و عکس با تایید توصیف فیزیکی؛ عدد ظرفیت فرضی ممنوع |
| `restaurant` | Concept | فقط معرفی سالن صبحانه/پذیرایی صحیح؛ رستوران مستقل نباید القا شود |
| `cafe` | Concept | تنها پذیرایی در اتاق، نه سالن کافه مستقل |

## VTour

- فقط چهار تور `VIP-01`, `VIP-3`, `Lobby`, `303` در کاتالوگ تاییدشده `sites/damoon/virtual-tour.js` هستند.
- VIP-02 هنوز 404؛ لینک نشرشده نباید ساخته شود تا پانوراما معتبر و تایید گردد.
- `/t/restaurant` در سرویس Andarama وجود دارد اما هنوز هویت مکان و عنوان مناسب تایید نشده؛ با وجود فعال‌بودن سالن صبحانه، نباید اسم تور «رستوران هتل» باشد مگر مدارک معتبر.
- lazy player، خطای شبکه، open-direct fallback، یک viewer فعال و fullscreen در مرورگر و موبایل باید حفظ شوند.

## محتوای متن سه‌زبانه

- همه آمار اتاق/سوئیت، check-in/out، شرایط صبحانه، تماس و نشانی از fact-sheet صاحب‌نظر تغذیه شود؛ اختلاف `20/11` و `7/17/7` باید حل شود.
- ترجمه نباید قطعیت بیشتر از متن فارسی القا کند. برای `restaurant`, `cafe`, `breakfast hall`, `suite`, `room` واژگان استاندارد متناسب با تصمیم ۱۷/۲۰ نوامبر استفاده شود.
- قانون لغو/قیمت/متراژ/تعداد تخت/امکانات تخصصی بدون تایید منتشر نشود.

## معیار آمادگی Index و سئو

- مدیریت هتل متن نهایی، تماس و قوانین، عکس‌ها، alt و سه زبان را تأیید کرده باشد.
- canonical برای `https://damoon-hotel.ir` و نسخه‌های زبان درست باشد؛ دامنه معکوس `hotel-damoon.ir` بدون اثبات مالکیت و مقصد به canonical افزوده نشود.
- `robots.txt`, `noindex`, `sitemap`, hreflang و JSON-LD مبتنی بر حقایق واقعی یک‌جا تست شوند. رفع noindex یک تصمیم انتشار محتواست، نه نتیجه خودکار merge PR.
- favicon/نام/manifest/PWA با هویت دامون و cache-origin مستقل از بازارباز/آکاشوز؛ نصب PWA اختصاصی بخشی از آینده است نه مانع M1.
- نمایش نقشه هتل فعلاً pin تقریبی/تأییدنشده است؛ مسافت‌های جاذبه‌ها هوایی و تقریبی، نه جاده‌ای. `ATTRACTIONS-LOCATION-VERIFICATION-2026-11-17.md` مرجع است.

## تحویل قابل ممیزی

برای هر فایل: `slot`, `ownerApprovalRef`, `rights`, `sha256Original`, `sha256Published`, `metadataReviewed`, `alt.fa/en/ar`, `firstPublishedSha`, `liveHashVerified`. بدون این داده‌ها وضعیت `PENDING` محفوظ بماند.

## OWNER_ACCOMMODATION_AMENDMENT_20261123 — Current owner-selected category baseline

The implementation now targets **3 single rooms, 17 double rooms, 6 three-person suites, 3 four-person suites and 2 five-person suites**, aggregate **20 rooms + 11 suites = 31 units**. This is the owner-selected editable **product default**, not certified physical capacity. Dashboard/website category edits must follow existing tenant-scoped publication/revision rules, preserve slugs/CTAs and remain separate from operational room inventory. Refer to `OWNER-DECISION-ACCOMMODATION-BASELINE-2026-11-23.md` and `ACCOMMODATION-ADMIN-AND-CONTENT-CONTRACT-2026-11-23.md`. No Production writes, migration, PR140 merge or booking activation are authorized.
