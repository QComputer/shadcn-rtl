# Bazar Baz

Bazar Baz is a multi-tenant, multi-locale commerce and appointment-booking application built with Next.js 16, TypeScript, Prisma 6, PostgreSQL, Tailwind CSS, shadcn-style UI components, and NextAuth.

## Production-hardening status

The project is being hardened in phases. Each phase includes code changes, documentation, and deployed smoke tests that use Node's built-in `fetch` instead of Playwright.

| Phase | Area | Status | Docs | Deployed smoke test |
| --- | --- | --- | --- | --- |
| 1 | Security/dashboard API baseline | Done | `docs/PHASE_1_SECURITY_DASHBOARD_API.md` | `npm run e2e:deployed:phase1` |
| 2 | Resource ownership and dashboard API scoping | Done | `docs/PHASE_2_RESOURCE_OWNERSHIP.md` | `npm run e2e:deployed:phase2` |
| 3 | Membership roles and multi-organization groundwork | Done | `docs/PHASE_3_MEMBERSHIP_RBAC.md` | `npm run e2e:deployed:phase3` |
| 4 | Appointment production correctness | Done | `docs/PHASE_4_APPOINTMENT_CORRECTNESS.md` | `npm run e2e:deployed:phase4` |
| 5 | Order/payment production hardening | Done | `docs/PHASE_5_ORDER_PAYMENT_HARDENING.md` | `npm run e2e:deployed:phase5` |
| 6 | Dashboard FullCalendar/shadcn calendar upgrade | Done | `docs/PHASE_6_DASHBOARD_CALENDAR.md` | `npm run e2e:deployed:phase6` |
| 7 | Uploads/images/QR media hardening | Done | `docs/PHASE_7_MEDIA_HARDENING.md` | `npm run e2e:deployed:phase7` |
| 8 | Audit, soft-delete, and notifications cleanup | Done | `docs/PHASE_8_AUDIT_SOFTDELETE_NOTIFICATIONS.md` | `npm run e2e:deployed:phase8` |
| 9 | Quality gates, smoke aggregation, and docs cleanup | Done | `docs/PHASE_9_QUALITY_GATES.md` | `npm run e2e:deployed:phase9` |

## Development

Install dependencies:

```bash
npm install
```

Generate Prisma client:

```bash
npm run db:generate
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

## Quality gates

Before producing or deploying a phase ZIP, run as much of this set as your environment allows:

```bash
npm run db:generate
npm run db:validate
npm run typecheck
npm run quality:local
npm run build
```

`quality:local` validates project documentation, deployed smoke scripts, and recurring regression patterns that were fixed in earlier phases.

## Database migrations

Apply migrations in deployment with:

```bash
npm run db:migrate
```

or:

```bash
npx prisma migrate deploy
```

Important migration notes:

- Phase 3 adds organization-member roles and removes the single-membership uniqueness restriction.
- Phase 5 converts `Order.paymentStatus` from Boolean to the `PaymentStatus` enum and adds append-only order/payment history tables.
- Phase 7 adds image ownership/metadata fields.
- Phase 8 adds notification timestamps and read metadata.

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
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase1
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase2
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase3
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase4
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase5
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase6
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase7
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase8
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase9
```

Run all deployed smoke tests:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:all
```

Linux/macOS/Git Bash:

```bash
DEPLOYED_URL=https://zc0.runflare.run npm run e2e:deployed:all
```

These smoke tests are not a replacement for full browser automation, but they catch important deployed API security and routing regressions without requiring Playwright.

## Phase notes

### Phase 6 calendar

The dashboard calendar phase was adapted after reviewing the uploaded `full-calendar-main.zip` source. The implementation keeps Bazar Baz's guarded appointment APIs and uses a shadcn-styled FullCalendar dashboard with month/week/day views, provider/service/status filters, appointment detail dialogs, and server-enforced appointment status transitions.

`/[locale]/dashboard/appointments` uses the same `AppointmentFullCalendar` component as `/[locale]/dashboard/calendar`, so appointment management and calendar scheduling share the same API/filter/status-action path.

### Phase 7 media

Uploads now require authentication, validate image type/signature/size, store ownership metadata, and use consistent storage helpers. Image deletion and QR image saving are authenticated and audited. Public QR image generation remains available because it does not persist data.

### Phase 8 notifications and audit

Dashboard notification polling uses a single cleaned-up interval and stops on auth failures. Notifications now include `createdAt`, `updatedAt`, and `readAt`. Dashboard statistics filter soft-deleted records where applicable. Critical user/member/settings mutations write audit logs.

### Phase 9 quality gates

Phase 9 adds local validation and aggregate deployed smoke testing. Use `npm run quality:local` before packaging future changes and `npm run e2e:deployed:all` after deployment.

## Remaining production-hardening roadmap

1. Add authenticated deployed smoke tests using seeded test credentials.
2. Add a guarded staff/admin appointment-create endpoint, then enable create-from-slot in the dashboard calendar.
3. Add safe drag/drop calendar rescheduling after server-side conflict checks are available.
4. Finish migrating dashboard UI assumptions from global `User.role` to `OrganizationMember.role` where any legacy UI assumptions remain.
5. Add public order tracking tokens instead of relying on order number and contextual access only.
6. Add inventory movement records for order creation/cancellation/refund.
7. Improve payment gateway integration with signed webhooks, idempotency keys, and amount verification.
8. Add search rate limiting and search indexes.
9. Add stricter TypeScript settings gradually.
10. Fix ESLint configuration to match Next.js 16.


## Phase 10 — Authentication and security headers

Phase 10 hardens login/account behavior and baseline HTTP security headers.

Important changes:

- Credentials login supports username, email, or phone.
- Disabled, deleted, or temporarily locked users cannot sign in.
- Failed login attempts are counted and locked for 15 minutes after 5 failures.
- Successful login resets failure counters and records `lastLoginAt`.
- Google sign-in is restricted to existing active users.
- Baseline security headers are configured in `next.config.ts`.
- Public search has conservative per-IP rate limiting.

Run the deployed Phase 10 smoke test:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase10
```

Run all deployed smoke tests:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:all
```
