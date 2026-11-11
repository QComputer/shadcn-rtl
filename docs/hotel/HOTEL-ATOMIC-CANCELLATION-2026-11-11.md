# Atomic Hotel cancellation — 2026-11-11

Prisma-backed PENDING_PAYMENT and CONFIRMED hold-backed cancellations now lock the reservation, validate and lock every booked inventory night, decrement all nights, clear physical room claims and mark CANCELLED in one transaction. Missing or insufficient inventory fails without partial changes. A stale status or retry cannot release twice. Settlement uses the same reservation lock.

The application service prefers this path for supported states. Legacy HELD/domain doubles retain their previous behavior. Per-night prices, paidAmount, refundedAmount and payment allocations remain unchanged; the returned cancellation policy calculation is a quote, never a provider refund. First-night penalty calculations now receive the stored first-night rate.

Validation: targeted service units; guarded PostgreSQL fixtures for duplicate cancellation, two-tenant denial, missing/insufficient inventory rollback, room reuse and preserved money; the verified-payment race test now invokes this actual cancellation method inside the competing transaction. CI repeats both PostgreSQL tests. No routes, feature flags, Production data or provider configuration are activated.
