# Bazar Baz

Bazar Baz is a multi-tenant, multi-locale commerce and appointment-booking application built with Next.js 16, TypeScript, Prisma 6, PostgreSQL, Tailwind CSS, and NextAuth.

## Current production-hardening status

The project is being hardened in phases. Each phase includes code changes, documentation, and deployed smoke tests that use Node's built-in `fetch` instead of Playwright.

| Phase | Area | Status | Docs | Deployed smoke test |
| --- | --- | --- | --- | --- |
| 1 | Security/dashboard API baseline | Done | `docs/PHASE_1_SECURITY_BASELINE.md` if present in your tree, plus this README | `npm run e2e:deployed:phase1` |
| 2 | Resource ownership and dashboard API scoping | Done | `docs/PHASE_2_RESOURCE_OWNERSHIP.md` | `npm run e2e:deployed:phase2` |
| 3 | Membership roles and multi-organization groundwork | Done | `docs/PHASE_3_MEMBERSHIP_RBAC.md` | `npm run e2e:deployed:phase3` |
| 4 | Appointment production correctness | Done | `docs/PHASE_4_APPOINTMENT_CORRECTNESS.md` | `npm run e2e:deployed:phase4` |
| 5 | Order/payment production hardening | Done | `docs/PHASE_5_ORDER_PAYMENT_HARDENING.md` | `npm run e2e:deployed:phase5` |

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

## Database migrations

Apply migrations in deployment with your normal Prisma deployment flow, for example:

```bash
npx prisma migrate deploy
```

Phase 5 includes a migration that converts `Order.paymentStatus` from Boolean to the existing `PaymentStatus` enum and adds append-only order/payment history tables.

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

## No-Playwright deployed tests

PowerShell:

```powershell
$env:DEPLOYED_URL="https://your-domain.example"; npm run e2e:deployed:phase1
$env:DEPLOYED_URL="https://your-domain.example"; npm run e2e:deployed:phase2
$env:DEPLOYED_URL="https://your-domain.example"; npm run e2e:deployed:phase3
$env:DEPLOYED_URL="https://your-domain.example"; npm run e2e:deployed:phase4
$env:DEPLOYED_URL="https://your-domain.example"; npm run e2e:deployed:phase5
```

Linux/macOS/Git Bash:

```bash
DEPLOYED_URL=https://your-domain.example npm run e2e:deployed:phase1
DEPLOYED_URL=https://your-domain.example npm run e2e:deployed:phase2
DEPLOYED_URL=https://your-domain.example npm run e2e:deployed:phase3
DEPLOYED_URL=https://your-domain.example npm run e2e:deployed:phase4
DEPLOYED_URL=https://your-domain.example npm run e2e:deployed:phase5
```

These tests are smoke tests. They are not a replacement for full browser automation, but they catch important deployed API security and routing regressions without requiring Playwright.

## Remaining production-hardening roadmap

1. Finish migrating dashboard UI assumptions from global `User.role` to `OrganizationMember.role`.
2. Add authenticated deployed smoke tests using seeded test credentials.
3. Add public order tracking tokens instead of relying on order number and contextual access only.
4. Add inventory movement records for order creation/cancellation/refund.
5. Add audit logs for user/member/product/service/settings mutations.
6. Improve payment gateway integration with signed webhooks, idempotency keys, and amount verification.
7. Add search rate limiting and search indexes.
8. Add stricter TypeScript settings gradually.
9. Fix ESLint configuration to match Next.js 16.
