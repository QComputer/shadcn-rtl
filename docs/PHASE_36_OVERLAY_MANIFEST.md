# Phase 36 Overlay Manifest

Apply from the project root.

## Updated files

```txt
app/[locale]/dashboard/layout.tsx
app/[locale]/dashboard/members/page.tsx
app/api/organizations/[id]/members/[mId]/route.ts
components/dashboard/dashboard-shell.tsx
package.json
scripts/quality/validate-project.mjs
scripts/quality/validate-seed-auth-members-cleanup.mjs
scripts/quality/validate-member-provider-hardening.mjs
README.md
docs/CURRENT_SOURCE_OF_TRUTH.md
docs/PHASE_36_MEMBER_PROVIDER_HARDENING.md
docs/PHASE_36_OVERLAY_MANIFEST.md
```

## Focus

- Organization-member role/status updates remain scoped to membership records.
- Last active organization admin and self-lockout guardrails are enforced.
- Dashboard member list UX is compact, searchable, refreshable, and uses a scrollable dialog.
- Dashboard shell no longer nests duplicate app-wide providers.
