# Bazar Baz — Growth Roadmap / Codex Handoff Package

This package contains:

```txt
bazar-baz-phase41a-dashboard-guard-smoke-script-fix-overlay.zip
BAZAR_BAZ_GROWTH_ROADMAP.md
CODEX_HANDOFF_PROMPT.md
CREATE_CLEAN_SOURCE.ps1
```

## 1) First fix the missing script

Copy `bazar-baz-phase41a-dashboard-guard-smoke-script-fix-overlay.zip` to the repository root and run:

```powershell
Expand-Archive -LiteralPath .\bazar-baz-phase41a-dashboard-guard-smoke-script-fix-overlay.zip -DestinationPath . -Force
```

Then validate:

```powershell
pnpm run quality:dashboard-route-guard-smoke
pnpm run quality:dashboard-route-authorization
pnpm run quality:dashboard-route-parity
pnpm run quality:dashboard-role-navigation
pnpm run quality:dashboard-navigation-copy
pnpm run quality:members-provider-hardening
pnpm run quality:local
pnpm run typecheck
pnpm run build
pnpm run release:stage
pnpm run quality:release-staged
```

Commit if green:

```powershell
git status --short
git add components/dashboard/dashboard-route-access-boundary.tsx scripts/quality/validate-dashboard-route-guard-smoke.mjs scripts/quality/validate-project.mjs package.json README.md docs/CURRENT_SOURCE_OF_TRUTH.md docs/PHASE_41_DASHBOARD_GUARD_SMOKE.md docs/PHASE_41_OVERLAY_MANIFEST.md
git commit -m "Fix dashboard guard smoke overlay script wiring"
git push origin main
```

## 2) Create a clean source locally

The full source archive uploaded to ChatGPT was a RAR and this environment did not have an extraction tool available for generating a full clean source package here. Use the included `CREATE_CLEAN_SOURCE.ps1` inside your local repository after applying the overlay.

It will run the validation gate and produce the clean release package using the project's own release workflow.

```powershell
.\CREATE_CLEAN_SOURCE.ps1
```

Expected output from the project workflow:

```txt
.release\bazar-baz-clean-source
.release\bazar-baz-clean-source.zip
```

## 3) Give Codex the prompt

Open `CODEX_HANDOFF_PROMPT.md`, attach the clean source ZIP generated locally, and paste the prompt into Codex.
