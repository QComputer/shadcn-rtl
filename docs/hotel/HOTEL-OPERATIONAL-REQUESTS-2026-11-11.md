# Deployable Hotel coordination requests

This slice adds an operational request portal independent of the fixture-only booking sandbox. It does not activate Production, reserve inventory, confirm rooms, or mark payments as paid.

## Activation and deployment contract

- New migration: `20261111140000_add_hotel_operational_modes_and_stay_requests`. It adds property mode (default `DISABLED`), durable server-priced quotes and guest-owned stay requests. Applying it to a real database requires owner approval.
- The process gate `HOTEL_GUEST_PORTAL_ENABLED=1` and an explicitly configured property mode are both required. The organization must be active HOTEL with active HOTEL_BOOKING capability. No environment or live property setting has been changed.
- ADMIN/SUPER_ADMIN can configure `DISABLED` or `REQUEST_ONLY` through the same-origin authenticated PATCH endpoint. MANAGER/STAFF can review requests but cannot activate a property. The reserved RESERVATION enum does not enable an operational booking/payment flow in this slice.
- Guest/reception page: `/{locale}/hotel/{organizationId}/{propertyId}`. Guest API: `/api/organizations/{organizationId}/hotels/{propertyId}/stay-requests`. Host-verified customer context and active membership are mandatory; client organization IDs do not authorize access.

## Functional behavior

Shared server pricing freezes nightly rates, TOMAN currency and cancellation-policy version. Quotes expire after ten minutes. A guest explicitly submits name/message and gets a durable request, scoped history and cancellation. Reception sees its property's requests and marks them CONTACTED or DECLINED. CONTACTED remains cancellable; DECLINED/CANCELLED are terminal.

Action idempotency and quote-row locking serialize retries. A quote owns at most one request. Request-only actions never create or change HotelBookingHold, HotelReservation, nightly inventory or financial records. No simulated payment command is accepted by the operational API. The original sandbox runtime/database gate remains intact.

Damoon's contact summary asks a same-origin read-only endpoint for the verified host's single enabled property and adds a localized portal link only when available. Stay query fields survive the link and login callback. Unknown child ages remain unknown and must be entered. OTP callback handling preserves only safe same-origin paths.

## Validation and remaining work

- Disposable PostgreSQL acceptance covers immutable quote snapshots, duplicate/concurrent requests, foreign tenant/account/resource denial, reception/customer role separation, closure, default-off modes and unchanged inventory/payment counts.
- The new migration was executed transactionally against the owned disposable PostgreSQL instance, after asserting the new tables were empty. No real migration ran.
- Shared authorization/pricing extraction was checked with the existing sandbox PostgreSQL regression; strict sandbox gate units still pass.
- Installed Chrome acceptance passed the authenticated guest quote/request/history/cancellation flow and reception contact/decline flow with two tenant domains, plus the real Damoon contact-page link against the new API. The browser mapped the owned `damoon-hotel.ir` fixture to loopback; no public hotel was contacted. Receipt `.tmp/hotel-stay-requests/http.result.json`: PASSED / exitCode 0 / cleanup PASSED. This browser run covers English desktop; fa/ar copy is implemented, not separately browser-accepted here.
- Local TypeScript and scoped ESLint passed; callback safety units and portal-link/public-bundle tests passed. Provider/physical-device OTP acceptance is not claimed by the callback change.
- PR54 integrates the original PR48 frontend and PR49–53 stack; both combined CI checks passed at `019b04fc`. Original branches/commits remain preserved.

Operational Hold/Reservation, verified provider reconciliation, operational room assignment and arrival/departure remain the next slice; the tested fixture-only variants are not represented as operational acceptance here. Real gateway/SMS enablement, database migration and main/Production publication remain owner-controlled.
