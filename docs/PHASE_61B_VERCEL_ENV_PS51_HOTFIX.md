# Phase 61B — Vercel Env Push PowerShell 5.1 Hotfix

This hotfix replaces `scripts/ops/push-vercel-env.ps1` with a Windows PowerShell 5.1-safe implementation.

## Why

The previous Phase 61A script could fail during parsing on older Windows PowerShell versions because it contained incompatible/fragile constructs, including `&&` and an inline conditional expression embedded inside a string.

## Behavior

The script reads `.env`, lists existing Vercel variables for each target, then chooses the correct operation:

- existing key: `vercel env update KEY TARGET --yes`
- missing key: `vercel env add KEY TARGET`

For `production` and `preview`, added variables are marked `--sensitive` by default. Use `-Plain` if you do not want that behavior.

## Commands

Dry run:

```powershell
.\scripts\ops\push-vercel-env.ps1 -EnvFile .env -Targets production -DryRun
```

Push/update production:

```powershell
.\scripts\ops\push-vercel-env.ps1 -EnvFile .env -Targets production
```

Production + preview:

```powershell
.\scripts\ops\push-vercel-env.ps1 -EnvFile .env -Targets production,preview
```

Push/update and redeploy:

```powershell
.\scripts\ops\push-vercel-env.ps1 -EnvFile .env -Targets production -Redeploy
```

Validate:

```powershell
pnpm run quality:vercel-env-push
```
