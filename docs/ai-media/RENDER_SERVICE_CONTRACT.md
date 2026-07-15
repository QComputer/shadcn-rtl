# Render AI Media Service Contract

Date: 2026-07-15

## Status

This document records the observed contract-discovery state for `BB-AI-MEDIA-ONLINE-MILESTONE-01`.

The Bazar Baz production server can reach the configured Render AI Media Service through the existing server-only readiness check. The local Codex workspace cannot connect directly to the configured Render hostname: DNS resolves to a private `10.x` address and TCP 443 fails from the workspace. Because of that network boundary, `/openapi.json` could not be inspected directly from the workspace without adding a server-side contract probe.

No generation request was sent during discovery.

The live OpenAPI contract was inspected from a Vercel Preview deployment through the SUPER_ADMIN-only Bazar Baz contract probe at `/api/dashboard/ai-media/contract`.

## Secure Configuration

The configured service URL and credential are present as server-side environment variables. Values were not printed.

Observed Vercel scopes:

| Variable | Scope | Type |
| --- | --- | --- |
| `AI_MEDIA_SERVICE_ENABLED` | Preview, Production | sensitive |
| `AI_MEDIA_SERVICE_URL` | Preview, Production | sensitive |
| `AI_MEDIA_SERVICE_INTERNAL_KEY` | Preview, Production | sensitive |
| `AI_MEDIA_SERVICE_TIMEOUT_MS` | Preview, Production | sensitive |

The browser must call only Bazar Baz dashboard routes. It must not call Render directly.

## Health And Readiness

Observed through authenticated Bazar Baz production smoke:

| Check | Result |
| --- | --- |
| Bazar Baz `/api/dashboard/ai-media/status?check=1` | passed |
| Render health via Bazar Baz server | passed |
| Render readiness via Bazar Baz server | passed |
| Paid generation enabled | false |
| Credentials exposed | no |

Direct workspace checks against `/health`, `/ready`, `/openapi.json`, and `/docs` failed because the configured hostname resolved to a private `10.x` address from the workspace.

## Confirmed OpenAPI Metadata

| Field | Observed value |
| --- | --- |
| Title | Bazar Baz AI Media Service |
| Version | 0.1.0 |
| OpenAPI | 3.1.0 |
| OpenAPI security schemes | none declared in the OpenAPI document |
| Credential behavior | Existing service accepts the server-only `X-BazarBaz-AI-Key` integration header; this is not declared as an OpenAPI security scheme |

Confirmed schemas:

```txt
AspectRatio
AuditLogCreate
BrandInput
CampaignPackCreate
ClaimJobRequest
ClaimJobResponse
CompleteRequest
ConsentCreate
CreateJobResponse
DatasetCreate
FailRequest
GeneratedImage
HTTPValidationError
HeartbeatRequest
JobStatus
JobStatusResponse
ModelArtifactCreate
ProductImageSuggestionRequest
StylePreset
SubjectCreate
TrainingJobCreate
ValidationError
VideoJobCreate
VoiceProfileCreate
WorkerStatusUpdate
```

Confirmed product-image lifecycle endpoints:

| Capability | Method | Path | Request schema | Response schema |
| --- | --- | --- | --- | --- |
| Product-image job create | `POST` | `/v1/product-image-suggestions/jobs` | `ProductImageSuggestionRequest` | `CreateJobResponse` / `HTTPValidationError` |
| Product-image job status | `GET` | `/v1/product-image-suggestions/jobs/{job_id}` | none | `JobStatusResponse` / `HTTPValidationError` |
| Product-image job cancel | `POST` | `/v1/product-image-suggestions/jobs/{job_id}/cancel` | none | `JobStatusResponse` / `HTTPValidationError` |

Other confirmed API groups:

| Group | Confirmed paths |
| --- | --- |
| Health/readiness | `/health`, `/ready` |
| Creative assets/campaigns/datasets/model artifacts/subjects | `/v1/creative/assets/{asset_id}/approve`, `/v1/creative/assets/{asset_id}/reject`, `/v1/creative/audit-logs`, `/v1/creative/campaign-packs`, `/v1/creative/campaign-packs/{pack_id}`, `/v1/creative/campaign-packs/{pack_id}/generate`, `/v1/creative/datasets/{dataset_id}`, `/v1/creative/datasets/{dataset_id}/assets`, `/v1/creative/model-artifacts`, `/v1/creative/model-artifacts/{artifact_id}`, `/v1/creative/subjects`, `/v1/creative/subjects/{subject_id}`, `/v1/creative/subjects/{subject_id}/consents`, `/v1/creative/subjects/{subject_id}/datasets`, `/v1/creative/subjects/{subject_id}/model-artifacts` |
| Training/video/voice | `/v1/creative/training-jobs`, `/v1/creative/training-jobs/{job_id}`, `/v1/creative/video-jobs`, `/v1/creative/video-jobs/{job_id}`, `/v1/creative/voice-profiles`, `/v1/creative/voice-profiles/{profile_id}` |
| Worker control-plane | `/v1/workers/register`, `/v1/workers/jobs/claim`, `/v1/workers/jobs/heartbeat`, `/v1/workers/jobs/{job_id}/running`, `/v1/workers/jobs/{job_id}/complete`, `/v1/workers/jobs/{job_id}/fail`, `/v1/workers/jobs/{job_id}/outputs`, `/v1/workers/training-jobs/claim`, `/v1/workers/training-jobs/{job_id}/complete`, `/v1/workers/training-jobs/{job_id}/fail` |

