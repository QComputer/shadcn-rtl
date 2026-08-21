# Customer Identity Foundation

This milestone adds an organization-scoped customer identity layer for future CRM, loyalty, campaign, USSD, iMenu, iCV, iAM, EBC, and AI assistant workflows.

## Runtime authority

Customer identity is scoped by `organizationId`. The same phone or email in two organizations resolves to two different `CustomerIdentity` records. Phone lookup uses a tenant-scoped SHA-256 hash so cross-organization lookup keys are not shared.

## Models

- `CustomerIdentity`: durable organization-scoped customer identity with optional links to an existing `User`, `GuestCustomer`, phone, email, external identifiers, and metadata.
- `CustomerInteraction`: append-only interaction timeline for a customer identity. Interactions can optionally link to an organization integration and a business event.
- `BusinessEvent.customerIdentityId`: optional event-to-customer link for integration/business automation.
- `UssdSession.customerIdentityId`: optional USSD session-to-customer link while preserving the older `customerId` and `guestCustomerId` fields.

## Safety

The foundation is additive. It does not alter existing customer, order, appointment, campaign, loyalty, or import semantics. Metadata and payload surfaces reuse the existing integration secret-key rejection policy, so secret-like keys must remain in credential stores rather than JSON metadata.

## USSD readiness

`startUssdSession()` can now resolve or attach a customer identity from a phone/user/guest signal, record the business event against that identity, and append a `USSD_SESSION_STARTED` interaction. This prepares the `*87788778#` flow for future customer history and CRM integrations without building the full USSD product workflow.
