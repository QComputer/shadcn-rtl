# Guest-First Access Matrix

**Status:** `OWNER_APPROVED` (architectural principle)

**Date:** 2026-11-20

**Related:** `docs/architecture/ADR-GUEST-FIRST-IDENTITY-OPTIONAL.md`, `docs/identity/GUEST-TO-CUSTOMER-LIFECYCLE.md`, `plans/guest-first-implementation-plan.md`

---

## Evidence Classification

| Code | Meaning |
|------|---------|
| `IMPLEMENTED_IN_SOURCE` | Feature exists in source code (TypeScript/Prisma) |
| `TESTED_LOCALLY` | Unit/integration tests pass against disposable PostgreSQL |
| `DEPLOYED_VERIFIED` | Verified on Runflare production (project 37622, service 87432) |
| `FEATURE_GATED` | Controlled by feature flag (default OFF unless noted) |
| `PLANNED` | Documented in roadmap, not yet implemented |
| `UNKNOWN` | Status unclear, needs investigation |

---

## Capability Access Matrix

### 1. Platform Marketing and Public Pages

| Aspect | Visitor | Account-less Guest | Registered CUSTOMER | Ownership Proof | Tenant Scope | Current Source | Target | Gap | Priority | Evidence |
|--------|---------|-------------------|---------------------|-----------------|--------------|----------------|--------|-----|----------|----------|
| Homepage (`/fa`, `/en`, `/ar`) | ✅ Full | ✅ Full | ✅ Full | None | Platform | `app/[locale]/page.tsx` | ✅ Same | None | — | `DEPLOYED_VERIFIED` |
| B2B landing pages (features, pricing, trust, showcase) | ✅ Full | ✅ Full | ✅ Full | None | Platform | `app/[locale]/features/page.tsx`, etc. | ✅ Same | None | — | `DEPLOYED_VERIFIED` |
| Contact, privacy, terms | ✅ Full | ✅ Full | ✅ Full | None | Platform | `app/[locale]/contact/page.tsx`, etc. | ✅ Same | None | — | `DEPLOYED_VERIFIED` |

### 2. Independent Tenant Websites and PWAs

| Aspect | Visitor | Account-less Guest | Registered CUSTOMER | Ownership Proof | Tenant Scope | Current Source | Target | Gap | Priority | Evidence |
|--------|---------|-------------------|---------------------|-----------------|--------------|----------------|--------|-----|----------|----------|
| Custom domain routing (`proxy.ts`) | ✅ Full | ✅ Full | ✅ Full | None | Per-tenant | `proxy.ts`, `lib/custom-domain-routing.ts` | ✅ Same | None | — | `DEPLOYED_VERIFIED` |
| Tenant PWA manifest/install | ✅ Full | ✅ Full | ✅ Full | None | Per-tenant | `app/manifest.ts`, `lib/pwa/*` | ✅ Same | None | — | `DEPLOYED_VERIFIED` |
| Offline shell (`/offline.html`) | ✅ Full | ✅ Full | ✅ Full | None | Per-tenant | `public/offline.html` | ✅ Same | None | — | `DEPLOYED_VERIFIED` |

### 3. Product, Service and Menu Discovery

| Aspect | Visitor | Account-less Guest | Registered CUSTOMER | Ownership Proof | Tenant Scope | Current Source | Target | Gap | Priority | Evidence |
|--------|---------|-------------------|---------------------|-----------------|--------------|----------------|--------|-----|----------|----------|
| SHOP public pages (org landing, category, product detail) | ✅ Full | ✅ Full | ✅ Full | None | Per SHOP org | `app/[locale]/shop/[slug]/page.tsx`, `product/[id]/page.tsx` | ✅ Same | None | — | `DEPLOYED_VERIFIED` (Aka Shoes) |
| APPOINTMENT public pages (org landing, service listing, provider listing) | ✅ Full | ✅ Full | ✅ Full | None | Per APPOINTMENT org | `app/[locale]/organizations/[slug]/page.tsx`, `booking/page.tsx` | ✅ Same | None | — | `DEPLOYED_VERIFIED` (Restaurant 13, Cafe Leo) |
| HOTEL public pages (rooms, attractions, facilities, virtual tour, gallery, policies, contact) | ✅ Full | ✅ Full | ✅ Full | None | Per HOTEL org | `sites/damoon/app.js` → `public/damoon-front/*` | ✅ Same | None | — | `DEPLOYED_VERIFIED` (Damoon Hotel) |
| Search and filtering | ✅ Full | ✅ Full | ✅ Full | None | Per-tenant | `lib/shop-menu-filter.ts`, category slugs | ✅ Same | None | — | `IMPLEMENTED_IN_SOURCE` |

