# Migration Note

## BB-B2B-P11-FIX1 review status

- Migration path: `prisma/migrations/20260708000100_custom_domain_onboarding/migration.sql`.
- Source migration added: yes.
- Production migration required: yes.
- Production migration applied in P11-FIX1: no.
- `DROP TABLE` found: no.
- Destructive column removal found: no.
- Unrelated schema mutation found: no.
- Existing rows are handled by status mapping from `PENDING` to `REQUESTED` and `FAILED` to `ERROR`.
- Enum additions are guarded with `IF NOT EXISTS`.
- New lifecycle/provider columns are additive.

## مهاجرت `20260708000100_custom_domain_onboarding`

### هدف
اضافه کردن فیلدهای P11 به جدول `OrganizationDomain` و انوم‌های مرتبط بدون از بین رفتن داده‌های موجود.

### مدیریت
این مهاجرت:
- مقادیر قدیمی `PENDING` را به `REQUESTED` تبدیل می‌کند.
- مقادیر قدیمی `FAILED` را به `ERROR` تبدیل می‌کند.
- ستون‌های جدید (`kind`, `provider`, `providerVerified`, ...) را با مقدار پیش‌فرض اضافه می‌کند.

### بازگشت به عقب (Rollback)
در صورت نیاز به بازگشت به مهاجرت قبلی:
۱. یک نسخه پشتیبان از دیتابیس بگیرید.
۲. انوم‌های اضافه شده را حذف کنید.
۳. ستون‌های اضافه شده را حذف کنید.
۴. داده‌های قدیمی `REQUESTED` / `ERROR` را دوباره به `PENDING` / `FAILED` تبدیل کنید.

توجه: این کار فقط با دسترسی ادمین دیتابیس انجام می‌شود و الزاماً باید قبل از آن پشتیبان‌گیری صورت گیرد.
