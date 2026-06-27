# Overlay — Phase 61 Vercel Env Push Script

Apply from project root:

```powershell
Expand-Archive -Path .\bazar-baz-phase61-vercel-env-push-overlay.zip -DestinationPath . -Force
node scripts/setup-register-vercel-env-package-scripts.mjs
pnpm run quality:vercel-env-push
```

Then push `.env` to Vercel production:

```powershell
pnpm run env:push:vercel
```

Direct run, without package scripts:

```powershell
.\scripts\ops\push-vercel-env.ps1 -EnvFile .env -Targets production
```