### 4. Guest Carts and Checkout

| Aspect | Visitor | Account-less Guest | Registered CUSTOMER | Ownership Proof | Tenant Scope | Current Source | Target | Gap | Priority | Evidence |
|--------|---------|-------------------|---------------------|-----------------|--------------|----------------|--------|-----|----------|----------|
| Add to cart (SHOP) | ❌ | ✅ Session-based `GuestCart` | ✅ User cart | Session cookie | Per SHOP org | `lib/services/cart.service.ts` (auth only), `lib/services/guest-cart.service.ts` (planned) | Guest cart via session | Cart requires auth | P0 | `PLANNED` (see `plans/shop-implementation-roadmap.md` Phase 3) |
| Cart persistence across pages | ❌ | ✅ 7-day session expiry | ✅ Persistent | Session cookie / User ID | Per SHOP org | Planned | Guest cart survives navigation | Missing | P0 | `PLANNED` |
| Guest checkout (SHOP) | ❌ | ✅ `GuestCustomer` + order | ✅ User + order | Phone + order token | Per SHOP org | `lib/services/order.service.ts` (auth only), guest checkout planned | Guest checkout creates `GuestCustomer` | Requires auth | P0 | `PLANNED` (see `plans/shop-implementation-roadmap.md` Phase 4) |
| Cart merge on login | ❌ | N/A | ✅ Merge guest→user | Authenticated session | Per SHOP org | Planned in `guest-cart.service.ts` | Automatic merge | Missing | P1 | `PLANNED` |

### 5. Order Status and Order Changes

| Aspect | Visitor | Account-less Guest | Registered CUSTOMER | Ownership Proof | Tenant Scope | Current Source | Target | Gap | Priority | Evidence |
|--------|---------|-------------------|---------------------|-----------------|--------------|----------------|--------|-----|----------|----------|
| Public order lookup (tracking) | ✅ Via token | ✅ Via token | ✅ Via token + history | Order number/token + phone | Per SHOP org | `app/api/orders/track/route.ts`, `app/[locale]/shop/[slug]/order/[orderNumber]/page.tsx` | ✅ Same | None | — | `IMPLEMENTED_IN_SOURCE` |
| Order status changes (cancel, modify) | ❌ | ✅ Via verified ownership | ✅ Via account | Tracking token + phone verification | Per SHOP org | `lib/services/order.service.ts` | Guest can cancel via token | Partial | P1 | `IMPLEMENTED_IN_SOURCE` (partial) |
| Order history (all orders) | ❌ | ❌ | ✅ Full history | Authenticated session | Per SHOP org | `app/[locale]/dashboard/my-orders/page.tsx` | Authenticated only | By design | — | `IMPLEMENTED_IN_SOURCE` |

### 6. Appointment Scheduling and Tracking

| Aspect | Visitor | Account-less Guest | Registered CUSTOMER | Ownership Proof | Tenant Scope | Current Source | Target | Gap | Priority | Evidence |
|--------|---------|-------------------|---------------------|-----------------|--------------|----------------|--------|-----|----------|----------|
| Book appointment | ✅ Full flow | ✅ Full flow | ✅ Full flow | None at booking time | Per APPOINTMENT org | `app/[locale]/organizations/[slug]/booking/page.tsx`, `POST /api/appointments` | ✅ Same | None | — | `DEPLOYED_VERIFIED` |
| Appointment lookup (public) | ✅ Via reference | ✅ Via reference | ✅ Via reference + history | Booking reference OR phone | Per APPOINTMENT org | `app/api/public/appointments/lookup/route.ts` | Phone-only lookup restricted | P0-A exposure | P0 | `IMPLEMENTED_IN_SOURCE` (see P0-A finding) |
| Appointment tracking (my appointments) | ❌ | ❌ | ✅ Full history | Authenticated session | Per APPOINTMENT org | `app/[locale]/my-appointments/page.tsx` | Authenticated only | By design | — | `IMPLEMENTED_IN_SOURCE` |
| Appointment cancel/reschedule | ❌ | ✅ Via verified ownership | ✅ Via account | Booking reference + phone/OTP | Per APPOINTMENT org | `PATCH /api/appointments/[id]` | Guest can cancel via reference | Partial | P1 | `IMPLEMENTED_IN_SOURCE` (partial) |

