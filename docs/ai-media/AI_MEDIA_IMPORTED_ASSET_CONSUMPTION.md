# AI Media Imported Asset Consumption

Phase: `BAZAR-BAZ-AI-MEDIA-ASSET-CONSUMPTION-01`

## Purpose

This phase makes canonical imported AI media assets safely available inside the
Bazar Baz application. Only assets backed by a successful app-managed import
(`AiMediaImport.status === IMPORTED`) are visible. Provider URLs, Render
secrets, and storage credentials never leave the server.

```
AiMediaRequest
    ↓
AiMediaJobMirror (RESULT_READY → IMPORTED)
    ↓
AiMediaImport (status: IMPORTED, acceptedAssetId: <asset>)
    ↓
AiMediaAsset (storageKey, storageKeyFingerprint, mimeType, checksum)
    ↓
consumption: list / detail / content
    (authenticated, org-scoped, imported-only)
```

## Canonical usable/imported asset rule

An `AiMediaAsset` is consumable when all of the following are true:

- `deletedAt` is `null` (not soft-deleted).
- `organizationId` matches the requesting user's organization.
- A linked `AiMediaImport` exists with `status === "IMPORTED"` and
  `acceptedAssetId` is set.
- The asset has a storage reference: `storageKey` (preferred, actual app-owned
  storage key) OR `storageKeyFingerprint` (SHA-256 of the key, legacy fallback).
- The asset `mimeType` is one of the allowed image types:
  `image/jpeg`, `image/png`, `image/webp`, `image/gif`.

Legacy assets created before the `storageKey` column existed (rows with
`storageKey = NULL`) are **not consumable** until explicitly backfilled. The
canonical rule requires at least one storage reference to be present.

This rule is enforced in a single reusable pure helper
(`lib/ai-media/asset-visibility.ts`) and reused by the service, route, and
selection layers.

## Safe metadata projection

The API returns only the following fields for each asset:

- `id`
- `mimeType`
- `width` / `height`
- `byteSize`
- `storageProvider`
- `checksumSha256`
- `visibilityScope`
- `acceptedAt`
- `createdAt`
- `previewUrl` (a Bazar-controlled `/api/dashboard/ai-media/assets/[id]/content` URL)
- `sourceType` (safe derived label like `MOCK:PRODUCT_IMAGE`)
- `requestedByUserId`

Never returned:

- Provider result URL
- Render base URL or job payload
- Storage credentials
- Raw internal filesystem paths
- Signed provider credentials
- `storageKeyFingerprint` is never exposed in API responses

## Content-serving boundary

Asset content is served only through:

```
GET /api/dashboard/ai-media/assets/[id]/content
```

This route:

- Requires authentication and organization membership.
- Enforces asset ownership (organization-scoped).
- Enforces the canonical imported/usable rule.
- Streams bytes only through the application storage gateway
  (`streamApplicationAssetContent`).
- For `local-test` storage: reads from the workspace-local filesystem.
- For `vercel-blob` storage: streams through the Vercel Blob read path.
- Never redirects to provider URLs.
- Sets safe headers:
  - `Content-Type` from the stored MIME type.
  - `Content-Disposition: inline` with a safe filename.
  - `X-Content-Type-Options: nosniff`.
  - `Cache-Control: private, no-store`.

## API routes

### List assets

`GET /api/dashboard/ai-media/assets`

Query params:

- `organizationId` (required for SUPER_ADMIN; otherwise resolved from session)
- `page` (default: 1, min: 1)
- `pageSize` (default: 20, max: 50)
- `requestedByUserId` (optional filter)

Returns only imported, non-deleted assets for the organization.

### Asset detail

`GET /api/dashboard/ai-media/assets/[id]`

Returns the safe projection for a single usable imported asset.
Foreign or non-imported assets return 404.

### Asset content

`GET /api/dashboard/ai-media/assets/[id]/content`

Streams the asset bytes. Requires the asset to be imported, usable, and
organization-scoped. MIME allowlist enforced. Path traversal is impossible
because the storage key comes from the database record, not the client.

## Selection abstraction

