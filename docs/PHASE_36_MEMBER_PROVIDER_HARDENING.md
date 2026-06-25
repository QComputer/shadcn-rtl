# Phase 36 — Member Management UX and Provider-Layer Hardening

Date: 2026-06-25

## Scope

P36 is a targeted dashboard/member-management cleanup after P35. It keeps behavior scoped to the existing dashboard and organization-member APIs.

## Changes

- Reworked `app/[locale]/dashboard/members/page.tsx` into a compact, clickable member list with active search, refresh, clearer errors, active counts, and a scrollable member-management dialog.
- Kept role/status updates scoped to `/api/organizations/[id]/members/[mId]`.
- Hardened `app/api/organizations/[id]/members/[mId]/route.ts` so organization member edits update the membership record directly instead of mutating the user's global role through `organizationService.updateMemberRole`.
- Added API guardrails:
  - managers cannot elevate members to `ADMIN`;
  - non-super-admin actors cannot change their own membership from this management endpoint;
  - the final active organization `ADMIN` cannot be demoted or deactivated.
- Simplified dashboard provider layering by removing the nested `Providers` stack from `DashboardShell`; the root localized layout remains the app-wide provider owner.
- Added `quality:members-provider-hardening` and wired it into `quality:local`.

## Validation

Run after applying the overlay:

```powershell
pnpm run quality:members-provider-hardening
pnpm run quality:seed-auth-members
pnpm run quality:local
pnpm run typecheck
pnpm run build
pnpm run release:stage
pnpm run quality:release-staged
```

## Notes

This phase intentionally does not add member invitation/create-member UX. It only hardens existing role/status management and reduces provider duplication before broader dashboard UX refactors.
