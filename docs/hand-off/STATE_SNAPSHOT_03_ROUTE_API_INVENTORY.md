# STATE-SNAPSHOT-03: Route and API Inventory

Generated: 2026-07-05
Project: Bazar Baz / shadcn-rtl

## Public Routes
| Path | Purpose | Auth | Tenant Scope | Mutation | B2B Fit |
|------|---------|------|--------------|----------|---------|
| `/` | Homepage (SSG) | No | Global | No | Needs B2B repositioning |
| `/:locale` | Locale redirect | No | Global | No | OK |
| `/:locale/login` | Login | No | Global | No | OK |
| `/:locale/register` | User registration | No | Global | Yes | OK |
| `/:locale/register/organization` | Organization registration | No | Global | Yes | OK |
| `/:locale/domain-not-configured` | Domain not configured page | No | Tenant | No | OK |
| `/:locale/appointment/[slug]` | Public appointment/shop view | No | Tenant | No | OK |
| `/:locale/appointment/[slug]/appointment/[id]` | Appointment detail | No | Tenant | No | OK |
| `/:locale/appointment/[slug]/booking` | Public booking flow | No | Tenant | Yes | OK |
| `/:locale/appointment/[slug]/fanpage` | Public fanpage posts | No | Tenant | No | OK |
| `/:locale/appointment/[slug]/my-appointments` | My appointments (customer) | No | Tenant | No | OK |
| `/:locale/appointment/[slug]/services` | Public services list | No | Tenant | No | OK |
| `/:locale/appointment/[slug]/services/[serviceId]` | Service detail | No | Tenant | No | OK |
| `/:locale/appointment/[slug]/services/category/[categoryId]` | Service category | No | Tenant | No | OK |
| `/:locale/appointment/[slug]/staff` | Public staff list | No | Tenant | No | OK |
| `/:locale/shop/[slug]` | Shop profile | No | Tenant | No | OK |
| `/:locale/shop/[slug]/category/[categoryId]` | Shop category | No | Tenant | No | OK |
| `/:locale/shop/[slug]/checkout` | Shop checkout | No | Tenant | Yes | OK |
| `/:locale/shop/[slug]/fanpage` | Shop fanpage | No | Tenant | No | OK |
| `/:locale/shop/[slug]/order/[orderNumber]` | Order tracking | No | Tenant | No | OK |
| `/:locale/shop/[slug]/product/[productId]` | Product detail | No | Tenant | No | OK |
| `/:locale/shop/[slug]/profile` | Shop profile edit | No | Tenant | Yes | OK |

