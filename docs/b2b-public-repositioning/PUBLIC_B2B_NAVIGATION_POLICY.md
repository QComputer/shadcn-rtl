# Public B2B Navigation Policy

This document defines the public navigation rules for the B2B repositioning.

## Allowed Public Navigation Links

These links are safe for public marketing pages:

- `/{locale}/` or `/{locale}` — B2B homepage
- `/{locale}/features` — public feature pages
- `/{locale}/dashboard-showcase` — public dashboard showcase
- `/{locale}/demo` — demo business portfolio
- `/{locale}/request-demo` — conversion funnel
- `/{locale}/contact` — contact/onboarding
- `/{locale}/pricing` — pricing explanation
- `/{locale}/login` — login page
- `/{locale}/register` — registration page
- `/{locale}/register/organization` — organization registration

## Preserved Tenant Direct Pages

These tenant pages must remain accessible and are documented as preserved:

- `/{locale}/shop/[slug]` — shop profile/storefront
- `/{locale}/shop/[slug]/product/[productId]` — product detail
- `/{locale}/shop/[slug]/checkout` — checkout
- `/{locale}/shop/[slug]/order/[orderNumber]` — order tracking
- `/{locale}/appointment/[slug]` — appointment profile
- `/{locale}/appointment/[slug]/services` — services list
- `/{locale}/appointment/[slug]/services/[serviceId]` — service detail
- `/{locale}/appointment/[slug]/booking` — booking
- `/{locale}/appointment/[slug]/my-appointments` — my appointments

## Prohibited Public Navigation Links

Do not link to these from public marketing pages:

- Public global shop listing (`/api/public/organizations`)
- Public global search (`/api/public/search`)
- Public consumer-facing discovery feed
- Any page that implies Bazar Baz sells/advertises businesses to consumers

## Link Integration Rules

- Homepage CTAs must point to request-demo or demo portfolio
- Homepage feature CTA → `/{locale}/features`
- Homepage dashboard section CTA → `/{locale}/dashboard-showcase`
- Pricing page feature links → `/{locale}/features`
- Request-demo page support links → `/{locale}/features` or `/{locale}/dashboard-showcase`
- Contact page support links → `/{locale}/request-demo`
- Demo page CTA → `/{locale}/request-demo` and `/{locale}/features`

## Routing Stability

- Public marketing routes use English slugs for stability: `/features`, `/dashboard-showcase`
- Locale prefix is preserved: `/{locale}/features`
- Tenant direct pages keep their existing slug patterns
