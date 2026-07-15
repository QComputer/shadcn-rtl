# AI Media Client Architecture

Date: 2026-07-15

The canonical Render integration boundary is `lib/services/ai-media-service-client.ts`.

Rules:

- server-only module;
- no client component import;
- no middleware/proxy import;
- service URL comes only from server env;
- HTTPS is required outside localhost test mode;
- `X-BazarBaz-AI-Key` is attached only server-side;
- `Idempotency-Key` and `X-BazarBaz-Correlation-Id` are attached for product-image creation;
- requests use `AbortController` timeouts;
- GET status checks may use one bounded retry for 429/5xx;
- unsafe POST creation/cancel requests are not retried automatically;
- provider errors are redacted before surfacing to application routes;
- no request-controlled provider, model, endpoint, or auth header is accepted.

Confirmed methods:

- `checkAiMediaServiceReadiness()`
- `getAiMediaServiceContractSummary()`
- `createAiMediaJob()` for `/v1/product-image-suggestions/jobs`
- `getAiMediaJob()` for `/v1/product-image-suggestions/jobs/{job_id}`
- `cancelAiMediaJob()` for `/v1/product-image-suggestions/jobs/{job_id}/cancel`

Organization-brand methods fail closed with `CAPABILITY_UNAVAILABLE` because the live OpenAPI contract does not expose the historical organization-brand endpoints.
