# Guest-First Implementation Plan

**Status:** `OWNER_APPROVED` (architectural principle — implementation milestones require separate approval)

**Date:** 2026-11-20

**Base SHA:** `441dd4d46fec83c9f546c6ae4c2f3403c0c3793d` (PR99 merged)

**Related:** `docs/architecture/ADR-GUEST-FIRST-IDENTITY-OPTIONAL.md`, `docs/identity/GUEST-FIRST-ACCESS-MATRIX.md`, `docs/identity/GUEST-TO-CUSTOMER-LIFECYCLE.md`, `docs/roadmaps/BAZARBAAZ-POST-HOTEL-P1-IDENTITY-MEMBERSHIP-OTP-SMS-ROADMAP-2026-11-16.md`

---

## Purpose

Engineering execution plan for the Guest-first, identity-optional architecture. Defines six parallel workstreams (GF0–GF5) with concrete implementation contracts, priorities, acceptance criteria, and dependencies.

This plan is documentation-only. No runtime code changes in this PR.

---

## Workstream Overview

| ID | Name | Priority | Dependency | Target |
|----|------|----------|------------|--------|
| **GF0** | Guest Cart & Checkout Foundation (SHOP) | P0 | — | Session-based `GuestCart`, `GuestCustomer` checkout, cart merge |
| **GF1** | Secure Guest Appointment Tracking | P0 (P0-A) | — | Opaque token lookup, verified ownership, negative tests |
| **GF2** | Hotel Guest Enquiry Decoupling | P0 (P0-B) | — | Independent feature gate, no operational coupling |
| **GF3** | Guest-to-CUSTOMER Conversion | P1 | GF0, GF1, GF2 | Secure, idempotent, non-destructive linking |
| **GF4** | CustomerClubMembership & Consent | P1 | GF3 | Explicit opt-in, per-tenant, audited |
| **GF5** | Cross-Domain SSO & PWA Integration | P2 | GF3, GF4 | User-mediated, verified domains, no silent creation |

---

## GF0 — Guest Cart & Checkout Foundation (SHOP)

### Objective
Enable account-less shopping: session-based cart, guest checkout creating `GuestCustomer` + `Order`, cart merge on login.

### Scope
- `lib/services/guest-cart.service.ts` — new service for session-based cart
- `lib/services/order.service.ts` — extend for guest checkout
- `app/api/shop/cart/*` — guest cart endpoints
- `app/api/shop/checkout/guest/route.ts` — guest checkout endpoint
- Cart merge logic on login

### Implementation Contract

#### `GuestCart` Service
```typescript
// lib/services/guest-cart.service.ts
interface GuestCart {
  sessionId: string;           // cookie-based, 7-day expiry
  organizationId: string;      // tenant scope
  items: GuestCartItem[];
  createdAt: Date;
  updatedAt: Date;
}

interface GuestCartItem {
  productVariantId: string;
  quantity: number;
  priceSnapshot: number;       // frozen at add time
}

// Required operations:
// - getOrCreate(sessionId, organizationId): GuestCart
// - addItem(sessionId, organizationId, variantId, qty): GuestCart
// - updateItem(sessionId, organizationId, variantId, qty): GuestCart
// - removeItem(sessionId, organizationId, variantId): GuestCart
// - clear(sessionId, organizationId): void
// - mergeToUserCart(sessionId, userId): Order  // transactional
```

#### Guest Checkout
```typescript
// POST /api/shop/checkout/guest
// Body: { sessionId, organizationId, phone, email?, address, paymentMethodId }
// Returns: { orderNumber, trackingToken, guestCustomerId }

// Creates:
// - GuestCustomer (phone, email, address snapshot)
// - Order (status: PENDING_PAYMENT, guestCustomerId)
// - Payment record
// - Sends transactional SMS to phone (via verified interaction phone)
```

#### Cart Merge on Login
- Trigger: successful CUSTOMER authentication
- Source: `GuestCart` by sessionId
- Target: `User` cart (existing `cart.service.ts`)
- Transactional: all-or-nothing
- Idempotent: safe to retry

