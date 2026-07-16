# AI Handoff - Current State

Date: 2026-07-16

## Repository Identity

- Repo path: `C:\Users\disso\Project\shadcn-rtl`
- Branch: `main`
- Current accepted baseline before this Render pinned contract read-only phase: `43034edf745fd52c4f9613e342c4ef4f909bfb68`
- This phase may add one later commit for Bazar-side pinned Render contract verification; run `git rev-parse HEAD` after validation for the final handoff hash.
- Project role: Bazar Baz main app (`bazar-baz.ir`)

## What `shadcn-rtl` Owns

- user accounts and authentication
- organizations and membership
- permissions and RBAC
- Bazar Baz UI and dashboard
- Baz wallet/ledger later; not implemented yet
- worker owner portal later; not implemented yet
- Super Admin network console later; not implemented yet
- AI media platform domain source design plus Preview MOCK write foundation schema/migration source
- imported media assets through application-managed storage for current product-image selection flow
- server-side Render integration via `lib/services/ai-media-service-client.ts`

## What `bazar-baz-ai-media-service` Owns

- Render coordinator
- queue and scheduling
- worker heartbeat and capability
- claim/lease/result flows
- machine scan/model recommendation
- trust/privacy routing
- contribution facts
- OpenAPI contract (`/openapi.json`)

## Accepted Local/Project Phases

- PRE-P07 AI media network status mapping accepted and committed (`3ed6367`)
- Preview isolation source gate accepted and committed (`40d2b2d`)
- Handoff/snapshot baseline accepted and committed (`a890a0f`)
- Preview env verification tooling accepted and committed (`bbdcf0a`)
- AI job mirror source design accepted and committed (`8a52533`)
- AI media platform domain foundation accepted and committed (`43034ed`)
- Bazar-side pinned Render contract read-only tooling accepted and committed (`cdaa011`)
- Preview MOCK write foundation accepted and committed (`c0a1260`): app-owned mirror schema source, server-only services, fail-closed guard, guarded route skeletons, tests, and docs
- Preview MOCK write E2E source gate is being added in this phase: Preview DB identity guard with isolated and explicit accepted-risk non-isolated modes, guarded Render MOCK create/status flow, tests, validator, and docs
- AI media roadmap docs added under `docs/ai-media/`
- Existing P02-P06 app-managed storage and import bridges remain in source

## Current Important Commits

- Current accepted HEAD before Preview MOCK write foundation: `cdaa01174c26e5b70109e308dea628f7a91e285d`
- Service-side deployed commit: `7c2381fb7041fcfc9627600240fc203ac5493f55`
- Service-side docs commit that pinned deployment: `96dd5c4ab80ed14498c46d441502ce48a68e1fbb`
- Pinned Render URL: `https://bazar-baz-ai-media-service.onrender.com`
- Pinned OpenAPI fingerprint: `8bed184dd79980beacc553308652a44d99590c9705b7d37ab9418f4f83868f91`
- Pinned OpenAPI surface: 42 paths, 40 schemas
- shadcn-rtl pinned Render verifier uses the same OpenAPI fingerprint algorithm as ai-media-service: sorted compact `app.openapi()` JSON, UTF-8 SHA-256, and FastAPI/Pydantic `.0` numeric constraint preservation.

## Current Safety Boundaries

- Browser never calls Render directly.
- Render credentials are server-only in `lib/services/ai-media-service-client.ts`.
- No `NEXT_PUBLIC_*` Render secrets in `.env.example` or source.
- AI write flows remain disabled in Production. Preview MOCK writes remain fail-closed unless explicit Preview evidence, pinned Render contract evidence, feature flag, provider `MOCK`, real-generation disabled state, SUPER_ADMIN role, and either isolated Preview DB proof or explicit accepted-risk non-isolated MOCK E2E approval are all present.
- Preview env verification tooling is read-only and accepts redacted/human-provided evidence only.
- AI job mirror source design is pure TypeScript and documentation only; it performs no DB, Render, Blob, or storage operation.
- AI platform domain foundation is pure TypeScript and documentation only; import planning performs no storage writes, Baz spend planning performs no ledger/balance mutation, and contribution mirror planning performs no reward settlement.
- Pinned Render contract verification is read-only and calls only `/health`, `/ready`, and `/openapi.json`.
- The pinned Render checker does not require secrets and does not call job creation, worker claim, worker progress, worker result, cancel, Blob, DB, or AI write endpoints.
- Baz wallet/ledger is not implemented yet.
- Worker portal is not implemented yet.
- Super Admin console is not implemented yet.
- Real generation is blocked.
- P07 not ready.

## Current AI Media Request/Mirror State

