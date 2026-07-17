# AI Media App-Managed Result Import

Phase: `BAZAR-BAZ-AI-MEDIA-APP-MANAGED-MOCK-RESULT-IMPORT-01`

## Purpose

This phase implements the first app-managed import of a completed MOCK AI media
result into Bazar Baz-owned storage. The flow is server-side and MOCK-only:

```
Render MOCK
    ↓
RESULT_READY (provider result)
    ↓
provider result validation
    ↓
Bazar import service (server-only)
    ↓
local test storage gateway
    ↓
AiMediaImport IMPORTED
    ↓
AiMediaAsset created
    ↓
AiMediaJobMirror IMPORTED
```

## Providers

Only `MOCK` provider results are accepted. The validator rejects every other
provider with `UNSUPPORTED_PROVIDER`. Real generation is blocked.

## Components

### Provider result validation

`lib/ai-media/provider-result-validation.ts` is a pure, side-effect-free
validator:

- Requires `RESULT_READY` canonical state (`RESULT_NOT_READY` otherwise).
- Requires provider `COMPLETED` status (`PROVIDER_NOT_COMPLETED`).
- Requires provider job id to match the mirror (`ID_MISMATCH`).
- Rejects unsupported providers (`UNSUPPORTED_PROVIDER`).
- Rejects unsupported MIME types such as `svg`/`html`/`xml` (`INVALID_MIME`).
- Rejects unsafe/non-HTTPS/private output URLs (`UNSAFE_URL`, private IPv4).
- Rejects missing outputs (`NO_OUTPUTS`).
- Computes a 64-char result fingerprint for idempotency and dedupe.
- Never reads DB or network; never leaks raw provider URLs in `safeSummary`.

### Import service

`lib/services/ai-media-result-import-service.ts` (server-only):

1. Loads the `AiMediaJobMirror` and requires `RESULT_READY`.
2. Checks for an existing `IMPORTED` import with an accepted asset and returns
   the canonical asset when found (idempotency / `reused: true`).
3. Reads the provider result through a swappable runtime (`getProviderResult`).
4. Validates the provider result.
5. Stores the asset through the application storage gateway
   (`storeCreativeStudioAsset` for synthetic buffer, or
   `storeCreativeStudioAssetFromRemote` for real remote fetch with HTTPS and
   private-IP guards).
6. Creates `AiMediaImport` (PROCESSING → IMPORTED) and `AiMediaAsset`.
7. Marks `AiMediaJobMirror` and `AiMediaRequest` as `IMPORTED` only after
   successful storage.
8. Appends an `ASSET_ACCEPTED` job event with a dedupe key.
9. On storage failure keeps `RESULT_READY` (or `IMPORT_FAILED`) and never marks
   `IMPORTED`. On DB persist failure compensates the stored asset.

### Storage gateway

`lib/storage/application-storage.ts` validates image bytes and sizes
(max 5 MB, allowed types), blocks private/unsafe provider URLs, and compensates
failed imports (`compensateFailedAssetImport`).

`lib/storage/local-test-storage.ts` provides the local test adapter. It throws
`Local test storage cannot run in production` when `NODE_ENV === "production"` or
`VERCEL_ENV === "production"`.

### Route

`app/api/dashboard/ai-media/preview/jobs/[id]/import/route.ts` is guarded:

- `requireAuthSession` + `requireCurrentOrganizationId` (org scoped).
- `evaluateAiMediaPreviewWriteGuard` + `evaluateAiMediaPreviewDbIdentityGuard`
  (fail closed outside Preview/test/dev).
- Requires an idempotency key.
- Calls `importResultReadyOutput` server-side only.
- Returns only a storage-key fingerprint, never raw provider URLs or secrets.
- No `NEXT_PUBLIC_*` / `BLOB_READ_WRITE_TOKEN` / `AI_MEDIA_SERVICE_INTERNAL_KEY`.

## Idempotency

A second import with the same `mirrorId` + `outputIndex` (existing `IMPORTED`
import) returns the canonical `AiMediaAsset` with `reused: true`. No second
storage write and no duplicate `AiMediaAsset` are created.

## Safety

- Blob write: false
- Render mutation: false
- Real generation: false
- Wallet settlement: false
- Raw provider URL exposed: false

No Production DB, no hosted Preview DB, no Production Blob, no browser Render
secrets, no Baz wallet mutation.

## Tests and gates

- `pnpm run test:ai-media:app-managed-import`
- `pnpm run quality:ai-media-app-managed-import`
- `pnpm run e2e:ai-media:local-docker-import` (disposable Docker Postgres only)
