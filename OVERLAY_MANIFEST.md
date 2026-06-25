# Overlay Manifest — Phase 33 Release Artifact Cleanup

## Purpose

Adds repeatable clean-release packaging so future source ZIPs do not include local secrets, `.vercel`, DB dumps, generated caches, test output, personal files, or archive files.

## Updated files

- `.gitignore`
- `package.json`
- `scripts/quality/validate-release-artifact.mjs`
- `scripts/release/create-clean-source.mjs`
- `docs/PHASE_33_RELEASE_ARTIFACT_CLEANUP.md`
- `docs/PHASE_33_OVERLAY_MANIFEST.md`

## Validate after extraction

```powershell
node --check scripts/release/create-clean-source.mjs
node --check scripts/quality/validate-release-artifact.mjs
pnpm run release:stage
pnpm run quality:release-staged
pnpm run quality:local
```

## Create a clean future handoff ZIP

```powershell
pnpm run release:zip
```
