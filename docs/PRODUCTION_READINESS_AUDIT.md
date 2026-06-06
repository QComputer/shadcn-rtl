# Bazar Baz — Production Readiness and Amateur-Code Audit

_Last updated from source inspection: 2026-06-02._

This document lists the current production-readiness risks and the most important amateur-code signals found during inspection. It is intentionally direct so it can be used as an engineering checklist.

## 1. Validation status from this overlay pass

What was possible:

- The ZIP was extracted and inspected directly.
- Routes, API routes, Prisma models/enums, services, hooks, providers, and docs were reviewed.
- A documentation-only overlay was created.
- `node scripts/quality/validate-project.mjs` can be run after applying the overlay because this overlay preserves the expected phase docs.

What was not proven from the ZIP alone:

- Clean dependency installation.
- Prisma client generation.
- Prisma schema validation.
- TypeScript typecheck.
- ESLint.
- Next production build.
- Browser E2E behavior.

Reason: the uploaded ZIP does not include `node_modules`, and this inspection environment could not fetch packages. Therefore build/typecheck/lint remain unknown until run in the user/developer environment.

## 2. P0 release blockers

### P0-1 — Secrets/local artifacts in distributable ZIP

The ZIP contains `.env` and `prisma/dev.db`. Release overlays and project snapshots must not contain real secrets, local database files, or local runtime artifacts.

Required actions:

- Remove `.env` from distributable project ZIPs.
- Remove `prisma/dev.db` unless explicitly making a local demo bundle.
- Rotate any credential that appeared in a shared ZIP.
- Keep `.env.example` as the documented contract.

### P0-2 — Build and type safety not proven

The project cannot be considered production-ready until a clean environment passes:

```bash
npm ci
npm run db:generate
npm run db:validate
npm run typecheck
npm run lint
npm run quality:local
npm run health:env
npm run build
```

### P0-3 — Dashboard route access is stale/incomplete

`lib/access-control.ts` does not fully match actual dashboard routes.

Actual dashboard routes include pages like:

- `/dashboard/users`.
- `/dashboard/products/new`.
- `/dashboard/products/[id]`.
- `/dashboard/services/new`.
- `/dashboard/services/[id]`.
- `/dashboard/appointments/[id]`.
- `/dashboard/appointments/[id]/edit`.
- `/dashboard/organizations/new`.

The route registry also contains stale routes such as:

- `/dashboard/customers`.
- `/dashboard/my-appointments`.
- `/dashboard/my-services`.
- `/dashboard/organization-details`.

Required actions:

- Generate a route policy from actual filesystem routes.
- Add explicit policy for every real dashboard page.
- Remove stale paths or create the matching pages deliberately.
- Deny unknown dashboard child paths by default.
- Add route-access tests for each role/org-type combination.

### P0-4 — GET routes mutate state

Observed examples:

- `app/api/orders/[id]/driver/route.ts` allows driver acceptance through GET as a backward-compatible alias for POST.
- `app/api/organizations/open/route.ts` updates `isOpen` through GET.

GET must not mutate state. Crawlers, prefetchers, link previews, caches, and scanners can issue GET requests.

Required actions:

- Remove GET mutations.
- Keep only POST/PATCH/PUT/DELETE for state changes.
- If backward compatibility is needed, return 405 with a migration message instead of mutating.

### P0-5 — Production env contract is not clean

Production must supply a real `NEXTAUTH_SECRET` and deploy URLs. Local `.env` should not force production runtime in development.

Required production variables:

```env
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=replace-with-strong-secret
NEXTAUTH_URL=https://your-domain.example
AUTH_TRUST_HOST=true
NEXT_PUBLIC_APP_URL=https://your-domain.example
NEXT_PUBLIC_DEPLOYED_APP_URL=https://your-domain.example
```

## 3. P1 high-priority code quality risks

### Provider/session duplication

`components/providers.tsx` nests `SessionProvider` twice. This should be reduced to one session provider around the auth provider.

### Duplicate auth interfaces

`hooks/use-auth.tsx` declares `OrganizationMembership` and `AuthContextType` twice. TypeScript may merge interfaces, but this is confusing and unsafe for future refactors.

### Locale-unaware auth redirects

Client sign-in currently redirects to `/dashboard`; sign-out redirects to `/`. Localized routes should redirect to `/{locale}/dashboard` and `/{locale}`.

### Client-only dashboard protection

Several dashboard pages do not call `useDashboardAccess`, and dashboard protection should not depend on client effects alone. A server-side dashboard layout guard is recommended.

### Weak TypeScript posture

Current `tsconfig.json` has:

```json
{
  "allowJs": true,
  "strict": false,
  "skipLibCheck": true,
  "target": "ES2017"
}
```

This is acceptable for early migration, but not a senior production posture. Move toward strict mode gradually.

