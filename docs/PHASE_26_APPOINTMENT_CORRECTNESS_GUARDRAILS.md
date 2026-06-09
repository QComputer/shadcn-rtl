# Phase 26 — Appointment Correctness Guardrails

Date: 2026-06-09

## Goal

P26 hardens appointment creation/rescheduling so server-side API paths enforce the same core scheduling safety that slot generation already implied.

This phase is intentionally narrow. It does not redesign the booking UI, add payment/clinical workflows, or rewrite appointment architecture.

## Source changes

### Appointment service

Updated `lib/services/appointment.service.ts`:

- Added `findApplicableBusinessHours()` to resolve provider-specific business hours first and organization-wide hours second.
- Added `assertAppointmentFitsBusinessWindow()` to reject appointment creation/rescheduling outside configured open hours.
- Added `buildGuardedAppointmentWindow()` to consistently apply `bufferBefore` and `bufferAfter` in conflict detection.
- Creation now enforces business hours before writing an appointment.
- Rescheduling now enforces business hours before updating an appointment.
- Creation/rescheduling conflict checks now use the guarded appointment window.
- Slot generation now shares the same business-hour resolver.

### Validator

Added `scripts/quality/validate-appointment-correctness.mjs` and `pnpm run quality:appointment-correctness`.

The aggregate project validator now runs the P26 validator through `quality:local`.

## Validation

Required target validation:

```powershell
pnpm run quality:appointment-correctness
pnpm run typecheck
pnpm run build
pnpm run quality:local
```

## Known remaining risks

- This phase does not add real browser E2E for booking/rescheduling.
- This phase does not redesign provider availability beyond existing `BusinessHour` records.
- This phase does not add custom holiday/closed-day calendars.
- This phase does not add distributed/concurrent appointment race tests.

## Recommended next phase

P27 — i18n / RTL completion audit.
