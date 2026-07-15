# AI Media Preview Resource Plan

Date: 2026-07-15

Phase: BB-AI-MEDIA-P04-P06-ISOLATION-RECOVERY

Status: planned; blocked before resource creation by Neon management authorization.

## Purpose

The Preview AI-media MOCK lifecycle may run only after Vercel Preview has resource identities that cannot write to Production persistence or Production provider state.

This plan defines the required boundary before any Preview lifecycle write is allowed.

## Database Boundary

Required Preview database variables:

| Variable | Required Preview value |
| --- | --- |
| `DATABASE_URL` | Pooled URL for the isolated Neon Preview child branch. |
| `DIRECT_URL` | Direct URL for the same isolated Preview child branch. |
| `DATABASE_URL_UNPOOLED` | Direct/unpooled URL for the same Preview branch while legacy compatibility still requires it. |

Branch requirements:

- Branch name: `bazar-baz-preview-ai-media`
- Parent: confirmed Production Neon branch.
- Type: full-data child branch, not read replica.
- Default branch: no.
- Production traffic: no.
- Vercel Production linkage: no.
- Compute: minimal autosuspending endpoint only.
- Migration policy: inspect with `prisma migrate status` against Preview only; do not migrate Production.

Preview branch creation was not executed in this checkpoint because both configured Neon API keys returned `403` for management project discovery, and no `NEON_PROJECT_ID` was available for a narrower safe API path.

## Storage Boundary

Required Preview storage:

- Dedicated Preview Vercel Blob store/token.
- Preview-only `BLOB_READ_WRITE_TOKEN`.
- No Production Blob token in Preview runtime.
- Test object prefix in addition to separate storage, for example `preview/ai-media/<deployment-or-run-id>/...`.
- Upload/list/delete cleanup path must be verified before lifecycle writes.

A prefix in the Production Blob store is not sufficient isolation.

No Blob write was attempted in this checkpoint.

## AI Media Boundary

Preferred service identity order:

1. Existing Render Preview/staging service with a Preview credential.
2. Existing Render service with a distinct Bazar Baz Preview application key and proven client-scoped job ownership.
3. Same MOCK control plane only if the service contract proves jobs/results/cancel/idempotency are isolated by authenticated client identity.
4. Coordinated ai-media-service work before Bazar Baz lifecycle writes.

Required proof before writes:

- Preview credential is distinct from Production.
- Job listing/retrieval is scoped by authenticated client identity.
- Idempotency scope includes client identity.
- Result retrieval is client-scoped.
- Cancellation is client-scoped.
- Worker credentials are separate from application credentials.
- Active provider is verifiably `MOCK`.

Current observed Bazar Baz source uses a single server-only `X-BazarBaz-AI-Key` integration header. The live OpenAPI summary does not declare security schemes or client-identity isolation semantics. Therefore a different key must not be assumed to provide isolation without Render-side proof.

## Vercel Preview Boundary

Preview-scoped variables only:

- Isolated Preview database URLs.
- Isolated Preview Blob token.
- Preview AI-media application credential.
- AI-media enabled only when active provider is proven `MOCK`.
- Real generation flags remain false.
- SMS, email, Web Push, payments, tenant provisioning execution, and domain provider mutation remain disabled or dry-run for test fixtures.

Production environment variables must not be modified during Preview recovery.

## Stop Conditions Applied

This checkpoint reached stop condition 3:

> Neon management credentials are unavailable.

The available configured Neon keys were present but not authorized for the metadata needed to safely create or reuse the Preview child branch.

## Manual Safe Next Step

In Neon Console or with an authorized Neon API key:

1. Confirm the Production project and default/production branch.
2. Create a child branch named `bazar-baz-preview-ai-media`.
3. Add one minimal autosuspending compute endpoint.
4. Copy the pooled and direct connection strings without sharing them in chat, docs, logs, or commits.
5. Provide either `NEON_PROJECT_ID` plus an authorized management API key, or confirm that the Preview branch already exists and provide the three Preview database URLs for Vercel Preview-scoped setup.

After that, resume from Phase 3 database verification and continue to storage and AI-media identity isolation.
