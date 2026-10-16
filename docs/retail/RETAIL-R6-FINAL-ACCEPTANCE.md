# Retail R6 final Platform acceptance

## Source and ownership

Platform candidate: `codex/platform-combined-integration-20261015`.
Integrated source commit: `a370d6588f26efdf318578f16b0006b8a2581aaf`.
Merge parents: `117d24d35584b5d80fd775938f30a53b6952dd99` (completed P14) and `54fe7bc9d07e3c2ceb6fd6f6a6bd78755e17e324` (R6 integration).
R6 integration input: `54fe7bc9d07e3c2ceb6fd6f6a6bd78755e17e324`.
Original Retail implementation: `d1680a1d57e4b12180d7d09c28a8c5038e49675d`.

The input cherry-pick `21ee601e094520463dd7fe873d8a9965c47334de` and original implementation have the same stable patch ID, `c6e39375d8023a09b3ccdd2e1df174f79142f92c`. The local merge preserves the integration input ancestry and all P14 commits. Retail source-only documentation commits and all source branches/worktrees remain preserved. Platform owns the integrated Retail functionality and shared PWA contracts. No Retail worktree deletion is performed or authorized by this report.

## Reviewed corrections

- Keep the deferred install event and manifest identity bound to the current pathname. A previous tenant's event cannot drive a new tenant's invitation.
- Require all four configured regular/maskable images to load with square, sufficient dimensions before offering installation. A missing 512 image suppresses the invitation even when 192 works.
- Verified custom domains use the origin's app scope (`/`, or `/app/`) while platform-path tenants retain `/{locale}/{slug}/shop` scope. Existing manifest IDs/start URLs are preserved.
- Return favicon redirects with a relative `Location`, retaining the verified public origin rather than an internal listener hostname.
- Resolve notification identity from the same-origin destination's trusted tenant manifest. Preserve notification titles; use no platform icon when a tenant manifest is unavailable.
- Use a brand-neutral offline shell. Cache only that shell and Next static assets; never persist tenant HTML, APIs, manifests or mutable private responses.
- Cast SQL identity `name` fields to `text` in test probes. Preserve independent Docker-side and host-side database identity checks.

No schema, migration, lockfile, payment configuration, Vercel deployment rule or Production data changes are part of R6.

## Reproduction

Use the existing isolated dependency tree and generated Prisma client for the selected combined schema. The production build uses only an explicit synthetic loopback build URL; no repository Production connection is needed. Generate the CI artwork with the existing fixture generator before building.

Run `node scripts/ops/verify-hotel-onboarding-local.mjs --pwa` only with local Docker available. It creates one labeled PostgreSQL 17 container, dedicated volume, loopback port, unique database/user and process-local password. It verifies two independent read-only identities, empty public schema and absent migration ledger, applies 104 migrations, checks SQL file checksums, runs proxy regressions and launches the production browser suite. It uninstalls only its own test PWAs, closes its fresh test Chrome profile, deletes only its synthetic records and exact labeled Docker resources, and verifies the database port is closed.

Do not run this harness against an existing database. Do not use `.env` connections or Production credentials.

## Validation ledger

