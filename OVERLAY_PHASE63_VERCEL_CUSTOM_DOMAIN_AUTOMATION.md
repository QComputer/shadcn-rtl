# Overlay — Phase 63 Vercel Custom Domain Automation

Apply from the project root:

```powershell
Expand-Archive -Path .\bazar-baz-phase63-vercel-custom-domain-automation-overlay.zip -DestinationPath . -Force
node scripts/setup-register-vercel-domain-automation-package-scripts.mjs
pnpm run quality:vercel-domain-automation
pnpm run quality:shop-domain-admin
pnpm typecheck
pnpm build
```

Add these env vars to `.env`, push them with the Phase 61 script, then redeploy:

```env
VERCEL_ACCESS_TOKEN=
VERCEL_PROJECT_ID=
VERCEL_TEAM_ID=
VERCEL_TEAM_SLUG=
VERCEL_DOMAIN_AUTOMATION_DRY_RUN=false
```

Push envs:

```powershell
.\scripts\ops\push-vercel-env.ps1 -EnvFile .env -Targets production -DryRun
.\scripts\ops\push-vercel-env.ps1 -EnvFile .env -Targets production
vercel --prod
```
