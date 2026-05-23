# Phase 4 — Appointment Production Correctness

Phase 4 hardens the appointment booking workflow after the dashboard/RBAC phases.

## Goals

- Make appointment booking safer under concurrent requests.
- Detect conflicts by service provider and time, not only by service.
- Generate slots in the organization's timezone instead of treating local business hours as UTC.
- Enforce legal appointment status transitions.
- Keep public slot lookup available while keeping appointment records protected.
- Add no-Playwright deployed smoke checks.

## Implemented changes

### Transaction-safe booking

Appointment creation now runs inside a Prisma transaction with `Serializable` isolation. Inside the transaction the service is reloaded, booking settings are checked, conflict detection is performed, and the appointment is created.

### Provider-aware conflicts

When a service has `serviceProviderId`, conflicts are checked across all active appointments for that provider, even if the appointments are for different services. If no provider is configured, the conflict scope falls back to the selected service.

Active appointment statuses are:

- `PENDING`
- `CONFIRMED`

Appointments with `CANCELLED`, `NO_SHOW`, or `COMPLETED` are not treated as blocking future slots.

### Timezone-safe slot generation

Slot generation now converts organization-local business-hour times into UTC using the organization's configured timezone. This avoids the previous behavior where `HH:mm` business hours were interpreted as UTC.

The slot endpoint still returns ISO UTC timestamps so the frontend can render them in the user's locale.

### Booking settings support

Slot generation and booking now respect:

- `slotDuration`
- `bufferBefore`
- `bufferAfter`
- `minBookingNotice`
- `maxBookingAdvance`
- `maxAppointmentsPerDay`
- `autoConfirm`

### Status transitions

Appointment status transitions are now constrained:

| Current | Allowed next statuses |
| --- | --- |
| `PENDING` | `CONFIRMED`, `CANCELLED`, `NO_SHOW` |
| `CONFIRMED` | `COMPLETED`, `CANCELLED`, `NO_SHOW` |
| `COMPLETED` | terminal |
| `CANCELLED` | terminal |
| `NO_SHOW` | terminal |

## Deployed smoke test

Run without Playwright:

```powershell
$env:DEPLOYED_URL="https://your-domain.example"; npm run e2e:deployed:phase4
```

Linux/macOS/Git Bash:

```bash
DEPLOYED_URL=https://your-domain.example npm run e2e:deployed:phase4
```

The test checks:

- homepage reachability,
- unauthenticated appointment list/detail/mutation protection,
- slot endpoint validation,
- public appointment detail privacy requirements.

## Remaining work

Phase 4 does not add a database-level booking lock table. For very high traffic booking workloads, add a dedicated slot/booking-lock table with a unique constraint on provider/time range, or use a PostgreSQL exclusion constraint.
