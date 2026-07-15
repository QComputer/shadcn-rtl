# AI Media Job Lifecycle

Date: 2026-07-15

BB-AI-MEDIA-P02-P03 uses existing models instead of adding schema.

Product-image flow:

1. Authenticated tenant user submits through Bazar Baz dashboard route.
2. Bazar Baz validates organization membership and role.
3. `AiMediaJob` is created locally before provider submission with a local placeholder job id, idempotency key, and correlation id.
4. Bazar Baz submits the typed product-image request to Render.
5. The local `AiMediaJob` is updated with the provider job id and provider status.
6. `CreativeStudioJob` stores the local AI media job id and provider job id in `p112Generation`.
7. Status synchronization polls `/v1/product-image-suggestions/jobs/{job_id}` with bounded GET retry.
8. Terminal outputs are validated as image URL metadata before draft `CreativeStudioAsset` rows are created.
9. Public product mutation still requires explicit asset selection/apply flow.

Terminal mapping:

| Render status | Creative Studio status |
| --- | --- |
| `QUEUED` | `QUEUED` |
| `PROCESSING` | `PROCESSING` |
| `COMPLETED` | `COMPLETED` |
| `FAILED` | `FAILED` |
| `CANCELED` | `CANCELED` |

Provider webhooks are not implemented because the live contract does not expose webhook support.
