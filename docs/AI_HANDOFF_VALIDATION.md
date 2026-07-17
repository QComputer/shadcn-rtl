# AI Handoff — Validation

## Green Validation Commands

Run these in order after every phase:

```powershell
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm prisma validate
pnpm run test:ai-media:pre-p07-status
pnpm run quality:ai-media-pre-p07-status
pnpm run test:ai-media:preview-isolation
pnpm run quality:ai-media-preview-isolation
pnpm run test:ai-media:preview-env-verification
pnpm run quality:ai-media-preview-env-verification
pnpm run test:ai-media:job-mirror-design
pnpm run quality:ai-media-job-mirror-design
pnpm run test:ai-media:platform-domain
pnpm run quality:ai-media-platform-domain
pnpm run test:ai-media:render-contract-readonly
pnpm run quality:ai-media-render-contract-readonly
pnpm run test:ai-media:preview-write-foundation
pnpm run quality:ai-media-preview-write-foundation
pnpm run test:ai-media:preview-mock-write-e2e
pnpm run quality:ai-media-preview-mock-write-e2e
pnpm run test:ai-media:app-managed-import
pnpm run quality:ai-media-app-managed-import
pnpm run test:ai-handoff
pnpm run quality:ai-handoff
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm run quality:source-baseline
git diff --check
git status --short --branch
```

## Notes

- If `pnpm run lint` is not present, report "not present" and continue.
- If build exits 0 but prints non-fatal DB connectivity warnings, report exactly:
  ```
  build: passed with non-fatal DB connectivity warnings.
  ```
- No current DB warnings were reported in the last validation report.
- Preview env verification tooling is source-only. It accepts redacted/operator-provided evidence and does not call Vercel, DB, Blob, Render, or AI write endpoints.
- AI job mirror design tooling is source-only. It validates docs and pure TypeScript helpers only; it does not add migrations or call Vercel, DB, Blob, Render, or AI write endpoints.
- AI platform domain tooling is source-only. It validates import planning, Baz spend-hold planning, contribution mirror planning, and schema proposal docs only; it does not add migrations, write storage, mutate balances, settle rewards, or call Vercel, DB, Blob, Render, or AI write endpoints.
- AI media pinned Render contract unit tests are mocked and deterministic.
- AI media pinned Render contract quality tooling calls only `GET /health`, `GET /ready`, and `GET /openapi.json` on the pinned Render URL, then fails closed on fingerprint, count, provider, or real-generation mismatch.
- AI media pinned Render contract fingerprinting matches ai-media-service canonicalization: sorted compact `app.openapi()` JSON, UTF-8 SHA-256, and FastAPI/Pydantic `.0` numeric constraint preservation.
- AI media Preview MOCK write foundation tests use mocked persistence and do not contact Production DB, Preview DB, Blob, Render mutation endpoints, or real generation.
- AI media Preview MOCK write foundation quality tooling validates schema/migration source, fail-closed guard rules, guarded route skeletons, no browser Render secrets, no Blob writes, docs, and package scripts.
- AI media Preview MOCK write E2E tests are local/source guarded. Live Preview E2E requires `AI_MEDIA_PREVIEW_WRITE_E2E=1`, provider `MOCK`, real generation disabled, and either explicit isolated Preview DB identity proof or `AI_MEDIA_PREVIEW_DB_NON_ISOLATED_WRITE_ACCEPTED=1` reported as accepted-risk non-isolated MOCK E2E.
- AI media Preview MOCK write E2E quality tooling validates the Preview DB identity guard, server-only Render MOCK create/status path, auth guards, no browser Render secrets, no Blob writes, docs, and package scripts.
- AI media app-managed result import unit tests use mocked/in-memory Prisma and local test storage; they validate provider result validation, storage-gateway import, IMPORTED marking, failure preservation, and idempotent reuse without contacting Production DB, Preview DB, Blob, Render mutation endpoints, or real generation.
- AI media app-managed result import quality tooling validates the pure validator, server-only import service, storage gateway guards, guarded import route, no browser Render secrets, no Blob writes, no real generation, docs, and package scripts.
- Local Docker MOCK E2E may be run before hosted Preview writes with `AI_MEDIA_LOCAL_DOCKER_E2E=1` and `AI_MEDIA_PREVIEW_DB_NON_ISOLATED_WRITE_ACCEPTED=1`, but only when `DATABASE_URL` and `DIRECT_URL` point to a disposable localhost PostgreSQL database. This mode does not prove hosted Preview DB isolation.
- Current local Docker MOCK E2E result: local migration, auth fixture, request/mirror/event creation, and provider failure recording pass; deployed Render MOCK product-image creation returns HTTP 500, so provider job creation and status sync remain blocked.
- App-managed result import local Docker E2E (`e2e:ai-media:local-docker-import`) runs only against a disposable Docker Postgres with local test storage; it verifies MOCK RESULT_READY import through the gateway into AiMediaImport/AiMediaAsset and AiMediaJobMirror IMPORTED, idempotency, no duplicate assets, no Blob write, and no real generation.

## Handoff Doc Validation

When validating handoff docs, also run:

```powershell
pnpm run test:ai-handoff
pnpm run quality:ai-handoff
```

## Snapshot Command

To create a clean source snapshot for handoff/review:

```powershell
pnpm run release:clean-source
```

Expected output locations:
- `dist/bazar-baz-clean-source/` (staged clean source)
- `dist/bazar-baz-clean-source.zip` (zipped snapshot)

The snapshot excludes:
- node_modules, .next, .vercel, .git
- .env files (except .env.example)
- secrets, logs, cache directories
- generated media, local DB dumps
- coverage, temporary files, large build artifacts

To verify the snapshot:

```powershell
pnpm run quality:clean-source
```
