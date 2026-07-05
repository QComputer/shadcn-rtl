# BB-B2B-P01 — Public Surface Policy and Route Audit

Generated: 2026-07-05
Project: Bazar Baz / shadcn-rtl

## Goal

Create a route policy and implementation plan for public surfaces without breaking tenant customer flows.

## Route Inventory Summary

Total public routes audited: 80+ page/layout routes + 90+ API routes.

### Route Categories

| Category | Code | Policy |
|---|---|---|
| BAZAR_BAZ_MARKETING | MKT | Should remain and be improved for B2B positioning |
| TENANT_DIRECT_PUBLIC | TENANT | Tenant shop/service pages, must remain functional |
| TENANT_CUSTOMER_FLOW | FLOW | Checkout/booking/order tracking, must remain functional |
| DEMO_PORTFOLIO | DEMO | Curated examples only, explicitly marked as demo |
| MARKETPLACE_DISCOVERY | MKT-DISC | Remove from nav, restrict/noindex/redirect later |
| LEGACY_UNKNOWN | UNKNOWN | Needs manual review before action |

### Public Route Decision Matrix

| Route Pattern | Current Purpose | Auth | Tenant Scoped | Category | Action | Risk |
|---|---|---|---|---|---|---|
| `/` | Homepage (SSG) | No | Global | MKT | Convert to B2B landing | Low |
| `/:locale` | Locale redirect | No | Global | MKT | Keep | Low |
| `/:locale/login` | Login | No | Global | MKT | Keep | Low |
| `/:locale/register` | User registration | No | Global | MKT | Keep | Low |
| `/:locale/register/organization` | Org registration | No | Global | MKT | Keep | Low |
| `/:locale/domain-not-configured` | Domain not configured | No | Tenant | TENANT | Keep | Low |
| `/:locale/appointment/[slug]` | Public appointment/shop view | No | Tenant | TENANT | Keep | Low |
| `/:locale/appointment/[slug]/appointment/[id]` | Appointment detail | No | Tenant | TENANT | Keep | Low |
| `/:locale/appointment/[slug]/booking` | Public booking flow | No | Tenant | FLOW | Keep | Low |
| `/:locale/appointment/[slug]/fanpage` | Public fanpage posts | No | Tenant | DEMO | Convert to demo-only | Medium |
| `/:locale/appointment/[slug]/my-appointments` | My appointments | No | Tenant | FLOW | Keep | Low |
| `/:locale/appointment/[slug]/services` | Public services list | No | Tenant | TENANT | Keep | Low |
| `/:locale/appointment/[slug]/services/[serviceId]` | Service detail | No | Tenant | TENANT | Keep | Low |
| `/:locale/appointment/[slug]/services/category/[categoryId]` | Service category | No | Tenant | TENANT | Keep | Low |
| `/:locale/appointment/[slug]/staff` | Public staff list | No | Tenant | TENANT | Keep | Low |
| `/:locale/shop/[slug]` | Shop profile | No | Tenant | TENANT/DEMO | Keep, brand as demo | Low |
| `/:locale/shop/[slug]/category/[categoryId]` | Shop category | No | Tenant | TENANT | Keep | Low |
| `/:locale/shop/[slug]/checkout` | Shop checkout | No | Tenant | FLOW | Keep | Low |
| `/:locale/shop/[slug]/fanpage` | Shop fanpage | No | Tenant | DEMO | Convert to demo-only | Medium |
| `/:locale/shop/[slug]/order/[orderNumber]` | Order tracking | No | Tenant | FLOW | Keep | Low |
| `/:locale/shop/[slug]/product/[productId]` | Product detail | No | Tenant | TENANT | Keep | Low |
| `/:locale/shop/[slug]/profile` | Shop profile edit | No | Tenant | TENANT | Keep | Low |

### API Public-Surface Classification

