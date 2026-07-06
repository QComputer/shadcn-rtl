# Feature Pages Content

This document maps the feature page content to its source module.

## Content Source

`lib/content/b2b-feature-pages-content.ts`

## Feature Groups

| # | Feature Group | ID |
|---|---|---|
| 1 | مدیریت فروشگاه و سفارش‌ها | shop-orders |
| 2 | مدیریت خدمات و نوبت‌دهی | services-appointments |
| 3 | باشگاه مشتریان و وفادارسازی | customer-club |
| 4 | پیامک، اعلان و اطلاع‌رسانی | notifications |
| 5 | کمپین‌ها، تخفیف‌ها و پیشنهادهای ویژه | campaigns |
| 6 | داشبورد مدیریتی و گزارش‌ها | dashboard |
| 7 | صفحه اختصاصی کسب‌وکار | business-page |
| 8 | مدیریت کارکنان و دسترسی‌ها | staff-roles |
| 9 | چندزبانه، فارسی‌محور و راست‌چین | multilingual |

## Per-Feature Content

Each feature group contains:
- `title` — Persian heading
- `what` — short capability description
- `who` — business role that uses it
- `workflow` — example business workflow
- `dashboardValue` — what the dashboard provides
- `customerFacingValue` — what the customer sees

## Locale Support

- `fa` — full content (9 feature groups, dashboard showcase)
- `en` — full content with English copy
- `ar` — full content with Arabic copy

## Implementation

- Features are rendered at `app/[locale]/features/page.tsx`
- Each feature group is a section on the features page
- No dashboard API data is exposed in this content
