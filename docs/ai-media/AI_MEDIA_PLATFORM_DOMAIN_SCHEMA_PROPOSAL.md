# AI Media Platform Domain Schema Proposal

Date: 2026-07-16
Phase: BAZAR-BAZ-AI-NETWORK-PREVIEW-MOCK-WRITE-FOUNDATION-01
Status: Source schema and migration added for the Preview MOCK write foundation.

Prisma schema and migration source now exist for the app-owned AI media mirror. The migration has not been applied to Production by this phase. Production writes, Production migrations, Blob writes, real generation, wallet settlement, worker portal, and Super Admin console remain disabled.

## Ownership

Bazar Baz owns wallet planning, imported media, tenant request ownership, audit visibility, and future Super Admin monitoring. The ai-media-service emits contribution facts only and owns Render coordination, queueing, worker heartbeat, worker claim/lease/result, model recommendation, and routing facts. Render and ai-media-service are not sources of wallet truth or user-visible asset success.

Worker operators cannot see cross-user media, prompts, source images, generated files, or tenant customer data. Normal users cannot see cross-user jobs/images/files outside their authorized organization scope. SUPER_ADMIN full monitoring is a later console capability and must still redact credentials.

Baz is internal Bazar Baz credit only. It is not crypto, tradable, withdrawable, or payout logic.

## Proposed Entities

### AiMediaRequest

Fields:
- `id`
- `organizationId`
- `requestedByUserId`
- `targetType`
- `targetId`
- `locale`
- `privacyLevel`
- `idempotencyKey`
- `payloadHash`
- `promptFingerprint`
- `sourceAssetFingerprints`
- `createdAt`
- `updatedAt`

Indexes and uniqueness:
- unique `(organizationId, idempotencyKey)`
- index `(organizationId, requestedByUserId, createdAt)`
- index `(targetType, targetId)`

Scope and visibility:
- organization and requester scoped
- normal users see own/org requests only
- prompt text should be encrypted/redacted or stored separately if persisted

Audit and idempotency:
- creation emits `AiMediaJobEvent`
- same key and same hash returns existing request
- same key and different hash conflicts

Migration risks:
- prompt privacy and input file references must be modeled before any production write
- do not backfill from provider URLs as permanent assets

### AiMediaJobMirror

Fields:
- `id`
- `requestId`
- `organizationId`
- `requestedByUserId`
- `state`
- `provider`
- `providerJobId`
- `providerStatus`
- `contractFingerprint`
- `correlationId`
- `idempotencyKey`
- `payloadHash`
- `retryCount`
- `lastSyncedAt`
- `createdAt`
- `updatedAt`

Indexes and uniqueness:
- unique `(organizationId, idempotencyKey)`
- unique nullable `(provider, providerJobId)`
- index `(organizationId, state, updatedAt)`
- index `(requestedByUserId, createdAt)`

Scope and visibility:
- organization/requester scoped
- provider job id never authorizes access
- SUPER_ADMIN monitoring later can see safe diagnostics

Audit:
- all state transitions emit `AiMediaJobEvent`
- provider error bodies are categorized/redacted

Migration risks:
- state enum rollout must align with `lib/ai-media/job-mirror.ts`
- deployed Render contract must be pinned before write activation

### AiMediaJobEvent

Fields:
- `id`
- `organizationId`
- `requestId`
- `mirrorId`
- `actorUserId`
- `action`
- `fromState`
- `toState`
- `dedupeKey`
- `safeMetadata`
- `createdAt`

Indexes and uniqueness:
- unique `(organizationId, dedupeKey)`
- index `(mirrorId, createdAt)`
- index `(organizationId, action, createdAt)`

Scope and visibility:
- normal user event views are redacted
- worker operators receive no prompts/images/files

Audit:
- append-only
- safe metadata only

Migration risks:
- avoid storing raw secrets, raw provider body, raw prompt, or signed URLs

### AiMediaAsset

Fields:
- `id`
- `organizationId`
- `requestId`
- `mirrorId`
- `importId`
- `requestedByUserId`
- `storageProvider`
- `storageKey`
- `storageKeyFingerprint`
- `mimeType`
- `byteSize`
- `width`
- `height`
- `checksumSha256`
- `visibilityScope`
- `createdAt`
- `deletedAt`