### 7. Public Hotel Enquiries

| Aspect | Visitor | Account-less Guest | Registered CUSTOMER | Ownership Proof | Tenant Scope | Current Source | Target | Gap | Priority | Evidence |
|--------|---------|-------------------|---------------------|-----------------|--------------|----------------|--------|-----|----------|----------|
| Submit stay enquiry (`HotelGuestBookingRequest`) | ✅ Full | ✅ Full | ✅ Full | None at submission | Per HOTEL org | `app/api/hotel/v1/guest-requests/route.ts`, `HotelGuestBookingRequest` model | ✅ Same | None | — | `IMPLEMENTED_IN_SOURCE` |
| Enquiry tracking | ✅ Via private token | ✅ Via private token | ✅ Via token + history | Private tracking token | Per HOTEL org | `lib/hotel/services/hotel-stay-request.service.ts` | ✅ Same | None | — | `IMPLEMENTED_IN_SOURCE` |
| Contact reception | ✅ Public contact info | ✅ Public contact info | ✅ Public contact info | None | Per HOTEL org | `sites/damoon/app.js` contact page | ✅ Same | None | — | `DEPLOYED_VERIFIED` |

### 8. Authenticated Hotel Stay Requests

| Aspect | Visitor | Account-less Guest | Registered CUSTOMER | Ownership Proof | Tenant Scope | Current Source | Target | Gap | Priority | Evidence |
|--------|---------|-------------------|---------------------|-----------------|--------------|----------------|--------|-----|----------|----------|
| Submit `HotelStayRequest` | ❌ | ❌ | ✅ Authenticated | Authenticated session + org membership | Per HOTEL org | `app/api/organizations/[id]/hotels/[propertyId]/stay-requests/route.ts` | Authenticated only | By design (operational) | — | `FEATURE_GATED` (`HOTEL_OPERATIONAL_RESERVATIONS_ENABLED`) |
| View stay request history | ❌ | ❌ | ✅ Authenticated | Authenticated session | Per HOTEL org | `components/hotel-operations/hotel-stay-requests.tsx` | Authenticated only | By design | — | `FEATURE_GATED` |
| Operational reservation/payment | ❌ | ❌ | ❌ Disabled | — | Per HOTEL org | `lib/hotel/services/hotel-operational-reservation.service.ts` | Disabled until migrations | `HOTEL_BOOKING` missing | P0 | `FEATURE_GATED` (disabled) |

### 9. Confirmed Hotel Reservations and Payments

| Aspect | Visitor | Account-less Guest | Registered CUSTOMER | Ownership Proof | Tenant Scope | Current Source | Target | Gap | Priority | Evidence |
|--------|---------|-------------------|---------------------|-----------------|--------------|----------------|--------|-----|----------|----------|
| Confirm reservation | ❌ | ❌ | ❌ Disabled | — | Per HOTEL org | `HotelOperationalReservationService` | Disabled | Pending migrations 13–17 | — | `FEATURE_GATED` (disabled) |
| Make payment | ❌ | ❌ | ❌ Disabled | — | Per HOTEL org | `lib/hotel/services/booking-quote.ts`, payment routes | Disabled | Pending migrations | — | `FEATURE_GATED` (disabled) |

### 10. Reviews and Follows

