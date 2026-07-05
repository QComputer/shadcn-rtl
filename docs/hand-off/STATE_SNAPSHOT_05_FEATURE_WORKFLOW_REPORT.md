# STATE-SNAPSHOT-05: Feature/Workflow Report

Generated: 2026-07-05
Project: Bazar Baz / shadcn-rtl

## Multi-Tenant Organization Model
- **Status**: Implemented
- **Details**: Organization-based multi-tenancy with OrganizationMember roles
- **Roles**: SUPER_ADMIN, ADMIN, MANAGER, STAFF, DRIVER, CUSTOMER, GUEST
- **Validation**: `quality:tenant-identity`, `quality:members-provider-hardening`
- **Known blockers**: None
- **Future recommendation**: Add org-level billing/subscription tiers for B2B SaaS

## Shop/E-Commerce Workflow
- **Status**: Implemented
- **Details**: Products, categories, variants, cart, checkout, orders, payments
- **Public shop pages**: Functional (`/:locale/shop/[slug]`, checkout, order tracking)
- **Validation**: `quality:commerce-correctness`, `quality:shop-domain-admin`
- **Known blockers**: None
- **Future recommendation**: Reposition as demo/example shops for B2B positioning

## Product/Category/Cart/Order/Payment Workflow
- **Status**: Implemented
- **Details**: Full CRUD for products, categories, variants; cart items; order lifecycle; payment events; progress tracking; order status history
- **Payment**: Configurable per organization (`PaymentSettings`)
- **Validation**: Multiple validators present
- **Known blockers**: None

## Service/Appointment Booking Workflow
- **Status**: Implemented
- **Details**: Services, service categories, staff availability, booking sessions, appointments
- **Public booking**: Customer-facing booking flow exists
- **Calendar dashboard**: Staff view with calendar
- **Validation**: `quality:appointment-correctness`
- **Known blockers**: None

## Customer Club
- **Status**: Implemented
- **Details**: Membership, segments, campaigns, coupons, loyalty rules, ledger
- **Segments**: Rule-based + manual snapshots
- **Campaigns**: Audience targeting, message sending, delivery tracking
- **Validation**: `quality:customer-club-foundation`, `quality:customer-segments`, `quality:campaign-builder`, `quality:loyalty-coupons`
- **Known blockers**: None

## Coupons/Loyalty/Segments
- **Status**: Implemented
- **Details**: Coupon codes, redemption tracking, loyalty rules, ledger entries
- **Validation**: `quality:loyalty-coupons`
- **Known blockers**: None

## Campaign Builder
- **Status**: Implemented
- **Details**: Multi-channel campaign creation, audience selection, send scheduling
- **Validation**: `quality:campaign-builder`
- **Known blockers**: None

## Notifications
- **Status**: Implemented (P120A-P120C complete)
- **Details**: In-app notification inbox, operational order notifications, customer lifecycle routing, delivery observability, retry policy
- **Models**: Notification, NotificationDeliveryAttempt, NotificationPreference, NotificationPermissionEvent
- **Validation**: `quality:notification-operations`, `quality:notification-delivery-observability`, `quality:notification-retry-policy`
- **Known blockers**: None

## SMS.ir Integration
- **Status**: Implemented (P120D-P120F complete)
- **Details**: SMS.ir provider with dry-run default, real-send gated, delivery reports, reconciliation, official report endpoints
- **Models**: SmsDelivery
- **Migration**: `20260703000200_notification_delivery_attempt` applied locally; production applied via Neon serverless script
- **Validation**: `quality:sms-ir-provider-completion`, `quality:sms-real-send-gates`, `quality:sms-delivery-reports`, `quality:sms-provider-reconciliation`, `quality:sms-provider-report-endpoints`
- **Known blockers**: Production DB connectivity during local static generation (expected)

## Web Push Integration
- **Status**: Implemented
- **Details**: VAPID-based Web Push, dashboard opt-in, customer push subscriptions, dry-run mode
- **Models**: PushSubscription, WebPushDelivery
- **Validation**: `quality:web-push-foundation`, `quality:web-push-delivery`, `quality:web-push-capability-detection`
- **Known blockers**: VAPID key corruption in Vercel resolved (regenerated 2026-07-05)

