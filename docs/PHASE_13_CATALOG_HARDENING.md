# Phase 13 — Catalog and Service Data Integrity Hardening

Phase 13 focuses on the product/service catalog layer used by dashboard product, category, service, and service-category pages.

## Goals

- Normalize catalog pagination so string query params never reach Prisma `take` / `skip` as strings.
- Keep product categories scoped to active shop organizations.
- Keep service categories scoped to active appointment organizations.
- Reject cross-organization product/category/service relationships.
- Avoid deleting categories that still own active products or services.
- Avoid deleting the last active product variant.
- Remove stale duplicate catalog service code.
- Keep deployed no-Playwright smoke tests available.

## Main changes

- Added `lib/pagination.ts` with `normalizePagination()`.
- Hardened `ProductService`:
  - validates active SHOP organization on create;
  - validates product category ownership on create/update;
  - normalizes pagination;
  - applies in-stock filtering at query level;
  - keeps at least one active variant;
  - soft-deletes variants when a product is soft-deleted;
  - uses `ApiError` for business errors.
- Hardened category services:
  - validates active organization type;
  - rejects duplicate category names per organization;
  - prevents deleting non-empty categories;
  - normalizes pagination;
  - removes stale duplicate service class from category service file.
- Hardened `ServiceService` pagination and business errors.
- Added deployed Phase 13 smoke test.

## Deployed smoke test

PowerShell:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase13
```

All deployed tests:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:all
```

## Notes

Phase 13 does not add new database tables or migrations. It is a service/API integrity phase around existing catalog models.

## Phase 13 hotfix — public product pagination

A deployed regression test showed that `/api/products?pageSize=999` could still return a server error because the route validated query parameters before clamping pagination. The product route now normalizes `page` and `pageSize` before Zod validation, caps `pageSize` at 100, and coerces common boolean/numeric filters defensively.
