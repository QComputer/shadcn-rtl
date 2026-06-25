# P45 Overlay Manifest - Campaign Builder MVP

Date: 2026-06-25

## Changed Files

```txt
README.md
app/[locale]/dashboard/customer-club/campaigns/[id]/page.tsx
app/[locale]/dashboard/customer-club/campaigns/new/page.tsx
app/[locale]/dashboard/customer-club/campaigns/page.tsx
app/[locale]/dashboard/customer-club/segments/page.tsx
app/api/dashboard/customer-club/campaigns/[id]/route.ts
app/api/dashboard/customer-club/campaigns/[id]/send/route.ts
app/api/dashboard/customer-club/campaigns/route.ts
dictionaries/ar.json
dictionaries/en.json
dictionaries/fa.json
docs/CURRENT_SOURCE_OF_TRUTH.md
docs/PHASE_45_CAMPAIGN_BUILDER_MVP.md
docs/PHASE_45_OVERLAY_MANIFEST.md
lib/access-control.ts
lib/dashboard/navigation-policy.ts
lib/services/campaign-builder.service.ts
package.json
prisma/migrations/20260625000400_campaign_builder_mvp/migration.sql
prisma/schema.prisma
scripts/quality/validate-campaign-builder.mjs
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
