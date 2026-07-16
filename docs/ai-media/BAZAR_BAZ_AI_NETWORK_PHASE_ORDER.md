# Bazar Baz AI Network — Recommended Phase Order

## Purpose

This file gives the recommended implementation order for the `shadcn-rtl` side of the Bazar Baz AI Media Network.

## Important Rule

Do not implement the desktop Control Center before the backend truth exists.

Do not implement Baz wallet settlement before AI job identity, worker contribution facts, and ledger rules exist.

## Phase Order

### 1. Docs and Source of Truth

Add:
- master roadmap
- integration gates
- wallet roadmap
- worker portal roadmap
- Super Admin console roadmap

### 2. Server-Side Contract Mapping

Implement:
- AI media status parser
- canonical status mapping
- Persian-first UI messages
- old/new contract compatibility
- fail-closed behavior

No write flows.

### 3. Preview Isolation

Prove:
- DB isolation
- storage isolation
- AI service identity isolation
- no Production mutation

No Render write until accepted.

### 4. AI Job Mirror

Create app-owned AI job/request records.

Track:
- user/org owner
- Render job ID
- status events
- quote/hold references
- import status

### 5. App-Managed Storage Import

Implement:
- safe import
- validation
- app storage
- permissioned assets
- audit trail

### 6. Baz Ledger Core

Implement:
- accounts
- ledger entries
- transactions
- holds
- settlements
- adjustments

No mutable-only balances.

### 7. Baz Spend for AI Jobs

Implement:
- quote
- hold
- submit
- settle
- refund

Preview-only first.

### 8. Worker Registration

Implement:
- worker record
- owner link
- token generation
- revoke/rotate
- safe status mirror

### 9. Worker Contribution Facts

Import:
- worker/job facts
- accepted/imported status
- duration
- machine class
- result status
- fraud flags

### 10. Worker Reward Settlement

Implement:
- pending reward
- quality/fraud window
- settlement
- reversal/clawback

### 11. Worker Portal UI

Implement:
- own workers
- own earnings
- own health
- safe summaries only

### 12. Super Admin Console

Implement:
- all workers
- all jobs
- all media
- queues
- fraud
- ledger
- Render health

### 13. Privacy-Aware Routing

Implement:
- job privacy levels
- worker trust levels
- routing policy
- audit

### 14. Render Contract Pinning

Pin deployed contract and smoke test.

### 15. Preview AI Media E2E

Run full Preview-only MOCK E2E:
- quote
- hold
- job submit
- worker completion
- import
- settlement/refund

### 16. Production Read-Only Rollout

Start:
- Super Admin only
- read-only monitoring
- MOCK only

### 17. Controlled Production Write Rollout

Only after all gates.

### 18. Real Generation

Only after:
- CUDA torch verified
- model cache complete
- provider accepted
- Render contract pinned
- privacy policy accepted
- explicit authorization

## Do Not Start Yet

Do not start:
- public worker marketplace
- fiat payout
- crypto/token features
- Control Center UI
- installer
- real generation
- broad production write flow

until prerequisite gates are accepted.
