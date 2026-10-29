# RunFlare release candidate — 2026-10-29

## Candidate baseline

- Local HEAD: `ab382565b7a20b82b41c9e3bbbef9e3e528f48ab` (five candidate commits, 90 changed files). This note is subsequent documentation only.
- Fetched `origin/main`: `4f0eb5d2a7ff65f977d2645682993cd0c7abc0a5`.
- Unchanged paths vs `origin/main`: `prisma/`, `package.json`, `pnpm-lock.yaml`, `next.config.ts`, `proxy.ts`, `lib/db-runtime.ts`, `lib/storage/`.
- Migration/schema unchanged in local candidate relative to `origin/main`; no migration/restore work for this release. Future migrations separately scoped.

## Verified primary facts (read-only provider terminal + local git show)

- v46 provider Node v24.22.1, cwd `/app`, `.git/HEAD` absent.
- SHA256 of `package.json`, `pnpm-lock.yaml`, `public/damoon-front/index.html`, `components/dashboard/retail-product-editor.tsx` all match raw Git blobs at fetched `origin/main` `4f0eb5d2a7ff65f977d2645682993cd0c7abc0a5`.
- Four-file baseline corroboration only; not full-tree/exact-commit attestation. Provider Git SHA not proven.

## Provider state (observed, read-only)

- RunFlare project `36927`, service `85798`, current version `v46` successful.
- Git QComputer/shadcn-rtl `main` Auto Pull checkbox ON; observed live Oct 29. No setting changes.
- No push/deploy performed. Provider SHA not yet attested.
- Historical deployment plan is baseline-specific, not current evidence.

## Source vs provider configuration (distinct)

- Runtime/storage code existence in source does not prove provider config, mounted disk durability, or env vars.
- Verify only redacted/nonsecret metadata of `DATABASE_URL` and runtime/storage adapter config; never print/copy credentials.
- PostgreSQL runtime existence does not prove production DB state, migration status, or data presence.

## Local acceptance (existing report)

- Retail/Hotel acceptance: `docs/handoffs/RETAIL-HOTEL-ACCEPTANCE-2026-10-29.md`.
- 93 tests, full build, browser, cleanup passed. No push, RunFlare deploy, production DB mutation, real payment, or real booking.

## Release boundaries

- Reviewed local candidate and hosted release remain distinct; push to main may trigger Auto Pull.
- No commit, push, worktree, branch change, or deploy in this slice.
- No assertion about production DB emptiness or restoration.

## Remaining read-only provider checks before controlled deployment

1. Attest current provider HEAD/SHA against fetched `origin/main` baseline (not undeployed local candidate).
2. Verify RunFlare env redacted metadata: `DATABASE_URL`, adapter env, `MEDIA_STORAGE_ROOT` absolute path.
3. Confirm migration status on provider DB via read-only query.
4. Record provider version and timestamp after pull; keep Auto Pull ON only with reviewed candidate.

## Separately authorized operational acceptance

- Write/read durability test on mounted persistent disk is not read-only; requires separate authorization. No immediate production writes suggested.