# AI Media Contract MOCK

Date: 2026-07-15

The local MOCK service lives at `scripts/ai-media/local-contract-mock.mjs`.

## Scope

It implements the confirmed product-image contract:

- `GET /health`
- `GET /ready`
- `GET /openapi.json`
- `POST /v1/product-image-suggestions/jobs`
- `GET /v1/product-image-suggestions/jobs/{job_id}`
- `POST /v1/product-image-suggestions/jobs/{job_id}/cancel`
- `GET /fixtures/result.png`

The MOCK accepts the same server-only `X-BazarBaz-AI-Key` header and honors idempotency keys. It returns deterministic valid PNG bytes and never calls CUDA, Hugging Face, paid providers, or live Render.

Live Render remains read-only for health/readiness/contract checks in this phase.
