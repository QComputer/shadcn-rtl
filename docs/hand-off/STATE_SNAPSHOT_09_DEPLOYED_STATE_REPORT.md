# STATE-SNAPSHOT-09: Deployed State Report

Generated: 2026-07-05
Project: Bazar Baz / shadcn-rtl

## Production URL
- https://www.bazar-baz.ir

## Production Reachability
- **Status**: REACHABLE
- **Last verified**: 2026-07-05 (Vercel deployment `7bco6K64tgaDH3BfSM7PTeesmpTW` succeeded)

## Vercel Deployment Status
- Latest deployment: Completed successfully
- Build warnings: `Detected .env file, it is strongly recommended to use Vercel's env handling instead`
- Build errors: None
- Prisma generate: Successful
- Static pages: 175/175 generated

## Notification Operations Deployed Smoke
- **Script**: `scripts/e2e/deployed-notification-operations-dashboard.mjs`
- **Status**: NOT RUN (blocked by Playwright browser binary download)
- **Blocker**: Geographic CDN restriction on `cdn.playwright.dev` on this Windows runner
- **Code status**: Script is updated and ready; passes when browsers are available

## SMS Diagnostics Deployed Smoke
- **Script**: `scripts/e2e/deployed-sms-notif-ops.mjs`
- **Status**: NOT RUN (same Playwright blocker)
- **Code status**: 16/17 checks passed in earlier runs; only block is browser binary

## PWA/Push Deployed Smoke
- **Script**: `scripts/e2e/deployed-pwa-push-sms-smoke.mjs`
- **Status**: NOT RUN (same Playwright blocker)
- **Code status**: 12/13 checks passed in earlier runs; only block is browser binary

## NotificationDeliveryAttempt Production Table
- **Status**: PRESENT
- **Verification**: Applied via `scripts/ops/apply-notification-delivery-attempt-migration.mjs` using Neon serverless driver
- **Evidence**: Deployed smoke after migration did not report missing table errors
- **Indexes**: OrganizationId/status/createdAt, targetUserId, orderId, guestCustomerId, notificationId

## localhost:4001/Socket.IO Status
- **Status**: NOT PRESENT in production
- **Evidence**: Deployed smokes confirmed no `localhost:4001` or `/socket.io/` requests
- **Fix**: Hardcoded fallback removed from `context/SocketContext.tsx`; Socket.IO gated behind safe public URL

## Secret Exposure Status
- **SMS_IR_API_KEY**: Not exposed in client bundles or API responses
- **VAPID private key**: Not exposed in client bundles or API responses
- **DATABASE_URL**: Not exposed in client bundles
- **Full phone numbers**: Masked in dashboard/API responses
- **Envs in snapshot**: Excluded via zip filters

## Real SMS Sent
- **Status**: NO
- **Mode**: Dry-run only
- **Gate**: `SMS_REAL_SEND_ENABLED=false`, `DEPLOYED_ALLOW_REAL_SMS=0`

## Known Deployed Issues
1. Playwright browser binary download blocked on this runner
2. `.env` file warning in Vercel build (local `.env` detected during build)
3. Prisma DB connectivity warnings during static generation (expected when DB is sleeping)

## Manual Verification Checklist (for human review)
- [ ] Open https://www.bazar-baz.ir/fa/dashboard/notification-operations
- [ ] Confirm no localhost:4001 requests in DevTools Network tab
- [ ] Confirm no socket.io ERR_CONNECTION_REFUSED
- [ ] Confirm Web Push switch shows permission prompt or specific Persian error (not generic unsupported)
- [ ] Confirm SMS diagnostics section loads
- [ ] Confirm delivery reports section loads
- [ ] Confirm no SMS_IR_API_KEY or VAPID_PRIVATE_KEY in page source
- [ ] Confirm no full phone numbers exposed