## Contract Mismatch Found

The historical Bazar Baz code previously contained disabled/gated organization-brand adapter calls for these legacy paths:

```txt
/v1/organization-brand/jobs
/v1/organization-brand/jobs/{jobId}
/v1/organization-brand/jobs/{jobId}/result
```

The live OpenAPI document does **not** expose those paths. Current Bazar Baz source fails closed for these methods with `CAPABILITY_UNAVAILABLE`; organization-brand provider execution must remain disabled and must not be treated as production-ready until Bazar Baz is adapted to the live `/v1/creative/...` contract or the service adds explicit organization-brand endpoints.

Product-image generation is the only currently confirmed endpoint family that matches the existing Bazar Baz Create/Poll/Cancel job lifecycle.

## Existing Documented Contract Versus Live Contract

The existing Bazar Baz source and documentation describe the following server-to-server contract. These entries are already implemented in the current Bazar Baz client; the table below distinguishes the portions confirmed by the live OpenAPI document from historical entries that no longer match.

| Capability | Method | Path | Notes |
| --- | --- | --- | --- |
| Health | `GET` | `/health` | Expected body includes `ok`. |
| Readiness | `GET` | `/ready` | Expected body includes `ready`. |
| OpenAPI | `GET` | `/openapi.json` | Added Bazar Baz contract probe summarizes this without returning raw body. |
| Product-image job create | `POST` | `/v1/product-image-suggestions/jobs` | Confirmed in OpenAPI. No explicit idempotency field/header was visible in the summarized OpenAPI metadata. |
| Product-image job status | `GET` | `/v1/product-image-suggestions/jobs/{jobId}` | Existing code supports `outputs` and `output_images`. |
| Product-image job cancel | `POST` | `/v1/product-image-suggestions/jobs/{jobId}/cancel` | Existing UI exposes cancel for queued/processing jobs. |
| Organization-brand job create | `POST` | `/v1/organization-brand/jobs` | Documented historically, but **not present** in live OpenAPI. |
| Organization-brand job status | `GET` | `/v1/organization-brand/jobs/{jobId}` | Documented historically, but **not present** in live OpenAPI. |
| Organization-brand result | `GET` | `/v1/organization-brand/jobs/{jobId}/result` | Documented historically, but **not present** in live OpenAPI. |

## Authentication

Existing integration uses the server-only header:

```txt
X-BazarBaz-AI-Key
```

The live OpenAPI document declares no `components.securitySchemes`. Bazar Baz must still attach the existing integration credential only server-side. The credential value must never be returned to the browser, logs, docs, or generated evidence.

## Active Provider

Current Bazar Baz smoke reports paid generation disabled. Historical project docs say the Render service is expected to run in explicit MOCK mode for safe lifecycle testing. The active provider value still needs to be confirmed from live OpenAPI/capability metadata or a safe authenticated status/capabilities endpoint if the service exposes one.

## Discovery Boundary

Because local direct access to the Render service is not available, future safe discovery should continue through Vercel-hosted Bazar Baz server routes:

1. Authenticate as SUPER_ADMIN.
2. Request `GET /api/dashboard/ai-media/contract`.
3. Record only the returned path/method/schema/security summary.
4. Do not create a generation job unless the service is explicitly confirmed to be MOCK and the operation has no real GPU or billing impact.

## Open Questions

- Idempotency header or request-field support.
- Retry-After semantics.
- Capability/provider metadata endpoint, if any.
- Whether organization-brand/logo/cover workflows should map to the confirmed creative endpoints or wait for explicit service endpoints.
- Whether webhooks exist; no webhook support is present in the observed OpenAPI paths and none should be assumed.
- Whether result URLs are temporary, signed, or stable.
- How Bazar Baz should map organization-brand/logo/cover workflows to the live `/v1/creative/...` endpoints.
