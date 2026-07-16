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
