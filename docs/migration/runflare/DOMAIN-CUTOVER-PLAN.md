# Multi-tenant domain cutover plan

R6.1 is read-only. No DNS, domain attachment, redirect, environment, certificate or application routing was changed. Evidence date: 2026-10-24. Source: commit `368e545e40cca95ddd9749d42c560d7444b1daa5`.

## Confirmed live inventory

Vercel deployment metadata independently confirms Production `dpl_4Gfqhn9n6o4mpGt6bcpTYTjUqw6e` is READY at the source commit, project `prj_CVf08NTiNcwtUPHGfGEwfyKHXoZL`, team `team_SXzXqmBelw5uJhsXMckCDajv`. Its 13 aliases are the eleven custom hostnames below plus `shadcn-rtl.vercel.app` and `shadcn-rtl-git-main-ahmads-projects-1b4ce1dc.vercel.app`. The generated deployment URL is `shadcn-3s2aoymky-ahmads-projects-1b4ce1dc.vercel.app` and is not a custom domain to transfer.

| Hostnames | Vercel project configuration, freshly read | Application tenant evidence / cutover action |
|---|---|---|
| `bazar-baz.ir`, `www.bazar-baz.ir`, `bazarbaaz.ir` | Verified; no provider redirect configured | Platform host allowlist in `lib/custom-domain-routing.ts`; retain current behavior for each, do not invent consolidation redirects. |
| `akashoes.ir`, `www.akashoes.ir` | Apex redirects to www with 308; www serves application | ACTIVE OrganizationDomain maps normalized apex to `aka-shoes`. Preserve `/shop`, `/shop/product/[slug]`, discovery, cart, checkout and merchant dashboard. |
| `fastfood13.ir`, `www.fastfood13.ir` | Apex → www, 308 | ACTIVE domain maps to `italiano-13`; preserve Restaurant 13 behavior. |
| `damoon-hotel.ir`, `www.damoon-hotel.ir` | Apex → www, 308 | ACTIVE domain maps to `damoon-hotel`; preserve Hotel website, booking and CMS behavior. |
| `azalia-shahrekord.ir`, `www.azalia-shahrekord.ir` | Apex → www, 308 | Provider association CONFIRMED, but no matching active OrganizationDomain in the live query. Actual tenant/endpoint routing is UNVERIFIED; resolve before its cutover, not by guessing a slug. |

The live OrganizationDomain query also found DISABLED `cafechakme.ir` → `chakme`, `leocafe.ir` → `cafe-leo`, and `sicilyfastfood.ir` → `sicily`. They are not current Production aliases. Preserve the records and disabled state; do not reactivate or attach them automatically.

The three ACTIVE tenant domains have `providerVerified`, `dnsConfigured`, and `sslReady` false in database metadata even though Vercel reports verified bindings. This is an existing evidence discrepancy, not permission to flip flags or a claim that the currently serving sites fail. The ordinary domain resolver and explicit endpoint resolver have distinct checks. Reproduce the actual route path and reconcile provider/DB contracts before migration. Vercel alias membership alone does not prove successful tenant resolution.

## Exact routing contracts to preserve

- `proxy.ts` reads Host, normalizes it with `normalizeDomainHost`, separates platform/custom hosts, handles locales, authentication paths and capability/public-home rewrites. Unknown custom domains fail closed. `lib/custom-domain-routing.ts` strips www and a trailing dot when matching tenant hostnames; the provider must still accept both TLS hostnames.
- Platform hosts come from source defaults plus `CUSTOM_DOMAIN_PLATFORM_HOSTS`, `BAZAR_BAZ_PLATFORM_HOSTS`, supported public origins and `NEXTAUTH_URL`. A new RunFlare temporary hostname is not automatically a valid application host. In R6.2 explicitly configure the approved temporary platform host, then test without changing public DNS.
- `app/api/internal/domain-resolver/route.ts`, `app/api/internal/shop-primary-domain/route.ts`, `lib/domains/domain-resolver.server.ts` and `lib/organization-endpoints.server.ts` resolve organization/home/capabilities/branding. Internal resolver requests require `CUSTOM_DOMAIN_RESOLVER_SECRET` or `INTERNAL_API_SECRET` in Production. Do not expose these secrets to browsers or proxy logs.
- `lib/organization-endpoints.ts` stores PUBLIC/APP/API/CALLBACK definitions under `OrganizationSettings.settings.organizationEndpoints`; there is no separate Prisma OrganizationEndpoint table. Preserve these JSON definitions and domain references. Origins must be HTTPS without credentials/query/fragment. Domain-backed endpoints require tenant ownership, ACTIVE and verified flags.
- `lib/forwarded-app-resolver.server.ts` trusts a forwarded tenant on platform traffic only with the configured `BAZARBAAZ_APP_PROXY_TOKEN` and a valid APP endpoint/path prefix. Do not weaken this into unconditional `X-Forwarded-Host` trust. RunFlare's edge must overwrite untrusted forwarding headers and correctly communicate HTTPS. Its actual contract is UNVERIFIED.
- `lib/vercel-domain-automation.ts` calls Vercel APIs and suggests Vercel DNS records. Retain it for the source, but disable its mutation gates on the new target until a reviewed provider abstraction or explicitly manual domain process exists. Do not rewrite existing domain-provider records to a guessed RunFlare enum.

