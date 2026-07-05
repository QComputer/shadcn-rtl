# STATE-SNAPSHOT-02: App Inventory

Generated: 2026-07-05
Project: Bazar Baz / shadcn-rtl

## Tech Stack
- Framework: Next.js 16.2.7 (App Router)
- React: 19.x (with react-compiler)
- Language: TypeScript 5.9.3
- ORM: Prisma 6.19.3
- Database: PostgreSQL (Neon serverless, pooler + unpooled)
- Auth: NextAuth v4 (credentials provider + optional Google OAuth)
- UI: shadcn/ui + Tailwind CSS v4
- Icons: lucide-react
- Charts: recharts
- Push: web-push + native PushManager/Notification API
- SMS: SMS.ir provider (dry-run default, real-send gated)
- AI Media: External service (`https://bazar-baz-ai-media-service.onrender.com`)
- Storage: Vercel Blob (`store_HOxsONRu2ZpG4wlo`)
- Maps/OSRM: External OSRM integration
- Validation: Zod
- PDF/Import: CSV/Excel/PDF/Instagram/Telegram/Snappfood/Snappmarket importers

## Package Manager
- pnpm 10.15.0 (pnpm-lock.yaml v9)

## Main Scripts
- `dev`: next dev
- `build`: npx prisma generate && next build
- `start`: next start
- `lint`: eslint
- `db:generate`: prisma generate
- `db:validate`: prisma validate
- `db:migrate`: prisma migrate deploy
- `db:migrate:neon`: PowerShell Neon data migration script
- `typecheck`: tsc --noEmit --incremental false
- `quality:local`: node scripts/quality/validate-project.mjs
- `quality:source-baseline`: validate source baseline
- `quality:notification-operations`: validate notification ops
- `quality:sms-ir-provider-completion`: validate SMS.ir integration
- `quality:sms-real-send-gates`: validate SMS real-send safety
- `quality:sms-delivery-reports`: validate SMS delivery reports
- `quality:sms-provider-reconciliation`: validate SMS reconciliation
- `quality:sms-provider-report-endpoints`: validate SMS report endpoints
- `e2e:deployed:notification-operations`: Playwright smoke for notification ops
- `e2e:deployed:sms-notif-ops`: Playwright smoke for SMS + notification ops
- `e2e:deployed:pwa-push-sms`: Playwright smoke for PWA/Push/SMS
- `e2e:deployed:all`: full deployed smoke suite

## App Directory Structure
- `app/[locale]/` — localized routes (fa, en, ar)
  - `layout.tsx` — root locale layout
  - `page.tsx` — public homepage
  - `login/`, `register/`, `register/organization/` — auth flows
  - `dashboard/` — authenticated dashboard module
  - `shop/[slug]/` — public shop pages
  - `appointment/[slug]/` — public appointment/shop pages
- `app/api/` — REST API routes
- `app/og-image/` — OG image generation
- `app/uploads/` — file serving

## Dashboard Modules
- appointments (list, detail, edit)
- calendar
- creative-studio (AI image generation, brand assets)
- customer-club (campaigns, coupons, loyalty, members, segments, push)
- driver-orders
- exports/imports
- members
- notification-operations (SMS diagnostics, delivery reports, Web Push status)
- notifications
- orders
- organizations (super-admin)
- product-categories
- products (with AI image suggestions)
- qrcode
- service-categories
- services
- settings (organization settings)
- shop-domains (custom domain + Vercel automation)
- users (super-admin)

## Public Modules
- Homepage (`/`, `/fa`, `/en`, `/ar`)
- Shop profile, products, categories, checkout, order tracking
- Appointment booking, staff, services
- Fanpage posts
- Public order tracking by order number
- Public organization search
- Custom domain robots/sitemap

## API Modules
- Auth (register, login, NextAuth)
- Appointments (CRUD, confirm, reschedule)
- Cart (items)
- Conversations + messages
- Customer (notification-preferences, notifications, push-subscriptions)
- Customer-club (membership, campaigns, coupons, loyalty, segments, push)
- Dashboard (extensive: creative-studio, ai-media, imports, exports, notification-operations, products, shop-domains, etc.)
- Driver (location)
- Health
- Images (upload, serve)
- Internal (creative-studio provider results, domain resolver, shop primary domain)
- Orders (CRUD, assign-driver, driver, payment)
- Organizations (open, CRUD, booking-settings, business-hours, domains, members, payment, settings)
- Product-categories
- Products (CRUD, variants)
- Public (appointments, orders, organizations, products, search)
- QR code
- Reviews
- Service-categories, services (with slots)
- Upload
- Users (me, CRUD)

## Database Models Summary (67 models)
Core:
- Organization, OrganizationMember, User, OrganizationSettings, PaymentSettings, BookingSettings
- ServiceCategory, Service, StaffAvailability, Appointment, BookingSession, BusinessHour
- ProductCategory, Product, ProductVariant, Image, InventoryMovement
- ShopCart, ShopCartItem, Order, OrderItem, Progress, OrderStatusHistory, OrderMessage
- Payment, PaymentEvent
- Promotion, Review, FanpagePost
- Conversation, ConversationParticipant, Message
- Location, AuditLog, PasswordReset, EmailVerification
- OrganizationDomain, Deny

Notifications/SMS:
- Notification, NotificationDeliveryAttempt, NotificationPreference, NotificationPermissionEvent
- PushSubscription, WebPushDelivery
- SmsDelivery

Customer Club:
- CustomerClubMembership, CustomerSegment, CustomerSegmentRule, CustomerSegmentSnapshot
- Campaign, CampaignAudience, CampaignMessage, CampaignDelivery
- LoyaltyLedger, LoyaltyRule, Coupon, CouponRedemption

Creative Studio:
- CreativeStudioJob, CreativeStudioAsset, CreativeStudioUsageEvent

AI Media:
- AiMediaJob, AiMediaUsageEvent

Import/Export:
- ExternalImportSource, ExternalImportJob, ImportedProductDraft, ImportedContentDraft
- ExportJob

Other:
- TimeInterval, GuestCustomer, Follow

## I18n/Locales
- Supported: fa (Persian), en (English), ar (Arabic)
- RTL-first design for Persian/Arabic
- Dictionary-based translation system (`getDictionary`, `getDictValue`)
- Persian is the primary/default locale

## Auth/Session Model
- NextAuth v4 credentials provider
- Optional Google OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- Session cookie: `guest_session_id`
- Roles: SUPER_ADMIN, ADMIN, MANAGER, STAFF, DRIVER, CUSTOMER, GUEST
- Organization-based multi-tenancy
- Organization membership required for dashboard access

## Deployment Assumptions
- Production: Vercel
- Domain: https://www.bazar-baz.ir
- Database: Neon PostgreSQL (serverless, pooler + unpooled)
- Blob storage: Vercel Blob
- AI media: External Render service
- SMS: SMS.ir API (dry-run by default)
- Web Push: Native browser Push API + web-push library
- Environment: 24+ production env vars synced via Vercel CLI
