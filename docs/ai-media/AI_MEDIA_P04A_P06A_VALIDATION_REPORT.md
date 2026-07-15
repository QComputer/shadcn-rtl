# AI Media P04A-P06A Validation Report

Date: 2026-07-15

## Status

BB-AI-MEDIA-P04A-P06A remains accepted locally. BB-AI-MEDIA-P06A hardening adds a production import-graph boundary, PostgreSQL-backed concurrent idempotency coverage, local UI locale validation, a deployed read-only contract check, and a prepared P07 controlled Production import runbook.

## Confirmed

- Application-owned storage gateway exists.
- Direct Blob access is removed from AI-media feature code.
- Production adapter is server-only.
- Local test adapter is server-only and refuses production.
- Browser storage access: none.
- Render Blob access: none.
- GPU worker Blob access: none.
- Codex direct Production Blob access: none.
- Production Blob credentials retrieved: no.
- Production Blob objects listed: no.
- Production Blob uploads: zero.
- Production Blob deletions: zero.
- Local PostgreSQL migrations are current.
- Hermetic lifecycle passed with MOCK provider and local storage.
- Hermetic concurrent idempotency matrix passed with 10-way duplicate submit, payload conflict, cross-tenant same-key isolation, provider accepted/lost-response recovery, and concurrent result ingestion.
- Real Render/GPU generation remains disabled.
- Deployed Preview acceptance is deferred.
- Production import graph is source-hardened: `lib/storage/application-storage.ts` no longer imports or constructs the local test adapter. Local test storage is injected only by hermetic test harnesses.

## Last Hermetic Run

```json
{
  "ok": true,
  "localJobsCreated": 2,
  "localAssetsCreated": 1,
  "storageObjectsCreated": 2,
  "provider": "MOCK",
  "storage": "LOCAL_TEST",
  "realGpuOperation": false
}
```

## Last Concurrent Hermetic Run

```json
{
  "ok": true,
  "sameTenantDuplicate10": "one-job",
  "payloadConflict": "409",
  "crossTenantSameKey": "distinct-jobs",
  "providerAcceptedResponseLost": "recovered-without-duplicate-provider-work",
  "concurrentIngestion": "one-storage-object",
  "providerJobs": 1,
  "storageObjectsCreated": 1,
  "productionBlobCalls": 0
}
```

## Validation Commands

Passed:

- `pnpm install --frozen-lockfile`
- `pnpm run db:generate`
- `pnpm run db:validate`
- local `pnpm exec prisma migrate status --schema=prisma/schema.prisma --config=prisma.config.ts`
- `pnpm run quality:neon-serverless-runtime`
- `pnpm run test:neon-serverless-runtime`
- `pnpm run quality:ai-media`
- `pnpm run quality:ai-media-application-storage-boundary`
- `pnpm run quality:ai-media-no-direct-production-blob`
- `pnpm run quality:ai-media-local-storage-adapter`
- `pnpm run quality:ai-media-local-db-guard` with hermetic local env
- `pnpm run quality:ai-media-contract-mock`
- `pnpm run quality:ai-media-mock-lifecycle`
- `pnpm run quality:ai-media-idempotency`
- `pnpm run quality:ai-media-status-sync`
- `pnpm run quality:ai-media-result-ingestion`
- `pnpm run quality:ai-media-tenant-isolation`
- `pnpm run quality:ai-media-creative-studio-ui`
- `pnpm run quality:ai-media-production-disabled`
- `pnpm run quality:ai-media-external-preview-deferred`
- `pnpm run quality:ai-media-production-import-graph`
- `pnpm run quality:ai-media-concurrent-idempotency`
- `pnpm run quality:ai-media-locale-ui`
- `pnpm run quality:ai-media-p07-runbook`
- `pnpm run quality:ai-media-durable-storage`
- `pnpm run quality:ai-media-output-security`
- `pnpm run quality:ai-media-product-image-lifecycle`
- `pnpm run quality:ai-media-server-boundary`
- `pnpm run quality:ai-media-render-contract`
- `pnpm run test:ai-media:hermetic`
- `pnpm run quality:creative-studio-product-image-generation`
- `pnpm run quality:creative-studio-organization-brand-provider-execution`
- `pnpm run quality:creative-studio-provider-result-ingestion`
- `pnpm run quality:dashboard-route-authorization`
- `pnpm run quality:dashboard-route-parity`
- `pnpm run quality:source-baseline`
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run build`
- `git diff --check`
- read-only deployed health smoke against `https://www.bazar-baz.ir`
- read-only deployed AI-media smoke against `https://www.bazar-baz.ir`

Notes:

- `pnpm run lint` previously passed with existing warnings; rerun for this hardening phase is tracked in the phase final report.
- A stale pre-hardening `.next` bundle can still contain old local-adapter traces. The production import-graph validator is intended to be run after a fresh `pnpm run build` for final bundle proof.
- `quality:ai-media-local-db-guard` fails closed without local database/storage env and passes with the hermetic local env.
- `pnpm run quality:local` remains a broad-suite gate with historical blockers outside this phase; classify its output in the final report when rerun.

`quality:local` residual blockers observed:

- P96 open fields audit
- P97 PWA foundation
- P98 PWA offline shell
- P99 notification preferences
- P102 notification routing
- P104 deployed PWA Push SMS
- P105 production rollout runbook
- P106 PWA Push SMS acceptance
- P107 Creative Studio planning
- P108 Creative Studio foundation
- P109 Creative Studio dashboard
- P110 Creative Studio apply controls
- P111 Creative Studio generation readiness
- P113 Creative Studio generated asset selection
- P115 Creative Studio organization brand request controls
- P116 Creative Studio organization brand acceptance
- P117 Creative Studio organization brand provider rollout
- P120 Creative Studio reviewed asset apply
- P29 public experience (`app/[locale]/page.tsx uses PublicImage`)
- P80 aggregate runner spawn issue (`spawnSync pnpm.cmd EINVAL`), while standalone `quality:ai-media` passed
- P94 AI media seller state UX

## Pending / Deferred

- Full authenticated browser click-through matrix across Persian, English, and Arabic remains a future deployed/local UI E2E enhancement. Source UI locale validation is repeatable through `pnpm run test:ai-media:hermetic:ui`.
- Deployed Preview MOCK lifecycle after isolated Preview resources exist.
- One controlled Production import only after separate explicit authorization.