- Full TypeScript: exit 0, `.tmp/r6-final-typecheck.log`.
- Production Next.js build: exit 0, `.tmp/r6-production-build.log`; includes framework TypeScript and route generation.
- Prisma schema validation: exit 0, `.tmp/r6-prisma-validation.log`. R6 requires no client/schema regeneration beyond accepted P14.
- Focused offline tests: 52/52 in `.tmp/r6-all-offline-tests.log`.
- Hotel public service/editorial regressions: 14/14 in `.tmp/r6-hotel-regressions.log`.
- Scoped ESLint: exit 0, zero errors, three warnings in `.tmp/r6-final-eslint.log` (two locale-layout `any` warnings; inherited Retail state-in-effect warning).
- Guarded PostgreSQL / production-browser acceptance: run `8bf53267b400`, `.tmp/hotel-secure-onboarding-8bf53267b400/result.json`, `status=PASSED`, `exitCode=0`, `cleanup=PASSED`.
- Fresh PostgreSQL 17: database `hotel_onboarding_8bf53267b400`, role `hotel_onboarding_test`, schema `public`, loopback port 57075, independently verified initially empty public schema and absent ledger; 104/104 migrations and file checksums passed.
- Trusted proxy regressions: 23/23 (16 unit plus 7 database integration assertions), `.tmp/hotel-secure-onboarding-8bf53267b400/pwa-proxy-regressions.log`.
- HTTP / manifest / favicon evidence: `manifest-http.json`; 12 regular/maskable images across three tenant fixtures matched approved/generated fixture bytes, MIME and dimensions in `asset-http-bytes.json`. Apple 180x180 assets also passed.
- Four storefront screenshots: Aka Shoes and Electronics, mobile and desktop. Seven install-invitation scenarios cover platform, Aka custom host/platform path, Restaurant 13, Electronics, fa/en/ar, light/dark and mobile/desktop. Negative unknown/inactive/unverified/incomplete/forged contexts do not offer installation. A broken configured secondary 512 image suppresses invitation.
- `service-worker.json`: two real origin-root registrations, offline/reconnect PASS, only neutral offline HTML and Next static assets cached.
- `retail-account.json`: real bcrypt-authenticated synthetic CUSTOMER, anonymous/authenticated account and checkout gates on mobile/desktop; cart/order/payment row counts unchanged.
- `native-installation.json`: both Chrome 155 apps genuinely installed and launched standalone, healthy rendered storefronts required before screenshots, exact processed manifest identities, same-origin account deep links, offline/reconnect PASSED, two distinct installed manifest IDs coexisted.
- `native-install-cleanup.json`: both exact apps uninstalled. Task Chrome profile removed. Container `cbbd189804a3d320240285f8f303d25bf5c4d101e41534e1f26c1af4112a1807`, volume `hotel-secure-onboarding-8bf53267b400` removed; database port 57075 verified closed. No global cleanup.

Synthetic installation invitations are UI checks only. Actual browser installation uses Chrome CDP `PWA.install`, browser-owned standalone preference, `PWA.launch`, real standalone display-mode observation, processed manifest and deep-link checks. No synthetic event or `--app` tab counts as native installation.

Browser Fetch cannot expose `Set-Cookie`; no empty browser header observation is claimed as cookie-header evidence. Cache claims derive from URL/content-type/cache-control inventory and actual offline/reconnect behavior.

## Scope and release limitations

All mutation fixtures are disposable, synthetic organizations/accounts. Aka Shoes fixture uses approved repository icon bytes; Electronics uses clearly synthetic generated assets. Empty-catalog/cart checks do not establish preservation or readiness of real Production products.

Custom-domain production-mode HTTP/browser checks and platform-path manifest/isolation checks are separate from `/app` prefix unit/proxy coverage. Physical Android installation, OS launcher icon selection/update and actual Production tenant branding records remain NOT_VERIFIED. Do not infer those gates from processed manifests, synthetic UI events or Windows Chrome installation.

Production migration checksum discrepancies, failed/rolled-back ledger records, ordering inversions and historical branding migration remain separate release blockers. No Production migration acceptance is claimed by the successful fresh-database chain.

PRODUCTION_MUTATIONS=NO. PRODUCTION_DEPLOYMENT=NO. LIVE_PROVIDER_CALLS=0. REMOTE_PUSH=NO.

## Harness defects and retained failed evidence

Earlier failed runs remain under `.tmp/hotel-secure-onboarding-*`; they are not acceptance passes. The Windows Chrome persistent profile inside the long candidate artifact path caused CacheStorage `UnknownError: Unexpected internal error`, rejected worker installation and empty registrations. A controlled comparison reproduced failure with a 162-character profile directory and success with a 46-character directory using the identical worker. The harness now uses a unique short `os.tmpdir()/bb-pwa-r6-{runId}` profile, checks exact parent/name before cleanup, and preserves SSO/auth/origin/SQL assertions.

