# Phase 9 — Quality Gates, Smoke Aggregation, and Documentation Cleanup

Phase 9 adds project-level guardrails so future phases are easier to validate before deployment.

## Completed scope

- Added local project validation script.
- Added aggregate deployed smoke-test runner for Phases 1 through 9.
- Added Phase 9 deployed smoke test that checks critical public and protected endpoints without Playwright.
- Added missing Phase 1 documentation file.
- Updated README with quality-gate commands and phase status.
- Added package scripts for Prisma generation, Prisma validation, migrations, TypeScript checking, local validation, and aggregate deployed smoke tests.

## Local validation commands

```bash
npm run db:generate
npm run db:validate
npm run typecheck
npm run quality:local
npm run build
```

In restricted/offline environments, `db:generate`, `db:validate`, and `build` may fail because Prisma engines or npm packages cannot be downloaded. In the normal project/deployment environment, these should pass before release.

## Deployed smoke tests

Run only Phase 9:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase9
```

Run all deployed smoke tests:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:all
```

## What Phase 9 checks

The local validator checks for:

- `package.json` parse correctness.
- Required phase documentation files.
- Required deployed smoke scripts.
- Previously recurring unsafe TypeScript/Auth patterns.
- Previously fixed security regressions, including static guest password and public payment update patterns.
- Syntax validity for the Phase 9 and aggregate smoke scripts.

The deployed Phase 9 smoke test checks:

- Homepage reachability.
- Public search reachability.
- Dashboard calendar and appointment pages do not server-error unauthenticated.
- Critical protected APIs still reject unauthenticated requests.

## Follow-up recommendations

- Keep adding one no-Playwright deployed smoke script per phase.
- Run `npm run e2e:deployed:all` after each production deploy.
- Keep README and phase docs updated before shipping each ZIP.
