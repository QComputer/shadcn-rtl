# Bazar Baz Growth Roadmap

## هدف محصول

هدف این roadmap تبدیل Bazar Baz از یک فروشگاه/فن‌پیج معمولی به یک پلتفرم حرفه‌ای رشد فروشگاه است:

```txt
Bazar Baz
├─ فروشگاه و صفحه عمومی قابل ایندکس
├─ کلاب مشتریان برای نگهداری و بازگشت مشتری
├─ اعلان و کمپین هدفمند
├─ SEO فنی و محتوایی قوی
├─ گزارش مالی و تحلیل فروش
└─ ابزارهای عملیاتی فروشگاه حرفه‌ای
```

## اصول غیرقابل نقض

```txt
1. تغییرات phase-by-phase و کوچک باشند.
2. هر phase باید validator خودش را داشته باشد.
3. i18n سه‌زبانه fa/en/ar حفظ شود؛ fa پیش‌فرض است.
4. RTL و shadcn/Radix composition حفظ شود.
5. route authorization و sidebar policy از فازهای P38-P41 شکسته نشود.
6. داده‌ها organization-scoped باشند؛ هیچ feature تجاری نباید global و tenant-unsafe باشد.
7. اعلان واقعی، SMS، Email یا Push واقعی بدون dry-run/explicit opt-in فعال نشود.
8. migrations باید شفاف و قابل validate باشند.
9. customer consent، unsubscribe و audit از ابتدا در طراحی لحاظ شوند.
10. SUPER_ADMIN دسترسی کامل دارد؛ ADMIN/MANAGER دسترسی عملیاتی؛ STAFF/DRIVER محدود و role-aware.
```

---

# Track A — Customer Club and Direct Communication

## P42 — Customer Club Foundation

### هدف
ساخت foundation باشگاه مشتریان به شکل organization-scoped.

### Scope

```txt
Prisma models:
- CustomerClubMembership
- CustomerClubConsent
- CustomerClubTier
- CustomerTag

Dashboard routes:
- /dashboard/customer-club
- /dashboard/customer-club/members

Public/customer actions:
- join customer club
- leave customer club
- view membership state
```

### Acceptance criteria

```txt
1. مشتری بتواند برای یک فروشگاه عضو کلاب شود.
2. عضویت فقط برای همان organization معتبر باشد.
3. خروج از کلاب ممکن باشد.
4. owner/admin بتواند اعضای کلاب خود را ببیند.
5. هیچ فروشگاهی اعضای فروشگاه دیگر را نبیند.
6. همه copyها fa/en/ar داشته باشند.
7. validator جدید اضافه شود: quality:customer-club-foundation
```

### Validation

```powershell
pnpm run db:validate
pnpm run quality:customer-club-foundation
pnpm run quality:local
pnpm run typecheck
pnpm run build
```

---

## P43 — In-App Notification Inbox

### هدف
ساخت notification inbox داخلی، بدون Web Push واقعی در این فاز.

### Scope

```txt
Prisma models:
- Notification
- NotificationRecipient
- NotificationReadState

Routes:
- /dashboard/notifications
- /api/dashboard/notifications
- /api/customer/notifications

Features:
- owner/admin sends in-app notifications to club members
- customers see notifications in app
- mark read/unread
- notification audit trail
```

### Acceptance criteria

```txt
1. ارسال اعلان داخلی برای اعضای کلاب ممکن باشد.
2. پیام فقط به مشتریان همان organization برسد.
3. مشتری بتواند اعلان‌های خودش را ببیند.
4. read/unread کار کند.
5. ارسال واقعی push/email/sms انجام نشود.
6. validator: quality:in-app-notifications
```

---

## P44 — Customer Segments MVP

### هدف
گروه‌بندی مشتریان برای کمپین و اعلان هدفمند.

### Segmentهای اولیه

```txt
- all_club_members
- new_members_30d
- recent_buyers_30d
- inactive_60d
- vip_by_revenue
- high_order_count
- abandoned_cart_candidates
```

### Scope

