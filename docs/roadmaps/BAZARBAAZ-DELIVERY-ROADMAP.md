# Bazarbaaz Delivery Roadmap

Updated: 2026-11-20. Acceptance evidence belongs to the exact source SHA and environment that produced it.

| Order | Milestone | Acceptance gate | Status |
|---|---|---|---|
| 1 | Hotel Damoon Phase 1 owner acceptance | Owner live acceptance, audited Production `HOTEL_BOOKING` state, active tenant/property, and exact-SHA technical acceptance | **`HOTEL_PHASE1_CLOSED`** — see [final closure record](../hotel/HOTEL-PHASE1-FINAL-CLOSURE-2026-11-16.md) |
| 2 | PR87 safe Hotel capability activation path | Additive, idempotent, tenant-confirmed SUPER_ADMIN operation; preserves existing capabilities and records before/after audit | Merged as `24604ccc939a64a03b948c2a5b9af40586d817c8`; exact-head CI passed |
| 3 | Post-Hotel identity, membership, OTP and SMS G0 | Separate owner approval to begin G0; fresh audit against the then-current main; no Production mutation | **Eligible to request G0 approval; not approved or started** — see [post-Hotel roadmap](./BAZARBAAZ-POST-HOTEL-P1-IDENTITY-MEMBERSHIP-OTP-SMS-ROADMAP-2026-11-16.md) |
| 4 | **Guest-First, Identity-Optional Architecture** | Architectural principle `OWNER_APPROVED`; GF0–GF5 workstreams defined; implementation requires separate approval per milestone | **Documentation complete** — see [ADR](../architecture/ADR-GUEST-FIRST-IDENTITY-OPTIONAL.md), [Access Matrix](../identity/GUEST-FIRST-ACCESS-MATRIX.md), [Lifecycle](../identity/GUEST-TO-CUSTOMER-LIFECYCLE.md), [Implementation Plan](../../plans/guest-first-implementation-plan.md) |

Historical PR64 sequencing and its local-only acceptance snapshot are superseded by the merged PR81–PR87 Hotel work and the closure evidence above. They are retained in Git history, not treated as current acceptance.

## Guest-First Workstream (GF0–GF5)

Parallel to G0–G9, the following Guest-first milestones are defined in `plans/guest-first-implementation-plan.md`:

| Milestone | Name | Priority | Status |
|---|---|---|---|
| **GF0** | Guest Cart & Checkout Foundation (SHOP) | P0 | `PLANNED` |
| **GF1** | Secure Guest Appointment Tracking | P0 (P0-A) | `PLANNED` |
| **GF2** | Hotel Guest Enquiry Decoupling | P0 (P0-B) | `PLANNED` |
| **GF3** | Guest-to-CUSTOMER Conversion | P1 | `PLANNED` |
| **GF4** | CustomerClubMembership & Consent | P1 | `PLANNED` |
| **GF5** | Cross-Domain SSO & PWA Integration | P2 | `PLANNED` |

**P0 Security Findings:**
- **P0-A**: Public appointment phone lookup exposes PII → Fixed in GF1
- **P0-B**: Hotel guest enquiry coupled to operational flag → Fixed in GF2

`OWNER_APPROVED` applies to the architectural principle only. GF0–GF5 execution requires separate owner approval.

## Delivery constraints

- Keep guest accommodation requests distinct from confirmed reservations and payments.
- Use locked dependencies and ephemeral CI fixtures. Avoid redundant builds and repeated successful CI.
- Preserve unrelated worktrees/files. Stage only task-owned paths.
- No Production database, Runflare settings, live booking, payment, SMS or `main` changes without the applicable owner authorization.
- Keep the UI scoped to necessary workflow behavior; avoid broad redesign and duplicate booking logic.
- `HOTEL_BOOKING` activation does not approve public reservations, real payments, public content, or SMS. Each remains governed by its existing independent gate.