### Huge client pages

Several pages are hundreds of lines long and mix fetching, state, rendering, labels, permissions, and business rules. Examples include dashboard, orders, driver orders, product edit, shop, booking, calendar, and checkout surfaces.

Recommended pattern:

```txt
page.tsx = route composition only
components/feature/* = UI sections
hooks/feature/* = client state/fetching
lib/api-client/* = typed fetch clients
lib/validators/* = request/response schemas
lib/status/* = status labels/actions
```

## 4. P1 service/data correctness risks

### Organization registration is not transactional enough

User creation, organization creation, settings creation, payment settings creation, and membership creation should be wrapped into a single transaction or a compensating workflow.

### Missing await/fire-and-forget writes

Some membership/business-hour flows call async operations without awaiting all writes. Fire-and-forget database writes cause race conditions and partial updates.

### Tenant identity inconsistency

Some relations use `organizationId`, some use `organizationSlug`, and some use both. Production should standardize on `organizationId` as canonical relational identity.

### Business-hour update scoping

Staff business-hour updates should always scope deletes/updates by both user and organization to avoid cross-organization data damage.

### Delivery fee logic needs review

The schema has `OrganizationSettings.deliveryFee`, but some code appears to calculate a default fee based on `deliveryRadius`. This should be corrected or explicitly documented.

### Order status mismatch

Prisma `OrderStatus` and TypeScript/type/filter status values should be unified. Avoid mixing pseudo-statuses such as driver denial state into the real order-status enum.

## 5. P1 API consistency risks

- Some routes use shared `ApiError`/`jsonError`, while others return raw manual errors.
- Some routes directly expose `error.message` in 500 responses.
- Some routes use raw Prisma access instead of service methods or shared guards.
- Some route bodies are manually parsed and validated; some use `zod`; some are weakly typed.

Production target:

- Shared validator per resource.
- Shared error response policy.
- No raw internal 500 messages to clients.
- API route handlers should be thin wrappers around guards, validators, and services.

## 6. P1 runtime scalability risks

### In-memory rate limiting

`lib/rate-limit.ts` uses an in-memory map. This is not reliable across multiple instances, serverless cold starts, or redeploys.

Production target: Redis/Upstash/database/platform rate limiting.

### Local disk uploads

Local disk upload storage is not durable in many deployment models.

Production target: S3-compatible storage, Cloudflare R2, MinIO, or persistent mounted volume.

### Prisma client caching disabled

`lib/db.ts` has development Prisma global caching commented out. This can cause excessive Prisma clients during hot reload. Restore dev caching unless there is a deliberate reason not to.

## 7. P2 i18n/UI quality risks

- Dictionary structure exists, but English/Arabic are behind Persian.
- Many hardcoded Persian/Arabic labels remain inside app/components.
- Metadata still needs brand/text cleanup.
- Locale detection is hardcoded to `fa` in `proxy.ts`.
- RTL/LTR should be tested visually and with browser tests.

## 8. P2 database-model cleanup risks

- `OrderMessage.orderNumber` is misleading if it relates to `Order.id`; rename to `orderId` in a migration.
- `BusinessHour` uniqueness with nullable `userId` does not guarantee one org-level row per day in PostgreSQL.
- Payment settings should avoid storing sensitive card-like values unmasked/unencrypted.
- `paymentMethodInt` should become an enum or be removed.
- Redundant `@@unique([id])` and `@@index([id])` patterns around primary keys should be cleaned where safe.

## 9. P2 testing gaps

Missing or not included in the ZIP:

- Unit tests for services.
- API integration tests.
- Browser E2E tests.
- RBAC matrix tests.
- Appointment concurrency/conflict tests.
- Checkout/inventory/payment idempotency tests.
- i18n/RTL/LTR rendering tests.

No-Playwright smoke tests are useful but should not be the only test layer.

## 10. Summary of the most amateur-code indicators

1. `.env` and local DB included in project ZIP.
2. `strict: false` and `allowJs: true` in TypeScript config.
3. Very large client pages instead of feature decomposition.
4. Duplicate `SessionProvider`.
5. Duplicate TypeScript interfaces in auth hook.
6. Stale dashboard route registry.
7. Missing explicit route policies for real dashboard pages.
8. GET routes that mutate state.
9. Split multi-write workflows without transactions.
10. Async writes that are not awaited.
11. Raw `error.message` returned to clients.
12. In-memory rate limiting.
13. Local disk upload storage.
14. Inconsistent tenant identity by slug/id.
15. Hardcoded UI strings despite dictionary system.
16. Locale detection disabled by hardcoding `fa`.
17. Mixed guard/validation style across APIs.
18. Missing direct dependencies imported by code.
19. No full test suite in the ZIP.
20. Build/typecheck/lint not proven from clean install.
