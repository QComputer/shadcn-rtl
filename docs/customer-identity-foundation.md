# Customer Identity Foundation

This milestone adds an organization-scoped customer identity layer for future CRM, loyalty, campaign, USSD, iMenu, iCV, iAM, EBC, and AI assistant workflows.

## Architectural Principle: Guest-First, Identity-Optional

**`OWNER_APPROVED`** — See `docs/architecture/ADR-GUEST-FIRST-IDENTITY-OPTIONAL.md`

This foundation operates within the Guest-first architecture:

- **`Visitor`** — Unauthenticated browser actor (not a `UserRole`)
- **`Guest`** — Interaction state without registered account (not a `UserRole`)
- **`GuestCustomer`** — Persisted data entity supporting guest interactions (cart, checkout, appointment, hotel enquiry)
- **`CUSTOMER`** — Authenticated `User` with `role: "CUSTOMER"`
- **`CustomerIdentity`** — Organization-scoped customer relationship and interaction history (this foundation)
- **`CustomerClubMembership`** — Explicit per-organization membership (opt-in, audited)

**Invariants:**
- No `GUEST` UserRole introduced
- Phone/email verification at interaction ≠ account creation
- Guest-to-CUSTOMER conversion is optional, explicit, secure, idempotent, non-destructive
- Cross-tenant claiming via phone/email/name alone is prohibited
- Tenant isolation mandatory at every layer

## Runtime authority

Customer identity is scoped by `organizationId`. The same phone or email in two organizations resolves to two different `CustomerIdentity` records. Phone lookup uses a tenant-scoped SHA-256 hash so cross-organization lookup keys are not shared.

## Models

- `CustomerIdentity`: durable organization-scoped customer identity with optional links to an existing `User`, `GuestCustomer`, phone, email, external identifiers, and metadata.
- `CustomerInteraction`: append-only interaction timeline for a customer identity. Interactions can optionally link to an organization integration and a business event.
- `BusinessEvent.customerIdentityId`: optional event-to-customer link for integration/business automation.
- `UssdSession.customerIdentityId`: optional USSD session-to-customer link while preserving the older `customerId` and `guestCustomerId` fields.

## Guest-to-CUSTOMER Linking

`CustomerIdentity` may link to a `GuestCustomer` to preserve interaction history when a guest converts to a registered CUSTOMER:

- Linking is **non-destructive** — `GuestCustomer` record retained for audit
- Linking is **idempotent** — safe to retry
- Linking requires **verified phone ownership** (OTP) and **explicit user action**
- Conflict resolution: if `User` exists with same verified phone in same organization → `RECONCILIATION_REQUIRED` (manual resolution, no automatic claiming)

## Safety

The foundation is additive. It does not alter existing customer, order, appointment, campaign, loyalty, or import semantics. Metadata and payload surfaces reuse the existing integration secret-key rejection policy, so secret-like keys must remain in credential stores rather than JSON metadata.

## USSD readiness

`startUssdSession()` can now resolve or attach a customer identity from a phone/user/guest signal, record the business event against that identity, and append a `USSD_SESSION_STARTED` interaction. This prepares the `*87788778#` flow for future customer history and CRM integrations without building the full USSD product workflow.

## Related Documents

- `docs/architecture/ADR-GUEST-FIRST-IDENTITY-OPTIONAL.md` — Architectural principle
- `docs/identity/GUEST-FIRST-ACCESS-MATRIX.md` — Capability access by actor
- `docs/identity/GUEST-TO-CUSTOMER-LIFECYCLE.md` — Complete lifecycle stages
- `plans/guest-first-implementation-plan.md` — Engineering execution (GF3 covers conversion)
