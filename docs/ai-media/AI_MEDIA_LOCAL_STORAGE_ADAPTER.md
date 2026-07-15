# AI Media Local Storage Adapter

Date: 2026-07-15

The local storage adapter supports hermetic acceptance only.

## Configuration

Use:

```txt
AI_MEDIA_APPLICATION_STORAGE_ADAPTER=local-test
AI_MEDIA_LOCAL_STORAGE_ROOT=.tmp/ai-media-acceptance/storage
NODE_ENV=test
```

The default temporary root is `.tmp/ai-media-acceptance/storage`. Generated objects are ignored by Git and must not be committed.

## Guarantees

The adapter:

- refuses `NODE_ENV=production`;
- refuses `VERCEL_ENV=production`;
- refuses absolute keys and `..` traversal;
- writes only under the configured temporary root;
- uses generated tenant-aware names;
- validates MIME type, image signature, size, and checksum through the shared gateway;
- performs deterministic delete for compensation and cleanup;
- does not use Vercel Blob credentials.

Hermetic tests used this temporary local storage adapter. No Production Blob store was used as a Preview or test store.
