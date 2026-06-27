# P46 Overlay Manifest - Loyalty Points and Coupons

Date: 2026-06-26

## Changed Files

```txt
README.md
app/[locale]/dashboard/customer-club/coupons/page.tsx
app/[locale]/dashboard/customer-club/loyalty/page.tsx
app/[locale]/dashboard/customer-club/members/page.tsx
app/api/dashboard/customer-club/coupons/route.ts
app/api/dashboard/customer-club/loyalty/route.ts
dictionaries/ar.json
dictionaries/en.json
dictionaries/fa.json
docs/CURRENT_SOURCE_OF_TRUTH.md
docs/PHASE_46_LOYALTY_COUPONS.md
docs/PHASE_46_OVERLAY_MANIFEST.md
lib/access-control.ts
lib/dashboard/navigation-policy.ts
lib/services/loyalty-coupons.service.ts
package.json
prisma/migrations/20260625000500_loyalty_coupons/migration.sql
prisma/schema.prisma
scripts/quality/validate-loyalty-coupons.mjs
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
pnpm run quality:loyalty-coupons
pnpm run quality:campaign-builder
pnpm run quality:customer-segments
pnpm run quality:in-app-notifications
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