### Acceptance Criteria
| ID | Criterion | Evidence |
|----|-----------|----------|
| GF0-1 | Visitor can add to cart without auth | `IMPLEMENTED_IN_SOURCE` + `TESTED_LOCALLY` |
| GF0-2 | Cart persists across page navigation (7 days) | `TESTED_LOCALLY` |
| GF0-3 | Guest checkout creates `GuestCustomer` + `Order` | `TESTED_LOCALLY` |
| GF0-4 | Order tracking via token + phone works | `TESTED_LOCALLY` |
| GF0-5 | Cart merges on login (transactional, idempotent) | `TESTED_LOCALLY` |
| GF0-6 | No `User` record created during guest flow | `TESTED_LOCALLY` (negative test) |
| GF0-7 | Cross-tenant cart isolation enforced | `TESTED_LOCALLY` (negative test) |

### Feature Flags
- `GUEST_CART_ENABLED` (default: `false`) — controls GF0 rollout
- `GUEST_CHECKOUT_ENABLED` (default: `false`) — controls guest checkout

### Dependencies
- Existing: `GuestCustomer` model, `Order` model, `cart.service.ts`
- New: `guest-cart.service.ts`, session cookie middleware

---

## GF1 — Secure Guest Appointment Tracking (P0-A)

### Objective
Remove unauthorized private-data disclosure in public appointment lookup. Require appropriate ownership proof for sensitive appointment data. Preserve account-less booking and tracking. Preserve tenant boundaries.

### P0-A Finding (Source Verified)
**File:** `app/api/public/appointments/lookup/route.ts` (lines 78-118)
**Current Behavior:** Phone-only lookup returns full appointment details (service, provider, time, customer name)
**Risk:** PII exposure, enumeration, cross-tenant leakage if phone reused

### Implementation Contract

#### Modified Lookup Endpoint
```typescript
// POST /api/public/appointments/lookup
// Body: { bookingReference?, phone?, otpCode?, organizationSlug }
// Returns: Generic message — NEVER returns appointment details or tokens

// Phone-only → generic anti-enumeration response: "If an appointment exists for this phone number, tracking information has been sent."
// Booking reference only → prompts for OTP: "To access appointment details, please verify your phone number with the OTP sent to you."
// Booking reference + phone + OTP → verifies ownership, then sends tracking info via secure channel (SMS/email)
// NEVER returns appointment details, tokens, or PII in lookup response
```

#### New Tracking Endpoint
```typescript
// POST /api/public/appointments/track
// Body: { token }
// Returns: { appointmentDetails }  // ONLY with valid tracking token

// Tracking token issued at appointment creation (guest booking)
// Token: cryptographically random, 32+ bytes (256-bit), SHA-256 hashed for storage
// 90-day expiry, audit-logged
// Security headers: Cache-Control: no-store, Referrer-Policy: no-referrer
```

#### Verified Ownership for Mutations
```typescript
// PATCH /api/appointments/[id] (cancel/reschedule)
// Requires: bookingReference + phone OTP verification
// Validates: token matches appointment, OTP valid for phone, appointment in mutable state
```

#### Negative Tests (Mandatory)
| Test | Expected Result |
|------|-----------------|
| Phone-only lookup for non-existent phone | Generic "if exists, tracking sent" response (anti-enumeration) |
| Phone-only lookup enumerating many phones | Rate-limited (10/min/IP), audit-logged, no data leakage |
| Booking reference guessing (sequential) | Generic prompt for OTP, no information disclosure |
| Cross-tenant appointment access via token | 404 (not found), audit-logged |
| PII in lookup response (name, service, time) | Never present — only generic messages |
| Valid token via POST /track returns details | Appointment details with security headers |
| Expired/revoked/malformed token | 404/410, no information disclosure |
| Unauthorized cancel/reschedule | 403/401, requires ownership proof |

