# Retail R2 acceptance record

## Git isolation

- Baseline commit: `fd0574be1beec6429a78b2c7f52b3664398ef4a`.
- Work branch: `codex/retail-r2-catalog-20261013`.
- Worktree: `C:\Users\disso\.codex\worktrees\retail-r2-20261013\shadcn-rtl`.
- The R1 worktree, dirty main checkout, and Hotel F4 worktree were left unchanged.
- Final commit SHA: recorded in the delivery result after the acceptance record is committed.

## Public catalog gallery discrepancy

Reproduced on the unchanged R1 baseline before editing with `tests/unit/public-catalog-contract.test.ts`: 3 passed, 2 failed. Both failures expected the `gallery` key to be omitted while the serializer returned `gallery: []`. `PublicCatalogMedia` declares required `gallery: string[]`, the serializer always emits it, and public response v1 uses a stable strict media shape. The tests were corrected to assert the authoritative empty-array value. This is not suppressed or excluded.

## Disposable database gate

- Local Docker container: `bazarbaaz-retail-r2-pg17-20261013` (created for this acceptance only; label `bazarbaaz.retail-r2.disposable=true`).
- Verified database: `bazarbaaz_retail_r2`, user `retail_r2`, PostgreSQL `17.10`, server version number `170010`, loopback port `55432`.
- `DATABASE_URL` and `DIRECT_URL` must both point at that exact local database and `LOCAL_PRISMA_EXPECTED_PORT=55432`; fixture script checks the database name and PostgreSQL major before any fixture action.
- No production, hosted preview, or Neon database was contacted or mutated.
- Full repository migration deploy from an empty disposable PG17 database applied 97 migrations total (95 inherited migrations plus the two listed R2 migrations). The second guarded deploy reported no pending migrations.

## Synthetic fixtures and focused results

`scripts/retail/r2-fixtures.mjs` seeds two organizations with active `SHOP` capability and persisted theme/preview config: a Persian fashion shoe shop and a generic mobile shop. It also seeds a restaurant-only organization with an active `APPOINTMENT` capability and a product to verify it is not exposed through retail. Products use existing Product/ProductVariant rows, typed attribute definitions/values, variant options, variant-specific prices and inventory, and clearly named PREVIEW synthetic media. A foreign-tenant image and a private image are attached to the fashion product solely to exercise media filtering.

Run the focused fixtures with this PowerShell session after verifying that the named disposable container remains the current target:

```powershell
$env:DATABASE_URL = $env:RETAIL_R2_DATABASE_URL # use only the URL for the inspected, labeled disposable container
$env:DIRECT_URL = $env:DATABASE_URL
$env:LOCAL_PRISMA_EXPECTED_PORT = '55432'
$env:RETAIL_R2_EXPECTED_DATABASE = 'bazarbaaz_retail_r2'
$env:NODE_ENV = 'test'
$env:AI_MEDIA_APPLICATION_STORAGE_ADAPTER = 'local-test'
corepack pnpm exec tsx scripts/retail/r2-fixtures.mjs seed
corepack pnpm exec tsx --require=./scripts/e2e/register-server-only.cjs scripts/retail/r2-fixtures.mjs verify
```

Results: seed passed on PostgreSQL 17.10; service acceptance passed for tenant category/product visibility, material and RAM structured attributes, variant options/SKU/prices, reserved-stock availability, public same-tenant media eligibility, foreign/private/unsafe media exclusion, foreign product 404, and restaurant capability 404. The serializer denylist check found no organization ID, inventory count, or sensitive device identifier in public JSON.

## Validation results

- `corepack pnpm typecheck`: passed.
- `corepack pnpm exec prisma validate`: passed.
- `corepack pnpm exec prisma generate`: passed with Prisma Client 6.19.3.
- Full `corepack pnpm lint`: exit 0, 0 errors and 987 repository warnings. Focused ESLint on changed code and harness files: passed with no warnings.
- Focused regression batch: 67/67 passed across public catalog contract, attribute validation, tenant capabilities and restaurant shop-menu behavior.
- Full migration chain on the empty disposable PG17 database: 97 applied; guarded repeat: no pending migrations.
- Optimized production build: passed with `NODE_OPTIONS=--max-old-space-size=8192`; Next.js 16.2.7 compiled, typechecked, and generated 278 static pages. An initial build using the default Node heap exited 134 during TypeScript due to memory exhaustion; the bounded retry with a larger heap completed successfully.
- Production server started on the R2 worktree at port 3101. Installed Chrome smoke: PASS at 360, 390, 768, 1024, and 1440 widths. It checked catalog/API response, structured filter, foreign tenant 404, capability 404, product detail composition, disabled purchase CTA, sensitive-identifier exclusion, and horizontal overflow.
- No payment or checkout was enabled.

Screenshots (final build):

- `artifacts/retail-r2-browser/fashion-390.png`
- `artifacts/retail-r2-browser/fashion-1440.png`
- `artifacts/retail-r2-browser/fashion-product-390.png`
- `artifacts/retail-r2-browser/electronics-390.png`
- `artifacts/retail-r2-browser/electronics-product-390.png`

Local preview URLs while the isolated server is running:

- Fashion: `http://localhost:3101/fa/retail/retail-r2-fashion-preview`
- Electronics: `http://localhost:3101/fa/retail/retail-r2-mobile-preview`
- Separate synthetic R1 preview routes: `http://localhost:3101/fa/retail-preview/fashion` and `/fa/retail-preview/electronics`.

The isolated PG17 container and server are left running for local preview. They contain synthetic, preview-only fixture data; no cleanup was run after the browser pass.
