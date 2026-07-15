# AI Media Application Storage Boundary

Date: 2026-07-15

BB-AI-MEDIA-P04A-P06A establishes one application-owned storage gateway for Creative Studio and AI-media asset imports.

## Boundary

Feature code must call `lib/storage/application-storage.ts` for generated Creative Studio assets. The gateway exposes narrow operations:

- `storeCreativeStudioAsset`
- `storeCreativeStudioAssetFromRemote`
- `removeCreativeStudioAsset`
- `verifyStoredAsset`
- `compensateFailedAssetImport`

Routes, providers, browser code, Render, GPU workers, and test harnesses must not call Vercel Blob directly for AI-media assets.

## Production

Production storage is application-managed. The deployed Bazar Baz server may use `lib/storage/vercel-blob-storage.ts`, which is the only allowed `@vercel/blob` import for this boundary. Credentials are runtime-provided server secrets and are never passed to the browser, Render, the GPU worker, Codex, or local acceptance scripts.

Codex had no direct Production Blob access during this phase. No Production Blob credential was needed, retrieved, printed, or used. No Production Blob object was listed, uploaded, or deleted.

## Safety Controls

The gateway:

- is server-only;
- generates tenant-scoped object keys;
- rejects caller-provided arbitrary storage paths;
- enforces a MIME allowlist;
- validates image signatures before storage;
- enforces a maximum byte size;
- records checksum and safe metadata;
- supports compensation when database finalization fails;
- refuses the local adapter in production.

Provider result URLs are temporary inputs only. They are not persisted as permanent Creative Studio asset URLs after import.