| Aspect | Visitor | Account-less Guest | Registered CUSTOMER | Ownership Proof | Tenant Scope | Current Source | Target | Gap | Priority | Evidence |
|--------|---------|-------------------|---------------------|-----------------|--------------|----------------|--------|-----|----------|----------|
| Read reviews | ✅ Full | ✅ Full | ✅ Full | None | Per-tenant | `lib/services/review.service.ts`, public pages | ✅ Same | None | — | `IMPLEMENTED_IN_SOURCE` |
| Write review | ❌ | ❌ | ✅ Authenticated | Authenticated session | Per-tenant | `POST /api/reviews` | Authenticated only | By design | — | `IMPLEMENTED_IN_SOURCE` |
| Follow organization | ❌ | ❌ | ✅ Authenticated | Authenticated session | Per-tenant | `lib/services/follow.service.ts` | Authenticated only | By design | — | `IMPLEMENTED_IN_SOURCE` |

### 11. Customer Profiles

| Aspect | Visitor | Account-less Guest | Registered CUSTOMER | Ownership Proof | Tenant Scope | Current Source | Target | Gap | Priority | Evidence |
|--------|---------|-------------------|---------------------|-----------------|--------------|----------------|--------|-----|----------|----------|
| View own profile | ❌ | ❌ | ✅ Authenticated | Authenticated session | Cross-tenant (platform) | `app/[locale]/dashboard/profile/page.tsx` | Authenticated only | By design | — | `IMPLEMENTED_IN_SOURCE` |
| Edit profile | ❌ | ❌ | ✅ Authenticated | Authenticated session | Cross-tenant | `PATCH /api/customer/profile` | Authenticated only | By design | — | `IMPLEMENTED_IN_SOURCE` |
| Manage addresses | ❌ | ❌ | ✅ Authenticated | Authenticated session | Cross-tenant | `app/[locale]/dashboard/addresses/page.tsx` | Authenticated only | By design | — | `IMPLEMENTED_IN_SOURCE` |

### 12. Customer Clubs and Loyalty

| Aspect | Visitor | Account-less Guest | Registered CUSTOMER | Ownership Proof | Tenant Scope | Current Source | Target | Gap | Priority | Evidence |
|--------|---------|-------------------|---------------------|-----------------|--------------|----------------|--------|-----|----------|----------|
| View club info | ✅ Public | ✅ Public | ✅ Public | None | Per-tenant | `app/[locale]/shop/[slug]/fanpage/page.tsx`, club pages | ✅ Same | None | — | `IMPLEMENTED_IN_SOURCE` |
| Join club | ❌ | ❌ | ✅ Explicit opt-in | Authenticated session + explicit consent | Per-tenant | `POST /api/customer-club/membership`, `CustomerClubMembership` model | Explicit join required | By design | — | `IMPLEMENTED_IN_SOURCE` |
| Earn/redeem loyalty points | ❌ | ❌ | ✅ Club member | Club membership + auth | Per-tenant | `LoyaltyLedger`, `Coupon`, `loyalty-coupons.service.ts` | Club members only | By design | — | `IMPLEMENTED_IN_SOURCE` |
| View loyalty history | ❌ | ❌ | ✅ Club member | Club membership + auth | Per-tenant | `app/[locale]/dashboard/customer-club/loyalty/page.tsx` | Club members only | By design | — | `IMPLEMENTED_IN_SOURCE` |

### 13. SMS, Push and Notifications

| Aspect | Visitor | Account-less Guest | Registered CUSTOMER | Ownership Proof | Tenant Scope | Current Source | Target | Gap | Priority | Evidence |
|--------|---------|-------------------|---------------------|-----------------|--------------|----------------|--------|-----|----------|----------|
| Transactional SMS (order, booking) | ❌ | ✅ Via verified phone at checkout/booking | ✅ Via preferences | Phone verified at interaction | Per-tenant | `lib/services/notification-preferences.service.ts`, `SmsService` | Guest receives via interaction phone | Partial | P1 | `FEATURE_GATED` (`SMS_REAL_SEND_ENABLED`) |
| Marketing SMS | ❌ | ❌ | ✅ Explicit opt-in | Authenticated + marketing consent | Per-tenant | `NotificationPreference` (marketing SMS default false) | Opt-in required | By design | — | `IMPLEMENTED_IN_SOURCE` |
| Web Push (transactional) | ❌ | ❌ | ✅ Explicit opt-in | Authenticated + push subscription | Per-tenant | `PushSubscription`, `WebPushFoundationService` | Opt-in required | By design | — | `IMPLEMENTED_IN_SOURCE` |
| In-app notifications | ❌ | ❌ | ✅ Authenticated | Authenticated session | Per-tenant | `Notification`, `notification.service.ts` | Authenticated only | By design | — | `IMPLEMENTED_IN_SOURCE` |

