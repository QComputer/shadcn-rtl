# AI Media Idempotency Policy

Date: 2026-07-15

AI-media product-image requests carry tenant-scoped idempotency metadata before provider submission.

## Rules

- Idempotency belongs to the local Bazar Baz job first, not to a browser-provided provider job ID.
- The same organization, payload, and idempotency key must resolve to one logical provider job.
- A different organization may reuse the same string without cross-tenant collision.
- Payload mismatch for the same tenant/key must be treated as a conflict.
- Duplicate result ingestion must not create duplicate permanent assets.
- Duplicate database finalization must not create duplicate audit transitions.
- PostgreSQL advisory locks serialize same-tenant product-image creation and result selection.
- The provider idempotency key is tenant-scoped before it leaves Bazar Baz, so two organizations may reuse the same caller key without provider-level collision.
- A local payload hash detects same-tenant key reuse with a different request body and returns a conflict.
- Failed local submissions with a retryable provider outcome may be retried through the same local logical job. If the provider accepted the first request but the response was lost, retry reconciles through provider idempotency.

The local MOCK implements idempotent create responses and a fail-after-accept-once control so local lifecycle tests can verify one provider job for repeated keys and recovery from a lost create response.
