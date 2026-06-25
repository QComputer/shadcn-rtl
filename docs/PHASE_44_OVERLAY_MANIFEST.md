# P44 Overlay Manifest - Customer Segments MVP

Date: 2026-06-25

## Changed Files

```txt
README.md
app/[locale]/dashboard/customer-club/members/page.tsx
app/[locale]/dashboard/customer-club/segments/page.tsx
app/api/dashboard/customer-club/segments/route.ts
dictionaries/ar.json
dictionaries/en.json
dictionaries/fa.json
docs/CURRENT_SOURCE_OF_TRUTH.md
docs/PHASE_44_CUSTOMER_SEGMENTS_MVP.md
docs/PHASE_44_OVERLAY_MANIFEST.md
lib/access-control.ts
lib/dashboard/navigation-policy.ts
lib/services/customer-segments.service.ts
package.json
prisma/migrations/20260625000300_customer_segments_mvp/migration.sql
prisma/schema.prisma
scripts/quality/validate-customer-segments.mjs
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