```txt
Prisma models:
- CustomerSegment
- CustomerSegmentRule
- CustomerSegmentSnapshot

Routes:
- /dashboard/customer-club/segments
```

### Acceptance criteria

```txt
1. owner/admin بتواند segmentهای آماده را ببیند.
2. شمارش اعضای هر segment محاسبه شود.
3. queryها tenant-safe باشند.
4. segmentها برای کمپین‌های بعدی قابل استفاده باشند.
5. validator: quality:customer-segments
```

---

## P45 — Campaign Builder MVP

### هدف
ساخت کمپین ساده برای ارسال پیام به segmentهای کلاب.

### Scope

```txt
Prisma models:
- Campaign
- CampaignAudience
- CampaignMessage
- CampaignDelivery

Routes:
- /dashboard/customer-club/campaigns
- /dashboard/customer-club/campaigns/new
- /dashboard/customer-club/campaigns/[id]
```

### Features

```txt
1. draft campaign
2. choose segment
3. write message
4. preview audience count
5. dry-run delivery
6. send in-app campaign
7. campaign status: draft, scheduled, sending, sent, canceled
```

### Acceptance criteria

```txt
1. بدون opt-in پیام خارجی ارسال نشود.
2. ارسال in-app به audience درست انجام شود.
3. delivery record برای هر recipient ذخیره شود.
4. cancellation قبل از ارسال ممکن باشد.
5. validator: quality:campaign-builder
```

---

## P46 — Loyalty Points and Coupons

### هدف
اضافه‌کردن loyalty و coupon برای نگهداری مشتری.

### Scope

```txt
Prisma models:
- LoyaltyLedger
- LoyaltyRule
- Coupon
- CouponRedemption

Dashboard routes:
- /dashboard/customer-club/loyalty
- /dashboard/customer-club/coupons
```

### Acceptance criteria

```txt
1. امتیاز با خرید قابل ثبت باشد.
2. ledger immutable باشد؛ امتیاز با update مستقیم تغییر نکند.
3. couponها organization-scoped باشند.
4. محدودیت تاریخ، تعداد استفاده و segment رعایت شود.
5. validator: quality:loyalty-coupons
```

---

## P47 — Web Push Opt-In Foundation

### هدف
آماده‌سازی Web Push بدون اسپم و با رضایت صریح کاربر.

### Scope

```txt
Prisma models:
- PushSubscription
- NotificationPermissionEvent

Features:
- opt-in UI after user action
- unsubscribe
- VAPID env validation
- dry-run push sending
```

### Acceptance criteria

```txt
1. permission prompt فقط بعد از action کاربر درخواست شود.
2. unsubscribe ساده و قابل دسترس باشد.
3. ارسال واقعی push پشت feature flag باشد.
4. validator: quality:web-push-foundation
```

---

# Track B — SEO Engine

## P48 — Public SEO Foundation

### هدف
استانداردسازی SEO صفحات عمومی فروشگاه و محصول.

### Scope

```txt
- shared metadata factory
- canonical URL helper
- locale-aware alternates/hreflang
- OpenGraph defaults
- Twitter card defaults
- public shop/product route metadata
```

### Target routes

```txt
/[locale]/shop/[slug]
/[locale]/shop/[slug]/fanpage
/[locale]/shop/[slug]/products
/[locale]/shop/[slug]/products/[productSlug]
/[locale]/shop/[slug]/categories/[categorySlug]
/[locale]/shop/[slug]/offers
/[locale]/shop/[slug]/reviews
/[locale]/shop/[slug]/about
```

### Acceptance criteria

```txt
1. هر صفحه title و description meaningful داشته باشد.
2. canonical درست باشد.
3. fa/en/ar alternates تولید شوند.
4. metadata از داده واقعی organization/product ساخته شود.
5. validator: quality:public-seo-foundation
```

---

## P49 — Structured Data: Product, Offer, LocalBusiness

### هدف
اضافه‌کردن JSON-LD برای public pages.

### Scope

```txt
Structured data helpers:
- Organization
- LocalBusiness
- Product
- Offer
- AggregateRating
- BreadcrumbList
- WebSite
```

### Acceptance criteria

