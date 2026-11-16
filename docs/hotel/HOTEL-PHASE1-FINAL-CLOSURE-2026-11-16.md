# Hotel Damoon Phase 1 — Final Closure

**Status: `HOTEL_PHASE1_CLOSED`**

**Closure date:** 2026-11-16

**Production:** Runflare PostgreSQL and Runflare application; no Production credentials are recorded here.

## Accepted source and implementation

- Pre-activation merged baseline: `8f16d3f9bd75321e660c7b5673546e9470e36652` (PR86).
- PR87 exact tested head: `cc6ad203217d03b523ac653df51c978d3e4a063a`.
- PR87 normal merge commit and final accepted source: `24604ccc939a64a03b948c2a5b9af40586d817c8`.
- Hotel implementation reused from PR81–PR86: public guest requests and reception, operational reservations and offline payments, inventory/room/rate management, owner-only availability preview, and HOTEL-only dashboard/navigation behavior.
- PR87 added the narrow, idempotent, platform-SUPER_ADMIN activation path for `HOTEL_BOOKING`. It does not replace the tenant's capability set or activate public booking, payment, SMS, or other business capabilities.

## Production configuration evidence

The existing `DB_REMOTE_URI` was used without printing or recording it. The target was checked against non-secret Runflare database metadata before querying. Each verification used a PostgreSQL `BEGIN READ ONLY` transaction, a five-second statement timeout, confirmed `transaction_read_only=on`, SELECT-only statements, and `ROLLBACK`.

Verified records:

| Record | Result |
|---|---|
| Organization | ID `cmvbltspu0000jt08zfn7xltj`, slug `damoon-hotel`, vertical `HOTEL`, active and not deleted |
| Domain | Primary `www.damoon-hotel.ir`, normalized domain `damoon-hotel.ir`, ACTIVE and verified |
| HotelProperty | ID `cmvbltsrc0009jt08k3o8jdip`, slug `damoon-hotel`, active and not deleted |
| `damoon` membership | Active user and active `ADMIN` membership in the exact Damoon organization |
| `HOTEL_BOOKING` before activation | Absent |
| `HOTEL_BOOKING` after activation | ID `cmwjp10l80001l10jm3crvvqd`, `ACTIVE`, `enabledAt=2026-11-16T20:05:40.027Z`, `disabledAt=null` |
| Existing `HOTEL_WEBSITE` | Still `ACTIVE`; its existing activation timestamp and row were preserved |
| Other capability rows | No additional capability rows were present in the post-activation read |

The activation audit is `cmwjp10lz0003l10jmd22b3o8`, action `UPDATE`, entity `OrganizationCapability`, and references the capability and Damoon organization above. The joined actor record is active `SUPER_ADMIN`. The audit records the previous state as absent and the resulting `ACTIVE` state, activation timestamp, and property ID. Its recorded database timestamp is `2026-11-16 20:05:40.055` (timezone not inferred). No unrelated organization or capability was changed by the activation.

## Owner and technical acceptance

The owner explicitly confirmed **FINAL LIVE ACCEPTANCE** of Hotel Damoon Phase 1 on 2026-11-16. This is recorded as the owner's acceptance, not as a separately captured Codex browser session. The owner-provided confirmation is the live acceptance evidence for this closure.

All required CI gates passed on PR87 head `cc6ad203217d03b523ac653df51c978d3e4a063a`:

| Gate | Result |
|---|---|
| RunFlare TypeScript | PASS — [workflow 43943221133](https://github.com/QComputer/shadcn-rtl/actions/runs/43943221133) |
| Focused regressions | PASS — [workflow 43943221071](https://github.com/QComputer/shadcn-rtl/actions/runs/43943221071) |
| Hotel operational PostgreSQL and browser acceptance | PASS — [workflow 43943221079](https://github.com/QComputer/shadcn-rtl/actions/runs/43943221079) |
| Damoon request-to-reception acceptance | PASS — [workflow 43943221237](https://github.com/QComputer/shadcn-rtl/actions/runs/43943221237) |

The disposable acceptance exercised the existing Hotel operational, capacity, payment, tenant-denial, and guest/reception paths. Production records were inspected read-only; no real reservation, payment, inventory edit, migration, or other tenant mutation was performed for this closure.

## Operational handoff and boundaries

- `damoon` remains an organization `ADMIN`; manager/staff and cross-tenant permissions continue to be governed by the existing API authorization and property scope.
- Only `HOTEL_BOOKING` was activated. No SHOP/APPOINTMENT capability, public publication gate, live payment provider, SMS, or notification gate was activated by PR87 or this closure.
- No Production migration was run.
- Existing owner-provided room/rate/policy facts and publication approvals remain governed by their source and approval records. This closure does not convert demo values, concept media, or unapproved content into confirmed public hotel information.
- If a future rollback is required, do not issue ad hoc SQL or use the full capability-set replacement endpoint. A platform SUPER_ADMIN must use a reviewed, audited per-capability deactivation procedure that preserves `HOTEL_WEBSITE`; if that path is unavailable, obtain a small reviewed change before reversing the activation. No rollback was needed or performed.
- Post-Hotel G0 is eligible to be requested. It is **not approved or started**; separate owner approval is still required. No OTP/SMS implementation or real SMS send occurred in this task.

## Closure decision

The source is merged, exact-head CI passed, Production `HOTEL_BOOKING` and its audit were verified read-only, existing capability state was preserved, and the owner supplied final live acceptance. Therefore the required Phase 1 gates are complete: **`HOTEL_PHASE1_CLOSED`**.
