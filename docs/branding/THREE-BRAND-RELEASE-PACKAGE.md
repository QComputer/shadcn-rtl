# Three-brand PWA release package

Status: source candidate reviewed; Production tenant rows and release are not verified or authorized.

Candidate branch: `codex/platform-combined-integration-20261015`
Brand asset/code commit: `a5334f65f2cbd3ca3b1b9d4910ce3190facfd993`
October 13 source-package verification: see `BAZARBAAZ-OCTOBER-13-ASSET-VERIFICATION.md`.

## Expected identity map

| Origin | Manifest name / short name | Start URL / scope | Source assets |
| --- | --- | --- | --- |
| `https://bazarbaaz.ir` | `بازارباز` / `بازارباز` | `/fa` / `/` (root build); `/app/fa` / `/app/` (`/app` build) | Mark `public/brand/marks/bazarbaaz-mark.svg`; favicon `public/icons/favicon.svg`; Apple `public/icons/apple-touch-icon.png`; regular `public/icons/icon-{192x192,512x512}.png`; maskable `public/icons/icon-maskable-{192x192,512x512}.png` |
| `https://www.akashoes.ir` (apex redirects to `www`) | Required `آکا شوز` / `آکا شوز`; persisted branding row not verified | Same build topology; live legacy manifest was `/` / `/` | Logo `public/brand/tenants/aka-shoes/brand/aka-shoes-logo-square-brand-1024.png`; favicon `browser/favicon.ico`; Apple `pwa/apple-touch-icon-180.png`; regular `pwa/icon-{192x192,512x512}.png`; maskable `pwa/maskable-{192x192,512x512}.png` |
| `https://www.fastfood13.ir` (apex redirects to `www`) | Preserve currently served commercial name `رستوران ایتالیایی سیزده` / `Restaurant 13`; no naming change proposed | Same build topology; live legacy manifest was `/` / `/` | Logo `brand/production-ready/logo-mark-gold.png`; favicon `favicon.ico`; Apple `apple-touch-icon.png`; regular `icon-{192,512}.png`; maskable `icon-maskable-{192,512}.png` under `public/brand/tenants/restaurant-13/brand/production-ready/` |

The generic runtime resolves organization identity from the trusted normalized host and its active organization-domain mapping. An unknown or inactive host remains non-installable and receives no cross-tenant or Bazarbaaz icon fallback. Organization/domain verification flags and branding rows must still be confirmed through a restricted database read before any tenant correction.

## Source and served-byte comparison

Corrected Bazarbaaz source asset hashes (SHA-256):

| Asset | SHA-256 |
| --- | --- |
| Master SVG mark | `1E12273A385AD5176E32D6E3FDB8575C4BAB7BB43B1DEC9BBE9549E16F42D879` |
| Favicon SVG | `6AAAB9E5E39056430981FAF4D58F5D498BAA1B1CB375F674E79DBC76253AF77F` |
| Apple Touch Icon | `241642370C3ED2B01C71F41C0D1A8AEECD15F68D432317D3A4246A7E9D123D6E` |
| Regular 192 | `76E4ECB1C3A2DA04DC8F2CF47BD6E31F72B8FD5DB8575E74223CE54477E9260F` |
| Regular 512 | `1ACACF7030FB211DD57759925EB9D3579803F7ECBC4DBC2C303C31FF5AF026EF` |
| Maskable 192 | `94700BFED2E8D09C5A019550EC4ED82A50AE1A2BFF59BF21D93CAA62CA31846E` |
| Maskable 512 | `34B336B1785DB46ABFED415617D27BE205A2524C7F9DC6A83A50F713D7267746` |

Tenant source logo hashes match the public image bytes observed on 2026-10-15: Aka logo `C796C64D36A43002674B1F53796CB97B525D34D6BF3AD97BFFF75FCF64D7867E`; Restaurant logo `A64909B7A7E67AFE24E6BF1254B4EDA45AFFB06FFFFB5E9DB41824D51FCAF868`. Restaurant public regular icons, favicon, and Apple Touch Icon also matched their candidate source bytes. These are public HTTP observations, not proof of persisted database fields or logo approval records.

Public Production comparison from the same read-only sample:

- Bazarbaaz served the older `Bazarbaaz | بازارباز` / `Bazarbaaz` identity and old regular/maskable icon bytes. Direct `/favicon.ico` and `/apple-touch-icon.png` returned HTML.
- Aka served `کفش آکا` and used platform regular icons; its maskable paths returned 404 HTML. Its page logo bytes matched the candidate Aka square logo. Its page metadata referenced platform favicon/Apple assets.
- Restaurant served the existing name `رستوران ایتالیایی سیزده`; its regular icons, favicon and Apple icon matched candidate assets, while both manifest maskable icons used platform bytes.
- Direct browser fallback requests `/favicon.ico` and `/apple-touch-icon.png` returned HTML on all three hosts. Explicit metadata links and actual served files should be checked separately during release verification.

Exact prior HTTP evidence and screenshots are retained locally under `artifacts/branding-audit/live/` and intentionally are not part of the branding commit.

## Tenant correction preview — not applied

The current Production `OrganizationBranding` values and organization IDs are **UNVERIFIED**. Do not substitute IDs based on slugs or public HTTP output.

| Tenant | Proposed fields after a restricted read verifies the row | Preserve |
| --- | --- | --- |
| Aka Shoes | Set `displayName` and `shortName` to `آکا شوز`; set `faviconUrl` to `/brand/tenants/aka-shoes/browser/favicon.ico`; `appleTouchIconUrl` to `/brand/tenants/aka-shoes/pwa/apple-touch-icon-180.png`; `pwaIcon192Url` / `pwaIcon512Url` to the listed regular files; `pwaMaskable192Url` / `pwaMaskable512Url` to the listed maskable files. | Existing logo is byte-matched; preserve `logoUrl`, theme, unrelated fields, domain records, and all other organizations. |
| Restaurant Italiano 13 | Set only `pwaMaskable192Url` and `pwaMaskable512Url` to the listed tenant maskable files if the verified row is currently wrong. | Preserve current verified commercial naming, `displayName`, `shortName`, logo, favicon, Apple and regular icon values, theme, domain records, and unrelated organizations. |

Use the authenticated organization-scoped `PATCH /api/organizations/{organizationId}/branding` workflow with a verified target ID and same-origin session. It validates paths and writes an audit entry transactionally. No raw SQL or direct Production update is part of this package. Before/after values must be captured by the authorized read, then the owner must explicitly approve any Production write separately.

## Cache, identity, and rollback

- The manifest route is host-resolved and `force-dynamic`; the production candidate smoke returned `Cache-Control: public, must-revalidate, max-age=0`. The service worker fetches the manifest with `cache: "no-store"` and excludes it and tenant favicon identity from its static cache.
- `/favicon.ico` resolves the trusted host's approved favicon and returns a `private, no-store` redirect or 404. Public static image responses in the local production smoke returned `public, max-age=0`.
- Manifest identity remains `id === start_url`; browser origin separates installations across tenants. Root and `/app` scopes remain `/` and `/app/` respectively.
- If an approved branding correction is made later, reverse it through the same organization-scoped branding workflow using the recorded prior values. For a code deployment, restore the preceding Production deployment; do not roll back unrelated database state or change the Vercel deployment exclusion.
- Android may retain launcher icons until its manifest/service-worker update cycle runs. Reopen the installed app online and allow refresh first; reinstall only if the launcher remains stale after the browser has fetched the corrected manifest. No physical Android install/update was tested here.

## Release baseline and required gates

Do not deploy the combined Platform/Retail/Hotel candidate solely to ship branding: it includes unrelated Retail/Hotel features and the combined branch is not Production migration-compatible. The branding commit `a5334f6` is based on combined candidate commit `1490c15`, not on the current Production-compatible lineage, so it is **not** a standalone deployable cherry-pick. The existing Production-lineage release worktree is at `543e818` (based on `3045d1a` plus later release-candidate changes); any narrow branding release must be re-reviewed and applied to that exact release source after its owner resolves currently known migration/source gates. No branch, push, deployment, DNS change, database query, or database write was performed for this package.

Post-release acceptance must, for each domain, verify authenticated/restricted organization-domain and branding rows, manifest JSON and cache headers, regular/maskable image bytes and dimensions, favicon and Apple icon MIME/bytes, rendered page metadata, browser network evidence, RTL/LTR and light/dark display, and tenant isolation. Verify root and `/app` path builds where deployed. Keep physical installed-PWA acceptance separate from browser emulation.
