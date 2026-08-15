# Tenant platform foundation: capabilities, collaboration, ready time, and push

Status: implemented foundation (2026-08-15). Production rollout is not performed by this change.

## What changed

### Organization capabilities

`Organization.type` remains a compatibility column while callers migrate. The authoritative model is now `OrganizationCapability` plus `Organization.capabilitiesInitializedAt`.

- `capabilitiesInitializedAt = null`: legacy tenant; effective capability falls back to `Organization.type`.
- initialized with no active rows: the tenant has zero capabilities.
- one or two active rows: shop, appointment, or both workflows are available.
- capability changes use `/api/organizations/:id/capabilities`, explicit tenant authorization, and an audit entry.
- organization creation initializes capabilities. Omitting `capabilities` preserves the old behavior; sending `[]` creates a tenant with zero active capabilities.
- dashboard navigation and route boundaries use the small `BUSINESS_CAPABILITY_REGISTRY`; plan/entitlement, permission, and rollout flags are not part of it.
- a zero-capability organization sees a setup state with organization settings, membership, and capability actions instead of being redirected into a legacy workflow.
- disabling a capability hides and blocks its public/manage navigation and rejects new product/category/variant/order or service/category/appointment creation at the server boundary; it never deletes historical products, services, orders, or appointments. Re-enabling the same capability restores those surfaces against the unchanged rows.

The migration backfills every existing organization from its legacy type, explicitly mapping `SHOP -> SHOP` and both historical `APPOINTMENT`/`SERVICE -> APPOINTMENT`. The marked backfill uses a deterministic ID, a tenant/key uniqueness constraint, `ON CONFLICT DO NOTHING`, and a NULL-only initialization update, so recovery can safely re-run that block. The legacy-upgrade test applies the pre-target migration chain, inserts memberships/orders/products/services/domains, applies the new migrations, compares row digests, and re-runs the marked block. New route checks consume the capability array returned by `/api/users/me/membership`. The legacy type should only be removed after all type reads listed by `rg "organization\.type|OrganizationType"` have migrated.

### Tenant context and isolation

New tenant-scoped mutations use `requireTenantContext(session, explicitOrganizationId, roles)`. It verifies an active organization, exact membership, and equality with the tenant persisted in the non-Super-Admin session. A second valid membership does not authorize an URL/query/body override until an explicit tenant switch updates session context. Super Admin also has to provide an organization ID; this prevents accidental use of an unrelated or first membership.

The membership compatibility response now chooses the membership matching the tenant in the authenticated session before falling back to the first active membership. All memberships remain available in `memberships` for a future explicit tenant switcher.

Custom-domain resolution remains read-only and tenant-bound through `OrganizationDomain`. No domain automation or Vercel configuration was changed.

The current NextAuth session is origin-cookie based. A session on `bazar-baz.ir` is not treated as a session on an unrelated custom origin. Login, logout, and dashboard application paths are kept out of storefront rewrites, and Auth.js form actions plus JSON/Location callbacks that would otherwise use the configured platform base URL are normalized back to the verified request origin. This milestone does not introduce cross-origin SSO and never puts credentials or a long-lived session token in a URL. If unified custom-domain login is required, the next milestone must implement an audited central identity handoff with a short-lived, one-time signed code and a tenant-local callback session.

Custom hostnames are normalized and resolved only through active `OrganizationDomain` records. New sensitive endpoints resolve the organization on the server and do not trust an `organizationId` from the browser without exact membership authorization. Platform Super Admin authority remains explicit and separate from organization membership; no implicit impersonation was added.

No new tenant-data cache or cross-request `unstable_cache`/`use cache` entry was introduced for branding, navigation, capabilities, or dashboard data. Prisma reads are request-scoped; broad `home-page` tags only invalidate and cannot return another tenant's value. The hardening suite alternates tenant A/B/A public reads with distinct branding and asserts exact results. Capability-dependent navigation is derived from the authenticated membership response. Cache keys for any future cached tenant reads must include organization, locale, capability, and visibility context. Protected asset management resolves the resource tenant before access; AI public media verifies the active entity, active organization, asset tenant, and storage key. Legacy `/uploads/:filename` now serves only records explicitly marked `PUBLIC`; `PRIVATE` records return 404. Public media intentionally remains cacheable by unique immutable filename/resource ID. A complete migration of every legacy query/cache/media route is deferred and is why tenant independence is reported as a foundation rather than complete.

### Controlled inter-organization collaboration

`OrganizationCollaboration` is an explicit invitation/consent record. It has owner and partner organizations, lifecycle state, direction, expiry/retention metadata, actors, and separately stored scopes. Scope rows are deny-by-default in both directions and `writeAccess` is always forced to `false` by the current API.

Lifecycle endpoint: `/api/organization-collaborations`.

