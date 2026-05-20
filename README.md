# Bazar Baz

Bazar Baz is a multi-tenant, multi-locale commerce and appointment-booking web application built with Next.js 16, TypeScript, Prisma 6, PostgreSQL, Tailwind CSS, and NextAuth.

## Current hardening status

The project is being production-hardened phase by phase.

### Phase 1 — security/dashboard API baseline

Implemented:

- Server-side API guard utilities.
- Hardened user/member/organization settings APIs.
- Protected upload/image/QR write endpoints.
- Removed guest appointment user creation with the hardcoded password.
- Added deployed smoke tests without Playwright.

Run Phase 1 deployed smoke tests:

```bash
DEPLOYED_URL=https://your-domain.example npm run e2e:deployed:phase1
```

### Phase 2 — resource ownership and dashboard API scoping

Implemented:

- Product, product category, product variant, service, service category, order, and appointment dashboard APIs now enforce server-side organization/resource ownership.
- Dashboard list APIs no longer trust arbitrary `organizationId` values from non-super-admin users.
- Service provider and category assignments are validated against the same organization.
- Product category super-admin listing bug was fixed.
- Added deployed resource-ownership smoke tests without Playwright.

Run Phase 2 deployed smoke tests:

```bash
DEPLOYED_URL=https://your-domain.example npm run e2e:deployed:phase2
```

## Development

Install dependencies:

```bash
npm install
```

Generate Prisma client:

```bash
npx prisma generate
```

Run development server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Seed database:

```bash
npm run db:seed
```

## Required environment variables

Create a local `.env` based on `.env.example`.

Important production variables:

```env
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=replace-with-a-strong-secret
NEXT_PUBLIC_DEPLOYED_APP_URL=https://your-domain.example
AUTH_TRUST_HOST=true
```

Do not commit `.env` or production secrets.

## Phase 2 build note

Phase 2 includes an API guard typing hotfix for NextAuth v5. The guard session type is explicit instead of using `ReturnType<typeof auth>`, because the overloaded `auth` helper can otherwise be inferred as a middleware type during `next build`.

## No-Playwright deployed tests

This project includes lightweight deployed smoke tests that use Node's built-in `fetch` and do not require Playwright.

```bash
DEPLOYED_URL=https://your-domain.example npm run e2e:deployed:phase1
DEPLOYED_URL=https://your-domain.example npm run e2e:deployed:phase2
```

These tests are not a replacement for browser E2E coverage, but they catch important deployed API security regressions.

## Production hardening roadmap

Remaining major areas:

1. Membership-role schema migration: move organization-specific roles from global `User.role` into `OrganizationMember.role`.
2. Remove `OrganizationMember.userId @unique` to support multi-organization membership.
3. Add transaction-safe appointment booking locks.
4. Fix appointment timezone handling.
5. Convert order payment status from Boolean to a proper enum/state machine.
6. Add audit logs for critical mutations.
7. Add inventory movement and order status history tables.
8. Add stronger public order tracking tokens.
9. Add non-Playwright authenticated smoke tests using seeded test credentials.

### Phase 2 build hotfix 2

Fixed remaining NextAuth `auth()` overload typing issues by replacing `Awaited<ReturnType<typeof auth>>` route helper signatures with the explicit `SessionWithUser` type from `lib/api-guards.ts`. This resolves TypeScript build failures in organization-member and user-management API routes.

