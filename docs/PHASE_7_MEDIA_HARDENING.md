# Phase 7 — Uploads, Images, and QR Production Hardening

## Scope

Phase 7 hardens the media surface used by dashboard product, organization, and QR flows.

The phase focuses on:

- authenticated image uploads,
- validated image content and file size limits,
- consistent upload storage paths,
- image ownership metadata,
- authenticated image deletion,
- QR code save authorization,
- public QR generation compatibility,
- public image serving hardening,
- deployed smoke tests without Playwright.

## Data model updates

`Image` now tracks media metadata and ownership:

- `filename`
- `mimeType`
- `sizeBytes`
- `purpose`
- `uploadedByUserId`
- `organizationId`

Migration:

```bash
npx prisma migrate deploy
```

Migration file:

```text
prisma/migrations/20260521000000_phase7_media_hardening/migration.sql
```

## API behavior

### `POST /api/upload`

Requires authentication and one of:

- `SUPER_ADMIN`
- `ADMIN`
- `MANAGER`
- `STAFF`

Accepts only:

- JPEG
- PNG
- WebP
- GIF

Limits file size to 5 MB and validates the file signature before writing it.

Optional form fields:

- `purpose`
- `organizationId`
- `organizationSlug`

Non-super-admin users can only upload for an organization they can access.

### `GET /api/images`

Requires authentication. Super admins can see recent images globally. Other dashboard roles see their own uploads and current organization images.

### `DELETE /api/images/[id]`

Requires authentication and image ownership/organization access.

### `GET /api/qrcode?url=...`

Remains public and returns a PNG QR code. This is intentionally public because it does not persist data.

### `POST /api/qrcode`

Requires authentication and persists the generated QR code as an owned image record.

### `GET /uploads/[filename]`

Serves stored images via redirect to Vercel Blob URLs for PRIVATE images. PUBLIC images are served directly via their blob URLs (stored in the `url` field). Path traversal attempts are rejected.

## Storage

All media operations use `lib/blob-storage.ts` with **Vercel Blob Storage only** (no local fallback).

**Required Environment Variable:**
- `BLOB_READ_WRITE_TOKEN` - Your Vercel Blob storage token (required in all environments)

Get your token from: https://vercel.com/dashboard/blob

## Deployed no-Playwright smoke test

PowerShell:

```powershell
$env:DEPLOYED_URL="https://bazar-baz.ir"; npm run e2e:deployed:phase7
```

Linux/macOS/Git Bash:

```bash
DEPLOYED_URL=https://bazar-baz.ir npm run e2e:deployed:phase7
```

The test verifies:

- homepage reachability,
- unauthenticated upload is blocked,
- unauthenticated image list is blocked,
- unauthenticated image delete is blocked,
- public QR GET still returns PNG,
- unauthenticated QR save is blocked,
- filename traversal is not served from `/uploads`.

## Production recommendations (completed)

- [x] Move persistent images to Vercel Blob Storage
- [ ] Add virus/malware scanning for user uploads
- [ ] Add per-user and per-organization upload quotas
- [ ] Add image optimization/resizing pipeline
- [ ] Add old/orphaned media cleanup job
- [ ] Add signed private URLs if sensitive documents are uploaded later