- owner admin/manager can invite;
- only partner admin/manager can accept;
- either party can suspend or revoke;
- every mutation is audited;
- duplicate active relationships and self-collaboration are rejected;
- no customer, order, loyalty, courier, staff, schedule, or contact query consumes this contract yet.

This last point is intentional: `ORGANIZATION_COLLABORATION_DATA_SHARING` is conceptually hard-disabled until field-level minimization, legal retention rules, erasure propagation, export controls, and tenant-negative integration tests exist. A collaboration row alone never expands data access.

`evaluateOrganizationCollaborationGrant` encodes the future consumer contract: base tenant authorization must succeed first, then an ACTIVE, in-date, directional, resource-specific scope may add access. Missing scope, suspended/revoked status, wrong direction, expired grants, and all current writes fail closed. The current pairwise agreement can later be associated with a multi-member network without changing this resource/scope decision contract; network membership itself must never imply a grant.

### Order preparation time

Preparation defaults exist at two levels:

1. `Product.preparationMinutes` when set; checkout uses the maximum configured preparation time among products in the cart.
2. `OrganizationSettings.defaultPreparationMinutes` (30 minutes by default) when no cart product overrides it.

Orders snapshot the chosen minutes and `estimatedReadyAt`. Admin, manager, and staff can update the estimate through `/api/orders/:id/ready-time` using a duration, mandatory reason, and `expectedVersion`. The transaction:

- compares `readyTimeVersion` and returns HTTP 409 for stale concurrent updates;
- updates the order and legacy preparation progress atomically;
- appends immutable `OrderReadyTimeHistory` with actor and reason;
- appends a generic audit record;
- after commit, awaits best-effort notification routing to the registered customer and assigned courier;
- returns history for the dashboard dialog.

The three domain concepts stay separate:

- `preparationMinutesSnapshot` is a duration;
- `estimatedReadyAt` is an estimate timestamp;
- the existing preparation progress `endTime` remains the actual completion timestamp when the workflow records completion (no duplicate `actualReadyAt` column was added).

The initial estimate uses the server-side order creation instant, matching the order's `createdAt` boundary. A manual re-estimate is calculated as UTC epoch milliseconds from the server-side change instant (`now + minutes`); organization timezone affects display/input interpretation, not the stored instant. The previous `estimatedReadyAt` remains recoverable from `OrderReadyTimeHistory.previousEstimatedReadyAt`. Durations must be integral and between 1 and 1440 minutes at both route and service boundaries.

The dashboard adds common duration presets, custom minutes, mandatory reason, current estimate, stale/late signal, and recent history. Organization settings expose the default preparation duration.

### Push notification roles and deep links

Subscriptions, preferences, and deliveries now record `recipientRole`. Every subscription also records its normalized application `origin`; uniqueness is `(organizationId, customerId, origin, endpoint)`, allowing the same user/endpoint on multiple application origins without collision. Unsubscribe updates only the exact tenant/origin/optional endpoint and keeps the shared tenant preference enabled while another active origin remains. Provider 404/410 responses deactivate only the expired subscription. The server accepts only a configured platform origin or an ACTIVE custom domain owned by the exact tenant. Dashboard opt-in supports ADMIN, MANAGER, STAFF, and DRIVER membership roles. Customer subscriptions remain supported. Staff-like users cannot subscribe under another tenant without an active membership.

Delivery payloads accept only same-origin relative deep links. The service worker independently re-validates the target before focusing or opening a window. Delivery records can retain `targetUrl` and `deduplicationKey`; no sensitive tenant data should be placed in push title/body.

Order deep links are built centrally and remain relative. Delivery now adapts each payload to its subscription origin: platform subscriptions keep the locale/shop/slug path, while an ACTIVE custom-domain subscription receives the clean `/order/:orderNumber` path directly. The proxy still canonicalizes an old platform-shaped notification URL to that clean path. Driver notifications target the same-origin driver dashboard. The payload contains exactly `title`, `body`, and `url`; it does not include phone, address, payment, tenant IDs, or staff-private fields.

Current coverage:

| Role | Opt-in surface | Transactional routing |
| --- | --- | --- |
| Customer | public tenant PWA | order status, payment, ready time |
| Admin / Manager / Staff | dashboard PWA | new-order operational alerts |
| Driver | dashboard PWA | ready-time changes for assigned orders |
| Super Admin | tenant-explicit API foundation | platform-wide notification UI is deferred |

Real Web Push remains guarded by the existing `WEB_PUSH_ENABLED`, provider, VAPID, dry-run, and `WEB_PUSH_REAL_SEND_ENABLED` checks. This work did not enable external delivery.

