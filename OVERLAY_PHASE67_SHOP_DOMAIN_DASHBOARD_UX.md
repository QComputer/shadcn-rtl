# Overlay — Phase 67 Shop-domain dashboard UX polish

Apply from the project root:

```powershell
Expand-Archive -Path .\bazar-baz-phase67-shop-domain-dashboard-ux-overlay.zip -DestinationPath . -Force
node scripts/setup-register-shop-domain-ux-package-scripts.mjs
pnpm run quality:shop-domain-ux
pnpm run quality:shop-domain-admin
pnpm run quality:vercel-domain-automation
pnpm typecheck
pnpm build
```

Changed files:

- `components/dashboard/shop-domain-manager.tsx`
- `scripts/quality/validate-shop-domain-ux-polish.mjs`
- `scripts/setup-register-shop-domain-ux-package-scripts.mjs`
- `docs/PHASE_67_SHOP_DOMAIN_DASHBOARD_UX.md`
- `OVERLAY_PHASE67_SHOP_DOMAIN_DASHBOARD_UX.md`

No Prisma migration is included.
