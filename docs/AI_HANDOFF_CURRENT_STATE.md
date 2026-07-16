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
- AI media platform domain source design; no DB schema or migration yet
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
- Bazar-side pinned Render contract read-only tooling is added in this phase once `test:ai-media:render-contract-readonly` and `quality:ai-media-render-contract-readonly` pass
- AI media roadmap docs added under `docs/ai-media/`
- Existing P02-P06 app-managed storage and import bridges remain in source

## Current Important Commits

- Current baseline HEAD before Render pinned contract read-only tooling: `43034edf745fd52c4f9613e342c4ef4f909bfb68`
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
- AI write flows remain disabled until Preview isolation and Render compatibility are proven.
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
- Future schema fields and rollout risks are proposed in `docs/ai-media/AI_MEDIA_PLATFORM_DOMAIN_SCHEMA_PROPOSAL.md`; no Prisma schema or migration has been added.
- No general `AiMediaRequest`, `AiMediaJobMirror`, event stream, quote, spend hold, contribution mirror, or wallet ledger schema exists yet.

## Current Blockers

- Preview MOCK write E2E remains blocked until explicitly authorized by a separate write-flow phase
- real Preview env evidence with isolated DB/storage/AI identity if Preview write work resumes
- AI job mirror Prisma schema/migration, pending explicit migration phase
- app-owned request/mirror services, pending schema phase
- app-managed storage import flow for future general AI media assets
- Baz ledger and internal spend holds
- worker portal
- Super Admin console
- privacy-aware routing
- Preview write E2E
- P07 controlled Production import

## Recommended Next Phase

Safe next choices:

1. `BAZAR-BAZ-AI-NETWORK-PREVIEW-MOCK-WRITE-E2E-FOUNDATION-01`: Preview-only MOCK write E2E foundation, but only with explicit write-flow rules and isolated Preview resources.
2. `BAZAR-BAZ-AI-NETWORK-PLATFORM-SCHEMA-MIGRATION-PLAN-01`: Bazar Baz AI platform schema/migration planning only after Preview/Render gates are ready and migration authorization is explicit.
3. `BAZAR-BAZ-AI-NETWORK-APP-MANAGED-IMPORT-IMPLEMENTATION-01`: app-managed storage import implementation after schema and storage isolation.
4. `BAZAR-BAZ-BAZ-LEDGER-FOUNDATION-01`: Baz ledger implementation after schema planning approval.

Do not activate AI writes, wallet settlement, Render writes, Blob writes, or Production import until separately authorized.
