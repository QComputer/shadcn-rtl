# طرح پیاده‌سازی مسیریابی چند زبانه (Multi-Locale Routing)

## خلاصه اجرایی

**تاریخ:** ۳ اسفند ۱۴۰۴
**وضعیت کلی:** ✅ پیاده‌سازی اصلی تکمیل شده
**زبان اصلی:** فارسی (RTL) - اولین زبان native پروژه
**زبان‌های پشتیبانی شده:**
- فارسی (fa) - RTL - زبان اصلی و پیش‌فرض ✓
- انگلیسی (en) - LTR ✓
- عربی (ar) - RTL ✓

---

## تغییرات انجام شده

### ۱. ساختار پروژه

```
app/
├── [locale]/                    # ✓ دایرکتوری پارامتر زبان (جدید)
│   ├── layout.tsx             # ✓ لایه با پارامتر locale
│   ├── page.tsx               # ✓ صفحه اصلی چند زبانه
│   └── template.tsx           # ✓ template برای مدیریت state
├── layout.tsx                 # ✓ لایه ریشه (بدون locale)
├── globals.css                # ✓ استایل‌های RTL
├── page.tsx                   # (در حال حاضر ریدایرکت می‌شود)
└── api/                       # API routes بدون تغییر
```

### ۲. فایل‌های کلیدی ایجاد/به‌روز شده

| فایل | وضعیت | توضیحات |
|------|--------|----------|
| `app/[locale]/layout.tsx` | ✅ تکمیل | لایه با پشتیبانی RTL و locale |
| `app/[locale]/page.tsx` | ✅ تکمیل | صفحه اصلی با استفاده از dictionary |
| `app/[locale]/template.tsx` | ✅ تکمیل | template برای locale state |
| `app/layout.tsx` | ✅ به‌روز | ریدایرکت به زبان پیش‌فرض |
| `proxy.ts` | ✅ به‌روز | Middleware برای تشخیص و تنظیم locale |
| `lib/i18n.ts` | ✅ به‌روز | پیکربندی زبان‌ها با type انعطاف‌پذیر |
| `lib/dictionary.ts` | ✅ جدید | توابع کمکی برای دسترسی به dictionary |
| `dictionaries/fa.json` | ✅ تکمیل | ترجمه‌های فارسی کامل |
| `dictionaries/en.json` | ✅ تکمیل | ترجمه‌های انگلیسی کامل |
| `dictionaries/ar.json` | ✅ تکمیل | ترجمه‌های عربی کامل |

### ۳. پیکربندی زبان‌ها

```typescript
// lib/i18n.ts
export const supportedLocales = ["fa", "en", "ar"] as const;
export type SupportedLocale = "fa" | "en" | "ar";

export const localeConfig = {
  fa: { dir: "rtl", name: "Persian", nativeName: "فارسی", languageCode: "fa-IR" },
  en: { dir: "ltr", name: "English", nativeName: "English", languageCode: "en-US" },
  ar: { dir: "rtl", name: "Arabic", nativeName: "العربية", languageCode: "ar-SA" }
};
```

### ۴. عملکرد Middleware (proxy.ts)

- ✓ تشخیص زبان از کوکی `locale`
- ✓ تشخیص از هدر `Accept-Language`
- ✓ ریدایرکت مسیرهای بدون پیشوند زبان
- ✓ تنظیم locale در کوکی برای جلسات بعدی
- ✓ پشتیبانی از مسیرهای استاتیک (مثلاً `/favicon.ico`)

### ۵. سیستم Dictionary

```typescript
// استفاده در کامپوننت‌ها
import { getDictionary, getDictValue } from "@/lib/dictionary";

const dict = getDictionary(locale); // یا از hook استفاده کنید
const t = (key: string) => getDictValue(dict, key);

// مثال استفاده
t("home.title")           // "فروشگاه آنلاین"
t("product.addToCart")    // "افزودن به سبد خرید"
t("common.loading")       // "در حال بارگذاری..."
```

---

## مسیرهای تولید شده

| مسیر | زبان | وضعیت |
|------|------|--------|
| `/fa` | فارسی (RTL) | ✅ فعال |
| `/en` | انگلیسی (LTR) | ✅ فعال |
| `/ar` | عربی (RTL) | ✅ فعال |
| `/fa/dashboard` | فارسی | ⏳ نیاز به انتقال |
| `/en/dashboard` | انگلیسی | ⏳ نیاز به انتقال |
| `/ar/dashboard` | عربی | ⏳ نیاز به انتقال |

---

## کارهای باقی مانده

### اولویت ۱ - انتقال صفحات موجود

#### ۱.۱ صفحات داشبورد

| فایل فعلی | مسیر جدید | اولویت |
|-----------|-----------|--------|
| `app/dashboard/page.tsx` | `app/[locale]/dashboard/page.tsx` | بالا |
| `app/dashboard/customers/page.tsx` | `app/[locale]/dashboard/customers/page.tsx` | بالا |
| `app/dashboard/orders/page.tsx` | `app/[locale]/dashboard/orders/page.tsx` | بالا |
| `app/dashboard/products/page.tsx` | `app/[locale]/dashboard/products/page.tsx` | بالا |
| `app/dashboard/settings/page.tsx` | `app/[locale]/dashboard/settings/page.tsx` | بالا |