`lib/services/ai-media-asset-selection-service.ts` provides
`validateAiMediaAssetForSelection(assetId, organizationId)` which:

- Loads the asset with its import record.
- Enforces the canonical usable/imported rule.
- Verifies same-organization ownership.
- Returns a stable canonical reference (`id`, `storageKeyFingerprint`,
  `mimeType`, `visibilityScope`, etc.).

This abstraction does not mutate `Product`, `Service`, or any other entity.
Future attachment phases must use this boundary instead of reimplementing
ownership checks.

## Dashboard UI

`app/[locale]/dashboard/ai-media/assets/page.tsx`

- Client component with `useSession`.
- Persian (`fa`) default copy; English (`en`) and Arabic (`ar`) included.
- RTL for `fa`/`ar`, LTR for `en`.
- Grid of imported assets with safe thumbnails via the Bazar content route.
- MIME type badge, dimensions, file size, source type, creation date.
- Deterministic pagination (previous/next with page indicator).
- Accessible loading skeletons, empty state, and error state.
- No provider URL in markup or browser network requests.

## Storage architecture

- App-owned storage gateway: `lib/storage/application-storage.ts`.
- Local test adapter: `lib/storage/local-test-storage.ts` (non-Production only).
- Vercel Blob adapter: `lib/storage/vercel-blob-storage.ts`.
- Image validation: `lib/storage/image-validation.ts` (5 MB max, JPEG/PNG/WebP/GIF).

The `AiMediaAsset` model stores `storageKeyFingerprint` (SHA-256 of the storage
key) and, since migration `20260717200000_add_ai_media_asset_storage_key`, the
actual `storageKey` column. Content serving uses `storageKey` (falling back to
`storageKeyFingerprint` only for legacy rows that were backfilled). Both fields
are server-only and never exposed through the API or client serialization.

## Safety

- No browser-to-Render calls.
- No `NEXT_PUBLIC_*` secrets.
- No provider URL exposure.
- No storage credential exposure.
- No real generation.
- No Baz wallet mutation.
- Production write paths remain fail-closed.
- Cross-tenant access fails with safe 404.

## Production readiness gate

The consumption feature is **fail-closed** before the Production database has
the `storageKey` column and storage activation is explicitly approved.

- `lib/ai-media/asset-consumption-feature-guard.ts` exposes
  `getAiMediaAssetConsumptionFeatureState()` and `assertAiMediaAssetConsumptionEnabled()`.
- **Production**: disabled by default (`enabled: false`). No Production
  migration is run in this phase.
- **Preview**: enabled only through the existing accepted-risk guard
  (`AI_MEDIA_ASSET_CONSUMPTION_PREVIEW_ENABLED=true` + `AI_MEDIA_PREVIEW_MOCK_WRITES_ENABLED=true`).
- **development / test / local**: enabled for hermetic verification.

The guard is invoked **before** any Prisma query in the list, detail, content,
and selection code paths. Unauthenticated requests still return 401 before any
asset query.

## Migration

`prisma/migrations/20260717200000_add_ai_media_asset_storage_key/migration.sql`
adds a nullable `storageKey TEXT` column and an index. It is additive and
idempotent (`IF NOT EXISTS`). Existing rows without `storageKey` remain valid
rows but are hidden by the usable-asset rule until backfilled.

`scripts/quality/validate-ai-media-storage-key-migration.mjs` validates both:

- Fresh database: `db push` + migration produces the column + index, nullable.
- Upgrade path: a pre-existing `AiMediaAsset` row with `storageKey = NULL`
  survives the migration and remains non-consumable.

## Tests

- `tests/unit/ai-media-asset-consumption.test.ts` — unit tests for visibility
  rule, safe projection, service with mock DB, source safety.
- `scripts/e2e/ai-media-local-docker-asset-consumption.mjs` — disposable Docker
  Postgres + local contract mock E2E covering create → status-sync → import →
  list → detail → content → cross-tenant rejection.

## Gates

- `pnpm run test:ai-media:asset-consumption`
- `pnpm run quality:ai-media-asset-consumption`
- `pnpm run e2e:ai-media:local-docker-asset-consumption`
