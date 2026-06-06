# Bazar Baz — Documentation Overlay Manifest

_Last updated: 2026-06-02._

## Purpose

This overlay adds comprehensive project documentation based on a full source-tree inspection. It does not change application runtime code, database migrations, API behavior, UI behavior, or package dependencies.

## Files added

- `docs/PROJECT_PROSPECT_AND_CURRENT_STATUS.md`
- `docs/ARCHITECTURE_AND_WORKFLOWS.md`
- `docs/ROUTE_API_DB_SERVICE_INVENTORY.md`
- `docs/PRODUCTION_READINESS_AUDIT.md`
- `docs/NEXT_PHASE_ROADMAP.md`
- `docs/AI_HANDOFF_PROJECT_CONTEXT.md`
- `docs/DOCUMENTATION_OVERLAY_MANIFEST.md`

## Files updated

- `README.md`

## Validation performed

The documentation overlay preserves the existing phase docs and quality-script expectations. After the files were written, the local project quality script was run:

```bash
node scripts/quality/validate-project.mjs
```

The script checks package JSON parsing, required phase docs, expected deployed smoke scripts, syntax of selected `.mjs` scripts, and recurring stale-code patterns.

## Validation not performed by this overlay

This overlay is documentation-only and was created from a ZIP without installed dependencies. The following remain to be run in the developer environment:

```bash
npm ci
npm run db:generate
npm run db:validate
npm run typecheck
npm run lint
npm run health:env
npm run build
```

## Packaging note

The overlay ZIP should be extracted at the project root. It contains only changed documentation files and `README.md`; it intentionally does not include `.env`, local database files, `node_modules`, `.next`, or full source replacement.
