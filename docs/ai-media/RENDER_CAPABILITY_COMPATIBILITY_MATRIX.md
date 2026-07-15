# Render Capability Compatibility Matrix

Date: 2026-07-15

Source: protected Bazar Baz contract probe for the live Render OpenAPI contract.

Contract fingerprint: `ab70c8d0bb1d9ccd`

No credentials or raw OpenAPI body are included here.

| Bazar Baz capability | Classification | Live endpoint | Method | Request schema | Response schema | Auth | Idempotency | Terminal states | Result form | Cancellation | Retry | Safe Bazar Baz mapping |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Product image suggestion | CONFIRMED | `/v1/product-image-suggestions/jobs` | POST | `ProductImageSuggestionRequest` | `CreateJobResponse` | `X-BazarBaz-AI-Key` server header | Bazar Baz sends `Idempotency-Key`; OpenAPI does not declare provider semantics | `COMPLETED`, `FAILED`, `CANCELED` | job status plus `outputs[]` or `output_images[]` | CONFIRMED via `/v1/product-image-suggestions/jobs/{job_id}/cancel` | Local retry only; no unsafe POST retry | `AiMediaJob` plus `CreativeStudioJob` PRODUCT/PRODUCT_IMAGE |
| Product image generation | CONFIRMED | `/v1/product-image-suggestions/jobs` | POST | `ProductImageSuggestionRequest` | `CreateJobResponse` / `JobStatusResponse` | `X-BazarBaz-AI-Key` server header | Bazar Baz local idempotency key and correlation ID | `COMPLETED`, `FAILED`, `CANCELED` | validated image URL metadata, draft asset boundary | CONFIRMED | Local retry only after failure classification | Creative Studio product-image workflow |
| Organization logo | UNSUPPORTED | none proven | none | none | none | server-only if later added | none | none | no compatible result form | UNSUPPORTED | UNSUPPORTED | request/draft planning only; no Render call |
| Organization cover/banner | UNSUPPORTED | none proven | none | none | none | server-only if later added | none | none | no compatible result form | UNSUPPORTED | UNSUPPORTED | request/draft planning only; no Render call |
| General creative image | UNKNOWN | `/v1/creative/campaign-packs/{pack_id}/generate` and related `/v1/creative/...` paths | mixed | `CampaignPackCreate`, `SubjectCreate`, dataset/model/training schemas | not mapped to Bazar Baz image lifecycle | server-only if mapped | not declared | not mapped | not proven as single tenant image asset job | UNKNOWN | UNKNOWN | diagnostics only until adapter tests prove compatibility |
| Job status | CONFIRMED for product image | `/v1/product-image-suggestions/jobs/{job_id}` | GET | none | `JobStatusResponse` | `X-BazarBaz-AI-Key` server header | not needed | `COMPLETED`, `FAILED`, `CANCELED` | status and outputs | n/a | bounded retry for GET/429/5xx | local job sync |
| Cancellation | CONFIRMED for product image | `/v1/product-image-suggestions/jobs/{job_id}/cancel` | POST | none | `JobStatusResponse` | `X-BazarBaz-AI-Key` server header | no unsafe retry | `CANCELED` | job status | CONFIRMED | no automatic retry | local cancel route |
| Result retrieval | CONFIRMED through polling only for product image | `/v1/product-image-suggestions/jobs/{job_id}` | GET | none | `JobStatusResponse` | `X-BazarBaz-AI-Key` server header | not needed | `COMPLETED` | image URL metadata | n/a | bounded GET retry | draft asset creation after validation |
| Retry | UNKNOWN provider-side | none declared | n/a | n/a | n/a | n/a | local idempotency only | n/a | n/a | n/a | local retry after safe failure only | future route can reuse local request metadata |
| Webhook or polling support | POLLING CONFIRMED | `/v1/product-image-suggestions/jobs/{job_id}` | GET | none | `JobStatusResponse` | server-only | n/a | terminal-state recognition in Bazar Baz | status payload | n/a | bounded polling | no webhook assumed |

## `/v1/creative/...` Decision

The live contract exposes creative asset, campaign pack, subject, dataset, model artifact, training, video, voice, and worker-control paths. These route names are not enough to prove logo/cover compatibility.

Logo/cover remain `UNSUPPORTED` because no inspected operation is proven to accept all required Bazar Baz fields:

- organization logo or cover brief;
- required aspect ratio and size semantics;
- single image-asset result semantics;
- compatible create/status/cancel lifecycle;
- deterministic tenant-safe mapping;
- no unsupported organization data requirement.

The app must not redirect logo/cover requests to product-image endpoints.
