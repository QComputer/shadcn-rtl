# P42 Overlay Manifest — Customer Club Foundation

Date: 2026-06-25

## Changed Files

```txt
README.md
app/[locale]/dashboard/customer-club/members/page.tsx
app/[locale]/dashboard/customer-club/page.tsx
app/api/customer-club/membership/route.ts
app/api/dashboard/customer-club/members/route.ts
components/dashboard/dashboard-sidebar.tsx
dictionaries/ar.json
dictionaries/en.json
dictionaries/fa.json
docs/CURRENT_SOURCE_OF_TRUTH.md
docs/PHASE_42_CUSTOMER_CLUB_FOUNDATION.md
docs/PHASE_42_OVERLAY_MANIFEST.md
lib/access-control.ts
lib/dashboard/navigation-policy.ts
lib/services/customer-club.service.ts
package.json
prisma/migrations/20260625000100_customer_club_foundation/migration.sql
prisma/schema.prisma
scripts/quality/validate-customer-club-foundation.mjs
scripts/quality/validate-project.mjs
```

## Excluded

The overlay must not include:

```txt
.env
.env.local
.env.*.local
.vercel/
.next/
node_modules/
.release/
test-results/
playwright-report/
coverage/
prisma/dev.db
*.dump
*.backup
*.zip
*.rar
public/uploads/
uploads/
tsconfig.tsbuildinfo
```

## Validation

```powershell
pnpm run db:validate
pnpm run db:generate
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
