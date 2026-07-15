# AI Media P04-P06 Validation Report

Date: 2026-07-15

Status: blocked at Preview isolation recovery gate.

## Milestone

BB-AI-MEDIA-P04-P06 was intended to prove the safe Preview MOCK lifecycle:

authorized tenant user -> Bazar Baz server -> local tenant-scoped job -> authenticated Render MOCK request -> persisted provider job -> bounded status sync -> validated MOCK result -> storage import -> tenant-scoped Creative Studio asset.

The lifecycle was not executed because Preview persistence is not isolated from Production.

## Continuity Checks

- `git status --short`: clean
- `git branch --show-current`: `main`
- `git rev-parse HEAD`: `bfaa0907eee4217d1c083c8f6800c21c427eee3a`
- `git ls-remote origin main`: matched local HEAD
- Accepted commits present:
  - `aeafd84 feat(ai-media): add capability registry and lifecycle hardening`
  - `5e932ef feat(settings): show notification policy`
  - `bfaa090 docs(ai-media): record preview isolation blocker`

## Deployment Checks

- Production deployment inspected through Vercel CLI: READY
- Production alias included `https://www.bazar-baz.ir`
- Production health read-only smoke: passed
- Production real generation: not enabled
- Production generation job: not created
- Production database migration: not executed

## Isolation Gate

The Preview/Production environment comparison showed shared database connection variables:

- `DATABASE_URL`: same value
- `DIRECT_URL`: same value
- `DATABASE_URL_UNPOOLED`: same value

AI-media service identity was also shared:

- `AI_MEDIA_SERVICE_URL`: same value
- `AI_MEDIA_SERVICE_INTERNAL_KEY`: same value

Because Preview shares the production database, any Preview lifecycle write would create production rows. The phase was stopped before job creation.

## Render / Contract Status

The accepted source contract remains:

- product image: `AVAILABLE`
- organization logo: `UNAVAILABLE`
- organization cover: `UNAVAILABLE`
- general creative: `UNKNOWN`
- contract fingerprint: `ab70c8d0bb1d9ccd`

No direct Render job operation was executed during this phase.

## Tests Not Run Due To Isolation Blocker

- Preview product-image MOCK job creation
- Provider job persistence
- Sequential duplicate idempotency
- Concurrent duplicate idempotency
- Cross-tenant deployed access checks
- Preview status synchronization
- Preview result ingestion
- Preview Blob/storage import
- Cancellation/failure deployed lifecycle tests

## Safety Outcome

- Secret values printed: no
- Env files committed: no
- Temporary env files retained: no
- Production rows changed: no
- Production assets created: no
- Real GPU generation executed: no
- SMS/email/Web Push/payment/domain action: no

## Required Next Step

Create or configure an isolated Preview persistence target before resuming P04-P06.

Recommended:

1. Create a Neon Preview branch/database for Vercel Preview.
2. Set Preview-only `DATABASE_URL`, `DIRECT_URL`, and `DATABASE_URL_UNPOOLED`.
3. Configure Preview-only storage or an explicit non-production Blob target.
4. Confirm Render active provider mode is MOCK through server-side diagnostics.
5. Rerun the isolation gate.

## Isolation Recovery Validation

The recovery run inspected only metadata and source state. It did not create or mutate external resources.

| Check | Result |
| --- | --- |
| Current branch is `main` | passed |
| Working tree clean before recovery | passed |
| HEAD matches `origin/main` | passed |
| Production deployment Ready | passed |
| Vercel Preview deployments discoverable | passed |
| Neon API variable names present locally | passed |
| Neon project discovery with `NEON_API_KEY` | failed: `403` |
| Neon project discovery with `NEON_PROJECT_API_KEY` | failed: `403` |
| `NEON_PROJECT_ID` available without printing secrets | failed: not present |
| Preview Neon branch created/reused | skipped: management authorization unavailable |
| Preview database migration status | skipped: no isolated Preview database URL |
| Preview Blob store/token creation | skipped: database isolation blocker reached first |
| Preview AI-media client isolation proof | skipped: database isolation blocker reached first |
| MOCK lifecycle | skipped: isolation gate did not pass |

No Production row, Blob object, Render job, SMS, email, Web Push, payment, tenant provisioning, or domain provider action was performed.
