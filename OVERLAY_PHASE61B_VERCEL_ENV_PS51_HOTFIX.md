# Overlay — Phase 61B Vercel Env PowerShell 5.1 Hotfix

Apply on top of Phase 61A:

```powershell
Expand-Archive -Path .\bazar-baz-phase61b-vercel-env-ps51-hotfix-overlay.zip -DestinationPath . -Force
pnpm run quality:vercel-env-push
```

Then test:

```powershell
.\scripts\ops\push-vercel-env.ps1 -EnvFile .env -Targets production -DryRun
```
