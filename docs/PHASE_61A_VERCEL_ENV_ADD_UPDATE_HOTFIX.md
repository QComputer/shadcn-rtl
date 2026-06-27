# Phase 61A — Vercel `.env` Explicit Add/Update Hotfix

This hotfix upgrades the Phase 61 Vercel env sync script.

## Problem fixed

The previous script used:

```powershell
vercel env add KEY TARGET --force
```

That was repeatable, but it did not explicitly check whether a variable already existed before deciding whether to add or update it.

## New behavior

The script now performs this flow for every target environment:

1. Runs `vercel env ls <target>`.
2. Parses the existing env variable names.
3. For each key from `.env`:
   - existing key → `vercel env update KEY TARGET --yes`
   - missing key → `vercel env add KEY TARGET`
4. Uses `--sensitive` for production/preview unless `-NoSensitive` is passed.
5. Keeps temp-file stdin handling so secret values are not placed in shell history.

## Apply and validate

```powershell
Expand-Archive -Path .\bazar-baz-phase61a-vercel-env-add-update-hotfix-overlay.zip -DestinationPath . -Force
pnpm run quality:vercel-env-push
```

## Run

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

Package shortcut, if Phase 61 package scripts were registered:

```powershell
pnpm run env:push:vercel
```

## Fallback mode

Normal mode is explicit `exists => update` and `missing => add`.

If a future Vercel CLI output format breaks env-list parsing or update behavior on your machine, use the fallback explicitly:

```powershell
.\scripts\ops\push-vercel-env.ps1 -EnvFile .env -Targets production -ForceAddFallback
```

The fallback is opt-in and is only used if an `update` fails.
