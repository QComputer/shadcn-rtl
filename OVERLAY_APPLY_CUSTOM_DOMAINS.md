# Bazar Baz Shop Custom Domains Overlay

This overlay contains only the files changed/added for shop custom-domain routing.

## Apply

From the project root on Windows PowerShell:

```powershell
Expand-Archive -Path .\bazar-baz-shop-custom-domains-overlay.zip -DestinationPath . -Force
```

## Validate after applying

```powershell
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm quality:shop-custom-domains
pnpm typecheck
pnpm lint
pnpm build
```

## Required env

Set `CUSTOM_DOMAIN_RESOLVER_SECRET` to a strong random value in local and Vercel environments.

See `docs/PHASE_59_SHOP_CUSTOM_DOMAINS.md` for DNS, Vercel, and tenant-domain activation steps.
