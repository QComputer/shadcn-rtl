# Preserved Tenant Direct Route Policy

This document lists all tenant direct routes that must remain functional during the B2B repositioning.

## Preserved Public Tenant Routes

These routes must keep working if they exist:

- `/{locale}/shop/{slug}` — shop storefront
- `/{locale}/shop/{slug}/profile` — shop profile
- `/{locale}/shop/{slug}/category/{categoryId}` — shop category
- `/{locale}/shop/{slug}/product/{productId}` — product detail
- `/{locale}/shop/{slug}/checkout` — cart/checkout
- `/{locale}/shop/{slug}/order/{orderNumber}` — order tracking
- `/{locale}/appointment/{slug}` — appointment business page
- `/{locale}/appointment/{slug}/services` — services listing
- `/{locale}/appointment/{slug}/services/{serviceId}` — service detail
- `/{locale}/appointment/{slug}/services/category/{categoryId}` — service category
- `/{locale}/appointment/{slug}/booking` — booking flow
- `/{locale}/appointment/{slug}/staff` — staff listing
- `/{locale}/appointment/{slug}/my-appointments` — customer appointments
- `/{locale}/appointment/{slug}/appointment/{id}` — appointment detail
- `/{locale}/domain-not-configured` — domain fallback

## Preserved APIs Used by Tenant Direct Pages

These APIs must remain accessible for tenant public pages:

- `GET /api/public/organizations/{slug}` — org detail by slug
- `GET /api/public/organizations/{slug}/shop` — shop data by slug
- `GET /api/public/organizations/{slug}/services` — services by slug
- `GET /api/public/organizations/{slug}/services/{serviceId}` — service detail by slug
- `GET /api/public/organizations/{slug}/staff` — staff by slug
- `GET /api/public/organizations/{slug}/booking-settings` — booking settings by slug
- `GET /api/public/organizations/{slug}/fanpage/posts` — fanpage by slug
- `GET /api/public/products/{id}` — product detail
- `GET /api/public/orders/{orderNumber}` — order tracking
- `GET /api/public/appointments/{id}` — appointment lookup
- `POST /api/public/appointments/lookup` — appointment lookup

## Non-Preserved Discovery Surfaces

These are not tenant direct pages and may be restricted:

- `GET /api/public/organizations` — broad organization listing
- `GET /api/public/search` — broad cross-tenant search

## Rules

- Do not delete or break any preserved route.
- Do not require authentication for preserved public tenant routes.
- Preserve custom-domain tenant routing.
- Do not add hard 404s for preserved routes.
