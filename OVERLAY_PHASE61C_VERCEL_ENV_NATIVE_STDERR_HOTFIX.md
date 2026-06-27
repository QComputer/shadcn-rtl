# Overlay — Phase 61C Vercel Env Native Stderr Hotfix

Apply from project root:

```powershell
Expand-Archive -Path .\bazar-baz-phase61c-vercel-env-native-stderr-hotfix-overlay.zip -DestinationPath . -Force
pnpm run quality:vercel-env-push
.\scripts\ops\push-vercel-env.ps1 -EnvFile .env -Targets production -DryRun
```

This patch fixes Windows PowerShell 5.1 `NativeCommandError` behavior when Vercel CLI prints banner/status text on stderr.
