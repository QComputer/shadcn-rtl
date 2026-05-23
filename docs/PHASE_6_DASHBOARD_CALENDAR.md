# Phase 6 — Dashboard Calendar FullCalendar/shadcn Upgrade

## Scope

Phase 6 replaces the legacy dashboard appointment calendar with a FullCalendar/shadcn-styled calendar experience. After the user uploaded `full-calendar-main.zip`, the implementation was reviewed against that source and adapted rather than copied wholesale: Bazar Baz keeps its own appointment APIs, RBAC guards, Persian/RTL UI, and Phase 4 appointment correctness rules, while adopting the source's dashboard-oriented calendar layout approach, header controls, filtered event views, modal details, and shadcn-style composition.

## Updated behavior

- `/[locale]/dashboard/calendar` now renders a FullCalendar-backed appointment calendar.
- Supports month, week, and day views.
- Supports RTL display for Persian and Arabic locales.
- Loads appointments from `/api/appointments` using the visible calendar range.
- Filters by appointment status, service provider, and service.
- Calendar provider filtering is backed by `serviceProviderId` query support in `/api/appointments`.
- Loads provider filters from `/api/organizations/[id]/members` after resolving the current user's active membership.
- Loads service filters from `/api/services` for the current organization.
- Appointment events use status-aware visual styling.
- Clicking an appointment opens a shadcn dialog with service, customer, phone, provider, time, notes, and status actions.
- Status actions use the existing guarded `/api/appointments/[id]` PATCH route and Phase 4 status-transition rules.
- Selecting an empty calendar slot does not create an appointment directly yet; it shows guidance to use the existing booking/appointment flow. This avoids the previous dashboard behavior that could accidentally create appointments against the signed-in staff/admin user instead of the intended customer.

## Production notes

The calendar intentionally does not bypass appointment APIs or create a separate data path. The following Phase 1–5 protections remain in effect:

- unauthenticated appointment APIs are blocked;
- staff only sees provider-scoped data where applicable;
- admins/managers are organization-scoped;
- appointment transitions are server-enforced;
- dashboard mutations are still server-side guarded.

## No-Playwright deployed smoke test

PowerShell:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase6
```

Linux/macOS/Git Bash:

```bash
DEPLOYED_URL=https://zc0.runflare.run npm run e2e:deployed:phase6
```

The test verifies:

- homepage is reachable;
- dashboard calendar page does not return a server error for unauthenticated users;
- appointment list remains blocked unauthenticated;
- membership provider-filter data remains blocked unauthenticated;
- service filter data remains blocked unauthenticated;
- appointment status mutation remains blocked unauthenticated.

## Follow-up items

- Add an authenticated deployed test once a stable test login flow exists.
- Add a dedicated staff/admin appointment-create API that can create appointments for a selected customer/guest, then enable create-from-slot in the calendar.
- Add drag/drop or resize only after the API supports safe rescheduling with provider/time conflict checks.

## Runtime hotfix: appointment pagination query coercion

After deployment, the FullCalendar dashboard requested appointments with `pageSize=500` from the query string. Query parameters arrive as strings, while Prisma `take` requires an integer. The appointment API and service now normalize `page` and `pageSize` before calling Prisma, and `pageSize` is capped at 500 for calendar-style range loading.

Validation performed for this hotfix:

- Parsed/transpiled all TS/TSX/JS/MJS files successfully.
- Confirmed `appointmentService.list()` accepts numeric or string pagination inputs safely.
- Confirmed `/api/appointments` converts query pagination values before passing them to the service.

## Follow-up: `/dashboard/appointments` calendar integration

The `/[locale]/dashboard/appointments` workspace now uses the same `AppointmentFullCalendar` component as `/[locale]/dashboard/calendar`. This keeps appointment management and calendar scheduling on one shared UI/data path instead of maintaining a separate legacy list implementation.

Updated behavior:

- `/dashboard/calendar` remains the primary calendar workspace.
- `/dashboard/appointments` now renders the same FullCalendar/shadcn appointment workspace with an appointment-management title and description.
- Both pages use the same appointment API, filters, status actions, provider/service loading, and Phase 4 status-transition rules.
- The legacy appointments page code path that fetched `/api/appointments` independently and attempted delete/edit links to non-existing dashboard detail pages has been removed.
- The Phase 6 deployed smoke test now also verifies that `/fa/dashboard/appointments` does not server-error for unauthenticated requests.

Validation performed for this follow-up:

- Parsed/transpiled all TS/TSX/JS/MJS files successfully.
- Confirmed `AppointmentFullCalendar` accepts optional `title` and `description` props while keeping `/dashboard/calendar` backward compatible.
- Confirmed the no-Playwright Phase 6 smoke script parses successfully.