## Dashboard Routes
| Path | Purpose | Auth | Roles | Tenant | Mutation | B2B Fit |
|------|---------|------|-------|--------|----------|---------|
| `/dashboard` | Dashboard home | Yes | ALL_AUTHENTICATED | Yes | No | OK |
| `/dashboard/appointments` | Appointment management | Yes | APPOINTMENT_WORKFLOW_ROLES | Yes | Yes | OK |
| `/dashboard/appointments/[id]` | Appointment detail | Yes | APPOINTMENT_WORKFLOW_ROLES | Yes | Yes | OK |
| `/dashboard/appointments/[id]/edit` | Edit appointment | Yes | APPOINTMENT_WORKFLOW_ROLES | Yes | Yes | OK |
| `/dashboard/calendar` | Calendar view | Yes | APPOINTMENT_WORKFLOW_ROLES | Yes | No | OK |
| `/dashboard/creative-studio` | AI media/creative studio | Yes | ORG_MANAGEMENT_ROLES | Yes | Yes | OK |
| `/dashboard/customer-club` | Customer club hub | Yes | ORG_MANAGEMENT_ROLES | Yes | No | OK |
| `/dashboard/customer-club/campaigns` | Campaign list | Yes | ORG_MANAGEMENT_ROLES | Yes | Yes | OK |
| `/dashboard/customer-club/campaigns/new` | New campaign | Yes | ORG_MANAGEMENT_ROLES | Yes | Yes | OK |
| `/dashboard/customer-club/campaigns/[id]` | Campaign detail | Yes | ORG_MANAGEMENT_ROLES | Yes | Yes | OK |
| `/dashboard/customer-club/coupons` | Coupon management | Yes | ORG_MANAGEMENT_ROLES | Yes | Yes | OK |
| `/dashboard/customer-club/loyalty` | Loyalty rules | Yes | ORG_MANAGEMENT_ROLES | Yes | Yes | OK |
| `/dashboard/customer-club/members` | Member management | Yes | ORG_MANAGEMENT_ROLES | Yes | Yes | OK |
| `/dashboard/customer-club/push` | Push campaigns | Yes | ORG_MANAGEMENT_ROLES | Yes | Yes | OK |
| `/dashboard/customer-club/segments` | Customer segments | Yes | ORG_MANAGEMENT_ROLES | Yes | Yes | OK |
| `/dashboard/driver-orders` | Driver order board | Yes | DRIVER | Yes | Yes | OK |
| `/dashboard/exports` | Export jobs | Yes | ORG_MANAGEMENT_ROLES | Yes | Yes | OK |
| `/dashboard/imports` | Import jobs | Yes | ORG_MANAGEMENT_ROLES | Yes | Yes | OK |
| `/dashboard/members` | Organization members | Yes | ORG_MANAGEMENT_ROLES | Yes | Yes | OK |
| `/dashboard/notification-operations` | Notification ops dashboard | Yes | ORG_MANAGEMENT_ROLES | Yes | No | OK |
| `/dashboard/notifications` | In-app notifications | Yes | ALL_AUTHENTICATED | Yes | No | OK |
| `/dashboard/orders` | Order management | Yes | ORG_MANAGEMENT_ROLES | Yes | Yes | OK |
| `/dashboard/organizations` | Organization list | Yes | SUPER_ADMIN | Yes | Yes | SUPER_ADMIN only |
| `/dashboard/organizations/new` | New organization | Yes | SUPER_ADMIN | Yes | Yes | SUPER_ADMIN only |
| `/dashboard/product-categories` | Product categories | Yes | ORG_MANAGEMENT_ROLES | Yes | Yes | OK |
| `/dashboard/products` | Product list | Yes | ORG_MANAGEMENT_ROLES | Yes | Yes | OK |
| `/dashboard/products/new` | New product | Yes | ORG_MANAGEMENT_ROLES | Yes | Yes | OK |
| `/dashboard/products/[id]` | Product detail | Yes | ORG_MANAGEMENT_ROLES | Yes | Yes | OK |
| `/dashboard/qrcode` | QR code generation | Yes | ORG_MANAGEMENT_ROLES | Yes | Yes | OK |
| `/dashboard/service-categories` | Service categories | Yes | ORG_MANAGEMENT_ROLES | Yes | Yes | OK |
| `/dashboard/services` | Service list | Yes | APPOINTMENT_WORKFLOW_ROLES | Yes | Yes | OK |
| `/dashboard/services/new` | New service | Yes | APPOINTMENT_WORKFLOW_ROLES | Yes | Yes | OK |
| `/dashboard/services/[id]` | Service detail | Yes | APPOINTMENT_WORKFLOW_ROLES | Yes | Yes | OK |
| `/dashboard/settings` | Settings hub | Yes | ALL_AUTHENTICATED | Yes | No | OK |
| `/dashboard/settings/organization` | Org settings | Yes | ORG_MANAGEMENT_ROLES | Yes | Yes | OK |
| `/dashboard/shop-domains` | Custom domains | Yes | SUPER_ADMIN | Yes | Yes | SUPER_ADMIN only |
| `/dashboard/users` | User management | Yes | SUPER_ADMIN | Yes | Yes | SUPER_ADMIN only |