Visual review rejected the earlier `90756b2ecf70` native screenshot despite its old identity/display-only assertions passing: Aka showed a chunk error. The final harness additionally requires the actual standalone Retail main and rejects chunk/error-boundary text before screenshot and after reconnect. The final `8bf53267b400` run passed those stronger assertions and both screenshots were visually inspected. The earlier chunk request failure was not established as a persistent application defect; do not count that earlier screenshot as successful rendering.

Next metadata routes return `public,max-age=0,must-revalidate`; tenant API manifests use `private,no-store`. The suite checks immediate response changes after a synthetic branding update and restoration without affecting another tenant. It does not relabel the metadata loader's revalidation header as no-store.

## Platform transfer and remaining device acceptance

Code/build/database/browser acceptance is complete locally. Windows Chrome genuine installation, healthy standalone rendering, deep link and reconnect are verified for both synthetic custom-domain tenants. Platform-path manifests have distinct tenant scopes and IDs verified by real HTTP; genuine installation of two path-based apps on one origin is NOT_TESTED. `/app` prefix behavior is covered by focused unit/proxy contracts, not a separate native base-path deployment.

Conservative verdict: `BB_PWA_R6_CODE_ACCEPTED_INSTALL_VERIFICATION_PENDING`. Physical Android installation, launcher icon selection/update and real tenant configuration remain separate outstanding acceptance. This is not Production release approval or authorization to delete any Retail resource.

Disk snapshot: initial approximately 2.27 billion bytes (~2.11 GiB); final measurement recorded in the delivery report. No user cache or other worktree cleanup was performed and no reclaimed space is attributed to concurrent free-space changes. Only task-created browser profiles and labeled test containers/volumes were removed.

See [RETAIL-R6-RETIREMENT-HANDOFF.md](RETAIL-R6-RETIREMENT-HANDOFF.md) for the protected inventory, source-only commits, owner disposition requirements and transferable release backlog.
Final C: free-space snapshot: 2550784000 bytes. No net reclaimed-space claim is made.

## Exact integrated source manifest

```text
app/[locale]/[slug]/shop/page.tsx
app/[locale]/[slug]/shop/product/[productId]/page.tsx
app/[locale]/[slug]/shop/shop-layout-content.tsx
app/[locale]/layout.tsx
app/[locale]/retail-preview/[store]/retail-preview.tsx
app/[locale]/retail/[organization]/account/page.tsx
app/[locale]/retail/[organization]/page.tsx
app/[locale]/retail/[organization]/product/[product]/page.tsx
app/[locale]/retail/[organization]/retail-catalog.tsx
app/api/public/v1/organizations/[organizationIdentifier]/pwa-manifest/route.ts
app/favicon.ico/route.ts
app/manifest.ts
components/pwa-install-manager.tsx
docs/retail/PLATFORM_PWA_HANDOFF_R6.md
docs/retail/RETAIL-R6-PLATFORM-INTEGRATION.md
lib/operational-app-manifest.ts
lib/organization-branding.ts
lib/tenant-pwa-context.server.ts
lib/tenant-retail-pwa.ts
public/offline.html
public/web-push-sw.js
scripts/e2e/verify-tenant-pwa-ci-db.mjs
scripts/ops/verify-hotel-onboarding-local.mjs
tests/e2e/pwa-account-acceptance.mjs
tests/e2e/pwa-native-install.mjs
tests/e2e/pwa-worker-acceptance.mjs
tests/e2e/tenant-pwa-branding-ci.mjs
tests/unit/operational-app-manifest.test.ts
tests/unit/organization-branding.test.ts
tests/unit/tenant-pwa-service-worker.test.ts
tests/unit/tenant-retail-pwa.test.ts
```
