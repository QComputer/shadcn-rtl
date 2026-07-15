# Bazar Baz Handoff Snapshot 03 - Route Inventory

Route source inspected under `app/` on 2026-07-15.

## Public Routes

| Route | Purpose | Auth | Tenant Scope | B2B Relevance | Recommendation |
| --- | --- | --- | --- | --- | --- |
| `/` | Root entry | none | platform | redirects to Persian-first `/fa` | keep |
| `/:locale` | B2B homepage | none | platform | primary business-owner landing | keep |
| `/:locale/features` | Feature explanation | none | platform | core B2B sales page | keep |
| `/:locale/dashboard-showcase` | Dashboard workflow showcase | none | platform | B2B proof/explainer | keep |
| `/:locale/demo` | Curated demo portfolio | none | platform demo-only | replaces marketplace discovery | keep |
| `/:locale/request-demo` | Public lead capture | none | platform | conversion funnel | keep |
| `/:locale/pricing` | Pricing/package copy | none | platform | conversion funnel | keep |
| `/:locale/contact` | Contact/onboarding path | none | platform | conversion funnel | keep |
| `/:locale/trust` | Trust/data ownership | none | platform | B2B reassurance | keep |
| `/:locale/privacy` | Privacy starter copy | none | platform | legal/trust | keep |
| `/:locale/terms` | Terms starter copy | none | platform | legal/trust | keep |
| `/:locale/login` | Login | public form | platform | operator/customer entry | keep |
| `/:locale/register` | User registration | public form | platform | onboarding entry | keep |
| `/:locale/register/organization` | Organization registration | public form | platform | business onboarding | keep |
| `/:locale/onboarding` | P12 business onboarding wizard | authenticated/flow-dependent | platform to tenant | next provisioning input | keep |
| `/:locale/shop/:slug` | Tenant shop homepage | none | tenant direct | preserved tenant public surface | keep |
| `/:locale/shop/:slug/category/:categoryId` | Shop category page | none | tenant direct | customer flow | keep |
| `/:locale/shop/:slug/product/:productId` | Product detail | none | tenant direct | customer flow | keep |
| `/:locale/shop/:slug/checkout` | Checkout | customer/session | tenant direct | customer transaction flow | keep |
| `/:locale/shop/:slug/order/:orderNumber` | Order tracking | token/lookup style | tenant direct | customer service flow | keep |
| `/:locale/shop/:slug/profile` | Customer/shop profile | customer/session | tenant direct | customer retention | keep |
| `/:locale/shop/:slug/fanpage` | Tenant fanpage posts | mixed | tenant direct | legacy/community surface | review later, do not expand as social network |
| `/:locale/appointment/:slug` | Appointment org homepage | none | tenant direct | service business public page | keep |
| `/:locale/appointment/:slug/services` | Service listing | none | tenant direct | booking funnel | keep |
| `/:locale/appointment/:slug/services/:serviceId` | Service detail | none | tenant direct | booking funnel | keep |
| `/:locale/appointment/:slug/booking` | Booking flow | customer/session | tenant direct | customer transaction flow | keep |
| `/:locale/appointment/:slug/my-appointments` | Appointment lookup | customer/phone lookup | tenant direct | customer service flow | keep |
| `/:locale/domain-not-configured` | Safe custom-domain fallback | none | platform/custom host | P11 safety surface | keep |
| `/robots.txt`, `/sitemap.xml`, `/og-image`, `/manifest.webmanifest` | SEO/PWA metadata | none | platform/custom-aware | SEO/PWA | keep |
| `/uploads/:filename` | Local upload serving fallback | none | media | legacy media | keep with access review |

## Dashboard Routes

| Route | Roles | Organization Scope | Purpose |
| --- | --- | --- | --- |
| `/:locale/dashboard` | authenticated roles | current org or global for SUPER_ADMIN | dashboard overview |
| `/:locale/dashboard/orders` | ADMIN/MANAGER/STAFF/DRIVER variants | organization | order operations |
| `/:locale/dashboard/driver-orders` | DRIVER plus managers | organization | driver dispatch/map |
| `/:locale/dashboard/products`, `/products/new`, `/products/:id` | ADMIN/MANAGER/STAFF read variants | organization | product catalog |
| `/:locale/dashboard/product-categories` | ADMIN/MANAGER/STAFF read variants | organization | product taxonomy |
| `/:locale/dashboard/services`, `/services/new`, `/services/:id` | ADMIN/MANAGER/STAFF | organization | appointment service catalog |
| `/:locale/dashboard/service-categories` | ADMIN/MANAGER/STAFF | organization | service taxonomy |
| `/:locale/dashboard/appointments`, `/appointments/:id`, `/appointments/:id/edit` | ADMIN/MANAGER/STAFF | organization | appointment operations |
| `/:locale/dashboard/calendar` | ADMIN/MANAGER/STAFF | organization | calendar management |
| `/:locale/dashboard/customer-club` | ADMIN/MANAGER/STAFF | organization | engagement hub |
| `/:locale/dashboard/customer-club/members` | ADMIN/MANAGER/STAFF | organization | customer club membership |
| `/:locale/dashboard/customer-club/segments` | ADMIN/MANAGER | organization | segmentation |
| `/:locale/dashboard/customer-club/campaigns/**` | ADMIN/MANAGER | organization | campaigns |
| `/:locale/dashboard/customer-club/coupons` | ADMIN/MANAGER | organization | coupons |
| `/:locale/dashboard/customer-club/loyalty` | ADMIN/MANAGER | organization | loyalty rules |
| `/:locale/dashboard/customer-club/push` | ADMIN/MANAGER/STAFF | organization | Web Push operations |
| `/:locale/dashboard/notification-operations` | ADMIN/MANAGER/STAFF/SUPER_ADMIN | organization | notification/SMS/Web Push operations |
| `/:locale/dashboard/notifications` | authenticated | user/org | notification inbox |
| `/:locale/dashboard/imports` | ADMIN/MANAGER; SUPER_ADMIN with org selection | organization | import hub |
| `/:locale/dashboard/exports` | ADMIN/MANAGER; SUPER_ADMIN with org selection | organization | export hub |
| `/:locale/dashboard/settings` | ADMIN/MANAGER | organization | settings hub |
| `/:locale/dashboard/settings/organization` | ADMIN/MANAGER | organization | org profile/media/settings |
| `/:locale/dashboard/settings/domains` | ADMIN/MANAGER | organization | P11 tenant custom-domain onboarding |
| `/:locale/dashboard/shop-domains` | SUPER_ADMIN | global oversight | legacy/global domain admin |
| `/:locale/dashboard/organizations`, `/organizations/new` | SUPER_ADMIN | global | organization management |
| `/:locale/dashboard/users` | SUPER_ADMIN | global | user management |
| `/:locale/dashboard/request-demo-leads` | SUPER_ADMIN | global | P10 lead review |
| `/:locale/dashboard/members` | ADMIN/MANAGER | organization | organization members |
| `/:locale/dashboard/qrcode` | ADMIN/MANAGER | organization | QR code tools |
| `/:locale/dashboard/creative-studio` | ADMIN/MANAGER gated | organization | creative tooling, not current priority |

