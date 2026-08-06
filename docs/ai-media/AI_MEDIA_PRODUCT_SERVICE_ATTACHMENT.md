# AI Media Product/Service Attachment

Phase: `BAZAR-BAZ-AI-MEDIA-PRODUCT-SERVICE-ATTACHMENT-01`

This phase attaches already imported, Bazar-owned `AiMediaAsset` records to customer-facing business entities.

## Scope

- Product primary image: achieved through `Product.aiPrimaryMediaAssetId`.
- Service primary image: achieved through `Service.aiPrimaryMediaAssetId`.
- Existing manual `image` URL fields remain intact as fallback.
- Replacement changes only the entity pointer and never deletes the old asset.
- Detach clears only the entity pointer.

## Safety Boundary

The browser, routes, and tests never receive provider result URLs, storage keys, Blob tokens, or arbitrary storage paths.

Dashboard attachment routes accept only:

- local entity id from the route;
- `aiMediaAssetId` in the request body;
- optional idempotency key for caller traceability.

The server derives organization ownership from the Product or Service row and validates the asset through `validateAiMediaAssetForSelection`.

## Public Display

Public storefront/appointment pages use helper functions:

- `getProductPrimaryMediaUrl`
- `getServicePrimaryMediaUrl`

When an AI asset is attached, public pages point to entity-scoped routes:

- `/api/public/products/[id]/media`
- `/api/public/services/[serviceId]/media`

Those routes resolve the entity first, require it and its organization to be active, then stream through application-owned storage.

## Validation

Repeatable gates:

- `pnpm run test:ai-media:product-service-attachment`
- `pnpm run quality:ai-media-product-service-attachment`
- `pnpm run e2e:ai-media:local-docker-product-service-attachment`

The local Docker E2E uses disposable PostgreSQL, local-test storage, and MOCK provider mode. It performs no Production/Preview hosted DB writes, no Blob writes, and no real generation.
