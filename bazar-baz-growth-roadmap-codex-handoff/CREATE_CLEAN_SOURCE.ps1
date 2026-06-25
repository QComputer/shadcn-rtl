$ErrorActionPreference = "Stop"

Write-Host "[1/6] Checking P41A hotfix script..."
pnpm run quality:dashboard-route-guard-smoke

Write-Host "[2/6] Running dashboard guard/navigation validators..."
pnpm run quality:dashboard-route-authorization
pnpm run quality:dashboard-route-parity
pnpm run quality:dashboard-role-navigation
pnpm run quality:dashboard-navigation-copy
pnpm run quality:members-provider-hardening

Write-Host "[3/6] Running full local project validator..."
pnpm run quality:local

Write-Host "[4/6] Running TypeScript and production build..."
pnpm run typecheck
pnpm run build

Write-Host "[5/6] Creating clean staged source..."
pnpm run release:stage
pnpm run quality:release-staged

Write-Host "[6/6] Creating clean source ZIP..."
pnpm run release:zip

Write-Host "Done. Check .release\bazar-baz-clean-source and .release\bazar-baz-clean-source.zip"