### 14. Registration and Login

| Aspect | Visitor | Account-less Guest | Registered CUSTOMER | Ownership Proof | Tenant Scope | Current Source | Target | Gap | Priority | Evidence |
|--------|---------|-------------------|---------------------|-----------------|--------------|----------------|--------|-----|----------|----------|
| Username/password register | ✅ Available | N/A | ✅ Creates account | Username unique | Platform | `app/api/auth/register/route.ts` | ✅ Same | None | — | `IMPLEMENTED_IN_SOURCE` |
| Organization registration | ✅ Available | N/A | ✅ Creates org + admin | Email verification | Platform | `app/api/auth/register/organization/route.ts` | ✅ Same | None | — | `IMPLEMENTED_IN_SOURCE` |
| Username/password login | ✅ Available | N/A | ✅ Authenticates | Credentials | Platform | `lib/auth.ts` (credentials provider) | ✅ Same | None | — | `IMPLEMENTED_IN_SOURCE` |

### 15. Phone Verification and OTP

| Aspect | Visitor | Account-less Guest | Registered CUSTOMER | Ownership Proof | Tenant Scope | Current Source | Target | Gap | Priority | Evidence |
|--------|---------|-------------------|---------------------|-----------------|--------------|----------------|--------|-----|----------|----------|
| Request OTP | ✅ Available | ✅ Available | ✅ Available | Phone + origin verification | Per-tenant | `app/api/auth/customer/request/route.ts`, `customerPhoneAuthService` | ✅ Same | None | — | `IMPLEMENTED_IN_SOURCE` |
| Verify OTP (login) | ✅ Available | ✅ Creates session | ✅ Authenticates | OTP + tenant context | Per-tenant | `lib/auth.ts` (customer-phone provider), `customerPhoneAuthService.consume` | ✅ Same | None | — | `IMPLEMENTED_IN_SOURCE` |
| OTP creates account automatically | ❌ Forbidden | ❌ Forbidden | N/A | — | — | N/A (architectural invariant) | Never | By design | — | `ADR` invariant #11 |
| Phone verification for sensitive ops | ✅ Available | ✅ Available | ✅ Available | OTP + ownership proof | Per-tenant | `customerPhoneAuthService`, `CustomerPhoneIdentity` | ✅ Same | None | — | `IMPLEMENTED_IN_SOURCE` |

### 16. Cross-Domain SSO

| Aspect | Visitor | Account-less Guest | Registered CUSTOMER | Ownership Proof | Tenant Scope | Current Source | Target | Gap | Priority | Evidence |
|--------|---------|-------------------|---------------------|-----------------|--------------|----------------|--------|-----|----------|----------|
| SSO ticket generation | ❌ | ❌ | ✅ Authenticated | Authenticated session + verified domain | Cross-tenant | `lib/customer-auth/sso.server.ts`, `customerSsoService` | ✅ Same | None | — | `IMPLEMENTED_IN_SOURCE` |
| SSO ticket redemption | ❌ | ❌ | ✅ Valid ticket + verifier | Ticket + cookie verifier | Cross-tenant | `lib/auth.ts` (customer-sso provider) | ✅ Same | None | — | `IMPLEMENTED_IN_SOURCE` |
| Silent cross-tenant account creation | ❌ Forbidden | ❌ Forbidden | ❌ Forbidden | — | — | N/A (architectural invariant) | Never | By design | — | `ADR` invariant #8, #13 |

### 17. Staff and Organization Management

