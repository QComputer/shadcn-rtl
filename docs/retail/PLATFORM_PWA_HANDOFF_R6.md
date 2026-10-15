# R6 Platform PWA integration handoff

Retail R6 keeps PWA presentation inside the Retail storefront. It does not
register a service worker, generate a manifest, select tenant identity from a
request, or change the shared install manager.

## Retail integration points

- Live collection and product routes pass the persisted catalog
  `organization.branding.logo` and `organization.name` into the shared Retail
  renderer. The renderer displays those values; it does not infer branding
  from a tenant slug.
- The Retail header links to the tenant storefront. Mobile navigation links to
  that storefront, its categories, the existing cart/checkout route, and the
  existing customer profile route.
- The Retail renderer detects standalone display mode for truthful UX only.
  While a tenant-specific installation contract is unverified, it offers
  tenant-named share/save guidance and does not claim that installing creates
  a tenant-branded app.
- While a loaded storefront is open, it reports offline/online state and
  retries the existing public catalog request on reconnection. It does not
  cache catalog, cart, account, or checkout data.

## Platform decisions needed for tenant-branded installation

1. Define a trusted organization-scoped install identity contract: display
   name, eligible icon assets and validation/fallback behavior. Use persisted
   organization branding; keep platform-wide identity separate.
2. Define tenant storefront `start_url` and `scope` for root-host and `/app`
   deployments. Start from the requested tenant storefront route and preserve
   locale/deep links without allowing client-controlled tenant identity.
3. Connect the shared manifest response to the trusted tenant context and
   verify isolation across two tenants on the same browser origin. Specify
   browser fallback behavior where host context cannot uniquely identify a
   tenant.
4. Define when the shared install manager may show `beforeinstallprompt`, how
   its name/icon presentation is obtained, and the supported iOS/manual
   instructions. Do not label a global Bazarbaaz installation as a tenant app.
5. Verify Service Worker scope, offline navigation fallback, asset/cache
   behavior, push identity, and `/app` base-path handling end-to-end. Retail
   currently reports connectivity in an already-loaded page only; API and
   commerce requests remain network-dependent.

## Acceptance required after Platform integration

Run installed-PWA acceptance on Aka Shoes and a second synthetic Retail tenant:
inspect actual manifest response, icon pixels/metadata, `start_url`, `scope`,
installed display mode, direct product deep links, tenant switching/isolation,
offline navigation and reconnect. Record supported browsers and separately
verify root and `/app` topology. Until these pass, Retail R6 is storefront UX
ready for Platform integration review, not proof of an installable
tenant-branded PWA.
