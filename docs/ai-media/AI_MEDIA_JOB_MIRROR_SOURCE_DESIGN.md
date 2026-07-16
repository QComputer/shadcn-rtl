# AI Media Job Mirror Source Design

Date: 2026-07-16
Phase: BAZAR-BAZ-AI-NETWORK-AI-JOB-MIRROR-SOURCE-DESIGN-01
Status: Source design only; no schema, migration, DB write, Render write, Blob write, deploy, or AI job creation.

## Current Handling

Bazar Baz currently has a product-image bridge through the existing `AiMediaJob` model and `AiMediaUsageEvent` records. The app creates a local row before submitting a product-image request, stores a correlation id and idempotency metadata in JSON inputs, mirrors the provider job id after Render accepts the request, polls the Render status endpoint through the server-only client, and imports a selected result through the application storage gateway. This is enough for the current Creative Studio product-image bridge, but it is product-specific and does not yet model the full Bazar Baz AI network.

Current accepted pieces:

- Bazar Baz browser never calls Render directly.
- Render credentials remain server-side.
- `lib/ai-media/status.ts` maps AI network statuses into safe canonical states, including GPU offline and GPU busy as queued conditions, not failures.
- Selected product-image results are copied into Bazar Baz application-managed storage before becoming public product media.
- Existing usage/cost telemetry is lightweight and not a Baz wallet or ledger.

Current gaps this design prepares:

- No first-class `AiMediaRequest` object for quoting, ownership, idempotency, or request privacy.
- No general `AiMediaJobMirror` separate from the current product-specific `AiMediaJob`.
- No immutable `AiMediaJobEvent` audit stream.
- No first-class `AiMediaAsset` or `AiMediaImport` lifecycle for imported media.
- No `AiMediaUsageQuote`, `AiMediaSpendHold`, or settled Baz ledger integration.
- No `WorkerContributionMirror` for privacy-safe worker contribution facts.
- No Super Admin AI network console, worker portal, desktop Control Center, installer, or real generation in this phase.

## Ownership Boundary

shadcn-rtl owns Bazar Baz users, organizations, permissions, request ownership, future Baz wallet/ledger holds, imported media assets, and future Super Admin monitoring. The external `bazar-baz-ai-media-service` owns Render coordination, GPU queueing, worker heartbeat, claim/lease/result mechanics, worker capability, model recommendation, trust/privacy routing, and raw contribution facts.

Render status is mirrored but not blindly trusted. Render is not the source of wallet truth, spend settlement truth, user-visible success, or tenant authorization. The user-visible success boundary is an accepted Bazar Baz import: the Bazar Baz server validates the provider result, stores it through the application-owned storage gateway, creates the tenant-scoped imported asset, and only then allows spend settlement.

Baz remains an internal platform credit for Bazar Baz service use. It is not crypto, not tradable, not withdrawable, and this phase does not implement Baz wallet or ledger tables.

## Future Entities

