# Phase 33 Overlay Manifest — Release Artifact Cleanup

## Changed files

- `.gitignore`
- `package.json`
- `scripts/quality/validate-release-artifact.mjs`
- `scripts/release/create-clean-source.mjs`
- `docs/PHASE_33_RELEASE_ARTIFACT_CLEANUP.md`
- `docs/PHASE_33_OVERLAY_MANIFEST.md`

## Validation

Run from the project root after applying the overlay:

```powershell
node --check scripts/release/create-clean-source.mjs
node --check scripts/quality/validate-release-artifact.mjs
pnpm run release:stage
pnpm run quality:release-staged
pnpm run quality:local
```

Optional ZIP creation:

```powershell
pnpm run release:zip
```