```txt
1. Product page JSON-LD معتبر داشته باشد.
2. Shop page LocalBusiness/Organization JSON-LD داشته باشد.
3. BreadcrumbList در صفحات عمومی اصلی باشد.
4. قیمت/موجودی فقط وقتی داده معتبر وجود دارد نمایش داده شود.
5. validator: quality:structured-data
```

---

## P50 — Dynamic Sitemap and Robots

### هدف
ایجاد sitemap و robots داینامیک و امن.

### Scope

```txt
- app/sitemap.ts or sitemap route
- app/robots.ts
- include public shop/product/fanpage routes
- exclude private dashboard/api routes
- lastModified from real data
- locale-aware URLs
```

### Acceptance criteria

```txt
1. dashboard و API داخل sitemap نیایند.
2. public active shops/products در sitemap باشند.
3. sitemap برای fa/en/ar درست باشد.
4. validator: quality:seo-sitemap
```

---

## P51 — SEO Health Panel

### هدف
داشبورد ساده برای صاحب فروشگاه تا وضعیت SEO خود را ببیند.

### Route

```txt
/dashboard/seo
```

### Checks

```txt
- missing shop title/description
- missing product meta description
- missing product image alt
- missing product slug
- missing business hours/address
- invalid public visibility
- missing structured data inputs
```

### Acceptance criteria

```txt
1. owner/admin وضعیت SEO فروشگاه خود را ببیند.
2. warnings actionable باشند.
3. لینک مستقیم به صفحه اصلاح داده شود.
4. validator: quality:seo-health-panel
```

---

# Track C — Finance, Analytics and Professional Store Tools

## P52 — Finance Dashboard MVP

### هدف
داشبورد مالی ساده و قابل اعتماد.

### Route

```txt
/dashboard/finance
```

### Metrics

```txt
- revenue today / week / month
- order count
- average order value, AOV
- paid vs unpaid orders
- canceled orders
- top products by revenue
- top customers by revenue
```

### Acceptance criteria

```txt
1. فقط داده organization جاری نمایش داده شود.
2. timezone و locale درست باشد.
3. اعداد مالی با واحد درست نمایش داده شوند.
4. empty/loading/error states حرفه‌ای باشند.
5. validator: quality:finance-dashboard
```

---

## P53 — Product Profitability and Inventory Analytics

### هدف
تحلیل سود، قیمت تمام‌شده و موجودی.

### Scope

```txt
Prisma additions:
- product cost fields or ProductCostSnapshot
- stock threshold fields

Reports:
- product gross margin
- low stock
- dead stock
- slow-moving products
```

### Acceptance criteria

```txt
1. margin براساس cost امن محاسبه شود.
2. نبود cost باعث crash نشود.
3. low-stock محصولات مشخص باشد.
4. validator: quality:profit-inventory-analytics
```

---

## P54 — Customer Analytics and Retention

### هدف
تحلیل مشتریان و بازگشت آن‌ها.

### Metrics

```txt
- repeat customer rate
- customer lifetime value, LTV
- last purchase age
- inactive customers
- VIP customers
- new vs returning buyers
```

### Acceptance criteria

```txt
1. گزارش‌ها tenant-safe باشند.
2. اطلاعات حساس مشتری محدود و role-aware باشد.
3. segmentهای P44 با analytics reuse شوند.
4. validator: quality:customer-analytics
```

---

## P55 — Campaign Analytics and Attribution

### هدف
اندازه‌گیری نتیجه کمپین‌ها.

### Metrics

```txt
- delivered count
- read/open count
- click count
- conversion count
- attributed revenue
- coupon redemption
```

### Acceptance criteria

```txt
1. هر کمپین نتیجه قابل مشاهده داشته باشد.
2. attribution ساده ولی قابل اعتماد باشد.
3. کوپن و لینک کمپین قابل ردیابی باشند.
4. validator: quality:campaign-analytics
```

---

## P56 — Export and Professional Reports

### هدف
خروجی‌گیری برای فروشگاه‌های حرفه‌ای.

### Scope