### Acceptance Criteria
| ID | Criterion | Evidence |
|----|-----------|----------|
| GF1-1 | Phone-only lookup returns generic message (no PII) | `IMPLEMENTED_IN_SOURCE` + `TESTED_LOCALLY` |
| GF1-2 | Full details require valid tracking token via POST /track | `TESTED_LOCALLY` |
| GF1-3 | Booking reference + phone OTP enables secure tracking | `TESTED_LOCALLY` |
| GF1-4 | Negative tests pass (enumeration, guessing, cross-tenant, PII) | `TESTED_LOCALLY` |
| GF1-5 | Rate limiting and audit logging on lookup | `IMPLEMENTED_IN_SOURCE` |
| GF1-6 | Existing guest booking flow unchanged | `TESTED_LOCALLY` (regression) |
| GF1-7 | Tenant isolation verified | `TESTED_LOCALLY` (negative test) |
| GF1-8 | Tracking token issued at creation, 256-bit, SHA-256 hashed | `IMPLEMENTED_IN_SOURCE` |
| GF1-9 | Security headers on tracking endpoint | `IMPLEMENTED_IN_SOURCE` |

### Feature Flags
- `SECURE_APPOINTMENT_LOOKUP_ENABLED` (default: `false`) — controls GF1 rollout

### Dependencies
- Existing: `Appointment` model, `GuestCustomer` relation, `customerPhoneAuthService`
- New: Tracking token generation, storage, validation

---

## GF2 — Hotel Guest Enquiry Decoupling (P0-B)

### Objective
Decouple hotel guest enquiry submission (`HotelGuestBookingRequest`) from `HOTEL_OPERATIONAL_RESERVATIONS_ENABLED` flag. Enquiries must work independently of operational reservations/payments.

### P0-B Finding (Source Verified)
**Files:** `app/api/auth/register/route.ts`, `lib/auth.ts`, Hotel feature gates
**Current Coupling:** Guest onboarding may depend on `HOTEL_OPERATIONAL_RESERVATIONS_ENABLED`
**Risk:** Guest enquiries blocked when operational features disabled

### Implementation Contract

#### Independent Feature Gate
```typescript
// New flag: HOTEL_GUEST_ENQUIRY_ENABLED (default: true)
// Controls: POST /api/hotel/v1/guest-requests, tracking, contact
// Independent of: HOTEL_OPERATIONAL_RESERVATIONS_ENABLED
```

#### Enquiry Flow (Unchanged, Now Independent)
```
Visitor/Guest → Submit HotelGuestBookingRequest
    │
    ▼
Creates: HotelGuestBookingRequest (status: SUBMITTED)
    │
    ▼
Returns: Private tracking token
    │
    ▼
Guest tracks via: GET /api/hotel/v1/guest-requests/track/[token]
    │
    ▼
Hotel staff responds via: HotelStayRequest (operational, gated separately)
```

#### Operational Reservation Flow (Separate, Still Gated)
```
CUSTOMER (authenticated) → Submit HotelStayRequest
    │
    ▼
Requires: HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = true
    │
    ▼
Creates: HotelStayRequest (status: PENDING_CONFIRMATION)
    │
    ▼
Hotel staff confirms → HotelOperationalReservation + Payment
    │
    ▼
Requires: Production migrations 13–17 + owner approval
```

### Acceptance Criteria
| ID | Criterion | Evidence |
|----|-----------|----------|
| GF2-1 | Guest enquiry works with `HOTEL_OPERATIONAL_RESERVATIONS_ENABLED=false` | `TESTED_LOCALLY` |
| GF2-2 | New flag `HOTEL_GUEST_ENQUIRY_ENABLED` controls enquiry only | `IMPLEMENTED_IN_SOURCE` |
| GF2-3 | No code path from enquiry to operational reservation/payment | `IMPLEMENTED_IN_SOURCE` (code review) |
| GF2-4 | Tracking token flow unchanged | `TESTED_LOCALLY` (regression) |
| GF2-5 | Contact reception info always public | `DEPLOYED_VERIFIED` |

### Feature Flags
- `HOTEL_GUEST_ENQUIRY_ENABLED` (default: `true`) — guest enquiries
- `HOTEL_OPERATIONAL_RESERVATIONS_ENABLED` (default: `false`) — operational (unchanged)

### Dependencies
- Existing: `HotelGuestBookingRequest` model, `hotel-stay-request.service.ts`
- No new models required

---

## GF3 — Guest-to-CUSTOMER Conversion

### Objective
Implement secure, idempotent, non-destructive conversion from Guest to registered CUSTOMER with proper conflict resolution.

### Implementation Contract

