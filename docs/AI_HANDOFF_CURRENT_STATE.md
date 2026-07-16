# AI Handoff - Current State

Date: 2026-07-16

## Repository Identity

- Repo path: `C:\Users\disso\Project\shadcn-rtl`
- Branch: `main`
- Current accepted baseline before AI job mirror source design: `bbdcf0a2705ff8eeaced6be27c21212c84b148d4`
- This phase may add one later local commit for AI job mirror source design; run `git rev-parse HEAD` after validation for the final handoff hash.
- Project role: Bazar Baz main app (`bazar-baz.ir`)

## What `shadcn-rtl` Owns

- user accounts and authentication
- organizations and membership
- permissions and RBAC
- Bazar Baz UI and dashboard
- Baz wallet/ledger later; not implemented yet
- worker owner portal later; not implemented yet
- Super Admin network console later; not implemented yet
- AI media request and job mirror source design; no DB schema or migration yet
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
- AI job mirror source design added in this phase once `test:ai-media:job-mirror-design` and `quality:ai-media-job-mirror-design` pass
- AI media roadmap docs added under `docs/ai-media/`
- Existing P02-P06 app-managed storage and import bridges remain in source

## Current Important Commits

- Current baseline HEAD before AI job mirror source design: `bbdcf0a2705ff8eeaced6be27c21212c84b148d4`
- Service-side HEAD: not tracked locally; Render deployed contract fingerprint is still pending

## Current Safety Boundaries

- Browser never calls Render directly.
- Render credentials are server-only in `lib/services/ai-media-service-client.ts`.
- No `NEXT_PUBLIC_*` Render secrets in `.env.example` or source.
- AI write flows remain disabled until Preview isolation and Render compatibility are proven.
- Preview env verification tooling is read-only and accepts redacted/human-provided evidence only.
- AI job mirror source design is pure TypeScript and documentation only; it performs no DB, Render, Blob, or storage operation.
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
- No general `AiMediaRequest`, `AiMediaJobMirror`, event stream, quote, spend hold, contribution mirror, or wallet ledger schema exists yet.

## Current Blockers

- deployed Render contract pinning/read-only compatibility
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

1. `BAZAR-BAZ-AI-NETWORK-RENDER-CONTRACT-PINNING-READONLY-01`: read-only deployed Render health/readiness/OpenAPI fingerprint pinning. No write flow.
2. `BAZAR-BAZ-AI-NETWORK-AI-JOB-MIRROR-SCHEMA-PLAN-01`: schema and migration planning only, if Preview/Render gates are ready and migration authorization is explicit.
3. `BAZAR-BAZ-AI-NETWORK-APP-MANAGED-IMPORT-SOURCE-DESIGN-01`: source-only design for general result ingestion and storage import if staying fully source-safe.

Do not activate AI writes, wallet settlement, Render writes, Blob writes, or Production import until separately authorized.
