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

Serves stored images from the shared upload directory using the same path logic as upload/delete. It rejects unsafe filenames and returns cache headers plus `X-Content-Type-Options: nosniff`.

## Storage path

All media operations use `lib/media-storage.ts`.

Current storage root:

```text
../uploads relative to process.cwd()
```

This keeps compatibility with the existing deployment layout. For larger production usage, move this behind durable object storage or a mounted persistent volume.

## Deployed no-Playwright smoke test

PowerShell:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase7
```

Linux/macOS/Git Bash:

```bash
DEPLOYED_URL=https://zc0.runflare.run npm run e2e:deployed:phase7
```

The test verifies:

- homepage reachability,
- unauthenticated upload is blocked,
- unauthenticated image list is blocked,
- unauthenticated image delete is blocked,
- public QR GET still returns PNG,
- unauthenticated QR save is blocked,
- filename traversal is not served from `/uploads`.

## Remaining production recommendations

- Move persistent images to object storage or a durable volume.
- Add virus/malware scanning for user uploads.
- Add per-user and per-organization upload quotas.
- Add image optimization/resizing pipeline.
- Add old/orphaned media cleanup job.
- Add signed private URLs if sensitive documents are uploaded later.
