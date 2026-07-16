# Bazar Baz AI Media Preview Isolation

## Purpose

This document defines the source-level Preview isolation requirements for the Bazar Baz AI Media Network integration in `shadcn-rtl`.

Preview environments must not accidentally mutate Production state while validating AI media flows.

## Environment Boundaries

### Database

- Preview must use a separate database from Production.
- `DATABASE_URL` and `DIRECT_URL` in Preview must not point to the Production database.
- Preview must not run production migrations.
- Preview must not write to Production data.

### Blob / Storage

- Preview Blob/storage must be separate from Production Blob/storage.
- `BLOB_READ_WRITE_TOKEN` in Preview must not grant access to Production containers.
- Preview must not import or mutate Production assets.
- Application storage import must target Preview-safe storage only.

### AI Media Service

- Preview AI media service identity must differ from Production AI media service identity.
- Preview must not use Production `AI_MEDIA_SERVICE_URL`.
- Preview must not use Production `AI_MEDIA_SERVICE_INTERNAL_KEY`.
- Preview Render writes must not affect Production Render jobs.
- Production Render writes must not be tested from Preview.

### Server / Render Credentials

- Browser must never call Render directly.
- Render credentials are server-only.
- No `NEXT_PUBLIC_*` Render secrets.
- All AI media calls go through Bazar Baz server-side routes.

## Flow Gates

AI write flows remain disabled until Preview isolation is proven.

Real generation remains blocked.

Baz wallet/ledger is not implemented in this phase.

Normal users cannot see cross-user jobs, images, or files.

SUPER_ADMIN-only full network monitoring comes later.

## Source-Level Guards

Source-level validation exists in:

- `lib/ai-media/env-isolation.ts`
- `scripts/quality/validate-ai-media-preview-isolation.mts`

These guards help detect accidental Preview/Production identity mixing before deployment.

Read-only human/operator evidence verification exists in:

- `lib/ai-media/preview-env-verification.ts`
- `scripts/quality/validate-ai-media-preview-env-verification.mts`
- `docs/ai-media/AI_MEDIA_PREVIEW_ENV_VERIFICATION_READONLY.md`

This newer gate compares redacted Preview and Production fingerprints side by side. It does not prove real Vercel state unless an operator supplies evidence or grants a separate read-only inspection path.

## Deployment Safety

- Do not change Vercel environment variables without explicit authorization.
- Do not deploy real generation without explicit authorization.
- Do not expose Render secrets to client/browser code.
- Do not add `NEXT_PUBLIC_*` Render secrets.
