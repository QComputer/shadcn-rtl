# Hotel Damoon owner decisions — 2026-11-17

Status: `OWNER_APPROVED_PENDING_APPLICATION`

This record captures the owner's explicit schedule decision for the existing
Hotel Damoon property. It does not claim the Production property has been
updated.

## Approved schedule

| Setting | Approved value | Evidence state |
| --- | --- | --- |
| Check-in | `14:00` | `OWNER_CONFIRMED` |
| Check-out | `12:00` (noon) | `OWNER_CONFIRMED` |

Target scope:

- Organization: `cmvbltspu0000jt08zfn7xltj`
- Property: `cmvbltsrc0009jt08k3o8jdip`

The approval applies only to this property. Do not change the global Prisma
default, another property, or unrelated configuration.

## Application state

A strictly read-only Runflare PostgreSQL inspection on 2026-11-17 verified the
target organization as active with vertical `HOTEL`, the target property as
active, and active `HOTEL_BOOKING` and `HOTEL_WEBSITE` capabilities. The
property's observed values were check-in `14:00` and check-out `11:00`.

The Production migration history is not yet safe to advance through the normal
migration workflow: five current source migrations are absent from the ledger,
27 completed migration checksums differ from current source, four rolled-back
history rows exist, and three successful-migration ordering inversions are
present. The relevant schema objects from the five missing migrations are also
absent. See `PRODUCTION-SCHEMA-PREFLIGHT-2026-11-17.md`.

No migration, property update, or other Production write was performed. The
existing property-management route and `HotelManagementService.updateProperty`
provide the tenant-scoped update path once schema compatibility and migration
authorization are established. After that, send only `{ "checkOutTime":
"12:00" }` through the authorized management route, then verify the exact
property with a separate read-only transaction and confirm public/admin display.

## Questionnaire V2 source-file integrity

Status: `VERIFIED` for byte-level source-file comparison only.

The supplied standalone `damoon-rooms-draft.json` and the questionnaire ZIP
entry `Damoon_31_Unit_Draft_Only_Manifest_V2_2026-11-17.json` are byte-identical:

- Size of each JSON: `26528` bytes.
- SHA-256 of each JSON: `55a6ed70aeaf0f75e81ad665ddffa5b68b47854735d7b971427b9fb93484f7db`.
- ZIP CRC check: passed.

This verifies that the two supplied V2 source copies match. It does not verify
the factual accuracy of proposed per-unit room classifications or details. The
source's `MODEL_GUESS_ONLY` / `MODEL_ASSUMED` and `DRAFT_ONLY` boundaries remain
in force: the draft is not importable, saleable, public room data, or evidence
of actual rates, beds, amenities, floor, or availability. The normalized
reconciliation manifest is a separate derivative and is not byte-identical to
the V2 source. No Production room, rate, inventory, or booking data was changed.
