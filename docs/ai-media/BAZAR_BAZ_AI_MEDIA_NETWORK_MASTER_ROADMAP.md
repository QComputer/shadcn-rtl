# Bazar Baz AI Media Network — Master Roadmap for `shadcn-rtl`

## Scope

This roadmap belongs to the **Bazar Baz web platform** repository:

```text
C:\Users\disso\Project\shadcn-rtl
```

It defines the platform-side roadmap for building a distributed AI media network powered by user-run worker machines and a platform credit named **Baz**.

This document is intentionally focused on `shadcn-rtl`, not the worker runtime implementation.

## Strategic Summary

Bazar Baz will allow selected platform users to install and run AI media worker servers on their own machines. These machines join the Bazar Baz AI Media Network and provide compute capacity for AI media jobs.

Users who operate worker machines earn **Baz**, an internal Bazar Baz platform credit, based on verified and accepted compute contribution. They can spend Baz on Bazar Baz services.

The main wallet, accounting, user identity, organization ownership, monitoring UI, Super Admin network console, and Baz ledger live in `shadcn-rtl`.

## System Responsibilities

```text
shadcn-rtl / bazar-baz.ir
= user accounts
= organizations
= wallet and Baz ledger
= AI job request ownership
= AI job quote/spend/refund
= worker owner portal
= Super Admin network console
= imported media asset ownership
= access control
= privacy policy
= settlement/reward accounting

bazar-baz-ai-media-service / Render
= coordinator
= queue
= worker registry
= worker heartbeat
= capability scheduling
= job leases
= result intake
= network diagnostics
= contribution facts

desktop/local worker server
= local machine scan
= local runtime control
= model installation/download after confirmation
= worker process control
= safe self-monitoring for that worker only
```

## Core Architecture

```text
Bazar Baz user / organization
        |
        | creates AI media request
        v
Bazar Baz server-side API
        |
        | server-to-server only
        v
Render AI Media Coordinator
        |
        | heartbeat / claim / lease / result
        v
Distributed worker machines
```

## Non-Negotiable Boundaries

### Browser Boundary

Browser clients must never call Render directly with secrets.

All Render communication from Bazar Baz must be server-side.

### Render Boundary

Render is the central coordinator that makes distributed worker connections possible.

Render owns:
- queue coordination
- worker heartbeats
- worker capability state
- job claim/lease/result flows
- eligibility diagnostics

Render does **not** own the Bazar Baz wallet ledger.

### Desktop Worker Boundary

A desktop/local worker server must not expose job data, prompts, source files, uploaded files, generated images, or other users' media to normal users or worker operators.

The desktop worker server may expose safe local operational information:
- local machine status
- GPU/CUDA/model readiness
- current worker status
- safe logs
- connection state
- model download/install status
- own contribution summary if fetched from Bazar Baz

It must not become:
- a file browser for AI job outputs
- a gallery of generated images
- a prompt viewer
- a cross-user job inspector
- a source-data viewer

### Super Admin Exception

Only `SUPER_ADMIN` in Bazar Baz may monitor the full network.

SUPER_ADMIN may view:
- all workers
- all jobs
- all generated/imported files
- all queues
- all failed jobs
- all stuck jobs
- all Baz ledger movements
- fraud/reliability signals
- Render health
- worker heartbeat and lease state
- privacy-routing decisions

Normal users and worker operators must not see other users' files, prompts, job details, or generated media.

## Baz Credit

### Definition

**Baz** is the internal Bazar Baz credit unit that measures useful compute contribution and platform service consumption.

### V1 Policy

Baz is an internal platform credit in v1.

Baz must not be implemented as:
- a public cryptocurrency
- a tradable token
- a public market asset
- a fiat withdrawal balance
- an investment product

Baz may be:
- earned by accepted verified worker jobs
- spent on Bazar Baz services
- held pending during fraud/quality windows
- refunded
- adjusted by admins
- frozen/reversed in fraud cases

## Main Product Flows

### AI Job Spend Flow

```text
1. User requests AI media generation.
2. Bazar Baz calculates quote in Baz.
3. User confirms.
4. Bazar Baz creates Baz spend hold.
5. Bazar Baz submits job to Render server-side.
6. Render coordinates worker execution.
7. Worker reports result.
8. Bazar Baz imports and validates result.
9. If successful, hold is settled.
10. If failed, hold is released/refunded.
```

### Worker Earning Flow

