# Bazar Baz — Worker Portal Roadmap

## Purpose

This roadmap defines the Bazar Baz user-facing portal for users who run AI media worker machines.

The worker portal lives in `shadcn-rtl`.

It lets users monitor their own servers and earnings, while preventing access to other users' jobs, files, prompts, or generated images.

## Scope

The worker portal is not the desktop Control Center.

The worker portal shows platform-side information:
- registered workers
- safe worker health
- own job/contribution summary
- own Baz income
- setup state
- warnings

The desktop Control Center handles local machine operations:
- start/stop worker
- machine scan
- model download/install after confirmation
- local logs
- local runtime health

## Routes

Suggested routes:

```text
/my/network/workers
/my/network/workers/[workerId]
/my/network/earnings
/my/network/setup
/my/baz
```

## User Permissions

A normal user can see:
- only their own workers
- only their own earnings
- safe summary of jobs processed by their worker
- safe operational status

A normal user must not see:
- other users' jobs
- prompts
- source files
- generated images from other users
- raw worker payloads
- full Render diagnostics
- Super Admin network data

## Worker Registration Flow

```text
1. User opens worker portal.
2. User creates a worker registration.
3. Bazar Baz generates worker ID and secret/token.
4. User installs desktop/local worker software.
5. Worker connects to Render using worker credentials.
6. Render reports heartbeat/capability.
7. Bazar Baz mirrors safe worker status.
```

## Worker Status Display

Show:
- worker name
- online/offline/stale/busy/draining/disabled
- last heartbeat
- machine class
- GPU summary
- supported models
- supported job types
- current safe status
- reliability score
- setup warnings
- connection state

Do not show:
- full local paths
- tokens/secrets
- raw private job data
- other users' media

## Worker Earnings Display

Show:
- pending Baz
- settled Baz
- held Baz
- reversed/clawed-back Baz
- completed accepted jobs count
- failed jobs count
- reliability trend
- reward policy version if relevant

## Worker Controls from Bazar Baz

Safe controls:
- rename worker
- revoke worker token
- disable worker
- request drain
- view setup instructions
- rotate secret
- mark as lost/stolen
- report issue

Do not implement direct local machine control from Bazar Baz unless a secure protocol is explicitly designed.

## Setup Instructions

The portal should guide the user through:
- install desktop server
- run machine scan
- review model recommendations
- confirm model downloads
- connect worker to Render
- verify heartbeat
- see first safe status

## Machine Recommendation Integration

The portal may show machine recommendation data reported by the worker:
- machine class
- recommended models
- missing runtime prerequisites
- missing model cache files
- expected downloads
- confirmation required

But the heavy download itself should be controlled locally through the desktop/local worker server, not silently triggered by Bazar Baz web UI.

## Privacy Rules

Worker operators are not allowed to inspect user content.

They can see:
- that work was completed
- reward amount
- high-level job category
- safe timing/status metadata

They cannot see:
- prompts
- source images
- generated output images
- business files
- other user identifiers beyond safe accounting context

## Worker Trust

The portal should show trust status:
- `UNVERIFIED`
- `VERIFIED`
- `TRUSTED`
- `SUSPENDED`

Trust affects:
- eligible job types
- reward settlement delay
- maximum concurrency
- privacy class eligibility

## Worker Reliability

Track:
- accepted jobs
- failed jobs
- timeouts
- retries
- expired leases
- fraud flags
- quality score
- uptime
- average processing time

Use reliability in reward policies and scheduling.

## UX Principles

- Be transparent about what the worker can earn.
- Clearly separate pending vs settled Baz.
- Clearly show that sensitive user data is protected.
- Do not promise guaranteed income.
- Do not use investment language.
- Do not expose other users' media.

## Minimum V1

V1 should include:
- register worker
- view own worker list
- view own worker status
- view own Baz earnings
- revoke worker
- setup instructions
- safe warnings

## Later

Later versions may include:
- richer charts
- reliability metrics
- reward simulations
- install download link
- support bundle export
- remote drain/disable controls
- multi-worker organization dashboard
