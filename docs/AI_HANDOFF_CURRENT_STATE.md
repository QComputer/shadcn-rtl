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

- Context-aware public footer (`BAZAR-BAZ-CONTEXT-AWARE-PUBLIC-FOOTER-01`) is implemented in source: platform pages keep the Bazar Baz footer, shop/custom-domain shop pages render a shop footer, appointment/service organization pages render an organization footer, and dashboard/auth shells suppress public footers. No Prisma migration was added.
- Shop in-page category filtering (`BAZAR-BAZ-SHOP-IN-PAGE-CATEGORY-FILTER-01`) is implemented in source: public shop category controls now filter the already-loaded menu products in place with button/pressed-state controls, preserve the current shop pathname, and keep direct category routes as compatibility pages. No Prisma migration was added.
- Custom-domain category routing hotfix (`BAZAR-BAZ-CUSTOM-DOMAIN-CATEGORY-ROUTING-HOTFIX-01`) is implemented in source: public shop URL construction is centralized in `lib/shop-public-paths.ts`, custom-domain category links now use `/category/<categorySlugOrId>`, platform category links remain `/<locale>/shop/<slug>/category/<categorySlugOrId>`, and the shop category page uses the shared helper for redirects, pagination, product links, and JSON-LD URLs. No Prisma migration was added.
- Product/service AI-media attachment source gate is implemented in this phase:
  nullable `Product.aiPrimaryMediaAssetId` and `Service.aiPrimaryMediaAssetId`,
  entity-scoped attach/detach APIs, safe public media routes, dashboard picker
  integration, unit/static gates, and disposable local Docker MOCK E2E.
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
- App-managed MOCK result import is implemented and committed in this phase: `provider-result-validation.ts`, `ai-media-result-import-service.ts`, guarded import route, unit tests, quality validator, local Docker E2E runner, and docs
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
- Rerun after reported ai-media-service fix `39168ae167c69aca3c01ae59368323dc5658b88f`: Render read-only health/ready stayed green, but guarded Bazar-to-Render MOCK create still returned HTTP 500. The local Docker gate remains partial and no provider job id was stored.
- Final rerun after deployed ai-media-service schema readiness fix `81f8c2cf6d95a8eaeaacc6fe45505f29854ad83a`: `/ready` reported `coordinatorSchema.ready=true` and `/diagnostics/version` matched the deployed commit, but guarded Bazar-to-Render MOCK create still returned HTTP 500. The local Docker gate remains partial.
- App-managed MOCK result import (`BAZAR-BAZ-AI-MEDIA-APP-MANAGED-MOCK-RESULT-IMPORT-01`) is now implemented: a pure provider-result validator (`lib/ai-media/provider-result-validation.ts`), a server-only import service (`lib/services/ai-media-result-import-service.ts`), a guarded Preview import route (`app/api/dashboard/ai-media/preview/jobs/[id]/import/route.ts`), local test storage usage for tests, unit tests, a quality validator, and a disposable local Docker E2E runner. The flow imports a completed `MOCK` `RESULT_READY` result through the application storage gateway into `AiMediaImport` (IMPORTED) + `AiMediaAsset`, then marks `AiMediaJobMirror` IMPORTED. Idempotency returns the canonical asset with no second storage write and no duplicate asset. No Production DB, no hosted Preview DB, no Production Blob, no browser Render secrets, and no Baz wallet mutation.
- Local Docker MOCK E2E recovery (`BAZAR-BAZ-AI-NETWORK-LOCAL-DOCKER-MOCK-E2E-RECOVERY-01`) is now implemented: a local contract mock runner (`scripts/ai-media/local-contract-mock.mjs`) reused for the create/status-sync path, a disposable Docker Postgres create+sync E2E wrapper + service-level flow (`scripts/e2e/ai-media-local-docker-create-sync.mjs` / `.mts`), and a quality validator (`scripts/quality/validate-ai-media-local-docker-create-sync.mjs`). The flow exercises `submitPreviewMockAiMediaJob` (create) and `syncPreviewMockAiMediaJobStatus` (status sync) against the local contract mock, proves one app-owned `AiMediaJobMirror` reaches `RESULT_READY` with a stored provider job id, and confirms idempotent reuse. No Render coordinator dependency; no Production/hosted-Preview DB, Blob, or browser-secret exposure. Docs in `docs/ai-media/AI_MEDIA_LOCAL_DOCKER_MOCK_E2E_RECOVERY.md`.
- Imported asset consumption (`BAZAR-BAZ-AI-MEDIA-ASSET-CONSUMPTION-01`) is now implemented: a server-only asset service (`lib/services/ai-media-asset-service.ts`), a reusable pure visibility helper (`lib/ai-media/asset-visibility.ts`), a selection abstraction (`lib/services/ai-media-asset-selection-service.ts`), guarded API routes (`/api/dashboard/ai-media/assets`, `/[id]`, `/[id]/content`), a minimal localized dashboard UI (`app/[locale]/dashboard/ai-media/assets/page.tsx`), unit tests, a local Docker consumption E2E, a quality validator, and docs. The flow exposes only canonical `IMPORTED` assets, scoped by organization, with no provider URLs, no storage credentials, no browser-to-Render calls, and no Production writes. Docs in `docs/ai-media/AI_MEDIA_IMPORTED_ASSET_CONSUMPTION.md`.
  - A `storageKey` column was added to `AiMediaAsset` (migration `20260717200000_add_ai_media_asset_storage_key`, nullable, additive) because `storageKeyFingerprint` is a SHA-256 hash and cannot be reversed to serve content. New imports persist `storageKey`; legacy rows without it remain hidden by the usable-asset rule until backfilled. `storageKey` is server-only and never exposed via API or client serialization.
  - A server-only feature guard (`lib/ai-media/asset-consumption-feature-guard.ts`) keeps Production fail-closed before the `storageKey` migration is explicitly approved. The guard runs before any Prisma query in all asset routes/services.
