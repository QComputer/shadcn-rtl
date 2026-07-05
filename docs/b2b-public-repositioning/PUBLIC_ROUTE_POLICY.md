# Public Route Policy for Bazar Baz B2B Positioning

This document is the authoritative policy for all public-facing routes and APIs during the B2B repositioning.

## Keep and Improve

These public surfaces should remain and be improved for B2B positioning:

- Homepage for Bazar Baz service introduction (`/`, `/:locale`)
- Login and registration flows (`/:locale/login`, `/:locale/register`, `/:locale/register/organization`)
- Feature pages explaining B2B capabilities
- Demo business portfolio pages (explicitly marked as demo)
- Request demo / contact pages (to be added in P06)
- Legal/trust pages (to be added in P08)
- Direct tenant shop/service pages by slug/domain (`/:locale/shop/[slug]`, `/:locale/appointment/[slug]`)
- Direct product/service pages inside a tenant
- Public checkout/booking/order-tracking where needed for tenant customers
- Public order tracking by order number

## Restrict or Remove from Navigation

These surfaces should not behave like a general marketplace:

- Public global shop listing (`/api/public/organizations`)
- Public global product listing
- Public global search across all businesses (`/api/public/search`)
- Consumer-facing discovery feed
- Any page that implies Bazar Baz sells/advertises businesses to consumers

If such routes must remain temporarily for compatibility, they should:
- be removed from homepage/navigation;
- be noindex if not part of demo strategy;
- redirect to demo examples or B2B explanation if safe;
- preserve API compatibility only where needed;
- not leak tenant/business data across organizations.

## Tenant Direct Pages Must Not Be Broken

Businesses still need customer-facing pages. Do not confuse public marketplace restriction with tenant page removal.

The following must keep working if they exist:
- `/:locale/shop/[slug]` or equivalent;
- custom-domain tenant routes;
- product/service detail pages;
- cart/checkout;
- appointment booking;
- public order tracking.

## Demo Examples

Demo businesses should be explicitly marked as examples:

```
نمونه نمایشی فروشگاه
نمونه نمایشی رستوران
نمونه نمایشی داروخانه
نمونه نمایشی مطب
نمونه نمایشی مرکز خدماتی
```

Demo data must not be confused with real customers or real tenant operations.

## API Public Surface Classification

Public APIs are classified as:
- `BAZAR_BAZ_MARKETING` — B2B homepage/marketing data
- `TENANT_DIRECT_PUBLIC` — tenant public data by slug
- `TENANT_CUSTOMER_FLOW` — checkout, booking, order tracking
- `DEMO_PORTFOLIO` — demo-only data
- `MARKETPLACE_DISCOVERY` — global listing/search, to be restricted
- `LEGACY_UNKNOWN` — needs review

## SEO/Indexing Policy

- B2B homepage: index, target business-owner Persian keywords
- Tenant direct pages: index (customer-facing)
- Demo portfolio: index, marked as demo with structured data
- Marketplace discovery: noindex, restrict from nav
- Reviews/fanpage: noindex unless demo-branded
- Order tracking: index (customer utility)
- Auth pages: index (business onboarding)

## Safety Rules

- Never break direct tenant access
- Preserve checkout/booking/order tracking
- Maintain tenant isolation
- Preserve custom domains
- No cross-tenant data leakage
- No real SMS sent during policy enforcement
- No secrets exposed in public responses
- No production DB mutations during audit

## Exclusions

- Creative Studio is not the next B2B phase focus
- Real SMS sending is not enabled by this policy
- No route deletion without explicit phase approval

## Next Phase

- BB-B2B-P03 is completed: Persian-first B2B homepage landing in `app/[locale]/page.tsx`
- **BB-B2B-P04** — Demo Business Portfolio and Seed Strategy
