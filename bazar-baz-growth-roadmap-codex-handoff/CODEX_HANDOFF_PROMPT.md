# Prompt for Codex — Bazar Baz Growth Roadmap

You are taking over the Bazar Baz project from a clean source ZIP. Your job is to inspect the project fully, validate the current state, then implement the growth roadmap phase-by-phase with small, safe, reviewable changes.

## Project context

Bazar Baz is a Next.js 16 / React 19 / Prisma / PostgreSQL / shadcn / RTL / i18n project. The product direction is to become a professional store platform with:

```txt
1. Customer Club for each shop/organization
2. Direct customer communication and notifications
3. Strong public SEO for shops and products
4. Financial analytics and professional store tools
5. Role-aware dashboard navigation and route authorization
```

The app supports locales:

```txt
fa, en, ar
```

Default locale is:

```txt
fa
```

The UI must preserve RTL quality and shadcn/Radix composition patterns.

## Non-negotiable rules

```txt
1. First inspect the project before changing code.
2. Do not rewrite broad areas unless necessary.
3. Implement one phase at a time.
4. Every phase must add or update a focused validator under scripts/quality.
5. Every phase must update README and docs/CURRENT_SOURCE_OF_TRUTH.md.
6. Every phase must include a PHASE_XX doc and overlay manifest doc.
7. Preserve existing auth, role, organization, and dashboard route-authorization behavior.
8. Do not mutate global user roles when changing organization membership roles.
9. All new customer/business data must be organization-scoped unless explicitly platform-global.
10. All user-visible copy must be localized in fa/en/ar or use the existing project dictionary pattern.
11. Do not send real SMS, email, Telegram, Web Push, or external notifications unless an explicit feature flag and dry-run-safe path exist.
12. Add audit logging for sensitive business operations where the project already has audit infrastructure.
13. Keep SUPER_ADMIN full access. Keep ADMIN/MANAGER practical workflows. Keep STAFF/DRIVER minimal and role-aware.
14. Do not include .env, .vercel, dumps, test-results, tsbuildinfo, node_modules, .next, or local DB files in release artifacts.
15. Use pnpm, not npm, unless the project scripts require otherwise.
```

## Immediate first action

Before implementing the growth roadmap, verify the P41A packaging hotfix is present.

The project must have this script in package.json:

```json
"quality:dashboard-route-guard-smoke": "node scripts/quality/validate-dashboard-route-guard-smoke.mjs"
```

Run:

```powershell
pnpm run quality:dashboard-route-guard-smoke
pnpm run quality:dashboard-route-authorization
pnpm run quality:dashboard-route-parity
pnpm run quality:dashboard-role-navigation
pnpm run quality:dashboard-navigation-copy
pnpm run quality:members-provider-hardening
pnpm run quality:local
pnpm run typecheck
pnpm run build
pnpm run release:stage
pnpm run quality:release-staged
```

If missing, add the script and ensure the validator file exists.

## Required inspection before P42

Read and summarize these files if present:

```txt
README.md
docs/CURRENT_SOURCE_OF_TRUTH.md
docs/ROUTE_API_DB_SERVICE_INVENTORY.md
docs/FOLLOW_FANPAGE_ROADMAP.md
docs/SEED_TESTING_GUIDE.md
docs/PHASE_38_DASHBOARD_ROLE_NAVIGATION.md
docs/PHASE_39_DASHBOARD_ROUTE_PARITY.md
docs/PHASE_40_DASHBOARD_ROUTE_AUTHORIZATION.md
docs/PHASE_41_DASHBOARD_GUARD_SMOKE.md
prisma/schema.prisma
package.json
components/dashboard/dashboard-sidebar.tsx
components/dashboard/dashboard-shell.tsx
lib/dashboard/navigation-policy.ts
```

Inspect these areas:

```txt
app/[locale]
app/api
components/dashboard
components/ui
lib/services
lib/dashboard
lib/auth.ts
lib/api-guards.ts
lib/access-control.ts
prisma
scripts/quality
```

Before coding, report:

```txt
1. current implemented domains
2. current role model
3. current dashboard route policy
4. current public shop/fanpage/product routes
5. current Prisma models relevant to customers, orders, products, follow/fanpage, notifications, payments
6. current validators and scripts
7. risks/mismatches found
```

## Roadmap to implement

Use `BAZAR_BAZ_GROWTH_ROADMAP.md` as the canonical roadmap. Start with:

```txt
P42 — Customer Club Foundation
```

Do not jump to later phases unless P42 is green and committed.

