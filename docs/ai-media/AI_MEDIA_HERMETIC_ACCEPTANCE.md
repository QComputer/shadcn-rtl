# AI Media Hermetic Acceptance

Date: 2026-07-15

BB-AI-MEDIA-P04A-P06A accepts local product-image lifecycle coverage without requiring `NEON_PROJECT_ID`, a separate Preview Blob store, or direct Production Blob access.

## Local Stack

- Disposable local PostgreSQL on `127.0.0.1`.
- Contract-faithful local MOCK provider on `127.0.0.1`.
- Local test storage adapter under `.tmp/ai-media-acceptance/storage`.
- Synthetic users, organizations, products, jobs, and assets only.

## Command

```powershell
pnpm run test:ai-media:hermetic
```

The command runs safety guards, source validators, the local MOCK lifecycle, local storage import, asset finalization, and cleanup.

It also runs the concurrent idempotency matrix:

- 10 simultaneous same-tenant same-key same-payload submissions converge to one local job and one provider job.
- Same tenant/key with a different payload returns a safe conflict.
- A different organization may reuse the same key without cross-tenant collision.
- Provider accepted but client response lost is recovered without duplicate provider work.
- Concurrent result ingestion creates one durable local storage object and one selection event.

## Explicit Non-Events

- No Production database was used.
- No Production Blob object was listed, uploaded, or deleted.
- No real Render job was created.
- No GPU inference ran.
- No SMS, email, Web Push, payment, tenant provisioning, or domain-provider mutation was executed.

Deployed Preview acceptance remains deferred until isolated Preview persistence and storage are available.
