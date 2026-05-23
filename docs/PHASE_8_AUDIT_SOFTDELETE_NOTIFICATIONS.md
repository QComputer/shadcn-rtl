# Phase 8 — Audit, Soft Delete, and Notification Cleanup

## Purpose

Phase 8 focuses on production stability and operational hygiene for dashboard data:

1. make dashboard statistics safer around soft-deleted data;
2. remove the `@ts-nocheck` dashboard API escape hatch;
3. make dashboard notification polling bounded and cleanup-safe;
4. add notification read metadata;
5. keep deployed no-Playwright smoke coverage current.

## Updated areas

- `prisma/schema.prisma`
- `prisma/migrations/20260521010000_phase8_audit_softdelete_notifications/migration.sql`
- `app/api/dashboard/route.ts`
- `app/api/dashboard/notifications/route.ts`
- `app/[locale]/dashboard/layout.tsx`
- `app/[locale]/dashboard/users/page.tsx`
- `scripts/e2e/deployed-phase8-audit-softdelete-notifications.mjs`
- `package.json`
- `README.md`

## Notification changes

`Notification` now includes:

- `createdAt`
- `updatedAt`
- `readAt`

The dashboard notification API now:

- requires a valid authenticated session;
- fetches at most 20 unread notifications;
- marks returned notifications as seen;
- writes `readAt` when marking them seen;
- avoids Prisma-specific `updateManyAndReturn` so the route is more portable.

The dashboard layout now:

- uses one interval with cleanup;
- polls every 30 seconds instead of recursively scheduling every 5 seconds;
- stops polling on 401/403;
- suppresses non-critical notification/audio failures so the dashboard page remains stable.

## Dashboard summary changes

`/api/dashboard` was rewritten without `@ts-nocheck` and now resolves the active organization membership through server-side data. Dashboard counts and recent records now filter `deletedAt: null` where applicable.

## Audit logging changes

A shared `lib/audit-log.ts` helper was added. The helper intentionally swallows audit-write failures so operational audit logging does not break the user-facing mutation. Phase 8 wires audit records into high-risk dashboard mutations:

- global user role changes;
- user active-status changes;
- user soft delete;
- organization member active-status changes;
- organization settings updates.

Existing upload/image/QR/order/payment audit/history records from earlier phases remain in place.

## Deployed smoke test

PowerShell:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase8
```

Linux/macOS/Git Bash:

```bash
DEPLOYED_URL=https://zc0.runflare.run npm run e2e:deployed:phase8
```

The smoke test checks:

- homepage reachability;
- unauthenticated `/api/dashboard` is blocked;
- unauthenticated `/api/dashboard/notifications` is blocked;
- media hardening still blocks unauthenticated image listing;
- dashboard calendar still avoids unauthenticated server errors.

## Remaining work

Phase 8 adds the shared audit helper and covers the highest-risk user/member/settings mutations. The recommended follow-up is to extend the helper to product, service, category, and organization mutations with richer request metadata such as IP address and user agent.
