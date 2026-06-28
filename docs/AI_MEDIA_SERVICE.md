# AI Media Service Integration (BZ-AI-01)

## Status

MOCK mode only. No real paid image generation is used in this phase.

## AI Media Service URL

```
https://bazar-baz-ai-media-service.onrender.com
```

Health checks:
- `GET /health` → `ok`
- `GET /ready` → `ready`

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AI_MEDIA_SERVICE_ENABLED` | Yes (server-only) | Set to `true` to enable the feature |
| `AI_MEDIA_SERVICE_URL` | Yes (server-only) | Base URL of the AI media service |
| `AI_MEDIA_SERVICE_INTERNAL_KEY` | Yes (server-only) | Internal key sent as `X-BazarBaz-AI-Key` header |
| `AI_MEDIA_SERVICE_TIMEOUT_MS` | No | Request timeout in ms (default: `60000`) |

**Security rules:**
- `AI_MEDIA_SERVICE_INTERNAL_KEY` must never be exposed through `NEXT_PUBLIC_*` variables.
- The key is only used server-side in `lib/services/ai-media-service-client.ts`.
- The browser calls Bazar Baz only; Bazar Baz server calls the AI media service.

## Available API Routes

### Create job

```http
POST /api/dashboard/products/{productId}/ai-image-suggestions
Authorization: required (ADMIN, MANAGER)
```

Request body:
```json
{
  "count": 3,
  "aspect_ratio": "1:1",
  "style_preset": "LIGHT_MENU_PHOTO",
  "seller_prompt": "Optional seller prompt"
}
```

Response:
```json
{
  "job_id": "string",
  "status": "QUEUED",
  "provider": "MOCK",
  "local_job_id": "string"
}
```

### Poll job status

```http
GET /api/dashboard/ai-image-suggestions/{jobId}
Authorization: required
```

Response:
```json
{
  "job": {
    "job_id": "string",
    "status": "COMPLETED",
    "provider": "MOCK",
    "outputs": [
      { "url": "https://..." }
    ]
  },
  "local": { ... }
}
```

### Select image

```http
POST /api/dashboard/products/{productId}/ai-image-suggestions/select
Authorization: required (ADMIN, MANAGER)
```

Request body:
```json
{
  "image_url": "https://...",
  "output_index": 0,
  "job_id": "optional-job-id"
}
```

- `job_id` is optional. If omitted, the most recent completed job for the product is used.

## UI Flow

### Edit product form
1. Seller opens the product edit form (`products/[id]`).
2. If `AI_MEDIA_SERVICE_ENABLED` is `true`, a button appears next to the image upload:
   - **پیشنهاد تصویر حرفه‌ای با AI**
3. Seller clicks the button → a dialog opens.
4. Seller clicks **شروع تولید تصاویر**.
5. Bazar Baz creates a job on the AI media service.
6. UI polls until `COMPLETED`, `FAILED`, or `CANCELED`.
7. On completion, 3 suggestion cards are shown.
8. Seller clicks **انتخاب تصویر** on a card.
9. Seller confirms in the browser dialog.
10. The product image preview updates.

### New product form
- The AI button is shown as **disabled** on the new product form.
- A helper text explains: "پس از ذخیره محصول، پیشنهادهای AI در صفحه ویرایش فعال می‌شود."
- After saving the product, the seller is redirected to the edit page where AI is available.

## Database Model

`AiMediaJob` is stored in the local database for ownership tracking:

- `jobId` — remote job ID from the AI media service
- `organizationId` — owner organization
- `productId` — related product
- `requestedByUserId` — seller who requested
- `status` — job status
- `provider` — always `MOCK` in this phase
- `inputs` — request payload
- `outputs` — response outputs when completed

## Smoke Tests

Run the quality gate:
```powershell
pnpm run quality:ai-media
```

Run the deployed smoke test:
```powershell
$env:DEPLOYED_URL="https://www.bazar-baz.ir"
$env:AI_MEDIA_SERVICE_URL="https://bazar-baz-ai-media-service.onrender.com"
$env:AI_MEDIA_SERVICE_INTERNAL_KEY="<vercel-secret>"
pnpm run smoke:deployed:ai-media
```

The deployed smoke verifies Bazar Baz route protection plus Render `/health`, `/ready`, and unauthenticated rejection. With the key, it also creates and polls a MOCK job and verifies `/local-output/` URLs.

## Important Warnings

1. **Durable storage (BZ-AI-02)**: When `BLOB_READ_WRITE_TOKEN` is configured, selected images are copied from Render's temporary local storage into Vercel Blob before being saved to the product. The product image URL is then the durable Blob URL. If Blob is not configured, the ephemeral Render URL is used as a fallback.
2. **Next phase**: If using Blob storage, no further action is needed for image durability. If not using Blob, implement durable object storage before production use.
3. **No OpenAI/premium provider is called** in this phase.
4. **Do not commit `.env`** files containing real secrets.

### Environment Variables for Durable Storage

| Variable | Required | Description |
|----------|----------|-------------|
| `BLOB_READ_WRITE_TOKEN` | Yes (for durability) | Vercel Blob token for durable image storage |

If `BLOB_READ_WRITE_TOKEN` is missing, the system falls back to the ephemeral Render URL and logs a warning.

## Acceptance Criteria

- `pnpm typecheck` passes
- `pnpm lint` passes
- `pnpm build` passes
- `quality:ai-media` passes
- Deployed Render AI service remains green
- Dashboard product form can request MOCK suggestions
- 3 suggestion cards appear
- Seller can select one completed generated image that belongs to the product/job
- Public users cannot call protected AI routes
- AI internal key is never exposed to browser
- No OpenAI/premium provider is called
