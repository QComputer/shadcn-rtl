# ADR: Guest-First, Identity-Optional Architecture

**Status:** `OWNER_APPROVED`

**Date:** 2026-11-20

**Decision Makers:** Product Owner, Architecture Team

**Related Documents:**
- `docs/identity/GUEST-FIRST-ACCESS-MATRIX.md`
- `docs/identity/GUEST-TO-CUSTOMER-LIFECYCLE.md`
- `plans/guest-first-implementation-plan.md`
- `docs/roadmaps/BAZARBAAZ-POST-HOTEL-P1-IDENTITY-MEMBERSHIP-OTP-SMS-ROADMAP-2026-11-16.md`

---

## Context

BazarBaaz serves multiple tenant types (SHOP, APPOINTMENT, HOTEL) through independent websites, PWAs, and custom domains. Historically, the platform has conflated several distinct concepts:

- Authentication (proving who you are)
- Authorization (what you can do)
- Ownership verification (proving a record belongs to you)
- Account creation (establishing a permanent identity)
- Organization membership (tenant-scoped relationship)
- Customer-club enrollment (loyalty relationship)
- Marketing consent (communication preferences)

This conflation has created barriers for visitors and guests who want to use core functionality (browsing, cart, checkout, appointment booking, hotel enquiries) without mandatory registration.

The product owner has explicitly approved a permanent architectural principle: **BAZARBAAZ SHALL BE GUEST-FIRST AND IDENTITY-OPTIONAL.**

---

## Decision

**Guest-first, identity-optional, tenant-isolated, progressive enrollment.**

All visitors and guests must be able to use the maximum safe and permitted functionality of BazarBaaz without mandatory registration or sign-in.

---

## Mandatory Invariants

The following invariants are binding on all current and future implementation:

1. **`Visitor`** is an unauthenticated browser actor, not a database `UserRole`.
2. **`Guest`** is an interaction state without a registered account, not a new global `UserRole`.
3. **`GuestCustomer`** may represent an account-less customer interaction (cart, checkout, appointment, hotel enquiry).
4. **`CUSTOMER`** is a persistent authenticated `User` identity with `role: "CUSTOMER"`.
5. **`CustomerIdentity`** represents organization-scoped customer identity and interaction history.
6. **`CustomerClubMembership`** is a separate per-organization membership relationship (opt-in, audited).
7. **Authentication never automatically confers** staff, manager, owner, or super-admin authority.
8. **Shared customer identity must not imply cross-tenant membership or access.**
9. **Ordinary public browsing, eligible checkout, appointment requests, and guest enquiries should not require permanent registration.**
10. **Sensitive account operations require appropriate authentication or proof of ownership.**
11. **Verified phone ownership does not automatically create a permanent account.**
12. **Guest-to-CUSTOMER conversion must be optional, explicit, secure, idempotent, and non-destructive.**
13. **Phone, email, or name matching alone must never claim previous orders, appointments, or requests.**
14. **Marketing consent is separate from authentication and transactional communications.**
15. **Tenant isolation, privacy, operational feature flags, publication policies, and schema-readiness gates remain mandatory.**

---

## Conceptual Distinctions

| Concept | Definition | What It Is NOT |
|---------|------------|----------------|
| **Authentication** | Proving identity (credentials, OTP, SSO ticket) | Authorization, account creation, membership |
| **Authorization** | Determining permitted actions for an authenticated identity | Authentication, ownership proof |
| **Ownership Verification** | Proving a specific record (order, appointment, request) belongs to the actor | Authentication, account creation |
| **Account Creation** | Establishing a persistent `User` record with credentials | Guest interaction, OTP verification |
| **Organization Membership** | `OrganizationMember` record with privileged role (ADMIN/MANAGER/STAFF/DRIVER) | Customer identity, customer-club membership |
| **Customer-Club Enrollment** | `CustomerClubMembership` per organization, opt-in with marketing consent | Organization membership, authentication |
| **Marketing Consent** | Explicit per-tenant/per-channel opt-in for promotional communications | Transactional notification consent, authentication |

