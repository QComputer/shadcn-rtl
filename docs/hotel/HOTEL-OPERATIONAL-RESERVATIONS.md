# Operational reservations

The deployable API is `/api/organizations/:organizationId/hotels/:propertyId/reservations`; the authenticated page is `/:locale/hotel-reservations/:organizationId/:propertyId`.

Both `HOTEL_GUEST_PORTAL_ENABLED=1` and `HOTEL_OPERATIONAL_RESERVATIONS_ENABLED=1`, plus persisted property mode `RESERVATION`, are required. All are independent of the strict Sandbox gate. Defaults remain disabled. ADMIN membership can configure mode; customers require domain-validated Customer Context and active membership.

Existing pricing and atomic repositories perform Quote → Hold → PENDING_PAYMENT reservation. Price, currency, policy/version, resource and capacity are revalidated before hold/reservation. Holds reserve stock atomically. Request-driven cleanup releases expired holds and pending reservation inventory; no scheduler is enabled. Guest history is scoped to owned operational quotes. Request conversion always requotes current terms.

Reception mutations use reservation/room locks and existing lifecycle guards. Cancellation uses the accepted atomic inventory release, without inventing a refund. Commands have durable tenant/actor/property-bound idempotency and operation history. Confirmation remains a payment verification boundary, never a browser-supplied status.

Validation is tied to the commit and CI, not Production. Isolated PostgreSQL exercises two tenants/shared identity, contention, replay, stale price/policy, gate-off and expiry. Production migration, flags, providers and main require separate owner authorization.

Chrome acceptance on two verified fixture domains passed guest quote/hold/reserve, tenant-bound history/denials and reception room assignment/check-in/check-out. Reception confirmation was an explicit synthetic fixture; paidAmount stayed zero, so this is not gateway/financial acceptance. The final receipt is `.tmp/hotel-operational-reservations/http.result.json` (PASSED, exitCode 0, cleanup PASSED). Payment work is excluded from this package.
