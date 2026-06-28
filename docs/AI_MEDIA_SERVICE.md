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
  "job_id": "string",
  "image_url": "https://...",
  "output_index": 0
}
```

## UI Flow

1. Seller opens the product create/edit form.
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

## Important Warnings

1. **MOCK-only**: The AI media service is running in MOCK mode. Generated images are temporary local assets served from Render's local storage. They are **not** permanent production storage.
2. **Next phase**: After this phase, selected/generated images should be copied to durable object storage (e.g., Vercel Blob or equivalent).
3. **No OpenAI/premium provider is called** in this phase.
4. **Do not commit `.env`** files containing real secrets.

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