#### Conversion Endpoint
```typescript
// POST /api/customer/convert-from-guest
// Body: { guestCustomerId, phone, email?, otpCode, organizationId }
// Returns: { userId, customerIdentityId, sessionToken }

// Steps (all in single transaction):
// 1. Verify OTP for phone (proves ownership)
// 2. Check for existing User with same verified phone
// 3. If no User → create User (role: CUSTOMER)
// 4. If User exists → CONFLICT QUARANTINE
//    a. If User has no CustomerIdentity in this org → link
//    b. If User has CustomerIdentity in this org → RECONCILIATION_REQUIRED
// 5. Create CustomerIdentity for this organization
// 6. Migrate GuestCustomer interactions → CustomerIdentity (append-only)
// 7. Mark GuestCustomer as CONVERTED (soft-delete or status)
// 8. Establish authenticated session
```

#### Conflict Resolution
```typescript
// RECONCILIATION_REQUIRED state:
// - Block automatic conversion
// - Notify user: "An account with this phone exists. Contact support to merge."
// - Admin workflow: verify ownership of BOTH → merge (non-destructive)
// - Audit trail preserved for both identities
```

#### Data Migration Mapping
| Guest Data | Target |
|------------|--------|
| `GuestCustomer.orders` | `CustomerInteraction` (type: ORDER, ref: orderId) |
| `GuestCustomer.appointments` | `CustomerInteraction` (type: APPOINTMENT, ref: appointmentId) |
| `GuestCustomer.hotelEnquiries` | `CustomerInteraction` (type: HOTEL_ENQUIRY, ref: requestId) |
| `GuestCustomer.addresses` | `CustomerIdentity.addresses` (user confirms) |
| `GuestCustomer.phone` | `CustomerPhoneIdentity` (if not exists) |

### Acceptance Criteria
| ID | Criterion | Evidence |
|----|-----------|----------|
| GF3-1 | Conversion requires explicit user action | `IMPLEMENTED_IN_SOURCE` |
| GF3-2 | OTP verification mandatory | `TESTED_LOCALLY` |
| GF3-3 | No automatic account creation on OTP verify | `TESTED_LOCALLY` (negative) |
| GF3-4 | New User created when no conflict | `TESTED_LOCALLY` |
| GF3-5 | Conflict quarantine when User exists | `TESTED_LOCALLY` |
| GF3-6 | Reconciliation required for same-org CustomerIdentity | `TESTED_LOCALLY` |
| GF3-7 | GuestCustomer history migrated (non-destructive) | `TESTED_LOCALLY` |
| GF3-8 | GuestCustomer retained for audit | `TESTED_LOCALLY` |
| GF3-9 | Cross-tenant claiming blocked | `TESTED_LOCALLY` (negative) |
| GF3-10 | Idempotent: safe to retry same conversion | `TESTED_LOCALLY` |

### Feature Flags
- `GUEST_CONVERSION_ENABLED` (default: `false`) — controls GF3 rollout

### Dependencies
- GF0, GF1, GF2 (guest data must exist to migrate)
- `CustomerPhoneIdentity`, `CustomerIdentity`, `CustomerInteraction` models
- `customerPhoneAuthService` for OTP

---

## GF4 — CustomerClubMembership & Consent

### Objective
Implement explicit, per-tenant, audited customer club membership with separate marketing consent.

### Implementation Contract

#### Membership Join
```typescript
// POST /api/customer-club/membership
// Body: { organizationId, consentMarketingSms: boolean, consentMarketingEmail: boolean }
// Requires: Authenticated CUSTOMER session
// Returns: { membershipId, status: "ACTIVE", joinedAt }

// Creates: CustomerClubMembership (userId, organizationId, status, source, consent versions)
// Audit: MembershipJoinedEvent (userId, orgId, source, consent versions, ip)
```

#### Membership Leave
```typescript
// DELETE /api/customer-club/membership
// Body: { organizationId }
// Requires: Authenticated CUSTOMER session (own membership) OR Org ADMIN/MANAGER
// Returns: { status: "LEFT", leftAt }

// Updates: CustomerClubMembership (status: LEFT, leftAt)
// Audit: MembershipLeftEvent
// Preserves: LoyaltyLedger, CouponRedemption (legal retention)
// Revokes: Marketing consent (transactional unaffected)
```

