# Phase 37 — Dashboard navigation and localized shell copy cleanup

Date: 2026-06-25

## Scope

P37 is a small dashboard-shell cleanup phase after P36 member/provider hardening. It does not redesign dashboard workflows or change authorization behavior.

The phase focuses on the shared dashboard frame:

- Add a localized dashboard shell copy map for `fa`, `en`, and `ar`.
- Add an accessible skip link into the dashboard main content.
- Replace the anonymous dashboard content wrapper with a semantic `<main>` landmark.
- Make the mobile dashboard header explicit, compact, sticky, and localized.
- Keep desktop breadcrumb navigation visible only on desktop to reduce mobile clutter.
- Preserve the P36 provider-layer simplification: no duplicate root `Providers`, `SessionProvider`, or `AuthProvider` inside the dashboard shell.
- Add a focused source validator to prevent dashboard shell navigation/copy regressions.

## Updated files

```txt
components/dashboard/dashboard-shell.tsx
scripts/quality/validate-dashboard-navigation-copy.mjs
scripts/quality/validate-project.mjs
package.json
README.md
docs/CURRENT_SOURCE_OF_TRUTH.md
docs/PHASE_37_DASHBOARD_NAVIGATION_COPY.md
docs/PHASE_37_OVERLAY_MANIFEST.md
```

## Behavioral notes

- Runtime dashboard routes and APIs are unchanged.
- The dashboard sidebar component remains the canonical navigation component.
- Mobile users now see a compact localized dashboard heading beside the existing menu trigger.
- Keyboard users can jump directly to the dashboard content with the localized skip link.
- Desktop users retain sidebar plus breadcrumb navigation.

## Validation

Focused validation:

```powershell
pnpm run quality:dashboard-navigation-copy
```

Recommended full local gate:

```powershell
pnpm run quality:dashboard-navigation-copy
pnpm run quality:members-provider-hardening
pnpm run quality:local
pnpm run typecheck
pnpm run build
pnpm run release:stage
pnpm run quality:release-staged
```

## Deferred follow-up

P37 intentionally does not rewrite every dashboard page string. Remaining dashboard/admin hardcoded copy should be handled in smaller vertical slices so each page can stay typecheck/build green.

Recommended next phase:

```txt
P38 — dashboard sidebar role-aware navigation cleanup
```

Suggested P38 scope:

1. Inspect `components/dashboard/dashboard-sidebar.tsx` and route access rules together.
2. Keep practical admin workflows visible for `ADMIN`.
3. Move highly technical workflows behind `SUPER_ADMIN` where appropriate.
4. Keep navigation labels dictionary-driven.
5. Add a focused sidebar/navigation validator.
