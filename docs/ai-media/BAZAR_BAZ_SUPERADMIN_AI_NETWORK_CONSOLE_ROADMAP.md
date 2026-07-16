# Bazar Baz — SUPER_ADMIN AI Network Console Roadmap

## Purpose

This roadmap defines the Super Admin console for monitoring and controlling the Bazar Baz AI Media Network.

This console lives in `shadcn-rtl`.

Only `SUPER_ADMIN` can use it.

## Why SUPER_ADMIN Console Is Special

Normal worker operators and users must not see cross-user job data, images, prompts, or files.

SUPER_ADMIN needs full visibility for:
- operations
- fraud detection
- support
- debugging
- accounting
- privacy enforcement
- network health

## Suggested Routes

```text
/admin/ai-network
/admin/ai-network/workers
/admin/ai-network/workers/[workerId]
/admin/ai-network/jobs
/admin/ai-network/jobs/[jobId]
/admin/ai-network/media
/admin/ai-network/queues
/admin/ai-network/render
/admin/ai-network/fraud
/admin/baz-ledger
```

## Overview Dashboard

Show:
- total workers
- online workers
- stale workers
- busy workers
- disabled workers
- workers by class
- queued jobs
- running jobs
- failed jobs
- no-eligible-worker jobs
- workers-busy jobs
- GPU-offline jobs
- pending Baz rewards
- settled Baz rewards
- fraud holds
- Render health

## Worker Management

SUPER_ADMIN can view:
- worker owner
- worker machine class
- capability metadata
- supported models
- supported providers
- supported job types
- heartbeat history
- reliability score
- trust level
- fraud flags
- active leases
- completed jobs

SUPER_ADMIN can control:
- disable worker
- suspend worker
- trust/verify worker
- request drain
- revoke token
- rotate credentials
- add admin note
- flag for review

## Job Monitoring

SUPER_ADMIN can view:
- all AI media jobs
- job owner
- organization
- privacy level
- job type
- model
- provider
- assigned worker
- status history
- queue rank
- jobs ahead
- ETA confidence
- lease state
- retry count
- failure reason
- contribution facts
- import status
- Baz spend/reward link

## Media/File Visibility

SUPER_ADMIN can inspect:
- generated images
- imported assets
- failed output artifacts if retained
- source/input files only if policy allows
- metadata and audit trail

Access must be audited.

## Queue Diagnostics

Show:
- jobs waiting for GPU offline
- jobs waiting because all eligible workers busy
- jobs waiting because no eligible worker exists
- jobs blocked by missing model
- jobs blocked by privacy/trust policy
- expired leases
- repeated retry loops

## Render Health

Show:
- `/health`
- `/ready`
- OpenAPI fingerprint
- deployed commit/version
- coordinator DB/queue status
- worker heartbeat status
- queue health
- internal API errors

## Baz Ledger Admin

SUPER_ADMIN can:
- inspect all Baz accounts
- inspect all ledger entries
- inspect holds
- inspect pending rewards
- settle/reverse rewards through controlled actions
- create admin adjustments
- freeze/fraud-hold rewards
- export audit reports

## Fraud and Abuse

Track:
- impossible speed
- duplicate outputs
- repeated identical outputs
- high failure rate
- high timeout rate
- suspicious worker behavior
- token abuse
- unexpected machine changes
- privacy violations

Actions:
- suspend worker
- hold rewards
- claw back rewards
- require manual review
- mark trust level down
- disable job routing to worker

## Privacy Controls

SUPER_ADMIN should see the privacy level of every job:
- `PUBLIC_SAFE`
- `BUSINESS_NORMAL`
- `SENSITIVE_BRAND`
- `PERSONAL_DATA`
- `RESTRICTED_INTERNAL`

SUPER_ADMIN can audit whether routing policy was followed.

## Audit Requirements

Every sensitive admin action must be audited:
- who acted
- when
- what changed
- reason
- affected worker/job/account
- previous state
- new state

## Minimum V1

V1 console:
- worker list
- job list
- network overview
- Render health
- queue diagnostics
- Baz pending/settled summary
- disable/suspend worker
- view generated/imported assets

## Not In Scope for Normal Users

Normal users must not have:
- all-job list
- all-media browser
- all-worker list
- Render full diagnostics
- fraud console
- full ledger view
