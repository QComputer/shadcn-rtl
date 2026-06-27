# Phase 61 — Vercel `.env` Push/Update Script

This overlay adds a reusable PowerShell script for pushing every variable from the project `.env` file to Vercel, regardless of whether the variable already exists.

## Added files

- `scripts/ops/push-vercel-env.ps1`
- `PUSH_VERCEL_ENV.cmd`
- `scripts/setup-register-vercel-env-package-scripts.mjs`
- `scripts/quality/validate-vercel-env-push.mjs`
- `docs/PHASE_61_VERCEL_ENV_PUSH_SCRIPT.md`

## Register package scripts

This overlay does not overwrite `package.json`. To safely add package scripts to the current project state, run:

```powershell
node scripts/setup-register-vercel-env-package-scripts.mjs
```

Then validate:

```powershell
pnpm run quality:vercel-env-push
```

## Run directly without package scripts

Production only:

```powershell
.\scripts\ops\push-vercel-env.ps1 -EnvFile .env -Targets production
```

Or with the root CMD wrapper:

```powershell
.\PUSH_VERCEL_ENV.cmd -EnvFile .env -Targets production
```

## Common modes

Dry run:

```powershell
.\scripts\ops\push-vercel-env.ps1 -EnvFile .env -Targets production -DryRun
```

Production and preview:

```powershell
.\scripts\ops\push-vercel-env.ps1 -EnvFile .env -Targets production,preview
```

Production, preview, and development:

```powershell
.\scripts\ops\push-vercel-env.ps1 -EnvFile .env -Targets production,preview,development
```

Preview branch-specific variable push:

```powershell
.\scripts\ops\push-vercel-env.ps1 -EnvFile .env -Targets preview -GitBranch main
```

Force relinking first:

```powershell
.\scripts\ops\push-vercel-env.ps1 -EnvFile .env -Targets production -Link
```

Push and redeploy production:

```powershell
.\scripts\ops\push-vercel-env.ps1 -EnvFile .env -Targets production -Redeploy
```

## Behavior

- Parses `.env` lines in `KEY=VALUE` format.
- Ignores blank lines and comments.
- Accepts optional `export KEY=VALUE` syntax.
- Preserves values containing `=` after the first equals sign.
- Removes matching single or double quotes around values.
- Converts escaped `\n` into real newlines for multiline secret values.
- Skips empty values by default.
- Uses `vercel env add KEY TARGET --force`, so existing variables are overwritten.
- Uses temporary stdin files, avoiding secret values in shell history.
- Uses `--sensitive` for production and preview unless `-NoSensitive` is passed.
- Does not use `--sensitive` for development, because Vercel development variables do not support sensitive mode.

## Notes

Vercel documents `vercel env add [name] [environment] < [file]`, `vercel env update`, and `vercel env add ... --force` for overwriting an existing variable. Production and preview variables are sensitive by default, while development variables remain encrypted.

Review `.env` before pushing. Do not push local-only values such as temporary localhost URLs unless they are intentionally needed on Vercel.
