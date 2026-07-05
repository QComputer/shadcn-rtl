# Public Route Decision Matrix

This matrix classifies every public route and API for the B2B repositioning.

## Public Page Routes

| Route Pattern | Current Purpose | Auth | Tenant Scoped | Category | Action | Risk |
|---|---|---|---|---|---|---|
| `/` | Homepage (SSG, marketplace-like) | No | Global | BAZAR_BAZ_MARKETING | Convert to B2B landing in P03 | Low |
| `/:locale` | Locale redirect to `/fa` | No | Global | BAZAR_BAZ_MARKETING | Keep | Low |
| `/:locale/login` | Login page | No | Global | BAZAR_BAZ_MARKETING | Keep | Low |
| `/:locale/register` | User registration | No | Global | BAZAR_BAZ_MARKETING | Keep | Low |
| `/:locale/register/organization` | Organization registration | No | Global | BAZAR_BAZ_MARKETING | Keep | Low |
| `/:locale/domain-not-configured` | Domain not configured page | No | Tenant | TENANT_DIRECT_PUBLIC | Keep | Low |
| `/:locale/appointment/[slug]` | Public appointment/shop view | No | Tenant | TENANT_DIRECT_PUBLIC | Keep | Low |
| `/:locale/appointment/[slug]/appointment/[id]` | Appointment detail | No | Tenant | TENANT_DIRECT_PUBLIC | Keep | Low |
| `/:locale/appointment/[slug]/booking` | Public booking flow | No | Tenant | TENANT_CUSTOMER_FLOW | Keep | Low |
| `/:locale/appointment/[slug]/fanpage` | Public fanpage posts | No | Tenant | DEMO_PORTFOLIO | Convert to demo-only; noindex non-demo | Medium |
| `/:locale/appointment/[slug]/my-appointments` | My appointments (customer) | No | Tenant | TENANT_CUSTOMER_FLOW | Keep | Low |
| `/:locale/appointment/[slug]/services` | Public services list | No | Tenant | TENANT_DIRECT_PUBLIC | Keep | Low |
| `/:locale/appointment/[slug]/services/[serviceId]` | Service detail | No | Tenant | TENANT_DIRECT_PUBLIC | Keep | Low |
| `/:locale/appointment/[slug]/services/category/[categoryId]` | Service category | No | Tenant | TENANT_DIRECT_PUBLIC | Keep | Low |
| `/:locale/appointment/[slug]/staff` | Public staff list | No | Tenant | TENANT_DIRECT_PUBLIC | Keep | Low |
| `/:locale/shop/[slug]` | Shop profile/storefront | No | Tenant | TENANT_DIRECT_PUBLIC | Keep; add demo badge for demo tenants | Low |
| `/:locale/shop/[slug]/category/[categoryId]` | Shop category | No | Tenant | TENANT_DIRECT_PUBLIC | Keep | Low |
| `/:locale/shop/[slug]/checkout` | Shop checkout | No | Tenant | TENANT_CUSTOMER_FLOW | Keep | Low |
| `/:locale/shop/[slug]/fanpage` | Shop fanpage | No | Tenant | DEMO_PORTFOLIO | Convert to demo-only; noindex non-demo | Medium |
| `/:locale/shop/[slug]/order/[orderNumber]` | Order tracking | No | Tenant | TENANT_CUSTOMER_FLOW | Keep | Low |
| `/:locale/shop/[slug]/product/[productId]` | Product detail | No | Tenant | TENANT_DIRECT_PUBLIC | Keep | Low |
| `/:locale/shop/[slug]/profile` | Shop profile edit | No | Tenant | TENANT_DIRECT_PUBLIC | Keep | Low |

## Public API Routes

