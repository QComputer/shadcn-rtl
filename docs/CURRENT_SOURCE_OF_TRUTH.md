# Current Source of Truth — Bazar Baz

Date: 2026-06-25

## Current validated baseline

The current working baseline after P44 overlays is source-validator green.

Minimum target-machine gate for any implementation phase:

```powershell
pnpm install
pnpm run db:validate
pnpm run typecheck
pnpm run build
pnpm run quality:local
pnpm run quality:members-provider-hardening
pnpm run quality:dashboard-navigation-copy
pnpm run quality:dashboard-role-navigation
pnpm run quality:dashboard-route-parity
pnpm run quality:dashboard-route-authorization
pnpm run quality:dashboard-route-guard-smoke
pnpm run quality:customer-club-foundation
pnpm run quality:in-app-notifications
pnpm run quality:customer-segments
```

Clean handoff gate introduced in P33:

```powershell
pnpm run release:stage
pnpm run quality:release-staged
```

Database/migration gate when database credentials and PostgreSQL client tools are available:

```powershell
pnpm run db:drift
pnpm run db:migrate:neon:dry-run
```

## Current product and architecture state

- Next.js 16 App Router with localized routes under `app/[locale]`.
- Supported locales: `fa`, `en`, `ar`; dictionary leaf-key parity is enforced by `quality:i18n-completion`.
- Multi-tenant organization model supports `SHOP` and `APPOINTMENT` organization types.
- Dashboard workflows cover appointments, calendar, notifications, organizations, members, Customer Club, Customer Segments, products, product categories, orders, QR code, services, service categories, settings, and users.
- Public shop workflows cover shop profile, product detail, checkout, order tracking, and shop fanpage.
- Public appointment workflows cover organization profile, service listing, staff listing, booking, appointment detail, my appointments, and appointment fanpage.
- Follow support exists through `Follow`, `follow.service.ts`, follow/unfollow API, public follow UI, and readiness validators.
- Fanpage MVP exists through `FanpagePost`, `fanpage.service.ts`, public read API, authorized create API, post card/form UI, and both appointment/shop fanpage routes.
- Customer Club foundation exists through `CustomerClubMembership`, `customer-club.service.ts`, self-service membership API, dashboard management API, localized dashboard pages, audit logging, and the `quality:customer-club-foundation` validator.
- In-app notification inbox exists through extended `Notification` organization/actor context, dashboard/customer inbox APIs, dashboard inbox UI, Customer Club in-app broadcast, dry-run recipient preview, audit logging, and the `quality:in-app-notifications` validator.
- Customer Segments MVP exists through `CustomerSegment`, `CustomerSegmentRule`, `CustomerSegmentSnapshot`, `customer-segments.service.ts`, dashboard segment API/UI, tenant-safe Customer Club/order/cart counts, snapshot audit logging, and the `quality:customer-segments` validator.
- Driver support includes driver orders dashboard, order driver/assignment APIs, and driver location API.
- Clean release packaging is now a first-class workflow through `scripts/release/create-clean-source.mjs`.

## Completed stabilization summary

| Phase | Status summary |
| --- | --- |
| P20 | API/service safety validator and service-boundary cleanup. |
| P21 | Reality reset; pnpm/typecheck/build/quality returned to green. |
| P22 | GET handlers no longer perform covered write/upsert/read-marking side effects. |
| P23 | Tenant database drift audit tooling. |
| P24 | Tenant identity guardrails for slug/id confusion risks. |
| P25 | Commerce correctness validator and order token/number retry guardrails. |
| P26 | Appointment correctness guardrails for business hours, provider hours, and buffers. |
| P26A/P26B | DB compatibility migrations for `Order.organizationSlug` and `Order.deletedAt`. |
| P27 | i18n/RTL audit gate and stale branding cleanup. |
| P28 | Follow/fanpage readiness cleanup and public follow links/prompts. |
| P29 | Public image fallback component and public page experience cleanup. |
| P30 | Fanpage MVP with `FanpagePost`, public feed API, create API, pages, components, dictionaries, validator. |
| P31 | FA/EN/AR dictionary completion and strict dictionary parity validator. |
| P32 | Safe Neon-to-current database data migration overlay and dry-run workflow. |
| P33 | Clean release staging/ZIP workflow and artifact hygiene validator. |
| P34 | Docs-only source-of-truth, inventory, fanpage roadmap, and seed guide synchronization. |
| P35 | Seed/auth demo-password documentation and dashboard member refresh/API cleanup. |
| P36 | Dashboard members UX/API hardening and dashboard provider-layer simplification. |
| P37 | Dashboard shell navigation semantics, localized mobile header copy, and accessibility guardrails. |
| P38 | Shared dashboard sidebar role-aware navigation policy and localized navigation labels. |
| P39 | Dashboard navigation policy extraction plus route/navigation parity validator. |
| P40 | Dashboard route-level authorization helper adoption and localized fallback boundary. |
| P41 | Dashboard unauthorized-state polish and route guard smoke validator. |
| P42 | Organization-scoped Customer Club foundation with management dashboard and validator. |
| P43 | In-app notification inbox and Customer Club broadcast foundation. |
| P44 | Customer Segments MVP with organization-scoped ready segments, counts, snapshots, and validator. |

