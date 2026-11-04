# Retail theme-aware catalog media

Local implementation only. No commit, push or provider deployment was requested
for this slice. Preserve inherited migration files and evidence.

## Contract

- `ProductCategory.image` and nullable `darkImage` hold owned public media URLs.
  Both category editors support upload, library, preview, replacement and clear.
  One available theme image can serve both themes.
- `Image.url` remains the original product upload. Nullable `derivatives` JSON
  records WebP card sizes and an optional larger detail derivative. Public
  product detail/gallery URLs retain originals; cards consume responsive sources.
- Category-purpose uploads store optimized WebP rather than a large original.
  Existing gallery selections can request scoped optimization before assignment.
- Gallery settings version 1 remains compatible with earlier product/color
  galleries. Optional `appearance`, `appearanceGroups`, `variantAppearances`
  contain light/dark image IDs. All writes validate PUBLIC access, tenant
  ownership, current product options and variant ownership. Size-only groups
  do not become visual appearances.
- Cards resolve variant, group and product image fallbacks; distinct configured
  visual appearances rotate every 2 seconds. Legacy color galleries remain
  supported. Size duplicates are removed, filtered/selected variants are pinned,
  and reduced motion, viewport, focus and hover pause rules remain supported.
- The existing theme provider supplies the resolved image choice after hydration;
  only the current theme is requested. The shared product-card image uses native
  responsive `srcSet` because the media pipeline already produces derivatives.

## Local database and prior images

New migration: `20261104093000_retail_theme_image_derivatives` adds two nullable
columns. It was applied only to the known disposable local `retail_hero_test`
database in container `bazarbaaz-admin-20261103`, bound to loopback port 55439.
Prisma Client was generated with isolated placeholder configuration.

`scripts/retail/backfill-image-derivatives.ts` is a bounded local-only tool:
explicit organization and limit, dry-run by default, explicit apply and absolute
media root. It never loads archived environment files. It preserves originals
and reports unavailable legacy bytes. Production historical media has not been
converted in this task. Uploads through other unrelated media endpoints retain
their prior behavior.

## Verification

- 42 focused tests passed: contracts, Sharp processing, tenant/media safety and
  presentation. Full TypeScript passed with exit 0.
- Real local PostgreSQL: synthetic tenant, 8 variants, 4 visual option groups,
  one variant override; merchant service save/get preserved all appearance refs.
- Normal NextAuth credentials login and authenticated dashboard/catalog HTTP 200
  were verified against the local server. Public product/catalog/category HTTP
  responses passed; latest product payload contains all 4 groups plus the
  explicit variant appearance.
- The in-app browser opened the actual `/fa/codex-local-retail-theme-demo/shop`
  route. Changing dark to light changed category and product image sources;
  optimized WebP loaded, card controls worked and rotation was observed.
  This is separate from the earlier Chrome extension connection failure.
- Authenticated multipart HTTP acceptance: product upload 201 with PNG original
  (7,111 bytes) preserved and WebP derivative present after reload; category
  upload 201 stored WebP (3,018 bytes). Category PATCH/get persisted both selected
  image URLs. Optimize called twice retained identical derivative metadata.
- Real Next bundling initially broke Sharp resolution through virtual module
  paths; rooting createRequire at the application cwd fixed it. Temporary
  development diagnostics were removed.
- Demo: http://127.0.0.1:3027/fa/codex-local-retail-theme-demo/shop
  Normal sign-in: retail-theme-demo@example.test / RetailThemeDemo!2026.
  These are synthetic local-only credentials, not a production account.
- Isolated launcher: scripts/dev/start-retail-theme-demo.mjs. Its preload caches
  an empty environment directory inside every Next process; inherited provider
  credentials and the repository environment file are not development inputs.

Before a future RunFlare release: complete local user review, apply the additive
migration through the authorized release process, finish all commits, wait for
the matching CI and pin the final main SHA. Do not advance main during that build.
