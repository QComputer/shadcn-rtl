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

The local MOCK implements idempotent create responses so local lifecycle tests can verify one provider job for repeated keys. Deeper concurrent duplicate coverage remains a continuing hardening target for BB-AI-MEDIA-P07/P08.