## Current route/API inventory

Use `docs/ROUTE_API_DB_SERVICE_INVENTORY.md` as the route/API/schema/service inventory for future planning. It was regenerated from the source tree on 2026-06-25.

Important currently implemented surfaces:

```txt
/{locale}/appointment/{slug}/fanpage
/{locale}/shop/{slug}/fanpage
/api/public/organizations/{slug}/fanpage/posts
/api/driver/location
/api/orders/{id}/assign-driver
/api/dashboard/notifications
/{locale}/dashboard/notifications
/{locale}/dashboard/customer-club
/{locale}/dashboard/customer-club/members
/{locale}/dashboard/customer-club/segments
/api/customer-club/membership
/api/dashboard/customer-club/members
/api/dashboard/customer-club/segments
/api/customer/notifications
```

## Current fanpage status

Implemented:

- `FanpagePost` Prisma model and migration.
- `FanpageService` for listing/creating posts and revalidating both appointment and shop fanpage paths across configured locales.
- Public `GET /api/public/organizations/{slug}/fanpage/posts`.
- Authorized `POST /api/public/organizations/{slug}/fanpage/posts` for organization `ADMIN`/`MANAGER` sessions.
- Public pages at `/{locale}/appointment/{slug}/fanpage` and `/{locale}/shop/{slug}/fanpage`.
- `FanpagePostCard` and `FanpagePostForm` components.
- FA/EN/AR dictionary parity for fanpage keys, including video placeholder text.

Deferred:

- Likes/reactions.
- Comments/replies.
- Edit/delete/moderation/drafts.
- Follower-only visibility.
- Upload-backed image/video picker from the create form.
- Dashboard post management.

## Known non-blocking debt

- Dashboard/admin Persian copy remains hardcoded in several TS/TSX files. This is reported as warning-level i18n debt, not a blocking validator failure.
- Some older phase docs remain historical and may mention outdated deployed URLs or older smoke-test context.
- The active seed script hashes `123456` through `DEMO_PASSWORD` and the seed console footer prints the same value.
- `app/[locale]/dashboard/members/page.tsx` now uses a compact searchable list, explicit refresh, API error surfacing, and a scrollable management dialog.
- Organization-member role/status edits are scoped to `OrganizationMember` records and guard against self-lockout, manager-to-admin elevation, and removing the final active organization admin.
- Dashboard shell now provides localized FA/EN/AR shell copy, a skip link, a semantic `main` landmark, and a compact mobile-only header.
- Dashboard sidebar navigation is role-aware: SUPER_ADMIN keeps full navigation, ADMIN/MANAGER keep practical workflows, STAFF sees operational/catalog entries, DRIVER gets a minimal driving-focused menu, and global platform links are hidden outside SUPER_ADMIN.
- Dashboard main content is wrapped by `DashboardRouteAccessBoundary`, which uses the shared route policy helper to show a localized fallback when a user manually opens a dashboard route hidden for their role. P41 adds focus management, role/route details, improved mobile spacing, and a route-guard smoke validator.
- Dashboard route/navigation policy now lives in `lib/dashboard/navigation-policy.ts`, with `DASHBOARD_NAVIGATION_ITEMS`, `ROLE_NAVIGATION_POLICY`, and `DASHBOARD_ROUTE_POLICY` available for validators and route-level authorization checks.
- Customer Club management navigation and routes are available to SUPER_ADMIN, ADMIN, and MANAGER. STAFF and DRIVER do not receive Customer Club management navigation.
- Customer Club membership data is organization-scoped and does not mutate global user roles.
- Dashboard notifications are a personal inbox route for dashboard users. Creating in-app Customer Club broadcasts remains API-gated to organization ADMIN/MANAGER and SUPER_ADMIN.
- P43 intentionally does not send SMS, email, Telegram, Web Push, or any external notification.
- Customer Segment counts are computed from active memberships, organization-scoped orders, and organization-scoped carts. GET is read-only; POST explicitly saves reusable segment rows and snapshots.
- P44 does not create campaigns or external message delivery. Segments are prepared for future campaign reuse.

## Clean release rules

Never hand off a raw archive from the working directory. Use:

```powershell
pnpm run release:zip
```

Do not commit or ship:

```txt
.env
.env.local
.env.*.local
.vercel/
.next/
node_modules/
.release/
test-results/
playwright-report/
coverage/
prisma/dev.db
*.dump
*.backup
*.zip
*.rar
public/myResume.pdf
public/uploads/
uploads/
tsconfig.tsbuildinfo
```

## Recommended next phase

```txt
P45 - Campaign Builder MVP
```

Scope:

1. Create organization-scoped campaign drafts that can target saved Customer Segments.
2. Keep campaign creation dry-run safe and in-app first.
3. Reuse P44 segment snapshots without sending SMS, email, Telegram, or Web Push.
4. Audit campaign create/update/send-preview operations.
5. Validate with typecheck, build, `quality:local`, P42/P43/P44 validators, dashboard navigation validators, and staged release checks.
