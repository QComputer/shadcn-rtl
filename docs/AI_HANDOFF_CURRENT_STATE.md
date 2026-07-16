# AI Handoff — Current State

Date: 2026-07-16

## Repository Identity

- Repo path: `C:\Users\disso\Project\shadcn-rtl`
- Branch: `main`
- Current HEAD: `a890a0fb88f718b1e269e519e7d87d4360f7035f`
- This phase may add a later commit for Preview env verification tooling; run `git rev-parse HEAD` after validation for the final handoff hash.
- Project role: Bazar Baz main app (`bazar-baz.ir`)

## What `shadcn-rtl` Owns

- user accounts and authentication
- organizations and membership
- permissions and RBAC
- Bazar Baz UI and dashboard
- Baz wallet/ledger (not implemented yet)
- worker owner portal (not implemented yet)
- Super Admin network console (not implemented yet)
- AI media request mirror (not implemented yet)
- imported media assets (not implemented yet)
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
- Preview env verification tooling added in source for read-only human-provided evidence review
- AI media roadmap docs added under `docs/ai-media/`
- Existing P02–P06 app-managed storage and import bridges remain in source

## Current Important Commits

- Local HEAD before Preview env verification tooling: `a890a0fb88f718b1e269e519e7d87d4360f7035f`
- Service-side HEAD: not tracked locally; Render deployed contract fingerprint is still pending

## Current Safety Boundaries

- Browser never calls Render directly.
- Render credentials are server-only in `lib/services/ai-media-service-client.ts`.
- No `NEXT_PUBLIC_*` Render secrets in `.env.example` or source.
- AI write flows remain disabled until Preview isolation is proven.
- Preview env verification tooling is read-only and accepts redacted/human-provided evidence only.
- Baz wallet/ledger is not implemented yet.
- Worker portal is not implemented yet.
- Super Admin console is not implemented yet.
- Real generation is blocked.
- P07 not ready.

## Current Blockers

- real Preview env verification with operator-provided evidence or authorized read-only runtime outputs
- deployed Render contract pinning
- Bazar Baz AI job mirror
- app-managed storage import
- Baz ledger
- worker portal
- Super Admin console
- privacy-aware routing
- Preview write E2E
- P07

## Recommended Next Phase

If Vercel/Preview access is available:
- run BAZAR-BAZ-AI-NETWORK-PREVIEW-ENV-VERIFICATION-READONLY-01 evidence review using `docs/ai-media/AI_MEDIA_PREVIEW_ENV_VERIFICATION_READONLY.md`
- provide redacted Preview and Production fingerprints to `verifyAiMediaPreviewEnvironmentEvidence(...)`
- no AI writes, no Blob writes, no migrations, no deploy unless explicitly authorized

If Vercel/Preview access is not available:
- keep real Preview verification pending with human-provided outputs
- next safe source work is Render deployed contract pinning docs/tooling or AI job mirror source design
- no write flow until Preview isolation and Render pinning are proven
