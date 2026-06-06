# Phase 20 Overlay Manifest

## Overlay name

`bazar-baz-p20-api-service-consistency-overlay.zip`

## Purpose

Backend/API consistency and safety hardening after P18/P19/P19A are green.

## Files changed

```txt
app/api/auth/register/organization/route.ts
app/api/auth/register/route.ts
app/api/orders/[id]/driver/route.ts
app/api/orders/[id]/route.ts
app/api/organizations/open/route.ts
docs/PHASE_20_API_SERVICE_CONSISTENCY.md
docs/PHASE_20_OVERLAY_MANIFEST.md
lib/api-guards.ts
lib/services/cart.service.ts
lib/services/order.service.ts
lib/services/organization.service.ts
lib/types.ts
lib/validators/index.ts
scripts/quality/validate-api-service-safety.mjs
scripts/quality/validate-env.mjs
scripts/quality/validate-project.mjs
README.md
```

## Important behavior changes

- Driver order accept is now `POST` only; `GET` returns `405`.
- Organization open state `GET` is read-only; mutation stays in `POST`.
- Organization registration is transactional.
- Generic 500 API responses are sanitized.
- Order and cart delivery fee calculations use `deliveryFee`.
- Driver order listing no longer leaks orders assigned to other drivers.
- `DENIED` is not accepted as a real `OrderStatus` filter.

## Apply order

Apply after:

```txt
P18 production integrity + SMS readiness
P19 RBAC/auth/dashboard access
P19A Turbopack comment syntax hotfix
```

## Validation command

```bash
node scripts/quality/validate-api-service-safety.mjs
node scripts/quality/validate-project.mjs
npm run typecheck
npm run lint
npm run build
```
