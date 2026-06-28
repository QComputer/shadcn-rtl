# Phase 67 — Shop-domain dashboard UX polish

This phase improves the SUPER_ADMIN-only shop-domain manager without changing the database schema or public routing behavior.

## Scope

- Keep `/fa/dashboard/shop-domains` as a central SUPER_ADMIN-only tool.
- Show whether Vercel automation is configured or missing.
- Keep dry-run visibility for safe testing.
- Add clickable storefront, `robots.txt`, and `sitemap.xml` quick links per domain.
- Add one-click copy buttons for DNS records returned by Vercel automation.
- Show localized status labels instead of raw enum-only UI.
- Show clearer last-check timestamps and failure reasons.
- Warn when an apex domain is present without its matching `www` domain, or vice versa.
- Add confirmation before removing a domain from Vercel.
- Add confirmation before deleting the local Bazar Baz domain mapping.
- Add a selected-domain PowerShell smoke command block using `e2e:custom-domain-smoke`.

## Validation

```powershell
node scripts/setup-register-shop-domain-ux-package-scripts.mjs
pnpm run quality:shop-domain-ux
pnpm run quality:shop-domain-admin
pnpm run quality:vercel-domain-automation
pnpm typecheck
pnpm build
```

## Manual smoke

Open:

```txt
https://www.bazar-baz.ir/fa/dashboard/shop-domains
```

Verify:

1. Domain links open the storefront.
2. `robots.txt` and `sitemap.xml` links are visible per domain.
3. DNS records returned by Vercel can be copied.
4. Removing from Vercel asks for confirmation.
5. Deleting a mapping asks for confirmation.
6. The smoke command block can be copied and run.