## Notification Operations Dashboard
- **Status**: Implemented and deployed
- **Details**: Unified dashboard for SMS diagnostics, delivery reports, Web Push status, provider reconciliation
- **Route**: `/dashboard/notification-operations`
- **Access control**: Registered in `dashboardRouteConfig` (fixed in commit `b6c7e50`)
- **Validation**: `quality:notification-ops-deployed-safety`, `quality:realtime-production-config`
- **Known blockers**: Playwright browser binary download blocked by geographic CDN restriction on this Windows runner

## Creative Studio (Current State)
- **Status**: Implemented but NOT the next focus
- **Details**: AI image generation, organization brand provider, asset review, apply/rollback workflow
- **Models**: CreativeStudioJob, CreativeStudioAsset, CreativeStudioUsageEvent
- **Validation**: Multiple creative-studio validators exist
- **Known blockers**: None
- **Future recommendation**: Defer to post-B2B-repositioning phase

## AI Media Service Integration
- **Status**: Implemented with external provider
- **Details**: External AI media service hosted on Render (`https://bazar-baz-ai-media-service.onrender.com`)
- **Models**: AiMediaJob, AiMediaUsageEvent
- **Validation**: `quality:ai-media`, `quality:ai-media-health-gate`, `quality:ai-media-durable-storage`
- **Known blockers**: External dependency on Render service

## Dashboard/Admin Workflows
- **Status**: Implemented
- **Details**: Organization management, user management, shop domains, settings, import/export, QR codes, media management
- **Role-based access**: Enforced via `lib/access-control.ts`
- **Super-admin**: Organizations, users, shop domains
- **Manager/Admin**: Full org management
- **Staff**: Appointments and services
- **Driver**: Driver orders/location

## Role/Permission Model
- **Status**: Implemented
- **Details**: Role-based access control with `OrgManagementRoles`, `AppointmentWorkflowRoles`, `AllAuthenticatedRoles`
- **Validation**: `quality:dashboard-role-navigation`, `quality:dashboard-route-authorization`, `quality:dashboard-route-guard-smoke`
- **Known blockers**: None

## Localization/RTL
- **Status**: Implemented
- **Details**: Persian-first with en/ar support, RTL layout, dictionary-based i18n, Jalali date adapter
- **Validation**: `quality:i18n-rtl`, `quality:i18n-completion`
- **Known blockers**: None

## File/Blob Storage
- **Status**: Implemented
- **Details**: Vercel Blob storage, image upload API, media serving
- **Validation**: `quality:vercel-domain-automation` (partial)
- **Known blockers**: None

## PWA/Offline
- **Status**: Partial
- **Details**: Service worker registration for Web Push, but no full offline shell/PWA manifest optimization
- **Validation**: `quality:pwa-foundation`, `quality:pwa-offline-shell`
- **Known blockers**: 2 validation checks failing per `quality:local`

## Import/Export
- **Status**: Implemented
- **Details**: CSV/Excel importer, manual Instagram import, text extraction, image/PDF menu import, Snappfood/Snappmarket URL import, Telegram post import, export jobs
- **Validation**: Multiple import/export validators
- **Known blockers**: None

## Custom Domains
- **Status**: Implemented
- **Details**: Custom domain management per organization, Vercel domain automation, SEO hardening
- **Validation**: `quality:shop-custom-domains`, `quality:shop-domain-admin`, `quality:vercel-domain-automation`
- **Known blockers**: None

## Fanpage/Social
- **Status**: Implemented
- **Details**: Fanpage posts, social preview (OG images), social preview evidence
- **Validation**: `quality:fanpage-readiness`, `quality:fanpage-mvp`, `quality:social-preview-evidence`
- **Known blockers**: Social features may not align with B2B strategy

## Overall Feature Maturity
- Core platform: Production-ready
- Notifications/SMS/Web Push: Production-ready with deployed validation
- AI Media: Production-ready with external provider
- Creative Studio: Production-ready but deprioritized
- Public B2B positioning: Not started
