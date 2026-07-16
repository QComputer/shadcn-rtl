# Bazar Baz — Baz Wallet and Ledger Roadmap

## Purpose

This document defines the `shadcn-rtl` roadmap for Baz wallet, ledger, spend, rewards, holds, settlement, and audit.

Baz wallet must live in Bazar Baz, not in the desktop worker server and not primarily in the AI media service.

## Baz Definition

**Baz** is an internal platform credit used inside Bazar Baz.

Baz can represent:
- accepted compute contribution from worker machines
- spend on Bazar Baz services
- AI media job cost
- subscription/service credits
- refunds and adjustments

## V1 Restrictions

In v1, Baz is:

- internal
- non-tradable
- non-withdrawable
- non-crypto
- non-investment
- non-transferable between users unless a future reviewed phase explicitly allows it

Do not implement:
- fiat payout
- exchange market
- crypto wallet
- external transfers
- speculative pricing

## Accounting Principle

Use a ledger.

Do not rely on mutable balance counters as source of truth.

Balances must be derived from ledger entries.

## Proposed Data Model

### BazAccount

Represents an account that can hold Baz.

Possible fields:
- `id`
- `ownerUserId`
- `ownerOrganizationId`
- `accountType`
- `status`
- `createdAt`
- `updatedAt`

Account types:
- `USER_SPENDABLE`
- `USER_PENDING_REWARD`
- `ORGANIZATION_SPENDABLE`
- `PLATFORM_REWARD_POOL`
- `PLATFORM_REVENUE`
- `ESCROW`
- `FRAUD_HOLD`
- `ADJUSTMENT`

### BazLedgerEntry

Immutable accounting entry.

Fields:
- `id`
- `transactionId`
- `accountId`
- `direction`
- `amountBaz`
- `entryType`
- `sourceType`
- `sourceId`
- `idempotencyKey`
- `metadata`
- `createdAt`
- `createdBy`

Direction:
- `DEBIT`
- `CREDIT`

### BazTransaction

Groups ledger entries.

Fields:
- `id`
- `type`
- `status`
- `idempotencyKey`
- `reason`
- `metadata`
- `createdAt`
- `settledAt`

### BazHold

Reserved Baz before final settlement.

Use for:
- AI job spend
- pending service purchase
- refund-safe flows

Fields:
- `id`
- `accountId`
- `amountBaz`
- `status`
- `sourceType`
- `sourceId`
- `expiresAt`
- `createdAt`
- `releasedAt`
- `settledAt`

Hold statuses:
- `ACTIVE`
- `SETTLED`
- `RELEASED`
- `EXPIRED`
- `CANCELLED`

### BazSettlement

Reward settlement record.

Fields:
- `id`
- `workerContributionId`
- `userId`
- `amountBaz`
- `status`
- `policyVersion`
- `qualityWindowEndsAt`
- `settledAt`
- `reversedAt`

Statuses:
- `PENDING`
- `SETTLED`
- `REVERSED`
- `HELD`
- `CLAWED_BACK`

### BazRewardPolicy

Versioned reward policy.

Fields:
- `id`
- `version`
- `jobType`
- `model`
- `baseRewardBaz`
- `machineFactor`
- `qualityFactorRules`
- `reliabilityFactorRules`
- `priorityFactorRules`
- `activeFrom`
- `activeTo`

### BazSpendPolicy

Versioned spend/pricing policy.

Fields:
- `id`
- `version`
- `serviceType`
- `jobType`
- `model`
- `baseCostBaz`
- `refundPolicy`
- `activeFrom`
- `activeTo`

## Ledger Event Types

Suggested ledger event types:

- `JOB_REWARD_PENDING`
- `JOB_REWARD_SETTLED`
- `JOB_REWARD_REVERSED`
- `JOB_REWARD_CLAWED_BACK`
- `AI_JOB_SPEND_HOLD`
- `AI_JOB_SPEND_SETTLED`
- `AI_JOB_SPEND_REFUNDED`
- `SERVICE_SPEND`
- `SUBSCRIPTION_SPEND`
- `ADMIN_ADJUSTMENT`
- `REFUND`
- `EXPIRATION`
- `FRAUD_HOLD`
- `FRAUD_RELEASE`

## AI Job Spend Flow

```text
1. User requests AI media generation.
2. Bazar Baz calculates quote in Baz.
3. User confirms.
4. Baz hold is created.
5. AI job is submitted to Render.
6. Job completes or fails.
7. Bazar Baz imports accepted result.
8. Hold is settled if successful.
9. Hold is released/refunded if failed.
```

## Worker Reward Flow

```text
1. Worker completes a job.
2. Render reports contribution facts.
3. Bazar Baz validates and imports result.
4. Pending reward is created.
5. Fraud/quality window starts.
6. Reward is settled or reversed.
```

## Reward Calculation

Initial formula:

```text
reward = base_job_reward
       × machine_capability_factor
       × quality_factor
       × reliability_factor
       × priority_factor
       - penalties
```

V1 should be simpler:
- fixed reward by job type/model
- 0 reward for failed jobs
- pending reward first
- settlement after acceptance window

## Fraud and Abuse Controls

Support:
- duplicate output detection
- impossible speed detection
- repeated failure penalty
- suspicious worker hold
- manual admin review
- reward clawback
- worker suspension
- ledger audit

## User Wallet UI

Routes:
- `/my/baz`
- `/my/wallet`
- `/my/network/earnings`

Show:
- settled Baz
- pending Baz
- held Baz
- spent Baz
- reward history
- spend history
- refunds
- adjustments
- worker contribution summary

## Super Admin Ledger UI

Routes:
- `/admin/baz-ledger`
- `/admin/baz-ledger/transactions`
- `/admin/baz-ledger/holds`
- `/admin/baz-ledger/rewards`
- `/admin/baz-ledger/fraud`

SUPER_ADMIN can:
- inspect all ledger entries
- create adjustments
- freeze/hold rewards
- reverse fraudulent settlement
- audit worker rewards
- audit AI job spending

## Critical Rules

- No reward at claim time.
- No settled reward before accepted/imported result.
- No mutable-only balances.
- No public crypto/token features in v1.
- No worker self-credit.
- No normal-user access to other users' wallet details.
- Full ledger visibility is SUPER_ADMIN only.