| Entity | Purpose | Ownership and Scope | Render Relation | Imported Asset Relation | Future Baz Ledger Relation | Visibility | Audit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AiMediaRequest` | Captures the app-owned user intent before any Render submission. Includes request type, locale, tenant, prompt metadata, input references, desired count, and policy snapshot. | Owned by Bazar Baz. Scoped to `organizationId` and `requestedByUserId`; may reference product, organization brand, or future creative target. | Has no provider job id until after quote and hold gates pass. | May produce zero or more imports through related mirrors. | Quote input for later `AiMediaUsageQuote`; never directly settles spend. | Normal users see own/org request summaries only. Prompt and file details follow request privacy. SUPER_ADMIN may inspect later. Worker operators cannot see prompts, images, or files. | Creation and policy decisions must be recorded in `AiMediaJobEvent`. | Request-level idempotency key is tenant scoped and payload hashed. Same key with same payload returns same request; same key with different payload conflicts. |
| `AiMediaJobMirror` | Mirrors a submitted network job in Bazar Baz with local state, provider ids, correlation id, retry metadata, and ownership. | Owned by Bazar Baz. Scoped to organization and requester. Database ownership is authoritative. | Stores provider job id, provider status, normalized network status, and contract fingerprint. Provider id never authorizes access by itself. | Moves toward `IMPORT_PENDING` only after provider result is ready and Bazar Baz decides to ingest. | References hold/quote ids but does not itself mutate ledger balances. | Normal users see own/org mirrors. Cross-user/cross-org access is hidden. SUPER_ADMIN all-job monitoring is future. Worker operators see only anonymized routing/contribution metadata. | Every state transition creates an event with safe provider metadata and no raw secrets. | Mirror submission is tenant scoped. Duplicate submission with same request and idempotency key returns the same mirror and provider job if already accepted. |
| `AiMediaJobEvent` | Immutable audit timeline for request, quote, hold, submission, sync, import, failure, cancel, expiry, rollback, and refund decisions. | Owned by Bazar Baz. Scoped to organization, request, mirror, and actor when applicable. | May include redacted provider status, provider request id, or error category, never raw credentials. | Records import attempts, import success, storage compensation, and orphan cleanup requirement. | Records hold create/settle/release/refund decisions, but the future ledger remains the monetary source of truth. | Normal users see redacted own/org events. SUPER_ADMIN may inspect full safe diagnostics later. Worker operators do not receive prompts/images/files. | Required for every state change and operator decision. | Event de-dupe keys prevent duplicate audit rows for repeated sync/import attempts. |
| `AiMediaAsset` | App-owned representation of an imported AI media asset after Bazar Baz accepts it. | Owned by Bazar Baz. Tenant scoped. References organization, requester, request, mirror, import, and application storage key. | Provider result metadata is historical only; Render URL is not the permanent asset URL. | This is the user-visible media asset boundary. It points to application-managed storage, not provider storage. | Spend can be settled only after this asset is accepted. | Normal users see own/org assets according to product/creative permissions. SUPER_ADMIN later can inspect all. Worker operators cannot see stored private files. | Creation, replacement, rollback, and deletion must be evented. | Asset finalization is idempotent per mirror/import/output identity and must not create duplicate permanent assets. |
| `AiMediaImport` | Tracks the Bazar Baz server-side result ingestion attempt from provider result to application storage and asset finalization. | Owned by Bazar Baz. Scoped to organization and mirror. | Reads provider result through server-only client using local mirror ownership. Does not accept arbitrary browser result URLs. | Creates or finalizes `AiMediaAsset` only after validation and storage. | Settlement is blocked until import is accepted. Failure/cancel/expiry releases/refunds holds. | Normal users can see safe status for own/org imports. Raw provider URLs and storage keys stay server-only. | Records validation, checksum, MIME, dimensions, storage key, compensation, and rollback result safely. | Duplicate ingestion for the same mirror/output returns the existing import or asset. It must not upload duplicate objects. |
| `AiMediaUsageQuote` | Captures estimated Baz cost, provider capability, quota policy, and expiration before submission. | Owned by Bazar Baz. Scoped to organization/requester/request. | Uses app policy and capability metadata, not provider billing as direct truth. | No asset relation until accepted import. | Basis for a future hold; not a ledger entry itself. Render is not the source of wallet truth. | Normal users see own/org quote summary. SUPER_ADMIN later can see diagnostic policy snapshots. | Quote creation/expiry/refresh must be evented. | Quote idempotency is request and payload scoped; expired quotes require refresh. |
| `AiMediaSpendHold` | Future internal Baz hold reserving spend while a request is eligible for provider submission. | Owned by Bazar Baz and future Baz ledger service. Scoped to organization wallet/account and request. | Render acceptance does not settle the hold. Provider failure does not directly mutate wallet truth. | Settled only after accepted Bazar Baz import. | Represents future hold lifecycle: create, keep, settle, release/refund. Baz is internal credit, not crypto/tradable/withdrawable. | Normal users see own/org financial summary only. SUPER_ADMIN later can audit all. Worker operators see no wallet data. | Every hold transition must be auditable and reconciled with the future ledger. | Hold creation and settlement are idempotent per request/import identity. |
| `WorkerContributionMirror` | Privacy-safe mirror of worker contribution facts needed for trust, routing, and future internal compensation reporting. | Owned by Bazar Baz as a redacted projection. Worker source of raw facts remains ai-media-service. | References provider worker id or contribution id through non-secret opaque identifiers. | Does not contain prompts, images, files, customer data, or provider result URLs. | May later inform internal Baz/network accounting, but never directly moves user wallet funds. | Worker operators can see their own contribution summaries only; no prompts/images/files. SUPER_ADMIN later can monitor all safe contribution facts. Normal tenant users do not see worker facts. | Contribution facts are append-only or versioned with source timestamp and contract fingerprint. | Contribution records are idempotent by provider contribution id and mirror id. |

## App-Owned State Machine

Future Bazar Baz-side states:

| State | Meaning | Spend hold rule | User-visible boundary |
| --- | --- | --- | --- |
| `DRAFT` | Request intent exists but is not quoted or submittable. | none | Hidden or draft-only. |
| `QUOTED` | Request has a current quote and policy snapshot. | create if user accepts quote; otherwise none | Quote summary only. |
| `HOLD_PENDING` | Future Baz hold is being created or verified. | create or keep | Request not submitted to Render yet. |
| `READY_TO_SUBMIT` | Tenant, quote, hold, and capability gates pass. | keep | Ready but no provider success yet. |
| `SUBMITTED_TO_RENDER` | Server submitted the request and awaits provider acceptance. | keep | Pending. |
| `QUEUED` | Provider accepted or queued, including waiting for GPU, GPU offline, GPU busy, or unknown safe pending. | keep | Pending queue state. |
| `CLAIMED` | A worker claimed the job. | keep | Processing started. |
| `PROCESSING` | Worker is generating or preparing result. | keep | Processing. |
| `RESULT_READY` | Provider reports a result, but Bazar Baz has not imported it. | keep; do not settle | Not final success. |
| `IMPORT_PENDING` | Bazar Baz server is validating and importing the result. | keep; do not settle | Importing. |
| `IMPORTED` | Bazar Baz accepted the result into application storage and created the tenant asset. | settle | User-visible success. |
| `FAILED_RETRYABLE` | Temporary failure eligible for bounded retry. | keep if retry remains; release if retry budget is exhausted into final failure | Safe failure/retry state. |
| `FAILED_FINAL` | Final failure. | release/refund | Terminal failure. |
| `CANCELLED` | User/system cancelled before accepted import. | release/refund | Terminal cancelled. |
| `EXPIRED` | Quote, job, or result retention window expired. | release/refund | Terminal expired. |
| `REFUNDED` | Future financial compensation completed after terminal failure/cancel/expiry. | release/refund already completed | Terminal financial closure. |

State rules:

- Render status is mirrored and normalized but never trusted as the sole source of tenant authorization, spend settlement, or asset success.
- `QUEUED_GPU_OFFLINE` and `QUEUED_GPU_BUSY` remain `QUEUED`; they are capacity states, not failures.
- `UNKNOWN` fails closed into `QUEUED` for monitoring until bounded sync resolves it or a local timeout policy expires it.
- `RESULT_READY` is not user-visible success. The result must pass Bazar Baz validation and import.
- `IMPORTED` is the first user-visible success boundary and the only state that allows future spend settlement.
- Final failure, cancellation, and expiry release or refund any active hold.
- Repeated status sync and import calls must be idempotent.
- The same mirror must not create multiple provider jobs, storage objects, assets, or ledger settlement events for the same logical output.

## Visibility Rules

Normal users:

- May see only jobs in their own organization or jobs they personally requested.
- Must not see cross-user jobs/images/files outside authorized organization scope.
- Must not receive raw provider result URLs, storage keys, Render credentials, worker routing metadata, or internal wallet diagnostics.

SUPER_ADMIN:

- May later monitor all jobs/images/files/network state through a dedicated Super Admin console.
- This phase implements no UI or route. It only defines the future visibility marker.
- Diagnostics must still redact secrets and raw credentials.

Worker operators:

- Must not see tenant prompts, uploaded images, generated files, customer data, storage keys, or private provider URLs.
- May later see anonymized contribution status and routing facts through worker-owned scope only.

## Safety Boundaries For Future Implementation

- Browser never calls Render directly.
- Render credentials are never `NEXT_PUBLIC`.
- Provider job id never bypasses Bazar Baz ownership lookup.
- Result URL is never accepted from the browser as an import authority.
- The Bazar Baz server is the only actor allowed to import provider results into permanent application storage.
- Render and GPU worker must never receive Production Blob credentials.
- Codex and local test tools must never directly manage Production Blob.
- No wallet/ledger mutation may be derived solely from provider status.
- No DB schema or migration is included in this phase.

## Future Implementation Order

1. Keep source-only mirror helpers and validators green.
2. Complete deployed Render contract pinning/read-only compatibility when authorized.
3. Add Prisma schema/migration for the mirror entities only after Preview/Render gates are ready and migration authorization is explicit.
4. Implement app-owned request and mirror services behind existing tenant guards.
5. Implement future Baz quote/hold/settle/release integration as a separate wallet-ledger phase.
6. Implement Super Admin monitoring and worker portal as separate UI phases.
