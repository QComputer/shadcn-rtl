# Overlay — Phase 60 Super Admin Shop Domains

Apply on top of the green Phase 59 custom-domain foundation and hotfix overlays.

```powershell
Expand-Archive -Path .\bazar-baz-phase60-super-admin-shop-domains-overlay.zip -DestinationPath . -Force
pnpm quality:shop-domain-admin
pnpm quality:shop-custom-domains
pnpm typecheck
pnpm build
```

The dashboard route is:

```txt
/fa/dashboard/shop-domains
```

Only `SUPER_ADMIN` can access the UI/API.
