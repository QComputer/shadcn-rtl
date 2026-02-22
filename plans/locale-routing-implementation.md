# پیاده‌سازی مسیریابی چند زبانه با ساختار /app/[locale]

## خلاصه وضعیت

**تاریخ:** ۳ اسفند ۱۴۰۴
**وضعیت:** ✅ در حال پیاده‌سازی
**زبان اصلی:** فارسی (RTL)

---

## تغییرات انجام شده

### ۱. ساختار دایرکتوری جدید

```
app/
├── [locale]/              # دایرکتوری پارامتر زبان (جدید)
│   ├── layout.tsx        # لایه با پارامتر locale
│   ├── page.tsx          # صفحه اصلی
│   ├── dashboard/        # (در حال انتقال)
│   └── login/            # (در حال انتقال)
├── layout.tsx            # لایه ریدایرکت به زبان پیش‌فرض
├── globals.css
└── api/                  # API routes بدون تغییر
```

### ۲. فایل‌های جدید و به‌روز شده

| فایل | وضعیت | توضیحات |
|-------|--------|---------|
| `app/[locale]/layout.tsx` | ✅ جدید | لایه با پارامتر locale |
| `app/[locale]/page.tsx` | ✅ جدید | صفحه اصلی چند زبانه |
| `app/layout.tsx` | ✅ به‌روز | ریدایرکت به زبان پیش‌فرض |
| `proxy.ts` | ✅ به‌روز | middleware برای تشخیص زبان |
| `lib/i18n.ts` | ✅ به‌روز | پیکربندی زبان‌ها |
| `lib/i18n-routing.ts` | ✅ جدید | ابزارهای مسیریابی |
| `components/locale-provider.tsx` | ✅ جدید | provider زبان |
| `components/ui/locale-switcher.tsx` | ✅ جدید | کامپوننت تغییر زبان |

### ۳. پیکربندی زبان‌ها

```typescript
// lib/i18n.ts
export const supportedLocales = ["fa", "en", "ar"] as const;

export const localeConfig = {
  fa: { dir: "rtl", nativeName: "فارسی" },
  en: { dir: "ltr", nativeName: "English" },
  ar: { dir: "rtl", nativeName: "العربية" }
};
```

### ۴. عملکرد Middleware

```typescript
// proxy.ts
- تشخیص زبان از کوکی
- تشخیص از هدر Accept-Language
- ریدایرکت به URL با پیشوند زبان
- تنظیم هدرهای x-locale و x-direction
```

---

## مسیرهای تولید شده

```
/fa               -> صفحه اصلی فارسی
/en               -> صفحه اصلی انگلیسی
/ar               -> صفحه اصلی عربی
/fa/dashboard    -> داشبورد فارسی (در حال انتقال)
/en/dashboard    -> داشبورد انگلیسی (در حال انتقال)
```

---

## کارهای باقی مانده

### اولویت بالا

1. **انتقال صفحات داشبورد به `[locale]`**
   - `app/dashboard/page.tsx` → `app/[locale]/dashboard/page.tsx`
   - `app/dashboard/customers/page.tsx` → `app/[locale]/dashboard/customers/page.tsx`
   - `app/dashboard/orders/page.tsx` → `app/[locale]/dashboard/orders/page.tsx`
   - `app/dashboard/products/page.tsx` → `app/[locale]/dashboard/products/page.tsx`
   - `app/dashboard/settings/page.tsx` → `app/[locale]/dashboard/settings/page.tsx`

2. **انتقال صفحه ورود**
   - `app/login/page.tsx` → `app/[locale]/login/page.tsx`

3. **به‌روزرسانی لینک‌های داخلی**
   - استفاده از `<Link href={`/${locale}/dashboard`}>`
   - یا استفاده از ابزارهای lib/i18n-routing.ts

### اولویت متوسط

4. **تکمیل ترجمه‌ها**
   - استفاده از dictionary ها در صفحات
   - جایگزینی متون سخت با ترجمه‌های پویا

5. **مدیریت زبان در سرویس‌ها**
   - ارسال زبان در درخواست‌های API

### اولویت پایین

6. **بهینه‌سازی سئو**
   - متاتگ‌های hreflang
   - sitemap چند زبانه

---

## نحوه استفاده از زبان در کامپوننت‌ها

### هوک useLocale

```typescript
import { useLocale } from "@/components/locale-provider";

function MyComponent() {
  const { locale, isRTL, dir } = useLocale();
  
  return <div dir={dir}>محتوای {locale}</div>;
}
```

### لینک‌هایLocale-Aware

```typescript
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";

function Navigation() {
  const { locale } = useLocale();
  
  return (
    <Link href={`/${locale}/dashboard`}>داشبورد</Link>
  );
}
```

### تغییر زبان

```typescript
import { LocaleSwitcher } from "@/components/ui/locale-switcher";

function Header() {
  return <LocaleSwitcher />;
}
```

---

## عیب‌یابی

### مشکل: خطای ۴۰۴ در مسیرهای جدید

1. بررسی وجود فایل در `app/[locale]/`
2. اطمینان از وجود `generateStaticParams`
3. اجرای مجدد build

### مشکل: زبان تغییر نمی‌کند

1. بررسی کوکی `locale`
2. بررسی عملکرد middleware
3. بررسی console برای خطاها

### مشکل: RTL/LTR اشتباه

1. بررسی localeConfig در lib/i18n.ts
2. بررسی مقدار document.dir
3. بررسی پارامتر locale در URL

---

## منابع

- [Next.js Internationalization](https://nextjs.org/docs/app/building-your-application/routing/internationalization)
- [Next.js 16 Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
- [MDN HTML dir attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/dir)