## API Route Groups

| Route Group | Methods | Authentication | Mutation/Read | Security Notes |
| --- | --- | --- | --- | --- |
| `/api/auth/**` | GET/POST | public/session | mutation | NextAuth and registration flows |
| `/api/request-demo` | POST | public, rate-limited | mutation | stores leads, does not create tenants/users or send SMS |
| `/api/dashboard/request-demo-leads/**` | GET/PATCH | SUPER_ADMIN | read/mutation | masks phone, audit/log status review |
| `/api/dashboard/organization-domains/**` | GET/POST/PATCH | authenticated org ADMIN/MANAGER | read/mutation | organization-scoped, ACTIVE-only primary, Vercel mutation gated |
| `/api/dashboard/shop-domains/**` | GET/POST/PATCH/DELETE | SUPER_ADMIN | read/mutation | global domain oversight, strict validator |
| `/api/internal/domain-resolver` | GET | internal secret from proxy | read | resolves ACTIVE custom domains only |
| `/api/internal/shop-primary-domain` | GET | internal/admin usage | read | primary custom-domain redirect support |
| `/api/public/organizations`, `/api/public/search` | GET | public | read | broad discovery classified restricted; do not promote |
| `/api/public/organizations/:slug/**` | GET mostly, fanpage POST guarded | public/tenant guarded | read/mutation | tenant direct public surface |
| `/api/public/orders/:orderNumber` | GET/PUT | public lookup/session-aware | read/mutation | order tracking; avoids broad exposure |
| `/api/public/appointments/**` | GET/POST | public lookup | read/mutation | appointment lookup/direct customer flow |
| `/api/products/**`, `/api/product-categories/**` | GET/POST/PATCH/DELETE | dashboard auth for writes | read/mutation | org-scoped via service guards |
| `/api/services/**`, `/api/service-categories/**` | GET/POST/PATCH/DELETE | dashboard auth for writes | read/mutation | org-scoped via service guards |
| `/api/orders/**` | GET/POST/PUT/PATCH/DELETE | role/resource guarded | read/mutation | customer/admin/driver access split |
| `/api/appointments/**` | GET/POST/PATCH/DELETE | role/resource guarded | read/mutation | customer/staff/admin access split |
| `/api/cart/**` | GET/POST/PATCH/DELETE | customer/session | read/mutation | tenant/customer flow |
| `/api/customer/**` | GET/POST/PATCH/DELETE | customer auth | read/mutation | notification preferences and push subscriptions |
| `/api/customer-club/membership` | GET/POST/PATCH/DELETE | customer/session | read/mutation | membership enrollment |
| `/api/dashboard/customer-club/**` | GET/POST/PATCH/DELETE | org role guarded | read/mutation | engagement tools |
| `/api/dashboard/notification-operations/**` | GET/POST for reconcile | org role guarded | read/reconcile | SMS/Web Push diagnostics, masked data, no secret exposure |
| `/api/dashboard/notifications` | GET/POST/PATCH | authenticated | read/mutation | in-app notifications |
| `/api/dashboard/imports/**` | GET/POST | org ADMIN/MANAGER | read/mutation | import jobs, review, retry, SSE events |
| `/api/dashboard/exports/**` | GET/POST | org ADMIN/MANAGER | read/mutation | export jobs/downloads |
| `/api/dashboard/creative-studio/**` | GET/POST | org role/gates | read/mutation | present but not current priority |
| `/api/upload`, `/api/images/**`, `/uploads/:filename` | POST/GET/DELETE | upload requires dashboard roles | media mutation/read | Vercel Blob/local media path |
| `/api/users/**`, `/api/organizations/**` | GET/POST/PATCH/DELETE | role/org guarded | read/mutation | SUPER_ADMIN or current org manager/admin |
| `/api/health` | GET | public safe | read | health only, no secret values |

