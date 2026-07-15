# AI Media Preview Isolation Report

Date: 2026-07-15

Phase: BB-AI-MEDIA-P04-P06 / BB-AI-MEDIA-P04-P06-ISOLATION-RECOVERY

Status: blocked before lifecycle writes.

## Scope

This report records the Preview isolation gate for the AI Media MOCK lifecycle. The goal was to determine whether a Vercel Preview deployment could safely create temporary AI-media jobs, provider MOCK jobs, and temporary generated assets without writing to production persistence.

No generation job was created.

No production database row was modified.

No Blob asset was uploaded.

No secret value was printed or committed.

## Source Continuity

- Branch: `main`
- Accepted source HEAD: `bfaa0907eee4217d1c083c8f6800c21c427eee3a`
- `origin/main`: matched local HEAD during preflight
- Working tree: clean before the isolation check
- Accepted commits present:
  - `aeafd84 feat(ai-media): add capability registry and lifecycle hardening`
  - `5e932ef feat(settings): show notification policy`
  - `bfaa090 docs(ai-media): record preview isolation blocker`

## Production Deployment

- Production alias: `https://www.bazar-baz.ir`
- Vercel production deployment inspected as READY.
- Production aliases included `www.bazar-baz.ir` and `bazar-baz.ir`.
- Production health was read-only checked and reported `status: ok`.
- Production AI media service flags were configured and paid-provider enablement remained false.

## Secret-Safe Environment Comparison

Preview and Production environment files were pulled into temporary local files for comparison only. The comparison printed only presence/equality booleans, not values. The temporary files were removed immediately after comparison and were not committed.

Result:

| Variable | Preview Present | Production Present | Same Value |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | yes | yes |
| `DIRECT_URL` | yes | yes | yes |
| `DATABASE_URL_UNPOOLED` | yes | yes | yes |
| `BLOB_READ_WRITE_TOKEN` | no | yes | no |
| `AI_MEDIA_SERVICE_URL` | yes | yes | yes |
| `AI_MEDIA_SERVICE_INTERNAL_KEY` | yes | yes | yes |
| `AI_MEDIA_SERVICE_ENABLED` | yes | yes | yes |
| `AI_MEDIA_PAID_PROVIDER_ENABLED` | no | no | no |
| `NEXT_PUBLIC_DEPLOYED_APP_URL` | yes | yes | yes |

## Isolation Decision

Preview is not isolated for AI-media lifecycle writes because it shares the production database connection variables.

The phase stop condition applies:

> Preview is not isolated from production writes.

Because the database is shared, creating a Preview AI-media job would create production database rows. Even if Render is in MOCK mode, the local Bazar Baz job, status updates, and Creative Studio asset records would be production data mutations.

## Lifecycle Write Status

- Product-image job creation: not run
- Duplicate/idempotency write test: not run
- Status synchronization write test: not run
- Result ingestion/import: not run
- Blob upload: not run
- Tenant asset creation: not run
- Cleanup mutation: not needed

## Required Before Resuming P04-P06

One of the following must be true before lifecycle writes are safe:

1. Vercel Preview uses a dedicated Neon database/branch and a dedicated storage target.
2. A disposable test organization is provisioned in an isolated non-production database.
3. A fully mocked local integration harness is used with no external persistence.
4. Separate explicit authorization is granted to create and clean up production test data, with a documented cleanup plan.

The recommended path is a dedicated Neon Preview branch plus Preview-only storage.

## Isolation Recovery Attempt

Date: 2026-07-15

The recovery phase attempted safe metadata discovery before creating any Preview resource.

Result:

- Current branch: `main`
- Local HEAD: `bfaa0907eee4217d1c083c8f6800c21c427eee3a`
- `origin/main`: matched local HEAD
- Working tree: clean
- Production deployment: Vercel reported `https://www.bazar-baz.ir` as Ready.
- Latest Vercel deployment list included Ready Preview deployments.
- Local `.env` contained Neon management variable names, but no values were printed.
- `NEON_API_KEY` project discovery returned `403`.
- `NEON_PROJECT_API_KEY` project discovery returned `403`.
- No `NEON_PROJECT_ID` was found in source-visible configuration.

Decision:

- Stop condition 3 applies: Neon management credentials are unavailable for safe branch discovery/creation.
- No Neon branch was created.
- No Vercel Preview database variables were changed.
- No Blob store/token was created or used.
- No Render job was created.
- No lifecycle writes were performed.

The required Preview resource boundary is now documented in `docs/ai-media/AI_MEDIA_PREVIEW_RESOURCE_PLAN.md`.
