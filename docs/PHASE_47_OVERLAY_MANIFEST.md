# P47 Overlay Manifest - Web Push Opt-In Foundation

Date: 2026-06-26

## Changed Files

```txt
README.md
app/[locale]/dashboard/customer-club/members/page.tsx
app/[locale]/dashboard/customer-club/push/page.tsx
app/[locale]/shop/[slug]/profile/page.tsx
app/api/customer/push-subscriptions/route.ts
app/api/dashboard/customer-club/push/route.ts
components/public/web-push-opt-in.tsx
dictionaries/ar.json
dictionaries/en.json
dictionaries/fa.json
docs/CURRENT_SOURCE_OF_TRUTH.md
docs/PHASE_47_OVERLAY_MANIFEST.md
docs/PHASE_47_WEB_PUSH_FOUNDATION.md
lib/access-control.ts
lib/dashboard/navigation-policy.ts
lib/runtime-env.ts
lib/services/web-push-foundation.service.ts
package.json
prisma/migrations/20260625000600_web_push_foundation/migration.sql
prisma/schema.prisma
public/web-push-sw.js
scripts/quality/validate-env.mjs
scripts/quality/validate-project.mjs
scripts/quality/validate-web-push-foundation.mjs
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
pnpm run health:env
pnpm run quality:web-push-foundation
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
