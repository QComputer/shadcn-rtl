# AI Media MOCK Lifecycle

Date: 2026-07-15

The hermetic lifecycle exercises the product-image path through application services:

1. Create synthetic organization, user, category, and product.
2. Create a local Bazar Baz `AiMediaJob` before provider submission.
3. Submit the job to the local contract MOCK with idempotency and correlation metadata.
4. Persist the provider job ID and completed MOCK output.
5. Select/import the provider output through the application storage gateway.
6. Store validated image bytes in local test storage.
7. Finalize product image and Creative Studio asset records.
8. Clean up synthetic rows and local files.

Observed local acceptance created two local jobs, one Creative Studio asset, and two local storage objects. The provider was MOCK and real GPU operation was false.