## R6.2/R6.3 domain preparation, without public DNS changes

1. Confirm the same RunFlare application service `85798` supports every required hostname and HTTPS certificate (SAN/SNI), apex binding and renewal. Obtain actual target DNS records from RunFlare; no target IP/CNAME is supplied or invented in this plan.
2. Confirm DNS zone owners and access for all six apex domains, registrar/authoritative nameservers, current A/AAAA/CNAME/CAA and TTL values. The read-only local resolver returned `bazar-baz.ir` A answers `64.29.17.65` and `216.198.79.65`, TTL 1800, during this audit; this is not a full authoritative zone export. Do not use those addresses as RunFlare targets. Full authoritative records remain UNVERIFIED and must be captured before cutover.
3. Use an approved temporary hostname or authenticated pre-cutover origin probe on the existing service, with final-host routing tested through provider-supported mechanisms. Do not substitute arbitrary spoofed proxy headers for the application's trust contract. Certificate issuance may require a separate authorized DNS validation action before traffic moves.
4. Test each host's original path, query, locale and redirect behavior. For each apex require the same one-hop 308 to www, preserving path/query. Check platform hosts individually because none has a provider redirect configured. Compare canonical URLs, dynamic metadata, robots/sitemap, product structured data, redirects and status codes against a dated source baseline.
5. Preserve `NEXTAUTH_SECRET` and credential-binding behavior, account/membership/audit records, host-scoped cookies and cookie paths. Same hostname/TLS/secret should permit compatible cookies, but must be tested; do not promise session continuity until login, existing-session validation, CSRF, callback, password-session revocation and logout pass. A different temporary hostname naturally uses different cookies. Do not widen cookie domains across unrelated tenant domains.
6. Inventory configured OAuth and payment callbacks/webhooks, iNoti endpoints and any external AI/signaling callbacks by safe hostname/path only. Register final HTTPS origins only under separate configuration authorization; keep real sends/charges disabled during staging. A preserved customer-facing domain may keep its callback URL, but endpoint/proxy validation still requires testing.
7. Validate tenant-specific manifest names, icons, scope/start URL, service-worker registration, offline assets and cache versioning. Existing installed PWAs can retain cached old JS/assets; retain compatible assets during overlap and test update activation without erasing customer caches indiscriminately.

## R6.4 controlled cutover and rollback

Only after all R6.3 gates pass and the owner approves the window: freeze every source write path (UI/API, uploads, callbacks, jobs, imports and merchant mutations), drain in-flight transactions and reconcile final DB/media snapshots. Freeze does not mean merely hiding checkout buttons. Keep old Vercel endpoints and cached clients unable to write during DNS propagation. Source Neon/Blob remain authoritative until the explicit switch; RunFlare becomes the sole writable authority only after final verification.

Capture pre-change zone records and target bindings; lower TTL only through a separately approved change sufficiently before the window. Activate each intended hostname on the same application service, reproduce existing redirects, change only approved records and check TLS, Host routing and content from multiple resolvers/networks. Keep both www/apex and any AAAA behavior consistent; do not overlook stale IPv6 records. Do not transfer or remove `*.vercel.app` provider-owned aliases.

Rollback before target writes can return DNS to recorded Vercel records with the target still frozen. After RunFlare accepts any DB/media write, DNS reversal alone loses or splits data. Freeze both sides, preserve a target backup and complete a reviewed reconciliation/replay of target-only DB/media changes into the chosen authority before reopening writes. If replay cannot be proven safe, stay frozen and escalate; never operate two writable databases. DNS/cache propagation is not immediate, so both old/new ingress paths require the same write-authority fence.

Retain Neon, Vercel deployments, Blob objects, source secrets and verified backups for the approved rollback window. Deletion, account cancellation or provider retirement requires a later explicit owner action.

## Missing provider evidence

RunFlare target domain bindings/TLS limits, certificate process, trusted proxy headers, authoritative DNS export/access and Azalia's actual application mapping remain UNVERIFIED. The console was observed read-only at `https://portal.runflare.com/project/36927/service/85798`; subsequent disk-page navigation failed with an empty network response. No fallback private API, hidden browser state or mutation was used.
