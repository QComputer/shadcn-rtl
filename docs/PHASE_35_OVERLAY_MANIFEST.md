# Phase 35 Overlay Manifest

## Files changed

```txt
app/[locale]/dashboard/members/page.tsx
app/api/organizations/[id]/members/[mId]/route.ts
prisma/seed.ts
package.json
scripts/quality/validate-project.mjs
scripts/quality/validate-seed-auth-members-cleanup.mjs
README.md
docs/CURRENT_SOURCE_OF_TRUTH.md
docs/DASHBOARD_TEST_REPORT.md
docs/SEED_TESTING_GUIDE.md
docs/PHASE_35_SEED_AUTH_MEMBER_CLEANUP.md
docs/PHASE_35_OVERLAY_MANIFEST.md
```

## Validation run in sandbox

```bash
node --check scripts/quality/validate-project.mjs
node --check scripts/quality/validate-seed-auth-members-cleanup.mjs
node scripts/quality/validate-seed-auth-members-cleanup.mjs
node scripts/quality/validate-project.mjs
node scripts/release/create-clean-source.mjs
node scripts/quality/validate-release-artifact.mjs .release/bazar-baz-clean-source
```

## Notes

Full TypeScript/build validation still needs the local project environment with dependencies installed.
