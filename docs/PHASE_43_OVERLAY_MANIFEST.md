# P43 Overlay Manifest — In-App Notification Inbox

Date: 2026-06-25

## Changed Files

```txt
README.md
app/[locale]/dashboard/notifications/page.tsx
app/api/customer/notifications/route.ts
app/api/dashboard/notifications/route.ts
components/dashboard/dashboard-sidebar.tsx
dictionaries/ar.json
dictionaries/en.json
dictionaries/fa.json
docs/CURRENT_SOURCE_OF_TRUTH.md
docs/PHASE_43_IN_APP_NOTIFICATION_INBOX.md
docs/PHASE_43_OVERLAY_MANIFEST.md
lib/access-control.ts
lib/dashboard/navigation-policy.ts
package.json
prisma/migrations/20260625000200_in_app_notification_inbox/migration.sql
prisma/schema.prisma
scripts/quality/validate-in-app-notifications.mjs
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
