# Retail storefront brand color

Store administrators can set an independent storefront primary color in Website
Studio, using a native picker, HEX input or presets, and restore the platform
default. Saving applies the color immediately; it is independent of hero draft
publication and PWA/browser `themeColor`.

## Implementation

- Nullable `OrganizationBranding.storefrontPrimaryColor`, validated as six-digit
  HEX or null through the existing ADMIN-only, same-origin branding API. Updates
  are restricted to SHOP organizations and audited with tenant and actor IDs.
- Scoped primary, foreground, focus and accent variables on Retail and custom
  shop layouts. React context carries these variables into Sheet, Select and
  Dialog portals without mutating document root styles or other tenants.
- Automatic light/dark accent derivation preserves the stored original color
  while maintaining foreground/primary contrast. Empty settings inherit the
  platform palette.
- Editor save performs a fresh GET and checks the persisted value. Failed initial
  loads cannot overwrite existing settings. Tenant changes remount the editor;
  requests are aborted on unmount. Preview includes the actual product card.

## Validation

- TypeScript passed; scoped ESLint passed with only two inherited unused-icon
  warnings in shared UI components. New editor/helper lint is clean.
- 22 focused unit tests passed (branding, palette validation, contrast and purity).
- Disposable PostgreSQL 17 integration passed: save/read/public snapshot, tenant
  isolation, reset and preservation of PWA values.
- Actual branding route and database-backed guards passed 10 loopback HTTP
  checks, including unauthenticated access, non-admin/other-tenant access, wrong
  origin, Hotel exclusion, persistence and audit records. Only auth session was
  synthetic. Acceptance fixtures were cleaned successfully.
- Real Chrome local acceptance verified save, reload rehydration, invalid input
  protection, default reset, scoped color and a Sheet portal retaining the same
  primary while an outside button retained its original palette. This is a
  loopback adapter around real route handlers, not a Next server or physical
  Android acceptance.

## Migration and release

`20261103120000_add_storefront_primary_color` only adds a nullable text column.
Deploy it before new application code. The Node 24 helper
`scripts/db/deploy-retail-brand-color.mjs <verified-database-name> --apply`
uses the application's explicit runtime database configuration and the installed
locked Prisma CLI. It creates a temporary directory containing only this new
migration and invokes standard `prisma migrate deploy`; historical migration
files in the shared dirty checkout are not replayed.

The helper passed a disposable-database test with a prior baseline migration,
then a second run with no pending migrations. Expected new migration checksum:
`67dc08b7a3dc91b54f747acd9d77f35a8fe8600a1a974ebd7da80cb901044bbb`.

Production publication evidence will be recorded after release verification.
