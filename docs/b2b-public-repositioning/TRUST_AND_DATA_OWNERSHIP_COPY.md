# Trust and Data Ownership Copy

This document maps trust and data ownership copy to its source module.

## Content Source

`lib/content/b2b-legal-content.ts`

## Trust Page Sections

| # | Section | Focus |
|---|---|---|
| 1 | بازارباز برای کسب‌وکارها ساخته شده است | B2B positioning |
| 2 | مالکیت رابطه با مشتری متعلق به کسب‌وکار است | Data ownership |
| 3 | دسترسی‌ها و نقش‌ها در داشبورد مدیریت می‌شوند | RBAC |
| 4 | پیامک و اعلان‌ها فقط با سیاست‌های فعال‌سازی و کنترل‌شده استفاده می‌شوند | SMS/notification safety |
| 5 | اطلاعات حساس نباید در صفحات عمومی نمایش داده شود | Public data exposure prevention |
| 6 | نمونه‌ها دمو هستند، نه بازارچه عمومی | Demo-only positioning |
| 7 | تعهد به شفافیت | Transparency commitment |

## Key Copy

- Data ownership: "داده‌های مشتریان شما، سوابق خرید، اطلاعات تماس و ترجیحات اعلان متعلق به خود کسب‌وکار شماست."
- SMS safety: "ارسال پیامک واقعی به صورت پیش‌فرض غیرفعال است و تنها با فعال‌سازی صریح شما انجام می‌شود."
- Dashboard access: "داشبورد بازارباز مبتنی بر نقش (RBAC) است."
- Demo positioning: "نمونه‌های نمایشی بازارباز صرفاً برای آشنایی صاحبان کسب‌وکار با پلتفرم هستند."
- Transparency disclaimer: "این صفحه برای شفاف‌سازی رویکرد بازارباز است و جایگزین مشاوره حقوقی یا متن نهایی قرارداد نیست."

## Locale Support

- `fa` — full content
- `en` — full English copy
- `ar` — full Arabic copy

## Implementation

- Trust page is rendered at `app/[locale]/trust/page.tsx`
- Privacy page is rendered at `app/[locale]/privacy/page.tsx`
- Terms page is rendered at `app/[locale]/terms/page.tsx`
- Footer links updated to include trust, privacy, and terms
