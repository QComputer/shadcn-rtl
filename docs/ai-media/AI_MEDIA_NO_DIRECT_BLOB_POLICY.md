# AI Media No Direct Blob Policy

Date: 2026-07-15

AI-media and Creative Studio generated-asset code must not directly manage Production Blob storage.

## Allowed

- `lib/storage/vercel-blob-storage.ts` may import `@vercel/blob`.
- `lib/storage/application-storage.ts` may select the production adapter on the deployed server.
- Existing non-AI upload behavior may continue through its legacy compatibility wrapper when it delegates to the canonical adapter.

## Not Allowed

- Browser code receiving Blob credentials.
- Render service receiving Blob credentials.
- GPU worker receiving Blob credentials.
- Codex or local test harness listing, uploading, or deleting Production Blob objects.
- AI-media route handlers calling `put()` or `del()` directly.
- Provider clients storing permanent assets.
- Persisting Render result URLs as permanent asset URLs.

## Validation

`pnpm run quality:ai-media-application-storage-boundary` confirms that only the canonical production adapter imports `@vercel/blob`, AI-media feature code uses the gateway, client surfaces do not import storage code, and the local adapter cannot activate in production.
