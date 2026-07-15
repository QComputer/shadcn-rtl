# AI Media Result Ingestion

Date: 2026-07-15

Product-image results are received through polling `JobStatusResponse`.

Current safe boundary:

- validate terminal status;
- validate image output URLs;
- reject credentials, private hosts, and non-HTTPS URLs outside explicit test mode;
- store draft Creative Studio assets through the application storage gateway;
- durable public product image storage occurs through the application storage gateway;
- no automatic public product/logo/cover mutation is performed.

Permanent storage:

- selected product images are imported by the server through the application storage gateway;
- the gateway validates size, MIME type, image signature, and checksum before storage;
- the provider result URL is not used as the permanent Creative Studio or selected product image URL.

Compensation:

- storage import happens before database finalization;
- if database finalization fails after storage succeeds, the service invokes `compensateFailedAssetImport`;
- rollback metadata is kept safe and does not expose credentials or private storage URLs;
- repeated ingestion must not create duplicate permanent assets.

Organization-brand provider result ingestion remains draft/review-only and is blocked from live Render polling unless the capability becomes available.