```text
1. User registers a worker machine in Bazar Baz.
2. User configures worker software.
3. Worker connects to Render.
4. Worker reports capability.
5. Render leases eligible jobs to worker.
6. Worker completes job.
7. Render records contribution facts.
8. Bazar Baz validates/imports accepted result.
9. Bazar Baz creates pending Baz reward.
10. After fraud/quality window, reward settles.
```

## Main `shadcn-rtl` Roadmap

### Phase BB-AI-00 — Source of Truth and Docs

Add docs that define:
- Render coordinator boundary
- browser/server boundary
- worker privacy boundary
- Super Admin visibility
- Baz as internal credit
- wallet ownership in Bazar Baz
- UI-last strategy
- worker-network architecture

Suggested files:
- `docs/BAZAR_BAZ_AI_MEDIA_NETWORK_MASTER_ROADMAP.md`
- `docs/BAZAR_BAZ_AI_MEDIA_INTEGRATION_GATES.md`
- `docs/BAZAR_BAZ_BAZ_WALLET_LEDGER_ROADMAP.md`
- `docs/BAZAR_BAZ_WORKER_PORTAL_ROADMAP.md`
- `docs/BAZAR_BAZ_SUPERADMIN_AI_NETWORK_CONSOLE_ROADMAP.md`

### Phase BB-AI-01 — Server-Side Contract Mapping

Implement server-only parsing/mapping for AI media status payloads.

Support:
- `canonical_status`
- `queue_rank`
- `jobs_ahead`
- `eta_confidence`
- `worker_availability`
- worker status/class metadata
- no eligible worker
- workers busy
- GPU offline
- model missing

Rules:
- backward-compatible with older Render responses
- fail closed on unknown status
- no browser-to-Render calls
- Persian-first user-facing messages

### Phase BB-AI-02 — Preview Isolation Gate

Prove Preview isolation before any write flow:
- Preview DB is not Production DB
- Preview Blob/storage is not Production storage
- Preview Render identity is not Production identity
- Preview AI jobs cannot mutate Production state
- Preview imported files cannot affect Production files

No AI write flow until this is accepted.

### Phase BB-AI-03 — Bazar Baz AI Job Domain

Create platform-side job records in Bazar Baz.

Suggested entities:
- `AiMediaRequest`
- `AiMediaJobMirror`
- `AiMediaJobEvent`
- `AiMediaAsset`
- `AiMediaImport`
- `AiMediaUsageQuote`
- `AiMediaSpendHold`

Purpose:
- own user/org request state
- mirror Render job safely
- track status for UI
- connect imported result to product/logo/cover/etc.
- connect spend/refund to Baz ledger
- audit every transition

### Phase BB-AI-04 — App-Managed Storage Import

Bazar Baz must own final media storage.

Flow:
```text
Render/worker result
  -> Bazar Baz server import
  -> validation
  -> app-managed storage
  -> permissioned asset
```

Rules:
- normal users see only their own/org assets
- worker operators do not see job media
- SUPER_ADMIN can inspect all
- failed imports do not expose raw files
- every import has audit trail

### Phase BB-AI-05 — Baz Wallet Ledger Core

Implement the Baz accounting core in `shadcn-rtl`.

This is the source of truth for:
- wallet balances
- earned Baz
- pending Baz
- spent Baz
- refunds
- fraud holds
- settlements
- admin adjustments

Use immutable ledger entries. Do not rely only on mutable balance counters.

### Phase BB-AI-06 — Baz Spend for AI Jobs

Add AI media quote/hold/settlement/refund flow.

Before job submit:
- quote Baz price
- show refund policy
- require confirmation
- create hold

After result:
- settle hold if accepted
- refund/release hold if failed/cancelled/expired
- audit all debits/credits

### Phase BB-AI-07 — Worker Registration and Ownership

Allow users to register worker machines.

Features:
- create worker record
- generate worker token/secret
- revoke worker
- view own worker state
- link worker to user/org
- display safe capability summary
- show own earning summary

Normal users must not see other users' workers/jobs/media.

### Phase BB-AI-08 — Worker Contribution Records

Store contribution facts from AI media service.

Suggested fields:
- `workerId`
- `ownerUserId`
- `jobId`
- `jobType`
- `model`
- `provider`
- `machineClass`
- `startedAt`
- `finishedAt`
- `duration`
- `resultStatus`
- `accepted/imported status`
- `retryCount`
- `failureReason`
- `quality/fraud flags`
- `eligibilityReasonCodes`

These records feed Baz reward calculation.

