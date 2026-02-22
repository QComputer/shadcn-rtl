# پیاده‌سازی مسیریابی چند زبانه - Multi-Locale Routing Implementation

## خلاصه اجرایی

**تاریخ:** ۲ اسفند ۱۴۰۴
**وضعیت:** ✅ تکمیل شده
**زبان اصلی:** فارسی (RTL)

---

## تغییرات انجام شده

### ۱. به‌روزرسانی Middleware (proxy.ts)

فایل `proxy.ts` به عنوان middleware برای Next.js 16 به‌روزرسانی شد:

```typescript
// ویژگی‌های پیاده‌سازی شده:
- تشخیص خودکار زبان از کوکی
- تشخیص از هدر Accept-Language
- زبان پیش‌فرض: فارسی (fa)
- تنظیم هدرهای x-locale و x-direction
- ریدایرکت به URL با پیشوند زبان
```

### ۲. به‌روزرسانی lib/i18n.ts

ماژول i18n با قابلیت‌های زیر ارتقا یافت:

- پیکربندی کامل زبان‌ها (فارسی، انگلیسی، عربی)
- تابع getDirection برای تعیین RTL/LTR
- تابع isRTL برای بررسی جهت
- تابع getLocaleNativeName برای نام بومی زبان
- پشتیبانی از انواع TypeScript

### ۳. ایجاد lib/i18n-routing.ts

فایل پیکربندی مسیریابی جدید:

- تابع hasLocalePrefix برای بررسی پیشوند زبان
- تابع getLocaleFromPath برای استخراج زبان از مسیر
- تابع addLocalePrefix برای افزودن پیشوند زبان
- تابع removeLocalePrefix برای حذف پیشوند زبان
- هوک‌های useLocalePathname و useLocaleRouter

### ۴. ایجاد components/locale-provider.tsx

Provider جدید برای مدیریت زبان در سمت کلاینت:

- LocaleProvider برای مدیریت وضعیت زبان
- useLocale hook برای دسترسی به زبان فعلی
- useIsRTL hook برای بررسی جهت RTL
- به‌روزرسانی خودکار document.dir و document.lang

### ۵. ایجاد components/ui/locale-switcher.tsx

کامپوننت تغییر زبان:

- LocaleSwitcher با منوی کشویی
- SimpleLocaleSwitcher با select
- پشتیبانی از هر سه زبان (fa, en, ar)
- ذخیره‌سازی زبان در کوکی

### ۶. به‌روزرسانی components/providers.tsx

اضافه شدن LocaleProvider:

```typescript
<LocaleProvider defaultLocale={locale}>
  <AuthProvider>
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  </AuthProvider>
</LocaleProvider>
```

### ۷. به‌روزرسانی app/layout.tsx

- دریافت زبان از کوکی
- تنظیم lang و dir بر اساس زبان
- تنظیم metadata چند زبانه

---

## ساختار URL

پس از پیاده‌سازی، ساختار URL ها به صورت زیر خواهد بود:

```
/fa/              -> صفحه اصلی (فارسی)
/en/              -> صفحه اصلی (انگلیسی)
/ar/              -> صفحه اصلی (عربی)
/fa/dashboard     -> داشبورد (فارسی)
/en/dashboard     -> داشبورد (انگلیسی)
/fa/products      -> محصولات (فارسی)
/en/products      -> محصولات (انگلیسی)
```

---

## مسیرهای پشتیبانی شده

| زبان | کد | جهت | نام بومی |
|------|-----|------|----------|
| فارسی | fa | RTL | فارسی |
| انگلیسی | en | LTR | English |
| عربی | ar | RTL | العربية |

---

## نحوه استفاده

### در کامپوننت‌ها:

```typescript
import { useLocale } from "@/components/locale-provider";

function MyComponent() {
  const { locale, setLocale, isRTL, dir } = useLocale();
  
  return (
    <div dir={dir}>
      <p>زبان فعلی: {locale}</p>
      <button onClick={() => setLocale("en")}>تغییر به انگلیسی</button>
    </div>
  );
}
```

### در لینک‌ها:

```typescript
import { Link } from "@/lib/i18n-routing";

function Navigation() {
  return (
    <nav>
      <Link href="/dashboard">داشبورد</Link>
      <Link href="/products">محصولات</Link>
    </nav>
  );
}
```

### استفاده از LocaleSwitcher:

```typescript
import { LocaleSwitcher } from "@/components/ui/locale-switcher";

function Header() {
  return (
    <header>
      <LocaleSwitcher />
    </header>
  );
}
```

---

## کارهای باقی مانده

### اولویت بالا

1. **تست مسیریابی چند زبانه**
   - تست ریدایرکت زبان
   - تست حفظ زبان در navigation
   - تست کوکی زبان

2. **به‌روزرسانی dictionary ها**
   - تکمیل ترجمه‌های انگلیسی
   - تکمیل ترجمه‌های عربی
   - افزودن کلیدهای جدید

3. **به‌روزرسانی صفحات موجود**
   - افزودن locale parameter
   - استفاده از dictionary در صفحات

### اولویت متوسط

4. **SEO**
   - متاتگ‌های hreflang
   - sitemap چند زبانه
   - structured data

5. **مدیریت زبان در API**
   - فیلتر زبان در پاسخ‌های API
   - ذخیره‌سازی ترجمه‌ها در دیتابیس

### اولویت پایین

6. **بهبودها**
   - ترجمه ایمیل‌ها
   - اعلان‌های چند زبانه
   - محتوای استاتیک

---

## نکات مهم

1. **زبان پیش‌فرض** فارسی است و RTL می‌باشد
2. **کوکی locale** برای حفظ زبان انتخابی کاربر استفاده می‌شود
3. **proxy.ts** به عنوان middleware در Next.js 16 عمل می‌کند
4. تمام متون رابط کاربری باید از dictionary ها استفاده کنند

---

## عیب‌یابی

### مشکل: زبان تغییر نمی‌کند

1. بررسی کوکی locale در مرورگر
2. بررسی console برای خطاها
3. اطمینان از عدم کش مرورگر

### مشکل: RTL/LTR اشتباه

1. بررسی مقدار locale در cookie
2. بررسی مقدار document.dir
3. بررسی localeConfig در lib/i18n.ts

### مشکل: ریدایرکت مداوم

1. بررسی regex در proxy.ts matcher
2. بررسی exclusions در proxy.ts
3. اطمینان از صحت locale ها

---

## منابع

- [Next.js Internationalization](https://nextjs.org/docs/app/building-your-application/routing/internationalization)
- [MDN HTML dir attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/dir)
- [RFC 5646 Language Tags](https://tools.ietf.org/html/rfc5646)
