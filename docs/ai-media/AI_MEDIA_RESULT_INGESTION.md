# AI Media Result Ingestion

Date: 2026-07-15

Product-image results are received through polling `JobStatusResponse`.

Current safe boundary:

- validate terminal status;
- validate image output URLs;
- reject credentials, localhost/private hosts, and non-HTTPS URLs outside test mode;
- store draft Creative Studio asset metadata only;
- durable public product image storage still occurs through existing selected-image Blob copy flow;
- no automatic public product/logo/cover mutation is performed.

Permanent storage:

- selected product images use existing `copyRemoteImageToBlob()` when Blob is configured;
- Blob copy validates size, MIME type, and image signature;
- if Blob is not configured, the system keeps the documented remote fallback for selected images.

Organization-brand provider result ingestion remains draft/review-only and is blocked from live Render polling unless the capability becomes available.
