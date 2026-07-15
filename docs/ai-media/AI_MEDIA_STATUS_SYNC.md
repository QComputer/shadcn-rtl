# AI Media Status Sync

Date: 2026-07-15

Status synchronization is server-side only.

## Current Product-Image Flow

- Local job is created in `QUEUED` before provider submission.
- Provider response updates the local job with provider job ID, provider status, outputs, correlation ID, and idempotency metadata.
- Status polling uses the canonical AI-media service client.
- Provider output URLs are validated by the client and then treated as temporary result references.
- Permanent asset URLs come only from the application storage gateway.

The browser must not call Render directly and must not supply arbitrary result URLs for ingestion.
