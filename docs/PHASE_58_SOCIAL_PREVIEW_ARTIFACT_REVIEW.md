# Phase 58 - Social Preview Artifact Review and Release Evidence

Date: 2026-06-27

## Scope

- Added a release-evidence archive script for deployed social preview captures.
- The archive copies `test-results/deployed-social-preview/manifest.json` and captured image files into `.release/social-preview-evidence/<timestamp>`.
- The archive writes `evidence.json` with commit, branch, base URL, capture counts, and copied capture metadata.
- The archive writes `REVIEW.md` with a lightweight visual review checklist.
- Added `quality:social-preview-evidence` to validate the evidence workflow and docs.
- Added a release notes template section for SEO/social preview evidence.

## Runbook

Capture deployed previews first:

```powershell
$env:DEPLOYED_URL="https://bazar-baz.ir"
pnpm run e2e:deployed:social-preview
```

Archive the generated capture evidence:

```powershell
pnpm run release:social-preview-evidence
```

Optional explicit inputs:

```powershell
pnpm run release:social-preview-evidence -- --manifest test-results/deployed-social-preview/manifest.json --out .release/social-preview-evidence/manual-review
```

## Review Checklist

Use the generated `.release/social-preview-evidence/<timestamp>/REVIEW.md` checklist to confirm:

- Persian generated social preview text is readable.
- At least one uploaded/static social preview candidate is readable.
- Generated fallback cards include tenant-specific title context.
- Captures match the expected social preview framing.
- Category sitemap stale candidates are recorded as deployed data debt, not source artifact failures.

## Artifact Rules

Generated capture artifacts and release evidence must not be committed:

```txt
test-results/deployed-social-preview/
.release/social-preview-evidence/
```

Copy the `.release/social-preview-evidence/<timestamp>` directory to the external release record if release evidence needs to be preserved beyond the local workspace.

## Validation

```powershell
pnpm run quality:social-preview-evidence
pnpm run quality:deployed-social-preview
pnpm run quality:local
pnpm run build
```

## Deferred

- CI artifact upload for social preview evidence.
- Manual visual diff tooling for comparing social cards across releases.
- Search Console or social crawler cache refresh automation.
