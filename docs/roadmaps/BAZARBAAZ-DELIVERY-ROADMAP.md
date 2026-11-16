# Bazarbaaz Delivery Roadmap

Updated: 2026-11-16. Acceptance evidence belongs to the exact source SHA and environment that produced it.

| Order | Milestone | Acceptance gate | Status |
|---|---|---|---|
| 1 | Hotel Damoon Phase 1 owner acceptance | Owner live acceptance, audited Production `HOTEL_BOOKING` state, active tenant/property, and exact-SHA technical acceptance | **`HOTEL_PHASE1_CLOSED`** — see [final closure record](../hotel/HOTEL-PHASE1-FINAL-CLOSURE-2026-11-16.md) |
| 2 | PR87 safe Hotel capability activation path | Additive, idempotent, tenant-confirmed SUPER_ADMIN operation; preserves existing capabilities and records before/after audit | Merged as `24604ccc939a64a03b948c2a5b9af40586d817c8`; exact-head CI passed |
| 3 | Post-Hotel identity, membership, OTP and SMS G0 | Separate owner approval to begin G0; fresh audit against the then-current main; no Production mutation | **Eligible to request G0 approval; not approved or started** — see [post-Hotel roadmap](./BAZARBAAZ-POST-HOTEL-P1-IDENTITY-MEMBERSHIP-OTP-SMS-ROADMAP-2026-11-16.md) |

Historical PR64 sequencing and its local-only acceptance snapshot are superseded by the merged PR81–PR87 Hotel work and the closure evidence above. They are retained in Git history, not treated as current acceptance.

## Delivery constraints

- Keep guest accommodation requests distinct from confirmed reservations and payments.
- Use locked dependencies and ephemeral CI fixtures. Avoid redundant builds and repeated successful CI.
- Preserve unrelated worktrees/files. Stage only task-owned paths.
- No Production database, Runflare settings, live booking, payment, SMS or `main` changes without the applicable owner authorization.
- Keep the UI scoped to necessary workflow behavior; avoid broad redesign and duplicate booking logic.
- `HOTEL_BOOKING` activation does not approve public reservations, real payments, public content, or SMS. Each remains governed by its existing independent gate.
