# Bazar Baz Handoff Snapshot 01 - Git State

Date: 2026-07-15

## Current Git State

| Item | Value |
| --- | --- |
| Branch | `main` |
| HEAD | `b5624c48fe4820cbeae9a2ef8cea514ffed6d7d5` |
| origin/main | `b5624c48fe4820cbeae9a2ef8cea514ffed6d7d5` |
| HEAD pushed | yes |
| HEAD matches origin/main | yes |
| Working tree before handoff reports | clean |
| Untracked files before handoff reports | none reported by Git |

Local ignored files/directories are present and must be excluded from snapshots: `.env`, `.env.local`, `.env.vercel-production`, `.env.check`, `.next/`, `node_modules/`, `test-results/`, prior ZIPs, dump files, and local release artifacts.

## Latest 50 Commits

```text
b5624c4 test(b2b): finalize custom domain onboarding acceptance
0769f3f feat(b2b): add business onboarding wizard
2368f26 fix(b2b): stabilize custom domain onboarding
8852690 feat(b2b): add tenant custom domain onboarding
0b03fd1 test(b2b): complete production admin lead acceptance
5bb94da chore(b2b): document FIX4 blocked on SUPER_ADMIN credentials
c4dcafe test(b2b): update production smoke and document FIX3 status
05da96c chore(b2b): verify request demo production readiness
ba33283 fix(b2b): finalize request demo lead acceptance
96d35f2 feat(b2b): store request demo leads for admin review
ea9689e chore(b2b): finalize deployed public repositioning handoff
b35032f feat(b2b): harden public trust legal and seo pages
756082e feat(b2b): add dashboard showcase and feature pages
4faf0f3 feat(b2b): add conversion funnel pages
2b2fcb1 feat(b2b): restrict public discovery to demo examples
a03af06 feat(b2b): add demo business portfolio strategy
acb17ad feat(b2b): implement Persian business landing homepage
1e64f49 docs(b2b): define Persian B2B content architecture
4b6a5f7 docs(b2b): define public route policy and route audit
762b3e1 docs(b2b): add state-snapshot handoff reports for baseline
90790d1 chore(b2b): reconcile baseline before public repositioning
2c424f7 redeploy with regenerated VAPID keys
b6c7e50 fix(access): register /dashboard/notification-operations route
d463173 fix(push): relax strict VAPID key length check on client
6e7b752 fix(vercel): push all local .env vars to Vercel production via PowerShell script
5586b4f fix(vercel): remove local .env.production override to restore encrypted env vars
8193509 fix(ops): strip quotes from Vercel URL env vars after sync corruption
41f4062 fix(push): resolve TS build error for applicationServerKey type
aaf1300 fix(push): validate VAPID public key format before subscribe
6a52f57 fix(db): apply NotificationDeliveryAttempt migration via Neon serverless
28eae91 fix(notifications): improve push error visibility and VAPID key safety
6bfb152 fix(notifications): improve push error visibility and VAPID key safety
7cd545d fix(notifications): harden deployed operations diagnostics
fcbdf5b feat(sms): reconcile deliveries with sms-ir reports
2d9cb92 feat(sms): add delivery reports and reconciliation foundation
0787211 fix(quality): finalize P120D SMS baseline acceptance
545a10c feat(sms): complete sms-ir provider integration
9975cdd docs: mark P120C complete in source of truth
3585c7e feat(notifications): add delivery observability and retry policy
37af319 feat(notifications): add customer order lifecycle routing
fd623ba feat(creative-studio): apply reviewed brand assets with rollback
1a10bdc fix(quality): repair CURRENT_SOURCE_OF_TRUTH P119 baseline reference for Windows runner compatibility
7795721 docs: mark P120A complete in source of truth
e63a960 fix(quality): update roadmap to P120A and fix validator references
1680e27 feat(orders): add operational notifications and admin controls
e4664f8 feat(creative-studio): ingest provider results for review
000e25e feat(creative-studio): execute organization brand provider behind gate
43f7d52 feat(creative-studio): add organization brand provider rollout gate
04a7583 feat(creative-studio): add organization brand acceptance gate
fea47e4 feat(creative-studio): add organization brand request controls
```

## Recent B2B Commits

The current B2B repositioning sequence starts at `4b6a5f7` and continues through `b5624c4`. Important recent commits:

| Commit | Meaning |
| --- | --- |
| `96d35f2` | P10 request-demo lead storage/admin review source |
| `ba33283` | P10 acceptance fix |
| `0b03fd1` | P10 production admin lead acceptance |
| `8852690` | P11 tenant custom-domain onboarding source |
| `2368f26` | P11 stabilization |
| `b5624c4` | P11-FIX1 custom-domain acceptance evidence |
| `0769f3f` | P12 business onboarding wizard |