## P42 implementation requirements

### Goal
Create organization-scoped Customer Club foundation.

### Suggested Prisma models

Adapt names to the current schema style if needed:

```prisma
model CustomerClubMembership {
  id             String   @id @default(cuid())
  organizationId String
  customerId     String
  status         CustomerClubMembershipStatus @default(ACTIVE)
  tier           CustomerClubTier @default(MEMBER)
  source         CustomerClubJoinSource @default(PUBLIC_SHOP)
  joinedAt       DateTime @default(now())
  leftAt         DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  customer       User         @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@unique([organizationId, customerId])
  @@index([organizationId, status])
  @@index([customerId, status])
}

enum CustomerClubMembershipStatus {
  ACTIVE
  PAUSED
  LEFT
  BLOCKED
}

enum CustomerClubTier {
  MEMBER
  LOYAL
  VIP
}

enum CustomerClubJoinSource {
  PUBLIC_SHOP
  CHECKOUT
  ADMIN_IMPORT
  CAMPAIGN
}
```

Add consent/tag models only if they fit without overcomplicating P42. Otherwise document them for P43/P44.

### Suggested routes/APIs

```txt
Dashboard:
- /dashboard/customer-club
- /dashboard/customer-club/members

API:
- GET /api/customer-club/membership?organizationId=...
- POST /api/customer-club/membership
- DELETE or PATCH /api/customer-club/membership
- GET /api/dashboard/customer-club/members?organizationId=...
```

Use existing route conventions if the project has a better pattern.

### UI requirements

```txt
1. Add role-aware dashboard sidebar entry for ADMIN/MANAGER/SUPER_ADMIN.
2. Do not show customer-club management to DRIVER.
3. STAFF visibility depends on current project role policy; if uncertain, hide from STAFF.
4. Use shadcn Card/Table/Dialog/Badge/Button patterns already in the project.
5. Add empty state, loading state, and error state.
6. Keep mobile layout compact.
7. Localize fa/en/ar copy.
```

### Validator requirements

Add:

```txt
scripts/quality/validate-customer-club-foundation.mjs
package.json script: quality:customer-club-foundation
validate-project integration
```

Validator should check at least:

```txt
1. Prisma schema has CustomerClubMembership or accepted equivalent.
2. API routes exist.
3. Dashboard pages exist.
4. Sidebar/navigation policy includes customer-club only for allowed roles.
5. Locale keys exist for fa/en/ar.
6. No driver access to management nav.
7. validate-project calls the new validator.
```

### P42 validation gate

```powershell
pnpm run db:validate
pnpm run quality:customer-club-foundation
pnpm run quality:dashboard-route-authorization
pnpm run quality:dashboard-route-parity
pnpm run quality:dashboard-role-navigation
pnpm run quality:local
pnpm run typecheck
pnpm run build
pnpm run release:stage
pnpm run quality:release-staged
```

## Output required after each phase

After implementing each phase, provide:

```txt
1. changed files list
2. what changed
3. validation commands run and results
4. commands for the user to run locally
5. git add/commit/push commands
6. an overlay zip containing only changed files, if this workflow is being used
```

## Technical standards for later phases

### SEO
Use official Next.js App Router metadata patterns and Google Search Central structured-data guidance.

Implement:

```txt
- generateMetadata per public route
- canonical URLs
- locale alternates / hreflang
- OpenGraph and Twitter cards
- JSON-LD Product, Offer, LocalBusiness, Organization, BreadcrumbList
- dynamic sitemap
- robots metadata file
- SEO health panel
```

### Notifications
Follow Web Push/Notification best practices:

```txt
- ask permission only after user gesture
- support unsubscribe
- avoid spam
- store consent and permission events
- keep real push behind feature flags
- dry-run safe by default
```

### Analytics and finance
Keep financial metrics tenant-safe and auditable:

```txt
- revenue
- order count
- AOV
- paid/unpaid orders
- top products
- top customers
- product margin
- inventory low-stock/dead-stock
- campaign attribution
- CSV exports
```

## Do not do these

```txt
1. Do not replace the design system with custom CSS-heavy UI.
2. Do not remove existing dashboard route authorization.
3. Do not expose customer data across organizations.
4. Do not add notification spam flows.
5. Do not add paid/plan gates before P58 unless necessary.
6. Do not skip validators.
7. Do not claim green unless typecheck/build/quality actually passed.
8. Do not include secrets in any archive.
```

## Final note

Proceed carefully. The priority is correctness and maintainability over adding many features at once. Implement P42 first, make it green, then stop and report.
