<!-- BAZARBAAZ_CURRENT_PRODUCTION_TOPOLOGY_20261123: START -->
> **CURRENT PRODUCTION INFRASTRUCTURE — OWNER CONFIRMED, 2026-11-23:** Runflare project `product` (ID `37622`); application service `87432`; **Production PostgreSQL-PostGIS 17.3 `maindb` service `87429` (active, console observed)**. The application's actual database target/binding is still **UNVERIFIED**. **Neon is NOT Production; Render is unrelated.** All authorized remote DB connection URIs must come only from `DB_REMOTE_URI`, fail closed if missing, never log the value; this does not authorize a connection. Static Damoon 3/17/6/3/2 fallback is verified, but dynamic CMS GET returned Nginx HTML HTTP 503 and Production CMS publication remains unaccepted. PR140, Production writes/migrations, booking/payment and unapproved feature changes remain ON HOLD. Current reference: `docs/BAZARBAAZ-PRODUCTION-TOPOLOGY-2026-11-23.md`. Historical Neon documents are not current operational authority.
<!-- BAZARBAAZ_CURRENT_PRODUCTION_TOPOLOGY_20261123: END -->

# Damoon | Runflare Release / GitHub App / Manifest Runbook

## تفاوت وضعیت‌ها

`PR_OPEN → CHECKS_PASS → MERGED → RUNFLARE_REQUESTED → BUILDING → ACTIVE_DEPLOYMENT → EXACT_SOURCE_MATCH → PRODUCTION_SMOKE_PASS`.

حتی اگر مرحله `MERGED` انجام شده باشد، «تحویل Production» تا برابری نسخه/هش و تست زنده بسته نمی‌شود. رویداد `Request Initialized` کافی نیست، `Completed` صرفاً event است و نیاز به active Pod و Source receipt دارد.

## مقصدهای شناخته‌شده

- Repo: `QComputer/shadcn-rtl`، branch `main`، Runflare project `37622`، service `87432`.
- صفحه خدمات: `https://portal.runflare.com/project/37622/service/87432`; Git: `/git`; سابقه: `/images`; گزارش: `/deploylog`.
- دامون: `https://damoon-hotel.ir`, بازارباز: `https://bazarbaaz.ir`, آکاشوز: `https://akashoes.ir`. کنترل Fastfood13 در صورت اثرپذیری Host نیز لازم است.
- فایل قابل سنجش: `https://damoon-hotel.ir/damoon-front/release-manifest.json` و Repo `public/damoon-front/release-manifest.json` در commit مورد انتظار.

## رویه نسخه‌سنجی

1. از GitHub API `branches/main` SHA را بگیر؛ آن را قبل از Merge با HEAD بررسی‌شده PR مطابقت بده. اگر Drift غیرمنتظره است، همان کار را بدون ادغام اضافه rebase/Review کن.
2. در Runflare Git Integration تأیید کن Repo/Branch/auto-connection فعال، **هیچ deploy در حال اجرا** نیست و رویداد جدید ثبت شده است.
3. اگر `Request Initialized` یا `BUILDING` وجود دارد، **deploy تکراری آغاز نکن**. در صورت توقف غیرمعمول، با شناسه Event و لاگ/وضعیت به Runflare رجوع کن؛ وضعیت بلاک را مستند کن.
4. پس از Completed، بررسی کن نسخه جدید **واقعاً active** و Pod مربوطه آماده است؛ نسخه قبلی را تا انتقال کامل بدون علت تغییر نده.
5. به‌دلیل `revision:null` در Health، از provider SHA در Log و تطبیق Manifest live (به‌همراه همان Source SHA) استفاده کن. برای تغییرات غیررسانه‌ای، فایل HTML/JS مرتبط را هم به‌صورت content/hash بررسی کن.
6. GETهای واقعی در `fa/en/ar` برای Home، Rooms، Booking-start، Virtual-tour و Host دیگر بررسی شود. **بدون ایجاد درخواست/پرداخت واقعی**. بررسی privacy, noindex, concept labels, CSP, iframe fallback و هیچ React error الزامی است.
7. اگر Source Live با Git برابر نیست، وضعیت `MERGED_DEPLOYMENT_PENDING` بگذار، نه `RELEASE_VERIFIED`.

## پرونده فعلی PR145

- `main`: `89e80a6e55b69c1e938674a344d60f46ed327913`.
- Runflare v124 با ۱ Pod فعال و ثبت نسخه موفق در سابقه استقرار، روی دامنه دیده شد.
- هش فعلی Live `accommodation.css` = `788e851522eb9ababfd29c5dc56514ff27387cbb3db7863116a03ee1a0393963` (PR145).
- هش فعلی Live `accommodation.js` = `28bdecc388aee1509058b73711463034485967b805793329c151951953763b74` (PR145).
- **خروجی:** PR145 به `PRODUCTION_ASSET_VERIFIED_V124` رسیده؛ تست تعاملی مستقیم از کارت اقامت تا فرم در fa/en/ar هنوز باید ثبت شود. نیازی به Deploy یا PR دوباره نیست.

## عیب‌یابی تأخیر اتصال GitHub App

- دیدن repository webhook خالی الزاماً علت خطا نیست؛ اتصال با GitHub App می‌تواند مستقل از repository-level webhook باشد.
- ترتیب بررسی بدون دست‌کاری: History Event → Git commit list → authorized integration scope → زمان event و status → run/build logs → provider support/installation delivery details در صورت دسترسی.
- اگر رویداد قبلی واقعاً failure و دیگر active/pending نیست، تنها Deploy همان SHA با ابزار commit-deploy Runflare پس از شناسایی علت و مجوز ایستاده قابل بررسی است. چیزی را `Revert` نکن که به معنی بازگرداندن کد GitHub باشد؛ commit selector provider معنای متفاوت دارد.
- هرگز secret، token، env vars، HTTP Authorization header یا لاگ خصوصی کاربر را داخل CI/README/چت کپی نکن. اگر web access برای App sudo reauth خواست، بدون مالک تغییر دسترسی نده.

## بازگشت نسخه

- Rollback frontend فقط به آخرین نسخه واقعاً healthy و **بدون تغییر schema** انجام شود؛ rollback code بعد از DB write ممکن است ناسازگار باشد. حفظ reference معتبر آخرین v و SHA لازم است.
- برای failure در دامون، ابتدا Host/site و Gateها را fail-closed نگه دار؛ هیچ عمل پرداخت/رزرو را برای "رفع سریع" روشن نکن.

## شکل Receipt

```json
{
  "pr": 145,
  "approvedHead": "<sha>",
  "mergeSha": "89e80a6e55b69c1e938674a344d60f46ed327913",
  "runflareVersion": "v124",
  "providerSourceCommit": null,
  "deploymentState": "ACTIVE_ASSET_MATCH_BROWSER_PENDING",
  "expectedAssetSha256": "788e851522eb9ababfd29c5dc56514ff27387cbb3db7863116a03ee1a0393963",
  "liveAssetSha256": "788e851522eb9ababfd29c5dc56514ff27387cbb3db7863116a03ee1a0393963",
  "requiredCiPassed": true,
  "liveSmokePassed": false,
  "productionGuestWrite": false
}
```

مقادیر `null`/`false` را فقط بعد از شواهد واقعی تغییر بده؛ گزارش Agent و API binding باید از هم تفکیک شوند.
