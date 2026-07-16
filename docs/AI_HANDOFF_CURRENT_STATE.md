# AI Handoff — Current State

Date: 2026-07-16

## Repository Identity

- Repo path: `C:\Users\disso\Project\shadcn-rtl`
- Branch: `main`
- Current HEAD: `40d2b2d60e64597fc9628819ebc2458d5749df96`
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
- AI media roadmap docs added under `docs/ai-media/`
- Existing P02–P06 app-managed storage and import bridges remain in source

## Current Important Commits

- Local HEAD: `40d2b2d60e64597fc9628819ebc2458d5749df96`
- Service-side HEAD: not tracked locally; Render deployed contract fingerprint is still pending

## Current Safety Boundaries

- Browser never calls Render directly.
- Render credentials are server-only in `lib/services/ai-media-service-client.ts`.
- No `NEXT_PUBLIC_*` Render secrets in `.env.example` or source.
- AI write flows remain disabled until Preview isolation is proven.
- Baz wallet/ledger is not implemented yet.
- Worker portal is not implemented yet.
- Super Admin console is not implemented yet.
- Real generation is blocked.
- P07 not ready.

## Current Blockers

- real Preview env verification
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
- BAZAR-BAZ-AI-NETWORK-PREVIEW-ENV-VERIFICATION-READONLY-01
- verify Preview env separation using read-only diagnostics only
- no AI writes, no Blob writes, no migrations, no deploy unless explicitly authorized

If Vercel/Preview access is not available:
- source-only AI job mirror design docs
- no write flow until Preview isolation and Render pinning are proven
