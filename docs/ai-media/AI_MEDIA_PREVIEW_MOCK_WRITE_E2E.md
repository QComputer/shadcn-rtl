# AI Media Preview MOCK Write E2E

Date: 2026-07-16
Phase: BAZAR-BAZ-AI-MEDIA-PREVIEW-MOCK-WRITE-E2E-01

## Summary

This phase adds the Bazar Baz source gate for the first Preview-only MOCK AI media write flow.

The flow is:

1. authenticated `SUPER_ADMIN` request to Bazar Baz
2. Preview write guard
3. Preview DB identity guard
4. app-owned `AiMediaRequest`
5. app-owned `AiMediaJobMirror`
6. server-only Render MOCK product-image job creation
7. provider job id stored on the mirror
8. safe status sync through the server
9. no Blob import
10. no Baz ledger settlement

Production AI writes remain disabled.

## Required Guards

The Preview write guard in `lib/ai-media/preview-write-guard.ts` requires:

- non-Production environment
- Preview, test, or development equivalent
- `AI_MEDIA_PREVIEW_MOCK_WRITES_ENABLED=true`
- `AI_MEDIA_PREVIEW_ISOLATION_VERIFIED=true`
- `AI_MEDIA_RENDER_PINNED_CONTRACT_VERIFIED=true`
- provider `MOCK`
- real generation disabled
- caller role `SUPER_ADMIN`

The Preview DB identity guard in `lib/ai-media/preview-db-identity-guard.ts` additionally requires:

- `DATABASE_URL` present
- `DIRECT_URL` present
- `DATABASE_URL` and `DIRECT_URL` are not identical
- `AI_MEDIA_PREVIEW_DB_FINGERPRINT` present
- `AI_MEDIA_PRODUCTION_DB_FINGERPRINT` present
- Preview and Production DB fingerprints differ
- optional branch ids do not match when both are provided
- `AI_MEDIA_PREVIEW_DB_IDENTITY_VERIFIED=true`

The guard returns only safe booleans/classifications and blocker messages. It does not print database URLs or secret values.

## Preview Migration Rule

The AI media mirror migration may be applied only to the verified Preview Neon branch after the DB identity guard is green.

Allowed command after proof:

```powershell
pnpm prisma migrate deploy
```

Required runtime context:

- `VERCEL_ENV=preview` or safe equivalent
- Preview-only `DATABASE_URL`
- Preview-only `DIRECT_URL`
- Preview DB fingerprint differs from Production
- explicit Preview DB identity verification flag

Forbidden:

- Production migration
- `db push` to Production
- seed against Production
- editing already-applied migrations
- applying this migration without Preview DB identity proof

No Preview migration was run by this source gate unless separately recorded in the phase report.

## Route Behavior

Routes:

- `POST /api/dashboard/ai-media/preview/jobs`
- `GET /api/dashboard/ai-media/preview/jobs`
- `GET /api/dashboard/ai-media/preview/jobs/[id]`
- `POST /api/dashboard/ai-media/preview/jobs/[id]`

`POST /preview/jobs` requires an idempotency key. With `dryRun` omitted or true, it returns a plan and does not call Render. With `dryRun=false`, it may create the app request/mirror and call the pinned Render MOCK product-image creation endpoint, but only after both guards pass.

`POST /preview/jobs/[id]` performs a guarded server-side status sync. It fetches the provider status by local app-owned mirror id and organization scope, not by a browser-supplied provider URL.

## Render MOCK Boundary

Render mutation is allowed only in Preview/test/development guarded paths. The browser never receives the Render credential and never calls Render directly.

The pinned contract remains:

- URL: `https://bazar-baz-ai-media-service.onrender.com`
- fingerprint: `8bed184dd79980beacc553308652a44d99590c9705b7d37ab9418f4f83868f91`
- paths: `42`
- schemas: `40`
- provider: `MOCK`
- real generation: disabled

## How To Run

Local mocked/source tests:

```powershell
pnpm run test:ai-media:preview-mock-write-e2e
pnpm run quality:ai-media-preview-mock-write-e2e
```

Preview live E2E requires an explicit operator-controlled environment, including:

```powershell
$env:AI_MEDIA_PREVIEW_WRITE_E2E="1"
$env:AI_MEDIA_PREVIEW_MOCK_WRITES_ENABLED="true"
$env:AI_MEDIA_PREVIEW_ISOLATION_VERIFIED="true"
$env:AI_MEDIA_RENDER_PINNED_CONTRACT_VERIFIED="true"
$env:AI_MEDIA_PREVIEW_DB_IDENTITY_VERIFIED="true"
```

Equivalent shell notation: `AI_MEDIA_PREVIEW_WRITE_E2E=1`.

Do not run Preview live E2E unless the active database is proven to be the isolated Preview branch.

## Still Disabled

- Production AI writes
- Production DB writes
- Production migrations
- Production Blob/storage writes
- Production Render mutation
- Production AI job creation
- real generation
- Blob import
- Baz ledger settlement
- worker portal
- Super Admin network console
- Control Center
- installer
- no P07
