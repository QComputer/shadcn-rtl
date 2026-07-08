# Rollback Policy — P11 Tenant Custom-domain Onboarding

## هدف
تضمین بازگشت سریع و امن به نسخه پیش از P11 در صورت بروز مشکل تولید.

## لایه‌های دفاعی
۱. **گیت صریح (Acknowledgment Gate)**: تغییرات واقعی سرویس‌دهنده (Vercel) به طور پیش‌فرض مسدود است.
۲. **Dry-run پیش‌فرض**: حتی با پیکربندی توکن، اگر `CUSTOM_DOMAIN_REAL_MUTATION_ENABLED=false` باشد، هیچ درخواستی ارسال نمی‌شود.
۳. **Legacy validators intact**: ۲۵ اعتبارسنجی قدیمی حفظ شده و جدیدها به آن‌ها اضافه شده است.

## سناریوهای بازگشت

| سناریو | اقدام |
|--------|--------|
| خطای ۵xx از Vercel | غیرفعال کردن `CUSTOM_DOMAIN_REAL_MUTATION_ENABLED` + بررسی پیکربندی |
| تداخل با Routing | بازگشت به کامیت قبل از تغییر `proxy.ts` |
| مشکل در دیتابیس | بازگشت به snapshot قبل از مهاجرت `20260708000100` |
| مشکل در UI | غیرفعال‌سازی صفحه `/dashboard/settings/domains` به صورت موقت |

## فرآیند بازگشت
۱. تنظیم `CUSTOM_DOMAIN_REAL_MUTATION_ENABLED=false`.
۲. بازگشت به کامیت قبلی با `git revert <commit-hash>`.
۳. اگر مهاجرت نفوذ کرده باشد، اعمال بازگشت مهاجرت با `prisma migrate resolve --rolled-back 20260708000100`.
۴. اطمینان از راه‌اندازی مجدد سرویس و تست Routing.

## محدودیت
بازگشت بدون تایید سازندگان تیمbackend ممکن نیست و نیازمند زمان توقف برنامه است.