## Customer Routes
| Path | Purpose | Auth | Tenant | Mutation | B2B Fit |
|------|---------|------|--------|----------|---------|
| `/api/customer/notification-preferences` | Customer notification prefs | Yes | Customer | Yes | OK |
| `/api/customer/notifications` | Customer notifications inbox | Yes | Customer | No | OK |
| `/api/customer/push-subscriptions` | Customer push subscribe | Yes | Customer | Yes | OK |
| `/api/customer-club/membership` | Customer club membership | Yes | Customer | Yes | OK |

## Shop/Business Routes (Public)
| Path | Purpose | Auth | Tenant | Mutation | B2B Fit |
|------|---------|------|--------|----------|---------|
| `/:locale/shop/[slug]` | Shop storefront | No | Yes | No | OK |
| `/:locale/shop/[slug]/checkout` | Checkout | No | Yes | Yes | OK |
| `/:locale/shop/[slug]/order/[orderNumber]` | Order tracking | No | Yes | No | OK |

## Auth-Only APIs
| Path | Method | Purpose |
|------|--------|---------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth handler |
| `/api/auth/register` | POST | User registration |
| `/api/auth/register/organization` | POST | Organization registration |

## Admin/Super-Admin APIs
| Path | Method | Purpose |
|------|--------|---------|
| `/api/dashboard/organizations` | GET | List all orgs |
| `/api/dashboard/organizations/new` | POST | Create org |
| `/api/dashboard/users` | GET | List users |
| `/api/dashboard/shop-domains` | GET/POST | Domain management |
| `/api/dashboard/shop-domains/[domainId]/vercel` | POST | Vercel domain automation |

## Notification/SMS/Web Push APIs
| Path | Method | Purpose | Auth |
|------|--------|---------|------|
| `/api/dashboard/notification-operations` | GET | Operations dashboard data | Dashboard admin |
| `/api/dashboard/notification-operations/sms-ir/status` | GET | SMS provider status | Dashboard admin |
| `/api/dashboard/notification-operations/sms-ir/lines` | GET | SMS lines/config | Dashboard admin |
| `/api/dashboard/notification-operations/sms-ir/deliveries` | GET | SMS delivery list | Dashboard admin |
| `/api/dashboard/notification-operations/sms-ir/deliveries/[deliveryId]` | GET | SMS delivery detail | Dashboard admin |
| `/api/dashboard/notification-operations/sms-ir/deliveries/[deliveryId]/reconcile` | POST | Reconcile delivery | Dashboard admin |
| `/api/dashboard/notification-operations/sms-ir/reports/live` | GET | Live SMS report | Dashboard admin |
| `/api/dashboard/notification-operations/sms-ir/reports/archive` | GET | Archive SMS report | Dashboard admin |
| `/api/dashboard/notification-operations/sms-ir/reports/packs` | GET | Pack SMS report | Dashboard admin |
| `/api/dashboard/notification-operations/web-push/status` | GET | Web Push diagnostics | Dashboard admin |
| `/api/dashboard/push-subscriptions` | GET/POST/DELETE | Dashboard push subscriptions | Dashboard admin |
| `/api/dashboard/notifications` | GET | Dashboard notifications | Dashboard admin |
| `/api/customer/notifications` | GET | Customer notifications | Customer |
| `/api/customer/push-subscriptions` | POST | Customer push subscribe | Customer |

## Ops/Migration APIs
| Path | Method | Purpose |
|------|--------|---------|
| `/api/internal/creative-studio/provider-results/organization-brand` | POST | Internal provider result ingestion |
| `/api/internal/domain-resolver` | GET | Internal domain resolution |
| `/api/internal/shop-primary-domain` | GET | Internal shop primary domain |

## Route Gaps / Notes
- `/dashboard/notification-operations` was missing from access-control registry and was fixed in commit `b6c7e50`
- No public marketplace/search listing page exists for B2B strategy (public listing is shop-centric)
- No `/api/dashboard/notification-operations` SMS send trigger (read-only diagnostics + reconciliation only)
- No public B2B landing page sections beyond the generic homepage