#### Consent Management
```typescript
// PATCH /api/customer/notification-preferences
// Body: { organizationId, channel: "SMS"|"EMAIL"|"PUSH", purpose: "TRANSACTIONAL"|"MARKETING", enabled: boolean }
// Requires: Authenticated CUSTOMER session
// Versioned: consentVersion, consentSource, consentAt stored per preference
// Marketing SMS default: false
// Transactional: cannot disable (order/booking notifications)
```

### Acceptance Criteria
| ID | Criterion | Evidence |
|----|-----------|----------|
| GF4-1 | Join requires explicit authenticated action | `IMPLEMENTED_IN_SOURCE` + `TESTED_LOCALLY` |
| GF4-2 | Marketing consent separate, default false | `TESTED_LOCALLY` |
| GF4-3 | Per-tenant membership (no cross-tenant auto-join) | `TESTED_LOCALLY` (negative) |
| GF4-4 | Leave preserves history, revokes marketing | `TESTED_LOCALLY` |
| GF4-5 | Rejoin requires explicit workflow (not auto) | `TESTED_LOCALLY` |
| GF4-6 | Audit trail for join/leave/consent changes | `IMPLEMENTED_IN_SOURCE` |
| GF4-7 | Staff cannot force join without user action | `TESTED_LOCALLY` (negative) |

### Feature Flags
- `CUSTOMER_CLUB_ENABLED` (default: `false`) — controls GF4 rollout (may already exist)

### Dependencies
- GF3 (requires authenticated CUSTOMER)
- `CustomerClubMembership` model (existing)
- `NotificationPreference` model (existing)

---

## GF5 — Cross-Domain SSO & PWA Integration

### Objective
Enable user-mediated cross-domain SSO between verified tenant domains with proper consent and no silent account creation.

### Implementation Contract

#### SSO Ticket Generation
```typescript
// POST /api/auth/customer/sso/generate
// Body: { targetDomain, returnTo }
// Requires: Authenticated CUSTOMER session + verified domain ownership
// Returns: { ssoTicket, expiresAt }

// Ticket: cryptographically random, 60-second TTL, single-use
// Bound to: source organization, target organization, userId
// Audit: SsoTicketGeneratedEvent
```

#### SSO Ticket Redemption
```typescript
// GET /api/auth/customer/sso/redeem?ticket=...
// Validates: ticket exists, not expired, not used, target domain matches
// Creates: CustomerPhoneSession for target organization (if CustomerIdentity exists)
//          OR redirects to explicit join flow (if no CustomerIdentity)
// Sets: Session cookie for target domain
// Audit: SsoTicketRedeemedEvent
```

#### PWA Integration
- Login/register pages branded per tenant (manifest, theme, logo)
- Cookie isolation per domain (no cross-domain leakage)
- `returnTo` parameter preserved through auth flow
- Offline shell excludes OTP/session/PII caching