| Aspect | Visitor | Account-less Guest | Registered CUSTOMER | Ownership Proof | Tenant Scope | Current Source | Target | Gap | Priority | Evidence |
|--------|---------|-------------------|---------------------|-----------------|--------------|----------------|--------|-----|----------|----------|
| Invite staff (ADMIN/MANAGER) | ❌ | ❌ | ✅ Org ADMIN/MANAGER | Org membership + role | Per-tenant | `app/api/organizations/[id]/members/route.ts` | Org staff only | By design | — | `IMPLEMENTED_IN_SOURCE` |
| Manage organization settings | ❌ | ❌ | ✅ Org ADMIN/MANAGER | Org membership + role | Per-tenant | `app/[locale]/dashboard/settings/page.tsx` | Org staff only | By design | — | `IMPLEMENTED_IN_SOURCE` |
| SUPER_ADMIN platform ops | ❌ | ❌ | ✅ SUPER_ADMIN only | Global role | Platform | `lib/api-guards.ts` (`requireRole("SUPER_ADMIN")`) | SUPER_ADMIN only | By design | — | `IMPLEMENTED_IN_SOURCE` |

### 18. Payments and Other Sensitive Mutations

| Aspect | Visitor | Account-less Guest | Registered CUSTOMER | Ownership Proof | Tenant Scope | Current Source | Target | Gap | Priority | Evidence |
|--------|---------|-------------------|---------------------|-----------------|--------------|----------------|--------|-----|----------|----------|
| Payment initiation (checkout) | ❌ | ✅ Guest checkout | ✅ User checkout | Order token + phone | Per SHOP org | `lib/services/order.service.ts`, payment routes | Guest checkout supported | Partial | P0 | `PLANNED` |
| Payment verification | ❌ | ✅ Via callback | ✅ Via callback | Provider callback + idempotency | Per-tenant | Payment webhook routes | ✅ Same | None | — | `IMPLEMENTED_IN_SOURCE` |
| Refund request | ❌ | ❌ | ✅ Authenticated | Authenticated + order ownership | Per-tenant | `lib/services/order.service.ts` | Authenticated only | By design | — | `IMPLEMENTED_IN_SOURCE` |

---

## Summary: Critical Gaps Requiring Implementation

| Gap ID | Capability | Current State | Target State | Priority |
|--------|------------|---------------|--------------|----------|
| GAP-01 | Guest cart (SHOP) | Requires auth | Session-based `GuestCart` | P0 |
| GAP-02 | Guest checkout (SHOP) | Requires auth | `GuestCustomer` + order | P0 |
| GAP-03 | Public appointment phone lookup | Returns PII | Opaque token + verified ownership | P0 (P0-A) |
| GAP-04 | Hotel guest enquiry ↔ operational coupling | May depend on `HOTEL_OPERATIONAL_RESERVATIONS_ENABLED` | Independent feature gate | P0 (P0-B) |
| GAP-05 | Cart merge on login | Not implemented | Automatic merge | P1 |
| GAP-06 | Guest order cancel/modify | Partial | Full via verified ownership | P1 |
| GAP-07 | Guest appointment cancel/reschedule | Partial | Full via verified ownership | P1 |

---

## Feature Flags and Deployment Restrictions

| Flag | Default | Controls | Deployment Restriction |
|------|---------|----------|------------------------|
| `HOTEL_OPERATIONAL_RESERVATIONS_ENABLED` | `false` | Hotel reservations, payments, `HotelStayRequest` | Requires Production migrations 13–17 + owner approval |
| `CUSTOMER_PHONE_AUTH_ENABLED` | `false` | OTP login, phone verification | Requires G1 security audit + owner approval |
| `CUSTOMER_AUTH_SMS_WORKER_ENABLED` | `false` | Platform OTP SMS dispatch | Requires G3 worker + owner approval |
| `INOTI_ALLOW_LIVE_SMS` | `false` | Real SMS sends | Canary only + owner approval |
| `SMS_REAL_SEND_ENABLED` | `false` | SMS.ir real sends | Canary only + owner approval |
| `WEB_PUSH_REAL_SEND_ENABLED` | `false` | Real Web Push | Canary only + owner approval |
| `CUSTOMER_SSO_ENABLED` | `false` | Cross-domain SSO | Requires G5 + owner approval |