```txt
- CSV export for sales
- CSV export for products/inventory
- CSV export for customer club members
- date range filters
- role-aware export permission
```

### Acceptance criteria

```txt
1. export فقط برای role مجاز باشد.
2. export tenant-safe باشد.
3. فایل‌ها اطلاعات حساس غیرضروری نداشته باشند.
4. validator: quality:report-exports
```

---

## P57 — Store Operations Toolkit

### هدف
ابزارهای عملیاتی فروشگاه استاندارد.

### Features

```txt
- supplier management
- purchase records
- expense records
- invoice numbering
- simple receivable/payable tracking
- product restock reminders
```

### Acceptance criteria

```txt
1. ابزارها ساده و قابل استفاده باشند.
2. financial numbers audit-friendly باشند.
3. تغییرات مهم audit log داشته باشند.
4. validator: quality:store-operations-toolkit
```

---

# Track D — Quality, Permissions, Plans and Production Readiness

## P58 — Feature Entitlements and Plans

### هدف
آماده‌سازی پلن‌های تجاری.

### Scope

```txt
- feature flags / entitlements
- free/pro/business plan capability matrix
- soft limits for campaigns, notifications, SEO panel, exports
```

### Acceptance criteria

```txt
1. feature access role-aware و plan-aware باشد.
2. SUPER_ADMIN override داشته باشد.
3. UI محدودیت‌ها را واضح نشان دهد.
4. validator: quality:feature-entitlements
```

---

## P59 — E2E Smoke Tests

### هدف
تست end-to-end برای مسیرهای حیاتی.

### Flows

```txt
- shop owner joins dashboard and sees customer club
- customer joins club
- owner sends in-app notification
- product public page has metadata and JSON-LD
- finance dashboard loads for admin
- unauthorized role cannot access restricted routes
```

### Acceptance criteria

```txt
1. Playwright Edge-compatible باشد.
2. tests dry-run safe باشند.
3. deployed smoke route جدا باشد.
4. validator/test script اضافه شود.
```

---

## P60 — Product Polish and Documentation Freeze

### هدف
جمع‌بندی، docs sync و آماده‌سازی release.

### Scope

```txt
- README sync
- CURRENT_SOURCE_OF_TRUTH sync
- route/API/model inventory update
- user-facing docs for store owners
- clean source release validation
```

### Acceptance criteria

```txt
pnpm run quality:local
pnpm run typecheck
pnpm run build
pnpm run release:stage
pnpm run quality:release-staged
pnpm run release:zip
```

---

# پیشنهاد ترتیب اجرا

بهترین ترتیب عملی از همین حالا:

```txt
P41A — fix missing quality:dashboard-route-guard-smoke script packaging
P42 — Customer Club Foundation
P43 — In-App Notification Inbox
P44 — Customer Segments MVP
P48 — Public SEO Foundation
P49 — Structured Data
P50 — Dynamic Sitemap and Robots
P52 — Finance Dashboard MVP
P45 — Campaign Builder MVP
P46 — Loyalty and Coupons
P53 — Product Profitability and Inventory Analytics
P54 — Customer Analytics and Retention
P55 — Campaign Analytics
P56 — Export and Professional Reports
P57 — Store Operations Toolkit
P58 — Feature Entitlements and Plans
P59 — E2E Smoke Tests
P60 — Documentation and Clean Release
```

## منابع استاندارد برای Codex/Developer

```txt
Google Search Central — Product structured data:
https://developers.google.com/search/docs/appearance/structured-data/product

Google Search Central — LocalBusiness structured data:
https://developers.google.com/search/docs/appearance/structured-data/local-business

Google Search Central — Ecommerce structured data:
https://developers.google.com/search/docs/specialty/ecommerce/include-structured-data-relevant-to-ecommerce

Next.js App Router — generateMetadata:
https://nextjs.org/docs/app/api-reference/functions/generate-metadata

Next.js App Router — robots metadata file:
https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots

MDN — Push API best practices:
https://developer.mozilla.org/en-US/docs/Web/API/Push_API/Best_Practices

MDN — Notification permission should be user-gesture based:
https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API
```
