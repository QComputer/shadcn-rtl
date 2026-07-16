# AI Handoff - Current State

Date: 2026-07-16

## Repository Identity

- Repo path: `C:\Users\disso\Project\shadcn-rtl`
- Branch: `main`
- Current accepted baseline before platform domain foundation: `8a5253322ad43f2ec3ea22265eb7c619b5e2d86e`
- This phase may add one later local commit for platform domain foundation; run `git rev-parse HEAD` after validation for the final handoff hash.
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
- AI media platform domain foundation added in this phase once `test:ai-media:platform-domain` and `quality:ai-media-platform-domain` pass
- AI media roadmap docs added under `docs/ai-media/`
- Existing P02-P06 app-managed storage and import bridges remain in source

## Current Important Commits

- Current baseline HEAD before platform domain foundation: `8a5253322ad43f2ec3ea22265eb7c619b5e2d86e`
- Service-side HEAD: not tracked locally; Render deployed contract fingerprint is still pending

## Current Safety Boundaries

- Browser never calls Render directly.
- Render credentials are server-only in `lib/services/ai-media-service-client.ts`.
- No `NEXT_PUBLIC_*` Render secrets in `.env.example` or source.
- AI write flows remain disabled until Preview isolation and Render compatibility are proven.
- Preview env verification tooling is read-only and accepts redacted/human-provided evidence only.
- AI job mirror source design is pure TypeScript and documentation only; it performs no DB, Render, Blob, or storage operation.
- AI platform domain foundation is pure TypeScript and documentation only; import planning performs no storage writes, Baz spend planning performs no ledger/balance mutation, and contribution mirror planning performs no reward settlement.
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
- Future schema fields and rollout risks are proposed in `docs/ai-media/AI_MEDIA_PLATFORM_DOMAIN_SCHEMA_PROPOSAL.md`; no Prisma schema or migration has been added.
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
2. `BAZAR-BAZ-AI-NETWORK-PLATFORM-SCHEMA-MIGRATION-PLAN-01`: Bazar Baz AI platform schema/migration planning only after Preview/Render gates are ready and migration authorization is explicit.
3. `BAZAR-BAZ-AI-NETWORK-APP-MANAGED-IMPORT-IMPLEMENTATION-01`: app-managed storage import implementation after schema and storage isolation.
4. `BAZAR-BAZ-BAZ-LEDGER-FOUNDATION-01`: Baz ledger implementation after schema planning approval.

Do not activate AI writes, wallet settlement, Render writes, Blob writes, or Production import until separately authorized.