- Product/service AI-media attachment (`BAZAR-BAZ-AI-MEDIA-PRODUCT-SERVICE-ATTACHMENT-01`) is implemented in source and remains `CODE_COMPLETE_PENDING_PRODUCTION_MIGRATION_AND_DEPLOYMENT`. It links already imported assets to Product and Service primary media via entity references, serves public media through entity-scoped routes, and keeps replacement/detach idempotent without deleting assets or exposing storage keys/provider URLs.
- Production migration execution has not been authorized or run for this phase. Use `docs/ai-media/AI_MEDIA_PRODUCT_SERVICE_ATTACHMENT_PRODUCTION_ROLLOUT.md` for the preparation-only rollout runbook before any Production mutation.
- The custom-domain category routing hotfix does not require the Product/Service AI-media attachment migration. Public category route reads remain guarded by `canReadAiMediaEntityAttachmentColumns()` and Production AI-media attachment migration status remains unauthorized/unconfirmed.
- Preview migration execution has not been run by source validation unless explicitly recorded in the phase report.
- Database migration chain recovery (`BAZAR-BAZ-DATABASE-MIGRATION-CHAIN-RECOVERY-01`) is now implemented: the conflicting migration `20260707000200_export_hub_extend_data_types` was corrected in place to use the repository's guarded idempotent enum-extension pattern (`DO $$ ... IF NOT EXISTS ... pg_enum ...`). The original SQL attempted `ALTER TYPE "ExportDataType" ADD VALUE 'CUSTOMERS'` / `'FANPAGE_POSTS'`, both of which already exist from `20260628000300_export_hub_foundation`, causing PostgreSQL `42710` and Prisma `P3018`/`P3009` failures. The corrected SQL creates no new schema objects and converges to the same final `ExportDataType` enum. Disposable local Docker PostgreSQL proofs (fresh, upgrade, and authentic Prisma failed-state recovery) all pass; `prisma migrate deploy` applies all 52 migrations with 0 active-failed, and the latest `storageKey` migration applies locally. Full Prisma schema parity is NOT PROVEN — unrelated historical drift (ImageAccess/DomainStatus enum variants, renamed indexes) remains and is documented as a separate future database-normalization phase.
  - The migration execution chain is locally proven; the targeted enum conflict is fixed; the `storageKey` migration deploys locally.
  - Production migration has not been run; Production asset-consumption remains disabled via the server-only feature guard.
  - Future Production activation requires migration-history inspection and a verified backup (prerequisites only, not executed).
  - Tooling: `test:db:migration-chain`, `e2e:db:migration-chain-fresh`, `e2e:db:migration-chain-upgrade`, `e2e:db:migration-chain-failed`, `quality:db:migration-chain`. Docs in `docs/database/DATABASE_MIGRATION_CHAIN_RECOVERY.md`.
- Database schema drift normalization (`BAZAR-BAZ-DATABASE-SCHEMA-DRIFT-NORMALIZATION-01`) is now the active database phase in source. It introduces the forward migration `20260719000000_normalize_schema_drift`, local-only Docker proof tooling, a quality validator, and `docs/database/DATABASE_SCHEMA_DRIFT_NORMALIZATION.md` to normalize `ImageAccess`, `DomainStatus`, FK/default/timestamp drift, and naming-only index drift. Complete Prisma migration/schema parity is proven only after both fresh and upgrade schema-drift gates pass with empty final diffs.
- Operator-accepted DB resume update: `20260716000100_ai_media_preview_mock_write_foundation` was applied with DB guard mode `ACCEPTED_RISK_NON_ISOLATED_DB` after explicit operator acceptance of temporary DB write risk. Live Preview MOCK E2E remains blocked by missing local `AI_MEDIA_PREVIEW_SESSION_COOKIE` and Vercel SSO-protected Preview access.

## Current Blockers

- Local Docker MOCK E2E create/status-sync recovery is implemented and passes against the local contract mock (disposable Docker Postgres only). The deployed Render MOCK coordinator HTTP 500 is not reproduced locally; the app-side create + status-sync path is proven correct and MOCK-compatible. Hosted Render MOCK create remains untouched and would still need external verification before live Preview E2E.
- Preview live MOCK write E2E remains pending until local Docker MOCK E2E passes, then the active runtime proves isolated Preview DB identity, or the operator enables the explicit accepted-risk non-isolated MOCK E2E marker, and the explicit E2E flag is set.
- Preview session/protection-bypass access for running the live E2E against `https://shadcn-kpuh90kko-ahmads-projects-1b4ce1dc.vercel.app`
- app-owned request/mirror services are source-ready but fail closed by guard
- Baz ledger and internal spend holds
- worker portal
- Super Admin console
- privacy-aware routing
- Preview write E2E
- P07 controlled Production import

## Recommended Next Phase

Safe next choices:

1. `BAZAR-BAZ-DATABASE-SCHEMA-DRIFT-NORMALIZATION-01`: finish and accept complete local Prisma migration/schema parity.
2. `BAZAR-BAZ-AI-MEDIA-PRODUCT-SERVICE-ATTACHMENT-01`: attach imported AI assets to products/services after parity is proven.
3. `SERVICE-AI-RESULT-EVIDENCE-CONTRACT-01` in `bazar-baz-ai-media-service`: only after attachment requirements identify exact provider-result evidence needs.
4. AI asset library lifecycle hardening.
5. End-user MOCK generation workflow.

Do not activate AI writes, wallet settlement, Render writes, Blob writes, or Production import until separately authorized.