#### Invariants
- No silent cross-tenant account creation (ADR invariant #8, #13)
- SSO only between verified domains with explicit user action
- Consent required for each new tenant relationship
- Logout revokes all SSO sessions for that user

### Acceptance Criteria
| ID | Criterion | Evidence |
|----|-----------|----------|
| GF5-1 | SSO ticket generation requires auth + verified domain | `TESTED_LOCALLY` |
| GF5-2 | Ticket redemption creates session only for target org | `TESTED_LOCALLY` |
| GF5-3 | No CustomerIdentity at target → explicit join flow | `TESTED_LOCALLY` |
| GF5-4 | No silent cross-tenant account creation | `TESTED_LOCALLY` (negative) |
| GF5-5 | Ticket replay/expire/wrong domain rejected | `TESTED_LOCALLY` (negative) |
| GF5-6 | PWA branding/cookies isolated per domain | `TESTED_LOCALLY` |
| GF5-7 | Logout revokes cross-domain sessions | `TESTED_LOCALLY` |

### Feature Flags
- `CUSTOMER_SSO_ENABLED` (default: `false`) — existing flag, controls GF5

### Dependencies
- GF3, GF4 (requires CustomerIdentity, membership model)
- `customerSsoService`, `CustomerSsoTicket` model (existing)
- Verified domain routing (`proxy.ts`, `OrganizationDomain`)

---

## Cross-Workstream Dependencies

```
GF0 ──────────────────┐
GF1 ──────────────────┤
GF2 ──────────────────┼──▶ GF3 (Guest-to-CUSTOMER Conversion)
                       │
                       ▼
                    GF4 (Club Membership & Consent)
                       │
                       ▼
                    GF5 (Cross-Domain SSO & PWA)
```

- GF0, GF1, GF2 can proceed in parallel (independent)
- GF3 requires guest data from GF0/GF1/GF2 to migrate
- GF4 requires authenticated CUSTOMER from GF3
- GF5 requires CustomerIdentity from GF3 and membership from GF4

---

## Feature Flag Summary

| Flag | Default | Controls | Deployment Restriction |
|------|---------|----------|------------------------|
| `GUEST_CART_ENABLED` | `false` | GF0 cart | Owner approval |
| `GUEST_CHECKOUT_ENABLED` | `false` | GF0 checkout | Owner approval |
| `SECURE_APPOINTMENT_LOOKUP_ENABLED` | `false` | GF1 lookup | Owner approval |
| `HOTEL_GUEST_ENQUIRY_ENABLED` | `true` | GF2 enquiry | Independent |
| `GUEST_CONVERSION_ENABLED` | `false` | GF3 conversion | Owner approval |
| `CUSTOMER_CLUB_ENABLED` | `false` | GF4 club | Owner approval |
| `CUSTOMER_SSO_ENABLED` | `false` | GF5 SSO | Owner approval |

---

## Evidence Requirements per Milestone

Each GF milestone must produce:

1. **Source Implementation** — `IMPLEMENTED_IN_SOURCE` with file paths
2. **Local Tests** — `TESTED_LOCALLY` with disposable PostgreSQL
3. **Negative Tests** — Explicit test cases for enumeration, cross-tenant, PII, replay
4. **CI Evidence** — Exact SHA, TypeScript, lint, unit, integration, browser tests PASS
5. **Documentation** — Updated ADR, access matrix, lifecycle with evidence links

---

## Deployment Constraints

- **Runflare only** — Project 37622, Service 87432, Image v89+
- **Auto Deploy** — `main` merge triggers rebuild; no manual redeploy
- **Feature flags OFF by default** — Production activation requires owner approval
- **No Neon, no Vercel** — Deprecated
- **5 pending Hotel migrations (13–17)** — Remain blocked, unaffected by GF0–GF5
- **No live SMS/OTP** — `INOTI_ALLOW_LIVE_SMS`, `SMS_REAL_SEND_ENABLED` remain `false`

---

## GF0–GF5 Status Tracking

| Milestone | Status | Target SHA | CI Evidence | Owner Approval |
|-----------|--------|------------|-------------|----------------|
| GF0 | `PLANNED` | — | — | Required |
| GF1 | `PLANNED` | — | — | Required |
| GF2 | `PLANNED` | — | — | Required |
| GF3 | `PLANNED` | — | — | Required |
| GF4 | `PLANNED` | — | — | Required |
| GF5 | `PLANNED` | — | — | Required |

---

## Next Steps (After Documentation PR Merge)

1. **Request owner approval for GF0** — Baseline audit, feature flag inventory
2. **Execute GF0** — Guest cart/checkout, cart merge
3. **Execute GF1** — Secure appointment tracking (P0-A fix)
4. **Execute GF2** — Hotel enquiry decoupling (P0-B fix)
5. **Request owner approval for GF3** — Conversion implementation
6. **Execute GF3, GF4, GF5** — Sequential per dependencies

---

## P0 Security Findings — Implementation Mapping

| Finding | Workstream | Fix |
|---------|------------|-----|
| **P0-A**: Phone-only appointment lookup exposes PII | GF1 | Opaque token + verified ownership |
| **P0-B**: Hotel guest enquiry coupled to operational flag | GF2 | Independent feature gate |

Both P0 fixes are in GF1 and GF2 respectively, can proceed in parallel, require owner approval to begin.

---

## Change Control

- This plan documents the engineering approach for the `OWNER_APPROVED` architectural principle
- Implementation milestones (GF0–GF5) require separate owner approval
- No runtime code changes in this documentation-only PR
- Update this plan with evidence links as milestones complete