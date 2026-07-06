# Dashboard Showcase Content

This document maps the dashboard showcase page content to its source module.

## Content Source

`lib/content/b2b-feature-pages-content.ts`

## Dashboard Overview Sections

| # | Section | Description |
|---|---|---|
| 1 | مدیریت محصولات و خدمات | Define and manage products/services |
| 2 | مدیریت سفارش‌ها و پرداخت‌ها | Orders, invoices, payment tracking |
| 3 | مدیریت نوبت‌ها و برنامه هفتگی | Calendar, slots, staff scheduling |
| 4 | مدیریت مشتریان و باشگاه مشتریان | CRM, loyalty, membership |
| 5 | مدیریت کمپین‌ها و کدهای تخفیف | Campaign builder, coupons |
| 6 | پیامک، اعلان مرورگر و اطلاع‌رسانی | SMS, notifications, preferences |
| 7 | پیگیری تحویل و خواندن پیام‌ها | Delivery reports |
| 8 | گزارش‌گیری و تحلیل عملکرد | Reports, CSV/Excel exports |
| 9 | مدیریت کارکنان و دسترسی‌ها | Roles, permissions, team |
| 10 | تنظیمات کسب‌وکار | Business profile, security |

## Dashboard Workflow Cards

| ID | Title | Icon | Description |
|---|---|---|---|
| orders | سفارش‌ها و پرداخت‌ها | 📦 | View new orders, update status, issue invoices, and track payments. |
| appointments | خدمات و نوبت‌ها | 📅 | Manage calendar, set available slots, view upcoming appointments, and approve requests. |
| customers | مشتریان و باشگاه مشتریان | 👥 | Segment customers, view purchase history, manage loyalty points, and handle memberships. |
| campaigns | کمپین‌ها و کدهای تخفیف | 🎯 | Create campaigns, define coupons, select target audiences, and track results. |
| notifications | پیامک و اعلان‌ها | 🔔 | Check SMS and notification settings, view delivery reports, and manage customer preferences. |
| reports | گزارش‌ها و عملیات روزانه | 📊 | Sales reports, revenue, campaign performance, customer analytics, and CSV/Excel exports. |
| settings | تنظیمات کسب‌وکار و دسترسی‌ها | ⚙️ | Edit business information, invite staff, define roles, and configure security. |

## Safety Copy

- Data ownership: customer data belongs to the business
- Real SMS only with explicit activation; default is safe trial mode
- Role-based access control (admin, manager, staff)
- Dashboard is for internal team only, not public

## Locale Support

- `fa` — full content
- `en` — full English copy
- `ar` — full Arabic copy

## Implementation

- Dashboard showcase is rendered at `app/[locale]/dashboard-showcase/page.tsx`
- Uses mock cards with static labels only
- No real screenshots, no production data, no API calls
