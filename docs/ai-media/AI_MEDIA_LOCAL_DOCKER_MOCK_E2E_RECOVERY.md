# AI Media Local Docker MOCK E2E Recovery (create + status sync)

Phase: `BAZAR-BAZ-AI-NETWORK-LOCAL-DOCKER-MOCK-E2E-RECOVERY-01`

## Purpose

Recover the local Docker MOCK end-to-end flow for provider **job creation**
and **status sync** without depending on the external Render MOCK coordinator
that previously returned HTTP 500 on product-image creation. The recovery runs
the full app-owned create → status-sync path against the **local contract mock**
(a faithful in-process copy of the pinned Render contract), using a disposable
local Docker Postgres. The flow stays MOCK-only and fails closed outside
local/test/Preview scope.

```
Bazar app (submitPreviewMockAiMediaJob)
    ↓ create (idempotent)
local contract MOCK  -> 201 { job_id, status: COMPLETED, provider: MOCK }
    ↓
AiMediaJobMirror created (SUBMITTED_TO_RENDER -> RESULT_READY)
providerJobId stored
    ↓
syncPreviewMockAiMediaJobStatus (status sync)
    ↓
AiMediaJobMirror RESULT_READY (idempotent reuse confirmed)
```

## Scope and safety

- Provider: `MOCK` only. Real generation is blocked.
- Database: disposable local Docker Postgres (`bazar-baz-ai-media-createsync-*`).
  No Production DB, no hosted Preview DB.
- Service target: local contract mock (`127.0.0.1`, configurable port, default
  `4766`). The runner refuses any non-local service URL and refuses to start the
  mock in Vercel production.
- Blob write: false (create/status-sync does not write assets; the import phase
  owns storage).
- Render mutation: guarded and MOCK-only.
- Wallet settlement: false.
- No `NEXT_PUBLIC_*` secrets, no `BLOB_READ_WRITE_TOKEN`, no
  `AI_MEDIA_SERVICE_INTERNAL_KEY` exposed to the client.

## Components

### Create service

`lib/services/ai-media-preview-mock-write-service.ts` (server-only):

- `submitPreviewMockAiMediaJob` creates a draft request + app-owned mirror
  (`SUBMITTED_TO_RENDER`), then calls the provider create endpoint through the
  server-only client (`createAiMediaJob`).
- On success it stores the provider job id and maps the provider status to a
  mirror state via `updateMirrorFromNormalizedStatus`, then marks the request
  `SUBMITTED`.
- On provider failure (e.g. HTTP 500) it safely records
  `FAILED_RETRYABLE`/`FAILED_FINAL` with a sanitized `PROVIDER_ERROR` and no
  provider job id, then throws.
- Idempotent reuse: a repeated submit with the same idempotency key returns the
  existing mirror/provider job and `reused: true`.

### Status sync service

- `syncPreviewMockAiMediaJobStatus` fetches the provider job
  (`getAiMediaJob`) and remaps its status onto the mirror. It honors missing
  provider job ids (`PROVIDER_JOB_ID_MISSING`) without throwing.

### Status mapping

`lib/ai-media/status.ts` maps provider `COMPLETED`/`SUCCEEDED`/`SUCCESS` to the
canonical `RESULT_READY` state. `lib/ai-media/job-mirror.ts` maps that canonical
status to `AiMediaJobMirrorState.RESULT_READY`.

### Local contract mock

`scripts/ai-media/local-contract-mock.mjs` implements the pinned Render
contract's create/status/cancel endpoints, returns `provider: "MOCK"` and
`status: "COMPLETED"`, requires the internal key header, and refuses to start in
Vercel production.

## Files

- `scripts/e2e/ai-media-local-docker-create-sync.mjs` — wrapper: disposable
  Docker Postgres + contract mock + bootstrap + flow.
- `scripts/e2e/ai-media-local-docker-create-sync-e2e.mts` — service-level flow:
  create, status sync, idempotent reuse, secret-leak guard, cleanup.
- `scripts/quality/validate-ai-media-local-docker-create-sync.mjs` — quality gate.

## Recovery result (expected)

```json
{
  "ok": true,
  "database": "LOCAL_DISPOSABLE",
  "provider": "MOCK",
  "createState": "RESULT_READY",
  "syncState": "RESULT_READY",
  "providerJobIdStored": true,
  "appOwnedMirrorCreated": true,
  "idempotentReuse": true,
  "blobWrite": false,
  "realGeneration": false,
  "walletSettlement": false,
  "renderInternalKeyExposed": false
}
```

## Gates

- `pnpm run quality:ai-media-local-docker-create-sync`
- `pnpm run e2e:ai-media:local-docker-create-sync` (disposable Docker Postgres only)

## Note on the Render HTTP 500 blocker

The previously reported blocker (deployed Render MOCK `POST
/v1/product-image-suggestions/jobs` returning HTTP 500 after commit
`39168ae167c69aca3c01ae59368323dc5658b88f`) is not reproduced here. This phase
proves the **app-side** create + status-sync path is correct and MOCK-compatible
by exercising it against the local contract mock. The hosted Render MOCK
coordinator remains untouched; live Preview MOCK E2E is still gated behind the
local Docker gate passing first.

## Integration targets

- The **local contract mock** is a deterministic offline regression target. It
  faithfully implements the pinned Render contract's create/status/cancel
  endpoints and is used for hermetic E2E.
- The **deployed Render** coordinator (`https://bazar-baz-ai-media-service.onrender.com`)
  is a separately verified integration target. Deployed Render read-only
  verification (`/health`, `/ready`, `/openapi.json`) was completed in an earlier
  phase with matching fingerprint `8bed184dd79980beacc553308652a44d99590c9705b7d37ab9418f4f83868f91`
  and 42 paths / 40 schemas.
- This phase does **not** claim that deployed Render is broken. The local mock
  coverage exists so that the Bazar app-side create + status-sync path can be
  validated without depending on external network availability.
