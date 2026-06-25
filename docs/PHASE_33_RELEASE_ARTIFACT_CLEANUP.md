# Phase 33 — Release Artifact Cleanup

## Goal

Prevent local secrets, database dumps, generated caches, test output, and personal files from being included in source packages shared with another AI, reviewer, or deployment operator.

## Implemented changes

- Added `scripts/release/create-clean-source.mjs`.
- Hardened `scripts/quality/validate-release-artifact.mjs` to catch:
  - private `.env*` files except `.env.example`,
  - `.vercel/`, `.vscode/`, `.idea/`, `.release/`, test/build/cache directories,
  - local DB/dump/archive files such as `*.db`, `*.sqlite`, `*.dump`, `*.backup`, `*.zip`, `*.rar`, `*.7z`,
  - `public/myResume.pdf`, `prisma/dev.db`, and `tsconfig.tsbuildinfo`.
- Added package scripts for repeatable clean source staging and ZIP creation.
- Updated `.gitignore` to reduce future accidental local artifact inclusion.

## Commands

Stage a clean source directory:

```powershell
pnpm run release:stage
```

Create a clean source ZIP:

```powershell
pnpm run release:zip
```

Validate the staged clean source directory:

```powershell
pnpm run quality:release-staged
```

Validate any arbitrary package directory after extraction:

```powershell
node scripts/quality/validate-release-artifact.mjs .\path\to\extracted-package
```

## Notes

The release cleanup script does not delete local files from the developer machine. It creates a clean staged copy under `.release/bazar-baz-clean-source` and optionally compresses it to `.release/bazar-baz-clean-source.zip`.

If an existing local archive already included `.env`, `.env.local`, `.vercel`, dumps, test results, or personal files, do not reuse it as a baseline. Generate a fresh archive with `pnpm run release:zip`.
