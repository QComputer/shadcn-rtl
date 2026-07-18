# AI Handoff - Next Prompt

## Recommended Next Prompt

```text
PHASE: BAZAR-BAZ-AI-NETWORK-LOCAL-DOCKER-MOCK-E2E-RECOVERY-01

STATUS: App-managed MOCK result import (`BAZAR-BAZ-AI-MEDIA-APP-MANAGED-MOCK-RESULT-IMPORT-01`) is complete and committed. Local Docker MOCK E2E recovery (`BAZAR-BAZ-AI-NETWORK-LOCAL-DOCKER-MOCK-E2E-RECOVERY-01`) is complete and committed. Imported asset consumption (`BAZAR-BAZ-AI-MEDIA-ASSET-CONSUMPTION-01`) is now implemented and committed: a server-only asset service, selection abstraction, guarded API routes (`/api/dashboard/ai-media/assets`, `/[id]`, `/[id]/content`), a minimal localized dashboard UI, unit tests, local Docker consumption E2E, quality validator, and docs. Only canonical `IMPORTED` assets are exposed, scoped by organization, with no provider URLs, no storage credentials, no browser-to-Render calls, and no Production writes.

MISSION:
Resolve the local Docker MOCK E2E blocker before any hosted Preview write. Use disposable local Docker Postgres, the local Bazar Baz app, and the deployed Render MOCK coordinator. Keep the flow MOCK-only and fail closed outside local/test/Preview scope.

BASELINE:
The repository should be on main at or after `43034edf745fd52c4f9613e342c4ef4f909bfb68`, plus the pinned Render contract read-only verification commit if it has been accepted.

CURRENT ACCEPTED SOURCE WORK:
- PRE-P07 AI media network status mapping.
- Preview isolation source gate.
- Preview env verification readonly gate.
- AI job mirror source design with pure TypeScript helper and validator.
- AI media platform domain foundation with import planning, Baz spend-hold planning, contribution mirror planning, and schema proposal docs.
- Pinned Render MOCK contract read-only verification from the Bazar Baz side.
- Preview MOCK write foundation with app-owned mirror schema/migration source, server-only persistence services, Preview write guard, guarded route skeletons, unit tests, and quality validator.
- Preview MOCK write E2E source gate with a Preview DB identity guard that allows isolated Preview proof or explicit accepted-risk non-isolated MOCK E2E, server-only Render MOCK create/status service, guarded routes, unit tests, quality validator, and docs.
- Local Docker MOCK E2E now reaches local Bazar Baz app-owned request/mirror/event creation against a disposable local Postgres container, but Render MOCK product-image creation still returns HTTP 500 after reported ai-media-service fix `39168ae167c69aca3c01ae59368323dc5658b88f`. The app records the failure safely as request `FAILED`, mirror `FAILED_RETRYABLE`, `PROVIDER_ERROR`, with sanitized status payload and no provider job id.
- App-managed MOCK result import (`BAZAR-BAZ-AI-MEDIA-APP-MANAGED-MOCK-RESULT-IMPORT-01`) is now implemented and committed: pure provider-result validator, server-only import service, guarded Preview import route, unit tests, quality validator, disposable local Docker import E2E, and docs. It imports a completed MOCK `RESULT_READY` result through the application storage gateway into `AiMediaImport`/`AiMediaAsset` and marks `AiMediaJobMirror` IMPORTED, with idempotent reuse and no Production/hosted-Preview DB, Blob, or browser-secret exposure.
- Pinned Render URL: `https://bazar-baz-ai-media-service.onrender.com`
- Pinned OpenAPI fingerprint: `8bed184dd79980beacc553308652a44d99590c9705b7d37ab9418f4f83868f91`
- Pinned OpenAPI counts: 42 paths, 40 schemas.
- Render provider expectation: `MOCK`; real generation remains blocked.
- shadcn-rtl verifier uses the same fingerprint algorithm as ai-media-service: sorted compact `app.openapi()` JSON, UTF-8 SHA-256, and FastAPI/Pydantic `.0` numeric constraint preservation.
- Operator-accepted DB resume applied migration `20260716000100_ai_media_preview_mock_write_foundation` under `ACCEPTED_RISK_NON_ISOLATED_DB`. Live Preview MOCK E2E is still pending because no local Preview session cookie or Vercel protection bypass value was available.
- Database migration chain recovery (`BAZAR-BAZ-DATABASE-MIGRATION-CHAIN-RECOVERY-01`) is now implemented and committed: the conflicting migration `20260707000200_export_hub_extend_data_types` was corrected in place to a guarded idempotent enum-extension pattern; the migration execution chain is locally proven (all 52 migrations apply, 0 active-failed) and the `storageKey` migration deploys locally. Full Prisma schema parity is NOT PROVEN — unrelated historical drift remains and is documented as a separate future database-normalization phase. Production migration has not been run and Production asset-consumption remains disabled.

RULES:
- No write flow is authorized outside Preview/test/development MOCK-only scope, and accepted-risk non-isolated DB mode must be explicitly marked and reported.
- Write flow must remain Preview-only and MOCK-only.
- Do NOT touch Production DB.
- Do NOT touch hosted Preview DB until the local Docker gate passes and a later phase explicitly authorizes it.
- Do NOT touch Production Blob/storage.
- Do NOT change Vercel env.
- Do NOT run production DB migrations.
- Do NOT add more migrations unless the user starts a separate schema phase with explicit scope.
- Do NOT write to Production DB.
- Do NOT call real generation.
- Do NOT call Render worker claim/result/progress endpoints.
- Do NOT expose Render secrets to browser/client code.
- Do NOT add NEXT_PUBLIC Render secrets.
- Do NOT implement Baz wallet/ledger or real balance mutation.
- Do NOT implement worker portal.
- Do NOT implement Super Admin console.
- Do NOT implement desktop Control Center.
- Do NOT implement installer.
- Do NOT implement real generation.
- Do NOT add secrets.

TASKS:
1. Inspect baseline with git status, HEAD, and validation scripts.
2. Re-run the pinned Render read-only checker before enabling any write flow.
3. Use local Docker Postgres only; do not run hosted Preview or Production migrations.
4. Confirm the disposable local DB schema remains migrated.
5. Reproduce the local Docker E2E against `http://127.0.0.1:3100`.
6. Investigate whether ai-media-service commit `39168ae167c69aca3c01ae59368323dc5658b88f` is deployed and why the deployed MOCK create path still returns HTTP 500. Use read-only contract/source/log evidence first; mutation is allowed only through the guarded local E2E path.
7. If Render MOCK job creation succeeds, continue status sync and verify one app-owned provider job mirror.
8. Keep browser-to-Render direct access forbidden.
9. Run validation gates and document remaining blockers.

FALLBACK:
If Render access is not available, do not fake verification. Document the missing read-only evidence and keep write compatibility pending.

ALTERNATIVE SAFE NEXT PHASES:
1. Hosted Preview MOCK write E2E only after local Docker MOCK E2E passes.
2. Bazar Baz AI platform schema/migration planning only after Preview/Render gates are ready.
3. App-managed storage import implementation is complete (`BAZAR-BAZ-AI-MEDIA-APP-MANAGED-MOCK-RESULT-IMPORT-01`). Next: harden end-to-end import against the disposable local Docker Postgres E2E.
4. Baz ledger implementation after schema planning approval.
```

## Fallback Note

Preview env verification tooling is available for redacted/human-provided evidence. If KiloCode/AI does not have Vercel/Preview access, do not fake verification. No Production write flow is allowed until Preview isolation, pinned Render contract verification, and explicit write-flow rules are all proven.
