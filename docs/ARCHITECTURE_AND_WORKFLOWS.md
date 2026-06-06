# Bazar Baz — Architecture and Workflow Documentation

_Last updated from source inspection: 2026-06-02._

## 1. Architecture overview

Bazar Baz uses the Next.js App Router with locale-prefixed routes under `app/[locale]` and API route handlers under `app/api`. The application is organized around public pages, authenticated dashboard pages, shared UI components, client hooks/contexts, service modules, Prisma data models, and quality/deployed smoke scripts.

Primary layers:

```txt
Browser / public users / dashboard users
  -> app/[locale] pages and client components
  -> hooks and context providers
  -> app/api route handlers
  -> lib/api-guards and validators
  -> lib/services business logic
  -> Prisma Client
  -> PostgreSQL
```

## 2. Runtime routing model

`proxy.ts` is responsible for locale routing and security headers. It redirects non-locale paths to a locale-prefixed path and sets locale/direction headers for localized routes.

Important current behavior:

- Supported locales are `fa`, `en`, and `ar`.
- Default locale is `fa`.
- `fa` and `ar` are RTL; `en` is LTR.
- The locale-detection function exists, but the actual redirect currently hardcodes `fa` instead of calling the detector.
- API routes, static assets, uploaded files, Next internals, and selected shop paths bypass the locale redirect.
- Security headers include `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Cross-Origin-Opener-Policy`.

Production recommendation: restore deliberate locale detection or document why Persian-forced routing is intentional. Review `Permissions-Policy` before adding camera, microphone, geolocation, payment, or WebRTC capabilities.

## 3. Authentication architecture

Authentication is handled by NextAuth v5 beta in `lib/auth.ts`.

Implemented behavior:

- JWT session strategy.
- Credentials login by username/email/phone.
- Google provider is optional and only enabled when Google env variables exist.
- Disabled, deleted, locked, or unknown users are blocked.
- Failed credential logins increment counters and lock after five failures for 15 minutes.
- Successful credential login resets failed counters and records `lastLoginAt`.
- Production runtime throws when `NEXTAUTH_SECRET` is missing.

Main risks:

- `pages.signIn` is `/login`, but actual localized login is `/{locale}/login`.
- Client auth hook redirects to `/dashboard` and `/` without locale prefix.
- `components/providers.tsx` nests `SessionProvider` twice.
- `hooks/use-auth.tsx` duplicates interface declarations.
- Global `User.role` is still used heavily even though tenant-aware authorization should use `OrganizationMember.role`.

Target design:

```txt
User = identity account.
Organization = tenant.
OrganizationMember = tenant-specific role and active state.
User.role = only global/system default or super-admin identity, not normal tenant authority.
```

## 4. Authorization and RBAC architecture

The project has two authorization layers:

1. API/server access helpers in `lib/api-guards.ts`.
2. Client/dashboard route filtering in `lib/access-control.ts` and `hooks/use-auth.tsx`.

Good API guard concepts already exist:

- `requireAuthSession`.
- `requireRole`.
- `getActiveMembership`.
- `requireOrgAccess`.
- `requireCurrentOrgAdminOrManager`.
- `requireCurrentOrganizationId`.
- Resource-specific access helpers for images, products, orders, and appointments.

Current concern: route/page access is less mature than API access. Some real dashboard pages do not have explicit route policies; stale paths still exist in the route registry; and some pages rely on client-only `useDashboardAccess` rather than server-side layout authorization.

Target production design:

- Every dashboard route must be listed in a single route policy registry.
- Unknown dashboard child routes must deny by default.
- Dashboard layout should perform a server-side auth/membership check before rendering the shell.
- API handlers remain the final source of truth for data mutations and resource access.

## 5. Data architecture

The database is modeled in Prisma with PostgreSQL. The schema has a rich domain and supports:

- Organizations and memberships.
- Users, passwords, email verification, password reset.
- Business hours and staff availability.
- Services, service categories, appointments, booking settings, and booking sessions.
- Product categories, products, variants, carts, guest customers, orders, order items, inventory movements, payment records, payment events, and order status history.
- Notifications, audit logs, reviews, follows, conversations, messages, order messages, and locations.

Main modeling concern: organization identity is represented inconsistently by `organizationId`, `organizationSlug`, and sometimes both. For production, `organizationId` should be canonical for relational integrity. `slug` should be public routing metadata and denormalized display/search data only when needed.

## 6. Service-layer architecture

Business logic lives primarily under `lib/services`:

- `appointment.service.ts`: appointment creation, guest appointment creation, list/update/cancel, availability slots.
- `order.service.ts`: order/guest order creation, listing, driver workflow, payment/status changes, inventory movement.
- `cart.service.ts`: cart retrieval, add/update/remove item, cart summary, guest/user merge.
- `organization.service.ts`: organization creation, user/org creation, members, business hours, soft delete.
- `service.service.ts`: service CRUD and availability-related listing.
- `product.service.ts`: product and variant CRUD.
- `category.service.ts`: product and service categories.
- `messaging.service.ts`: conversation and message behavior.
- `review.service.ts`: review creation/listing/update/delete.
- `follow.service.ts`: follow/unfollow and follower counts.
- `notification.service.ts`: notification creation and reminder concepts.
- `audit.service.ts`: audit log creation and querying.
- `booking-settings.service.ts`: booking-setting retrieval/update and booking policy checks.
- `user.service.ts`: user profile, role/status, and business hours.