- Current runtime handling is product-image specific through `AiMediaJob`, `AiMediaUsageEvent`, and Creative Studio product-image routes.
- Local job rows are created before provider submission, then updated with provider job id/status after Render accepts.
- Status mapping is centralized in `lib/ai-media/status.ts`.
- Application-managed storage is used when a generated product image is selected for durable product media.
- The broader future app-owned mirror model is now documented in `docs/ai-media/AI_MEDIA_JOB_MIRROR_SOURCE_DESIGN.md` and represented by pure helpers in `lib/ai-media/job-mirror.ts`.
- Platform domain planning helpers now live in `lib/ai-media/platform-domain.ts`, `lib/ai-media/import-planning.ts`, `lib/ai-media/baz-spend-planning.ts`, and `lib/ai-media/contribution-mirror.ts`.
- Pinned Render contract constants live in `lib/ai-media/pinned-render-contract.ts`.
- Pinned Render contract evidence verification lives in `lib/ai-media/render-contract-verification.ts`.
- Live read-only Render quality gate lives in `scripts/quality/validate-ai-media-render-contract-readonly.mts`.
- Live read-only Render verification currently passes with `/health` 200, `/ready` 200, `/openapi.json` 200, provider `MOCK`, 42 paths, 40 schemas, and matching fingerprint `8bed184dd79980beacc553308652a44d99590c9705b7d37ab9418f4f83868f91`.
- Preview MOCK write foundation schema source now adds `AiMediaRequest`, `AiMediaJobMirror`, `AiMediaJobEvent`, `AiMediaImport`, `AiMediaAsset`, `AiMediaUsageQuote`, `AiMediaSpendHold`, and `WorkerContributionMirror`.
- Server-only persistence skeletons live in `lib/services/ai-media-platform-request-service.ts`, `lib/services/ai-media-job-mirror-service.ts`, `lib/services/ai-media-import-service.ts`, and `lib/services/ai-media-contribution-mirror-service.ts`.
- Preview write guard lives in `lib/ai-media/preview-write-guard.ts`.
- Preview DB identity guard lives in `lib/ai-media/preview-db-identity-guard.ts`. Identical `DATABASE_URL` and `DIRECT_URL` values inside Preview are warnings only; separation is checked against Production evidence, or the phase must use the explicit accepted-risk non-isolated marker.
- Preview route skeletons live under `app/api/dashboard/ai-media/preview/jobs`.
- Preview MOCK write E2E service lives in `lib/services/ai-media-preview-mock-write-service.ts`. It can call the pinned Render MOCK product-image create/status endpoints only after the route guards pass.
- Local Docker MOCK E2E is now the preferred intermediate gate before hosted Preview writes. A disposable Docker Postgres database was migrated locally, a synthetic `SUPER_ADMIN` organization fixture was used, and the local Bazar Baz route created app-owned request/mirror/event rows without touching hosted Production or Preview DBs after the Docker-priority update.
- The local Docker E2E currently reaches Render MOCK submission but the deployed coordinator returns HTTP 500 on product-image job creation. The Bazar app records this failure safely as request `FAILED`, mirror `FAILED_RETRYABLE`, `PROVIDER_ERROR`, with sanitized status payload and no provider job id.
- Production migration execution has not been authorized or run for this phase.
- Preview migration execution has not been run by source validation unless explicitly recorded in the phase report.
- Operator-accepted DB resume update: `20260716000100_ai_media_preview_mock_write_foundation` was applied with DB guard mode `ACCEPTED_RISK_NON_ISOLATED_DB` after explicit operator acceptance of temporary DB write risk. Live Preview MOCK E2E remains blocked by missing local `AI_MEDIA_PREVIEW_SESSION_COOKIE` and Vercel SSO-protected Preview access.

## Current Blockers

- Local Docker MOCK E2E remains partial because the deployed Render MOCK coordinator returns HTTP 500 for the product-image create mutation.
- Preview live MOCK write E2E remains pending until local Docker MOCK E2E passes, then the active runtime proves isolated Preview DB identity, or the operator enables the explicit accepted-risk non-isolated MOCK E2E marker, and the explicit E2E flag is set.
- Preview session/protection-bypass access for running the live E2E against `https://shadcn-kpuh90kko-ahmads-projects-1b4ce1dc.vercel.app`
- app-owned request/mirror services are source-ready but fail closed by guard
- app-managed storage import flow for future general AI media assets
- Baz ledger and internal spend holds
- worker portal
- Super Admin console
- privacy-aware routing
- Preview write E2E
- P07 controlled Production import

## Recommended Next Phase

Safe next choices:

1. `BAZAR-BAZ-AI-NETWORK-LOCAL-DOCKER-MOCK-E2E-RECOVERY-01`: resolve the deployed Render MOCK create 500, then rerun the local Docker E2E before hosted Preview writes.
2. `BAZAR-BAZ-AI-NETWORK-PREVIEW-MOCK-WRITE-E2E-FOUNDATION-01`: Preview-only MOCK write E2E foundation, but only after the local Docker gate passes and explicit write-flow rules plus isolated Preview resources are proven.
3. `BAZAR-BAZ-AI-NETWORK-PLATFORM-SCHEMA-MIGRATION-PLAN-01`: Bazar Baz AI platform schema/migration planning only after Preview/Render gates are ready and migration authorization is explicit.
4. `BAZAR-BAZ-AI-NETWORK-APP-MANAGED-IMPORT-IMPLEMENTATION-01`: app-managed storage import implementation after schema and storage isolation.
5. `BAZAR-BAZ-BAZ-LEDGER-FOUNDATION-01`: Baz ledger implementation after schema planning approval.

Do not activate AI writes, wallet settlement, Render writes, Blob writes, or Production import until separately authorized.