#### ۱.۲ صفحه ورود

| فایل فعلی | مسیر جدید | اولویت |
|-----------|-----------|--------|
| `app/login/page.tsx` | `app/[locale]/login/page.tsx` | بالا |

**الگوی انتقال:**
```typescript
// app/[locale]/dashboard/page.tsx
import { redirect } from "next/navigation";

export default function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // استفاده از dictionary برای ترجمه‌ها
  // استفاده از locale برای مسیرها
}
```

### اولویت ۲ - به‌روزرسانی لینک‌ها

#### ۲.۱ جایگزینی لینک‌های hardcoded

تمام لینک‌های داخلی باید از فرمت زیر استفاده کنند:

```typescript
// قبل
<Link href="/dashboard">داشبورد</Link>

// بعد
<Link href={`/${locale}/dashboard`}>داشبورد</Link>
```

یا استفاده از helper:

```typescript
// lib/i18n-routing.ts (در صورت نیاز ایجاد شود)
import { useLocale } from "@/hooks/use-locale";

function MyLink({ href, children }) {
  const { locale } = useLocale();
  return <Link href={`/${locale}${href}`}>{children}</Link>;
}
```

### اولویت ۳ - ترجمه محتوای پویا

#### ۳.۱ صفحات محصول

- دریافت ترجمه‌ها از API
- استفاده از dictionary برای لیبل‌های استاتیک
- نمایش محصولات با توجه به locale

#### ۳.۲ پیام‌های خطا و اعلان‌ها

- استفاده از dictionary برای تمام پیام‌ها
- پشتیبانی از پارامترهای dynamic در ترجمه‌ها

### اولویت ۴ - بهینه‌سازی سئو

#### ۴.۱ متاتگ‌های hreflang

```tsx
// app/[locale]/layout.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const { locale } = await params;
  
  return {
    alternates: {
      languages: {
        "fa": "/fa",
        "en": "/en",
        "ar": "/ar",
      },
    },
  };
}
```

#### ۴.۲ sitemap چند زبانه

### اولویت ۵ - بهینه‌سازی عملکرد

- Lazy loading dictionary ها
- کش کردن ترجمه‌ها
- استفاده از React Server Components برای dictionary

---

## وابستگی‌ها و الزامات

### وابستگی‌های فنی

| وابستگی | نسخه | وضعیت |
|---------|------|--------|
| Next.js | 16.x | ✅ سازگار |
| React | 19.x | ✅ سازگار |
| TypeScript | 5.x | ✅ سازگار |
| Tailwind CSS | 3.x | ✅ سازگار |

### پیش‌نیازها

1. Node.js 18+ نصب شده باشد
2. وابستگی‌ها نصب شده باشند (`npm install`)
3. پایگاه داده آماده باشد (در صورت نیاز)

---

## برنامه زمانی پیشنهادی

### فاز ۱: تکمیل پایه (هفته ۱)

- [x] ایجاد ساختار `/app/[locale]`
- [x] پیکربندی middleware
- [x] ایجاد dictionary ها
- [x] تست TypeScript
- [ ] تست در محیط توسعه

### فاز ۲: انتقال صفحات (هفته ۲)

- [ ] انتقال داشبورد
- [ ] انتقال صفحه ورود
- [ ] به‌روزرسانی لینک‌ها

### فاز ۳: محتوا و سئو (هفته ۳)

- [ ] ترجمه محتوای پویا
- [ ] بهینه‌سازی سئو
- [ ] sitemap

### فاز ۴: تست و بهینه‌سازی (هفته ۴)

- [ ] تست کامل مرورگرها
- [ ] تست RTL
- [ ] بهینه‌سازی عملکرد

---

## عیب‌یابی

### مشکل: خطای ۴۰۴ در مسیرهای جدید

1. بررسی وجود فایل در `app/[locale]/`
2. اطمینان از وجود `generateStaticParams` (برای static export)
3. اجرای مجدد build

### مشکل: زبان تغییر نمی‌کند

1. بررسی کوکی `locale`
2. بررسی عملکرد middleware
3. بررسی console برای خطاها

### مشکل: RTL/LTR اشتباه

1. بررسی `localeConfig` در `lib/i18n.ts`
2. بررسی مقدار `document.dir`
3. بررسی پارامتر `locale` در URL

### مشکل: TypeScript errors

1. اجرای `npx tsc --noEmit` برای بررسی خطاها
2. استفاده از type انعطاف‌پذیر برای dictionary

---

## منابع

- [Next.js Internationalization](https://nextjs.org/docs/app/building-your-application/routing/internationalization)
- [Next.js 16 Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
- [MDN HTML dir attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/dir)
- [RTL CSS Best Practices](https://rtlstyling.com/)

---

## یادداشت‌ها

1. **زبان اصلی:** فارسی به عنوان زبان اصلی و پیش‌فرض پروژه تنظیم شده است.
2. **RTL:** تمام کامپوننت‌ها و صفحات باید از سیستم RTL پشتیبانی کنند.
3. **Dictionary:** سیستم dictionary جایگزین توابع محلی‌سازی قبلی شده است.
4. **向后兼容性:** API routes بدون تغییر باقی می‌مانند و locale در هدر ارسال می‌شود.
