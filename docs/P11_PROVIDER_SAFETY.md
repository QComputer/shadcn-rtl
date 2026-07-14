# Provider Safety

## BB-B2B-P11-FIX1 source acceptance

- `VERCEL_API_TOKEN` is the preferred server-only token variable.
- `VERCEL_ACCESS_TOKEN` is only a legacy fallback and must not be exposed to clients.
- Real provider mutation is disabled by default.
- Real provider mutation requires both `CUSTOM_DOMAIN_REAL_MUTATION_ENABLED=true` and exact `CUSTOM_DOMAIN_REAL_MUTATION_ACK=ENABLE_VERCEL_DOMAIN_MUTATIONS`.
- Provider-disabled mode returns a 403 before any Vercel call.
- Dry-run mode is explicit and must not be treated as real activation.
- Raw provider payloads are not returned to the dashboard.
- Provider error messages are sanitized so bearer tokens, authorization values, token fields, and API key fields are redacted.
- No real Vercel add/check/remove operation was authorized or performed during P11-FIX1.

## حفاظت‌های اعمال شده برای Vercel (P11)

- **غیرفعال به طور پیش‌فرض**: در محیط‌های توسعه و سیستمی، تمام فراخوانی‌های سرویس‌دهنده فقط `DRY_RUN` هستند.
- **گیت صریح**: برای فعال‌سازی واقعی تغییرات (`add / check / remove`)، متغیر `CUSTOM_DOMAIN_REAL_MUTATION_ENABLED=true` باید در سطح محیط تنظیم شود.
- **عدم افشای توکن**: توکن `VERCEL_ACCESS_TOKEN` از پاسخ‌ها و لاگ‌های مرورگر حذف شده و فقط در مسیر سرور خوانده می‌شود.
- **ثبت От audit**: هر فراخوانی سرویس‌دهنده در لاگ‌های ممیزی ثبت می‌شود.

## محدودیت‌های اجرایی
- اختصاص یا حذف دامنه‌های واقعی تولید بدون مجوز صریح خودکار انجام نمی‌شود.
- در صورت فعال نبودن گیت، API با خطای ۴۰۳ پاسخ می‌دهد و هیچ درخواستی به Vercel ارسال نمی‌شود.

## بازیابی
در صورت نیاز به خام‌سازی فوری، مقدار `CUSTOM_DOMAIN_REAL_MUTATION_ENABLED` را به `false` تغییر دهید.
