# Overlay — Phase 61A Vercel Env Add/Update Hotfix

Apply on top of Phase 61:

```powershell
Expand-Archive -Path .\bazar-baz-phase61a-vercel-env-add-update-hotfix-overlay.zip -DestinationPath . -Force
pnpm run quality:vercel-env-push
```

Main change:

- `scripts/ops/push-vercel-env.ps1` now runs `vercel env ls` first, then chooses:
  - existing env var: `vercel env update`
  - missing env var: `vercel env add`

This replaces the previous default behavior that always used `vercel env add --force`.