Notification routing is separated from the order mutation through the existing notification router. The ready-time transaction contains only the order, progress estimate, immutable history, and audit row. **Notification intent is not in that transaction and there is no outbox row.** After commit, the service awaits a best-effort router that creates IN_APP notification and delivery-attempt rows in later independent writes; its safe wrapper logs/swallow failures so the already-committed order update still returns success. Therefore partial success is possible in both directions: the order may commit while no notification is persisted (process termination or router/database failure), and IN_APP may persist while a later WEB_PUSH attempt fails. Awaiting the router narrows the serverless termination window but does not provide atomicity or durable retry. A transactional outbox remains a separate milestone.

## Migration and rollback

Migrations:

- `20260815000100_multi_capability_collaboration_ready_time_push_roles`
- `20260815000200_push_subscription_origin`

Rollout order:

1. Take a database backup and run the full migration-chain checks.
2. Apply the additive migration.
3. Deploy application code while keeping real push disabled/dry-run.
4. Run `test:tenant-platform-legacy-migration`: verify SHOP/APPOINTMENT/SERVICE mapping, unchanged legacy row counts/digests, idempotent marked backfill, and a second no-op migrate deploy.
5. Exercise tenant-negative API checks, order ready-time conflict behavior, and push opt-in by role.
6. Enable real push separately only after VAPID/provider operational approval.

Application rollback is compatible because the legacy `Organization.type` column remains populated. Database rollback should be a forward corrective migration, not destructive down SQL. Do not drop capability, collaboration, history, or delivery columns until all newly written data has been exported and its retention requirements reviewed.

## Required verification matrix

- zero, shop-only, appointment-only, and dual-capability tenants;
- admin with memberships in two organizations, requesting each explicit tenant and a third unauthorized tenant;
- custom-domain public shop and appointment pages with no platform navigation leakage;
- ready-time first update, invalid duration, missing reason, wrong tenant, stale version, history actor/reason, overdue UI;
- customer and assigned driver notification routing; unrelated driver rejection;
- dashboard opt-in for admin/manager/staff/driver; cross-tenant subscription rejection;
- push permission denied/revoked, disabled preference, multi-origin uniqueness, origin-specific unsubscribe, provider 404/410 cleanup, dry-run, retry/audit, minimal payload, same-origin and hostile deep links;
- collaboration self-invite, duplicate, partner-only acceptance, suspension/revocation, and proof that no scoped data query changes before a separate sharing implementation.

## Known deferred work

- migrate every legacy `Organization.type` query and remove the compatibility column;
- explicit tenant switcher persisted in the session for multi-membership users;
- product preparation-time editor in the product form (the schema and API contract accept it now);
- a reviewed data-sharing consumer for collaboration scopes;
- platform-wide Super Admin push center and durable deduplication uniqueness;
- production provider/browser matrix and real-device permission tests.
- transactional notification outbox and durable retry worker;
- short-lived central identity handoff for explicit custom-domain SSO;
- multi-member collaboration network and every data-sharing consumer.

## Delivery status for the five requests

| Request | Status | Evidence boundary |
| --- | --- | --- |
| Zero/one/many organization capabilities | Implemented | migration/backfill tests, registry unit tests, and browser observations for zero, SHOP-only, and dual navigation/setup UX |
| Complete tenant independence, custom domains, cache/media | Foundation implemented | exact-membership/disabled-tenant tests and existing custom-domain/storage boundaries; legacy route audit and cross-origin identity handoff remain milestones |
| Controlled inter-organization collaboration | Foundation implemented | invitation lifecycle schema/API, audit, deny-by-default evaluator tests; no business-data consumer or federation exists |
| Order preparation time | Implemented | local transaction test proves history plus stale-version rejection; dashboard/settings UI and notification routing compile and build |
| Push for all tenant roles | Foundation implemented | role-aware subscription APIs, origin validation, relative deep-link tests, and browser API observation; real-device display/click delivery was not claimed |

Push verification in this milestone reached: backend status accepted and tenant/origin context returned. It did not prove push-service acceptance, service-worker receipt, operating-system display, click, or authorized destination loading on a real device.

## Validator maintenance decision

The clean `HEAD` audit proved that `quality:notification-preferences` and `quality:notification-routing` already failed before this work, solely because they coupled behavioral validation to obsolete P109/P120 README, roadmap, and source-of-truth strings. Those phase-history assertions are now explicitly retired inside the validators; phase prose is documentation, not an executable notification contract. Schema, migration, preference, routing, packaging, and delivery checks remain active.

`quality:notification-preferences` had one additional assumption invalidated intentionally by multi-origin subscriptions: unsubscribing one origin no longer disables the shared tenant preference if another active subscription remains. The validator now requires denied/revoked permission to opt out, and origin-specific unsubscribe to derive opt-in from the remaining active count. `quality:order-operational-notifications` was green on clean `HEAD`; it remains a valid gate and now recognizes the stronger `requireAuthSession` plus exact `requireTenantContext` boundary and the explicit ADMIN/MANAGER/STAFF/DRIVER role set. No validator is knowingly left red or removed from the package/project gates.
