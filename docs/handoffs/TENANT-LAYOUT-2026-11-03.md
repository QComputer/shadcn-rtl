# Tenant header, search and minimal footer

The owner approved showing each organization's own logo beside its name,
replacing the shop location control with search, and keeping only brand identity,
About and Contact in the footer.

## Implementation

- Shared TenantBrand prefers the tenant branding logo and display name, then
  the organization's own logo/name. Missing logos use the tenant initial;
  platform logos are not substituted. Logos use contain sizing.
- Shop and appointment headers use that identity. Editorial organization homes
  also show name and logo together. The shop follow control is compact on mobile.
- TenantSearch uses the existing organization-scoped public catalog API,
  debounced and aborted on query/tenant changes. Responses are schema-checked
  and keyed by tenant/query to exclude stale results. Product links and advanced
  search use existing custom-domain-aware shop paths. Advanced search links are
  only exposed for the currently supported Persian discovery route.
- Search includes the current organization's public description and contact
  fields. Editorial collection/lookbook titles and public copy are indexed on
  editorial homes. Appointment search indexes public navigation labels and
  organization information, not appointments or customer records.
- Footer contains only logo/name, About and Contact. The two controls open
  theme-aware dialogs using existing public organization data; missing content
  has a localized empty state. Draft CMS content is not exposed. Contact links
  validate email and telephone values, including Persian/Arabic digits.
- Dialogs use existing accessible primitives, initial input focus, keyboard tabs,
  result loading/error/empty states and internal scrolling. Styles use semantic
  tokens and retain the tenant primary color in portals.

## Verification

- Local full TypeScript check passed; scoped ESLint and diff whitespace check
  passed. Final exact-source CI and publication are recorded below when ready.
- Actual components and actual generated CSS were inspected in Chrome using a
  separate loopback GET-only synthetic search fixture, including a 390px iframe.
  Product results, advanced-search destination, minimal localized footer,
  nested contact dialog, Persian telephone normalization and Escape focus
  restoration were observed. This fixture does not exercise a Next runtime or
  production database. Physical Android acceptance remains unverified.
- Inexpensive subagent audited API/path contracts and reviewed search behavior.
  Kilo auto/free performed investigation but produced no patch before the
  bounded run was stopped; final edits/review are by the primary agent.

## Release

Pending exact-source CI and RunFlare publication. No schema migration is needed.
Inherited migration/provider artifacts in the shared checkout are excluded.
