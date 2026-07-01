# P116 - Creative Studio Organization Brand Generated-Asset Acceptance

Status: implemented

## Goal

Harden the organization logo and cover generated-asset acceptance path before provider execution is enabled.

P116 keeps the P115 request-only logo/cover workflow intact, but makes the future public apply path stricter: organization brand assets must be selected during internal review before they can be applied to `organization.logo` or `organization.coverImage`.

## Scope

- Require selected-candidate review before public organization logo/cover apply.
- Require the selected target field to match the requested apply target.
- Preserve the existing confirmation-gated apply action.
- Preserve public URL safety checks before any logo/cover mutation.
- Record P116 acceptance metadata on successful organization brand apply.
- Extend deployed Creative Studio smoke coverage with a safe request-only logo probe.
- Add a focused source validator for the P116 contract.

## Non-goals

- No `/v1/organization-brand/jobs` provider execution.
- No browser-side provider calls.
- No public auto-apply.
- No mutation from request-only P115 draft assets that do not have a public URL.
- No change to product-image provider rollout policy.

## Validation

```powershell
pnpm run quality:creative-studio-organization-brand-acceptance
pnpm run quality:creative-studio-organization-brand-request-controls
pnpm run quality:creative-studio-generated-asset-selection
pnpm run e2e:deployed:creative-studio
```

## Recommended Next Phase

```txt
P117 - Creative Studio organization-brand provider execution rollout gate
```
