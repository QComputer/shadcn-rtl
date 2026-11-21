# Reception manual room management — owner requirement, 2026-11-21

Status: REQUIRED FOLLOW-UP. Not implemented or enabled by the draft accommodation PR. Deliver independently from guest experience PR111/PR113. The draft model remains outside operational rooms, availability and bookings until safe promotion.

## Existing building blocks and limits

The existing Hotel operational reservation service has tenant/property authorization, priced quote/hold/reserve commands, confirmation, cancellation, room assignment, check-in and check-out; the reception workspace exposes assignment and lifecycle actions. Physical-room management supports an out-of-service flag and type-level nightly inventory. These are building blocks, not evidence of a complete walk-in workflow: the current service requires RESERVATION operational mode and price/rate-plan backed quote and hold, so independent manual entry with unknown prices is not established. A dated room board, manual source, maintenance periods, guest occupancy history and full edit/reassignment workflow need design and acceptance. The flag alone is not a dated maintenance calendar or a safe way to override occupied/reserved state.

## Required outcome

- Authorized reception/management staff can view all operational physical rooms on a daily and date-range board, derived from dated assignments, reservation lifecycle and maintenance blocks. Distinguish vacant, reserved, occupied and out of service; never make a room available by an arbitrary status toggle.
- Create and manage walk-in, telephone and reception reservations with explicit dates, physical room, party and necessary guest details; preserve source and history. Support confirmation, edits, cancellation, assignment/reassignment, check-in and checkout as distinct audited actions.
- Allow maintenance blocks and unblocks with explicit dates and reason, checking existing assignments and reservations. Define safe conflict resolution, without changing unrelated bookings.
- Reuse the Hotel reservation, authorization and inventory services. Claims from manual and online workflows must share the same tenant/property scoped inventory accounting and transactional locking. Reject overlaps and racing assignments, and preserve occupancy and reservation history.
- Keep draft/unverified accommodations out of operational calculations. Never infer paid status or invent rates; manual entry must work without activation of online payments. Preserve guest privacy and role-scoped access.
- Build a Persian-first responsive reception board and booking form, with English and Arabic labels, clear conflict messages, search, and status colors with text alternatives.

## Acceptance before release

Use isolated PostgreSQL and browser fixtures to prove cross-tenant and unauthorized denial, concurrent manual/manual and manual/online assignment conflicts, room-type inventory consistency, cancellation versus checkout, dated maintenance blocks, no release of occupied rooms, replay/idempotency, source/history persistence, audit rollback and privacy. Exercise dates spanning midnight and property timezone boundaries. Confirm reception operations work without enabling public booking or payment. Rehearse any required additive schema changes before Production, and leave inventory and gates unchanged until accepted.
