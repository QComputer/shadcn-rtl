# STATE-SNAPSHOT-00: Master Summary

Generated: 2026-07-05
Project: Bazar Baz / shadcn-rtl
Production: https://www.bazar-baz.ir

## Project Identity
Bazar Baz is a multi-tenant B2B service platform for Iranian businesses. It provides business management, customer communication, commerce, appointments, customer club, campaigns, notifications, and AI-assisted creative/media tools. The platform is built with Next.js 16, Prisma, PostgreSQL (Neon), and Vercel.

## Current Branch/Commit
- Branch: main
- HEAD: 2c424f7 (`redeploy with regenerated VAPID keys`)
- Origin/main: 2c424f791f9857c891b5d296fcd67359e4e72c8b
- Working tree: Has uncommitted changes in `components/dashboard/dashboard-push-opt-in.tsx`

## Source Cleanliness
- Core source: Clean and committed
- Uncommitted changes: Small VAPID validation improvements in dashboard push opt-in
- Untracked scripts: Several Vercel env sync/debug scripts from recent hotfix work
- No secrets committed: Verified (SMS keys, VAPID private key, DB URLs not in git)

## Production Status
- Vercel deployment: Healthy
- Build: Passes with non-fatal DB connectivity warnings
- Auth: Functional (NextAuth credentials + optional Google)
- Database: Neon PostgreSQL, migrations applied
- Blob storage: Vercel Blob operational
- SMS: SMS.ir integrated, dry-run only
- Web Push: VAPID keys regenerated and synced to production
- Notification operations dashboard: Deployed and accessible

## Biggest Blockers
1. **Playwright browser binary download blocked** on this Windows runner by geographic CDN restriction — cannot run deployed smoke tests locally
2. **Public homepage/B2B strategy mismatch** — current homepage is marketplace-like, needs B2B repositioning
3. **Public org listing/search exposure** — tenant data is publicly browsable without B2B framing
4. **Demo data strategy undefined** — no curated demo businesses for portfolio positioning

## Notification/SMS Status
- P120A-P120F: All committed, validated, and production-deployed
- NotificationDeliveryAttempt table: Present in production
- SMS dry-run gates: Active (no real SMS sent)
- Web Push VAPID keys: Regenerated and synced
- localhost:4001 socket leak: Fixed and verified absent in production
- Deployed smoke coverage: Code ready, execution blocked by Playwright CDN

## Public Homepage/B2B Strategy Gap
- Current homepage: Generic public landing with org listings
- Needed: B2B service-introduction page with value proposition, features, demo businesses, CTAs
- Public shop/search: Functional but overexposed for B2B positioning
- Missing: Request-demo, pricing, for-businesses, how-it-works, dashboard showcase

## What Is Included in Snapshot
- Full source code (excluding node_modules, .next, .git, .env, logs)
- All docs including hand-off reports
- Prisma schema and migrations
- Quality validators and E2E scripts
- Operational scripts (`scripts/ops/`)
- No secrets, no credentials, no generated artifacts

## What Is Intentionally Excluded
- `node_modules/`
- `.next/`
- `.git/`
- `.env`, `.env.local`, `.env.production`, `.env.vercel`
- `test-results/`, `playwright-report/`
- `.vercel/`
- Large generated zips/dist folders
- Any file containing `SMS_IR_API_KEY`, `VAPID_PRIVATE`, `DATABASE_URL`

## Exact Next Recommended Action
1. Trigger fresh Vercel deploy after env sync (`vercel --prod` or push empty commit)
2. Manually test notification operations and Web Push on production
3. Begin Phase 1: Public homepage B2B repositioning
4. Run deployed smokes on a machine with Playwright browsers available

## Snapshot Ready to Upload to ChatGPT
YES