| API Route | Category | Action | Risk |
|---|---|---|---|
| `/api/public/organizations` | MKT-DISC | Restrict to demo tenants only | High |
| `/api/public/search` | MKT-DISC | Restrict to demo tenants only | High |
| `/api/public/organizations/[slug]` | TENANT | Keep | Low |
| `/api/public/organizations/[slug]/services` | TENANT | Keep | Low |
| `/api/public/organizations/[slug]/shop` | TENANT | Keep | Low |
| `/api/public/organizations/[slug]/staff` | TENANT | Keep | Low |
| `/api/public/organizations/[slug]/booking-settings` | TENANT | Keep | Low |
| `/api/public/organizations/[slug]/fanpage/posts` | DEMO | Restrict to demo tenants | Medium |
| `/api/public/orders/[orderNumber]` | FLOW | Keep | Low |
| `/api/public/appointments/[id]` | FLOW | Keep | Low |
| `/api/public/products/[id]` | TENANT | Keep | Low |
| `/api/reviews` | MKT-DISC | Noindex/restrict later | Medium |
| `/api/reviews/[id]` | MKT-DISC | Noindex/restrict later | Medium |
| `/api/public/custom-domain/robots` | MKT | Keep | Low |
| `/api/public/custom-domain/sitemap` | MKT | Keep | Low |

## SEO/Indexing Policy

1. **B2B Homepage**: Index, target B2B Persian keywords
2. **Tenant direct pages**: Index per tenant (they are customer-facing)
3. **Demo portfolio pages**: Index, marked as demo with structured data
4. **Marketplace discovery APIs**: Noindex, restrict from public nav
5. **Fanpage/review pages**: Noindex unless demo-branded
6. **Order tracking**: Index (customer utility)
7. **Registration/login**: Index (business onboarding)

## Demo-Business-Only Policy

1. Demo businesses must be explicitly labeled:
   - نمونه نمایشی فروشگاه
   - نمونه نمایشی رستوران
   - نمونه نمایشی داروخانه
   - نمونه نمایشی مطب
   - نمونه نمایشی مرکز خدماتی
2. Demo data must not use real customer data
3. Public API listing endpoints must return only demo tenants
4. Demo pages must have clear "Demo" badges and CTAs
5. Real tenant pages must remain accessible by direct slug/domain

## Safety Policy for Tenant Pages

1. **Never break direct tenant access**: `/:locale/shop/[slug]` and related pages must remain functional
2. **Preserve checkout/booking/order tracking**: These are customer-facing utilities
3. **Maintain tenant isolation**: Organization-based access control unchanged
4. **Preserve custom domains**: Tenant custom domains must continue resolving
5. **No data leakage**: Public APIs must not expose cross-tenant data

## Marketplace Discovery Restriction Policy

1. Remove global shop/product listing from public homepage/navigation
2. Restrict `/api/public/organizations` to demo tenants only
3. Restrict `/api/public/search` to demo tenants only
4. Add `noindex` to marketplace-style listing pages if they must remain temporarily
5. Redirect public marketplace pages to B2B homepage or demo portfolio

## B2B Strategy Alignment

- Homepage will introduce Bazar Baz as a B2B platform for Iranian businesses
- Public discovery reduced from "marketplace" to "curated demo portfolio"
- Tenant direct pages preserved for real business customers
- Conversion pages (request-demo, pricing, contact) planned for P06
- Dashboard showcase pages planned for P07
- Creative Studio explicitly excluded from B2B roadmap near-term

## Phase P02/P03 Input Summary

P02 will use this policy to define:
- Persian homepage content architecture
- Feature section copy
- B2B value proposition sections
- Demo business placement in homepage

P03 will implement:
- B2B homepage UI based on P02 content architecture
- Demo business showcase sections
- Request-demo CTAs
- Navigation updates per this policy

## Out of Scope for P01

- Homepage redesign
- Route deletion
- API behavior changes
- Demo data seeding
- Creative Studio work
