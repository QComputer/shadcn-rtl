# Phase 34 Overlay Manifest — Source-of-Truth Documentation Sync

## Changed files

```txt
README.md
docs/CURRENT_SOURCE_OF_TRUTH.md
docs/ROUTE_API_DB_SERVICE_INVENTORY.md
docs/FOLLOW_FANPAGE_ROADMAP.md
docs/SEED_TESTING_GUIDE.md
docs/PHASE_34_SOURCE_OF_TRUTH_SYNC.md
docs/PHASE_34_OVERLAY_MANIFEST.md
```

## Apply from project root

```powershell
Expand-Archive -LiteralPath .azar-baz-phase34-docs-sync-overlay.zip -DestinationPath . -Force
```

## Validate

```powershell
pnpm run quality:local
pnpm run release:stage
pnpm run quality:release-staged
```

## Notes

- Docs-only overlay.
- No source runtime behavior changed.
- No Prisma migration added.
- No package script added.