### Phase BB-AI-09 — Worker Reward Settlement

Implement pending-to-settled reward lifecycle.

Flow:
```text
accepted contribution fact
  -> pending reward
  -> fraud/quality window
  -> settled reward
```

Must support:
- reversal
- clawback
- fraud hold
- manual review
- admin adjustment
- reward policy versioning

### Phase BB-AI-10 — User Wallet and Worker Portal UI

Add user-facing wallet and worker monitoring surfaces.

Suggested routes:
- `/my/baz`
- `/my/wallet`
- `/my/network/workers`
- `/my/network/workers/[workerId]`
- `/my/network/earnings`

Show:
- settled Baz
- pending Baz
- spent Baz
- own workers
- own worker health
- own completed jobs count
- own reward history
- safe machine status
- setup warnings

Do not show:
- other users' jobs
- prompts
- source files
- generated images from other users
- full Render diagnostics

### Phase BB-AI-11 — Super Admin AI Network Console

Add SUPER_ADMIN-only console.

Suggested routes:
- `/admin/ai-network`
- `/admin/ai-network/workers`
- `/admin/ai-network/jobs`
- `/admin/ai-network/media`
- `/admin/baz-ledger`

SUPER_ADMIN can see:
- all workers
- all jobs
- all generated/imported files
- queue conditions
- stuck leases
- failed jobs
- worker trust/reputation
- fraud flags
- Baz ledger
- network health

### Phase BB-AI-12 — Privacy-Aware Routing Policy

Bazar Baz must classify jobs by privacy level before sending them to the worker network.

Suggested levels:
- `PUBLIC_SAFE`
- `BUSINESS_NORMAL`
- `SENSITIVE_BRAND`
- `PERSONAL_DATA`
- `RESTRICTED_INTERNAL`

Routing policy:
- unverified workers: public-safe/synthetic only
- verified workers: normal jobs
- trusted workers: sensitive jobs if policy allows
- personal/restricted jobs: platform-controlled until legal review

### Phase BB-AI-13 — Render Contract Pinning

After AI media service is ready:
- deploy MOCK-safe Render coordinator
- pin OpenAPI fingerprint
- verify `/health`
- verify `/ready`
- verify worker diagnostics
- verify queue/claim contract
- verify no real generation

### Phase BB-AI-14 — Preview AI Media E2E

Preview-only:
- quote Baz cost
- create Baz hold
- submit MOCK job to Render Preview
- MOCK worker completes
- Bazar Baz imports Preview asset
- hold settles/refunds
- no Production mutation

### Phase BB-AI-15 — Controlled Production Rollout

Start with:
- SUPER_ADMIN only
- MOCK only
- read-only monitoring
- no real generation

Then expand to:
- trusted internal workers
- limited orgs
- limited media types
- real generation only after explicit authorization

### Phase BB-DB-01 — Database Migration Chain Recovery (Done Locally)

`BAZAR-BAZ-DATABASE-MIGRATION-CHAIN-RECOVERY-01` corrected the conflicting migration
`20260707000200_export_hub_extend_data_types` in place to a guarded idempotent enum-extension
pattern. The local migration execution chain is proven (all 52 migrations apply, 0
active-failed) and the `storageKey` migration (`20260717200000_add_ai_media_asset_storage_key`)
deploys locally. Production migration has not been run; Production asset-consumption remains
disabled. Full Prisma schema parity is NOT PROVEN — see next phase.

### Phase BB-DB-02 — Database Normalization (Future, Out of Scope for Recovery)

Reconcile pre-existing schema-vs-migrations drift that is unrelated to the recovery:
- `ImageAccess` enum variant divergence between migrations and datamodel.
- `DomainStatus` variant removals/additions between migrations and datamodel.
- Renamed indexes/constraints between migrations and datamodel.

Goal: re-establish `prisma migrate diff` parity (or an explicit, documented exception list)
without data loss. Do not combine with Production activation; verify backup and migration
history first.

## What `shadcn-rtl` Must Not Do

`shadcn-rtl` must not:
- run GPU workers
- install models
- download SDXL
- expose Render secrets to browser
- let normal users see all jobs/files/images
- implement desktop Control Center
- trust worker self-reported rewards
- make Baz tradable/withdrawable in v1

## Current Priority

1. AI service distributed scheduling and machine recommendation
2. Bazar Baz contract mapping and docs
3. Preview isolation
4. Bazar Baz AI job mirror and Baz ledger
5. Worker portal and Super Admin console
6. Control Center UI later
