# AI Media Preview MOCK Write Foundation

Date: 2026-07-16
Phase: BAZAR-BAZ-AI-NETWORK-PREVIEW-MOCK-WRITE-FOUNDATION-01

## Summary

This phase adds the Bazar Baz-side source foundation for future Preview-only MOCK AI media writes. It creates app-owned mirror schema source, server-only persistence services, a fail-closed Preview write guard, guarded dashboard route skeletons, tests, and quality validation.

This is not a Production AI write activation.

## Schema Added

New Prisma schema and migration source were added for:

- `AiMediaRequest`
- `AiMediaJobMirror`
- `AiMediaJobEvent`
- `AiMediaImport`
- `AiMediaAsset`
- `AiMediaUsageQuote`
- `AiMediaSpendHold`
- `WorkerContributionMirror`

The schema records organization ownership, requester ownership, app-owned state, provider job mirror identifiers, idempotency, audit events, import planning, asset visibility, quote/hold planning, contribution facts, timestamps, and safe error codes.

The existing product-image runtime tables remain separate:

- `AiMediaJob`
- `AiMediaUsageEvent`
- `CreativeStudioJob`
- `CreativeStudioAsset`
- `CreativeStudioUsageEvent`

## Preview Write Guard

`lib/ai-media/preview-write-guard.ts` fails closed unless all are true:

- environment is Preview, test, or development equivalent
- environment is not Production
- explicit `AI_MEDIA_PREVIEW_MOCK_WRITES_ENABLED=true`
- Preview isolation evidence is marked verified
- pinned Render contract evidence is marked verified
- provider is `MOCK`
- real generation remains disabled
- caller is `SUPER_ADMIN`

The guard returns only safe classifications and blocker messages. It does not return secrets.

## Server Services

Server-only service skeletons were added:

- `lib/services/ai-media-platform-request-service.ts`
- `lib/services/ai-media-job-mirror-service.ts`
- `lib/services/ai-media-import-service.ts`
- `lib/services/ai-media-contribution-mirror-service.ts`

They provide boundaries for draft requests, quote drafts, job mirrors, audit events, status mirroring, import planning, contribution mirroring, and safe user/worker/Super Admin views.

The services support idempotent upsert patterns and can be tested with mock DB clients.

## Route Skeletons

Guarded routes were added:

- `app/api/dashboard/ai-media/preview/jobs/route.ts`
- `app/api/dashboard/ai-media/preview/jobs/[id]/route.ts`

The routes require authentication, evaluate the Preview write guard, and return blocked status by default unless the explicit Preview MOCK evidence and flag are present.

The default flow is dry-run/planning. The route code does not call Render mutation endpoints, does not expose Render credentials, and does not write Blob storage.

## Import Planning

Import planning remains dry-run/source-only for this phase:

- `RESULT_READY` maps to pending import.
- `IMPORTED` maps to user-visible success.
- failed import states do not expose raw worker output.
- no Blob object is listed, uploaded, or deleted.
- raw provider result URLs are not treated as permanent app assets.

## Baz Ledger

Baz remains internal Bazar Baz credit only.

This phase adds quote and hold planning fields, but does not mutate wallet balances, settle rewards, or implement ledger truth. Worker contribution mirrors explicitly keep `walletCreditProduced=false`.

## Render Dependency

The foundation depends on the pinned MOCK-safe Render contract:

- URL: `https://bazar-baz-ai-media-service.onrender.com`
- OpenAPI fingerprint: `8bed184dd79980beacc553308652a44d99590c9705b7d37ab9418f4f83868f91`
- paths: `42`
- schemas: `40`
- provider: `MOCK`
- real generation remains disabled
- GPU worker offline is acceptable

## Disabled In This Phase

- Production AI writes
- Production database migration execution
- Production or Preview DB writes during validation
- Render mutation calls
- real generation
- Blob/storage writes
- app-managed permanent import execution
- Baz wallet/ledger balance mutation
- worker portal
- Super Admin network console
- Control Center
- installer

## Next Steps

The next safe phase is Preview MOCK E2E against an isolated Preview database after explicit authorization. That phase should apply the new migration only to the isolated Preview database, enable the guard only in Preview, and prove one guarded MOCK flow without Production writes, Blob writes, or real generation.