---

## Practical Examples

### Aka Shoes (SHOP tenant, custom domain `akashoes.ir`)

| Actor | Can Do | Cannot Do Without |
|-------|--------|-------------------|
| Visitor | Browse products, view categories, read public content | — |
| Guest | Add to cart, proceed to guest checkout, receive order tracking token | — |
| Guest (post-checkout) | View order status via tracking token, request changes via verified ownership | — |
| CUSTOMER (registered) | View order history, save addresses, join customer club, manage notifications | Explicit account creation + login |
| CUSTOMER (club member) | Earn loyalty points, redeem coupons, receive marketing (if consented) | Explicit club join + marketing consent |

### Restaurant 13 (SHAPPOINTMENT tenant, custom domain `fastfood13.ir`)

| Actor | Can Do | Cannot Do Without |
|-------|--------|-------------------|
| Visitor | View menu, services, location, hours | — |
| Guest | Book appointment, receive booking reference, track via reference | — |
| Guest (post-booking) | View appointment status via reference, cancel via verified ownership | — |
| CUSTOMER (registered) | View appointment history, manage profile, join customer club | Explicit account creation + login |

### Cafe Leo (APPOINTMENT tenant, platform domain `bazarbaaz.ir/fa/cafe-leo`)

| Actor | Can Do | Cannot Do Without |
|-------|--------|-------------------|
| Visitor | Browse menu, view services | — |
| Guest | Add to cart (takeaway), guest checkout, book appointment | — |
| CUSTOMER | Full history, loyalty, club membership | Explicit account creation |

### Hotel Damoon (HOTEL tenant, custom domain `damoon-hotel.ir`)

| Actor | Can Do | Cannot Do Without |
|-------|--------|-------------------|
| Visitor | View rooms, attractions, facilities, virtual tour, policies | — |
| Guest | Submit stay enquiry (`HotelGuestBookingRequest`), contact reception | — |
| Guest (enquiry submitted) | Track enquiry via private token, receive responses | — |
| CUSTOMER (registered) | Submit authenticated `HotelStayRequest`, view request history | Explicit account creation + login |
| CUSTOMER (operational) | Confirm reservation, make payment | Hotel operational features enabled + verified payment |

### Appointment-Based Organization (e.g., Beauty Clinic)

| Actor | Can Do | Cannot Do Without |
|-------|--------|-------------------|
| Visitor | View services, providers, availability, hours | — |
| Guest | Book appointment, select provider/time, receive reference | — |
| CUSTOMER | View history, reschedule/cancel via account, join club | Explicit account creation |

---

## Consequences

### Positive
- Removes registration barriers for core user journeys
- Aligns with privacy-by-design and data minimization principles
- Clear separation of concerns enables independent feature development
- Tenant isolation preserved by design
- Existing `GuestCustomer`, `CustomerIdentity`, `CustomerClubMembership` models can be reused

### Negative / Risks
- Requires careful implementation of guest tracking tokens and ownership verification
- Guest-to-CUSTOMER linking must be secure, idempotent, and non-destructive
- Cross-tenant data leakage must be prevented at every layer
- Marketing consent must be explicitly managed separate from transactional flows

### Neutral
- No new `UserRole` values needed (no `GUEST` role)
- No mandatory database migrations (existing models support the pattern)
- Feature flags control rollout per capability

---

## Implementation Approach

This ADR establishes the architectural principle. Implementation proceeds through the staged workstreams documented in:
- `plans/guest-first-implementation-plan.md` (engineering execution plan)
- `docs/roadmaps/BAZARBAAZ-POST-HOTEL-P1-IDENTITY-MEMBERSHIP-OTP-SMS-ROADMAP-2026-11-16.md` (GF0–GF5 parallel to G0–G9)

No runtime code changes in this documentation-only PR.