The service layer is a good project choice. The next maturity step is making transaction boundaries explicit, eliminating fire-and-forget writes, and moving repeated API validation into shared validators.

## 7. Core workflows

### 7.1 Organization registration workflow

Expected flow:

1. User submits organization registration.
2. User account is created.
3. Organization is created.
4. Organization settings/payment settings/booking settings are initialized as applicable.
5. Organization membership is created for the admin.
6. Audit logs are written.
7. User can log in and manage the tenant.

Current risk: several writes are split across independent operations. A failed later write can leave partial user/org data. This should be wrapped in one transaction where possible.

### 7.2 Product/catalog workflow

Expected flow:

1. Admin/manager creates product category.
2. Admin/manager creates product.
3. Product variants define SKU/stock/price fields.
4. Inventory movement records track stock changes.
5. Public shop pages expose active products.
6. Cart and checkout consume product variants.

Current risk: catalog logic is strong enough for a prototype, but product/category access policies, image persistence, and stock race conditions need test coverage.

### 7.3 Cart and checkout workflow

Expected flow:

1. Visitor or authenticated customer adds product variants to cart.
2. Guest carts use session cookie identity.
3. Authenticated carts use user identity.
4. Checkout creates order, order items, payment record, status history, and inventory movements.
5. Public tracking token/order number allows safe post-checkout status retrieval.

Current risks:

- Guest-to-user cart merge should be transactional.
- Delivery fee logic appears to use delivery radius in places; this should be reviewed.
- Public order lookup is protected better than a naive implementation, but API errors should be sanitized.

### 7.4 Appointment-booking workflow

Expected flow:

1. Public user selects organization, service, provider, and slot.
2. System validates booking settings, business hours, provider availability, max advance days, and minimum notice.
3. Appointment is created with a booking reference.
4. Owner/staff/customer can view or manage according to policy.

Current risks:

- Direct creation endpoints must enforce the same availability/business-hour rules as slot generation.
- Concurrent overlapping appointments require stronger transactional or database-level protection.
- Dashboard create/reschedule workflow is not yet a fully hardened production workflow.

### 7.5 Driver order workflow

Expected flow:

1. Driver views available orders.
2. Driver accepts an order with a mutation method.
3. Driver can deny/undeny orders.
4. Assigned driver updates progress/status through authorized API calls.

Current risk: accepting an order is currently also allowed through GET for backward compatibility. This should be removed because GET must not mutate state.

### 7.6 Messaging/notification workflow

Expected flow:

1. Conversation is created between users or around an order/context.
2. Participants can fetch conversations.
3. Messages are sent, read, and counted.
4. Dashboard notification polling shows new events.

Current risks:

- Dashboard notification polling runs in client layout and should be checked for duplication and auth failure behavior.
- Realtime/socket deployment strategy is not fully documented.
- Notification sound asset assumptions should be verified.

## 8. Media and upload architecture

Uploads are handled by API routes and media helpers. The project validates image type/signature/size and stores metadata.

Current risk: local disk upload storage is not durable across serverless/container redeploys unless a persistent volume exists. Production should use S3-compatible storage, Cloudflare R2, MinIO, or a deliberately mounted shared volume.

## 9. i18n and RTL architecture

The app has `dictionaries/fa.json`, `dictionaries/en.json`, `dictionaries/ar.json`, locale providers, dictionary helpers, and locale-aware layout direction.

Current state:

- Structure exists.
- Persian is the most complete locale.
- English and Arabic are missing many keys compared with the union.
- Many page/component strings are still hardcoded in Persian/Arabic.
- Locale detection in `proxy.ts` is disabled by hardcoded `fa`.

Production target:

- All user-facing strings should come from dictionaries or typed translation helpers.
- Locale redirects should be deliberate and documented.
- RTL/LTR should be visually tested for dashboard and public flows.

## 10. Quality and deployment architecture

Current quality scripts:

- `npm run quality:local` / `npm run validate:project`.
- `npm run health:env`.
- `npm run e2e:deployed:phase1` through `phase17`.
- `npm run e2e:deployed:all`.

The deployed smoke scripts use Node `fetch`, not Playwright. They are useful but not sufficient as the only test strategy.

Target quality gate:

```bash
npm ci
npm run db:generate
npm run db:validate
npm run typecheck
npm run lint
npm run quality:local
npm run health:env
npm run build
DEPLOYED_URL=https://your-deploy.example npm run e2e:deployed:all
```

Add browser/API tests for the critical workflows before production release.