Indexes and uniqueness:
- unique `(organizationId, mirrorId, importId)`
- index `(organizationId, requestedByUserId, createdAt)`
- index `(organizationId, deletedAt)`

Scope and visibility:
- tenant scoped
- imported asset is the user-visible success boundary
- raw provider result URL is historical only and should not become permanent asset URL

Audit:
- creation, rollback, deletion, and replacement emit events

Migration risks:
- storage gateway must remain server-only
- no direct Production Blob access by Render, browser, tests, or Codex

### AiMediaImport

Fields:
- `id`
- `organizationId`
- `requestId`
- `mirrorId`
- `status`
- `outputIndex`
- `resultFingerprint`
- `risk`
- `validationSummary`
- `acceptedAssetId`
- `compensationStatus`
- `createdAt`
- `updatedAt`

Indexes and uniqueness:
- unique `(organizationId, mirrorId, outputIndex)`
- index `(organizationId, status, updatedAt)`

Scope and visibility:
- normal users see own/org safe import status only
- raw output remains hidden on failed import

Audit:
- validation, import acceptance, compensation, and orphan cleanup must be evented

Migration risks:
- import retry must be idempotent and must not create duplicate storage objects

### AiMediaUsageQuote

Fields:
- `id`
- `organizationId`
- `requestId`
- `requestedByUserId`
- `bazAmount`
- `currency`
- `policyKey`
- `idempotencyKey`
- `expiresAt`
- `createdAt`

Indexes and uniqueness:
- unique `(organizationId, idempotencyKey)`
- index `(organizationId, requestId)`
- index `(expiresAt)`

Scope and visibility:
- organization/requester scoped
- normal users see own/org quote summaries

Audit:
- quote create, refresh, expiry, and rejection are evented

Migration risks:
- quote is not ledger truth
- currency must remain `BAZ_INTERNAL_CREDIT`

### AiMediaSpendHold

Fields:
- `id`
- `organizationId`
- `requestId`
- `quoteId`
- `state`
- `bazAmount`
- `currency`
- `ledgerReferenceId`
- `idempotencyKey`
- `createdAt`
- `updatedAt`

Indexes and uniqueness:
- unique `(organizationId, idempotencyKey)`
- unique nullable `(ledgerReferenceId)`
- index `(organizationId, state, updatedAt)`

Scope and visibility:
- organization/requester financial scope
- worker operators see no wallet data

Audit:
- hold creation, keep, settlement, release/refund, and reconciliation are evented

Migration risks:
- no balance mutation until separate Baz ledger phase
- hold settles only after accepted import
- final failure/cancel/expiry releases or refunds

### WorkerContributionMirror

Fields:
- `id`
- `organizationId`
- `mirrorId`
- `providerContributionId`
- `workerOpaqueId`
- `jobState`
- `importedAssetAccepted`
- `rewardPolicyKey`
- `rewardEligible`
- `safeFacts`
- `createdAt`
- `updatedAt`

Indexes and uniqueness:
- unique `(providerContributionId)`
- index `(workerOpaqueId, createdAt)`
- index `(mirrorId)`

Scope and visibility:
- contribution facts only
- worker operator views are worker-safe and never include prompts/source images/generated results from other users
- SUPER_ADMIN monitoring later can inspect safe facts

Audit:
- imported fact, eligibility decision, blocker codes, and policy key are evented

Migration risks:
- do not copy raw ai-media-service payloads blindly
- reward cannot settle at claim time
- reward can become pending only after accepted/imported result

## Rollout Plan

1. Keep source-only platform domain helpers green.
2. Pin deployed Render read-only contract compatibility.
3. Apply the new Prisma migration only to an isolated Preview database after explicit authorization.
4. Enable the Preview MOCK write guard only with explicit Preview flags and verified pinned Render evidence.
5. Run one app-owned Preview MOCK request/mirror flow through Bazar Baz routes.
6. Add application-managed import execution after storage isolation is verified.
7. Add Baz ledger/hold mutation only in a separate approved wallet phase.
8. Add Super Admin and worker portal UI only after authorization and privacy review.