| API Route | Current Purpose | Auth | Tenant Scoped | Category | Action | Risk |
|---|---|---|---|---|---|---|
| `/api/public/organizations` | Public org listing/search | No | Multi-tenant | MARKETPLACE_DISCOVERY | Restrict to demo tenants only; remove from nav | High |
| `/api/public/search` | Public search across tenants | No | Multi-tenant | MARKETPLACE_DISCOVERY | Restrict to demo tenants only; remove from nav | High |
| `/api/public/organizations/[slug]` | Public org detail | No | Tenant | TENANT_DIRECT_PUBLIC | Keep | Low |
| `/api/public/organizations/[slug]/services` | Public services listing | No | Tenant | TENANT_DIRECT_PUBLIC | Keep | Low |
| `/api/public/organizations/[slug]/services/[serviceId]` | Public service detail | No | Tenant | TENANT_DIRECT_PUBLIC | Keep | Low |
| `/api/public/organizations/[slug]/shop` | Public shop data | No | Tenant | TENANT_DIRECT_PUBLIC | Keep | Low |
| `/api/public/organizations/[slug]/staff` | Public staff list | No | Tenant | TENANT_DIRECT_PUBLIC | Keep | Low |
| `/api/public/organizations/[slug]/booking-settings` | Public booking settings | No | Tenant | TENANT_DIRECT_PUBLIC | Keep | Low |
| `/api/public/organizations/[slug]/fanpage/posts` | Public fanpage posts | No | Tenant | DEMO_PORTFOLIO | Restrict to demo tenants | Medium |
| `/api/public/orders/[orderNumber]` | Public order tracking | No | Order | TENANT_CUSTOMER_FLOW | Keep | Low |
| `/api/public/appointments/[id]` | Public appointment lookup | No | Appointment | TENANT_CUSTOMER_FLOW | Keep | Low |
| `/api/public/appointments/lookup` | Public appointment lookup | No | Global | TENANT_CUSTOMER_FLOW | Keep | Low |
| `/api/public/products/[id]` | Public product detail | No | Tenant | TENANT_DIRECT_PUBLIC | Keep | Low |
| `/api/reviews` | Public reviews list | No | Multi-tenant | MARKETPLACE_DISCOVERY | Noindex; restrict later | Medium |
| `/api/reviews/[id]` | Public review detail | No | Multi-tenant | MARKETPLACE_DISCOVERY | Noindex; restrict later | Medium |
| `/api/public/custom-domain/robots` | robots.txt for custom domains | No | Tenant | BAZAR_BAZ_MARKETING | Keep | Low |
| `/api/public/custom-domain/sitemap` | sitemap.xml for custom domains | No | Tenant | BAZAR_BAZ_MARKETING | Keep | Low |
| `/api/qrcode` | QR code generation | No | Global | BAZAR_BAZ_MARKETING | Keep | Low |
| `/api/health` | Health check | No | Global | BAZAR_BAZ_MARKETING | Keep | Low |
| `/api/images/[id]` | Image serving | No | Global | BAZAR_BAZ_MARKETING | Keep | Low |
| `/api/uploads/[filename]` | File serving | No | Global | BAZAR_BAZ_MARKETING | Keep | Low |

## Dashboard/Admin Routes

All dashboard routes require authentication and are excluded from public surface policy.

## Customer Routes

Customer-facing authenticated routes (`/api/customer/*`) are excluded from public surface policy.

## Summary Counts

- BAZAR_BAZ_MARKETING: 7 routes
- TENANT_DIRECT_PUBLIC: 16 routes
- TENANT_CUSTOMER_FLOW: 8 routes
- DEMO_PORTFOLIO: 3 routes
- MARKETPLACE_DISCOVERY: 4 routes
- LEGACY_UNKNOWN: 0 routes

## Priority Actions

1. **High priority**: Restrict `/api/public/organizations` and `/api/public/search` to demo tenants
2. **Medium priority**: Brand fanpage/review pages as demo-only or noindex
3. **Low priority**: Add demo badges to tenant pages in P04
4. **P03 priority**: Implement B2B homepage to replace marketplace-style homepage
