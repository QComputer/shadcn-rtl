# Phase 86 - AI Media Durable Storage Acceptance

Status: implemented.

P86 validates and hardens durable storage for selected AI-generated product images. It keeps the existing fallback behavior when Vercel Blob is not configured or the remote image copy fails.

## Implemented

- Remote AI image copy now normalizes `Content-Type` before choosing the stored extension.
- Remote AI image copy rejects oversized `Content-Length` headers before downloading.
- Remote AI image bytes are validated with the existing upload signature checks before Blob write.
- Selected image responses now include `storageStatus`:
  - `blob` when the selected image was copied to Vercel Blob.
  - `remote-unconfigured` when `BLOB_READ_WRITE_TOKEN` is missing.
  - `remote-fallback` when Blob is configured but the copy fails.
- Missing Blob configuration now logs an explicit server warning.
- Product edit UI already applies the API-returned selected image URL, so durable Blob URLs replace temporary Render URLs in the form state.
- Added `quality:ai-media-durable-storage` and wired it into `quality:local`.

## Guardrails

- `BLOB_READ_WRITE_TOKEN` is never exposed to the browser.
- Remote image fallback remains explicit through `storedDurably: false` and `storageStatus`.
- Product image cache revalidation still runs after the final selected URL is saved.

## Validation

```powershell
pnpm run quality:ai-media-durable-storage
pnpm run quality:ai-media-mock-flow
pnpm run quality:ai-media
pnpm run quality:local
pnpm run typecheck
pnpm run build
```
