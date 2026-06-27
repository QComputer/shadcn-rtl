# Phase 61C — Vercel Env Native Stderr Hotfix

This hotfix makes `scripts/ops/push-vercel-env.ps1` safer on Windows PowerShell 5.1.

## Why

Vercel CLI can print its banner/status text on stderr. In Windows PowerShell 5.1, a native command writing to stderr can surface as `NativeCommandError` when strict error handling is enabled.

The previous script could stop at:

```powershell
node.exe : Vercel CLI 54.x.x
```

before it could parse `vercel env ls`.

## Fix

All Vercel CLI calls now go through `Invoke-VercelCommand`, which:

- temporarily relaxes `$ErrorActionPreference` for the native CLI call,
- captures stdout and stderr together,
- strips ANSI control codes,
- returns `{ ExitCode, Output }`,
- treats the command as failed only when the native exit code is non-zero.

For write commands, stdin is passed through a temporary file via `cmd.exe /d /s /c "vercel ... < temp-file"`, avoiding PowerShell 5.1 native stderr parsing problems.

## Usage

```powershell
pnpm run quality:vercel-env-push
.\scripts\ops\push-vercel-env.ps1 -EnvFile .env -Targets production -DryRun
.\scripts\ops\push-vercel-env.ps1 -EnvFile .env -Targets production
```
