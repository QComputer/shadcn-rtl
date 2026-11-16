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
