# BazarBaaz — G0 Identity, Guest Access, OTP, SSO and Messaging Baseline

**Audit date:** 2026-11-26
**Verified GitHub main:** `1e50f5c2a9d6374014b5aca685e9dc57cff947a8` (PR182)
**Status:** `SOURCE_BASELINE_REVIEWED / PUBLIC_RUNTIME_STATUS_OBSERVED / PRIVATE_RUNTIME_PREFLIGHT_PENDING`
**Scope:** read-only audit; no implementation, no commits, no deployment, no DB access, no registration/login, no OTP/SMS send, no configuration changes. This is a working audit report, not an approval to enable features.

## 1. Evidence and limitations

- Current main verified via GitHub refs API. The existing source archive plus sequential accepted overlays was inspected locally; the available app/lib/components/prisma/tests/scripts tree contains 2,006 files. The complete clone could not be obtained because direct GitHub DNS is unavailable in the execution environment. Full repository file-by-file equivalence is therefore not claimed. Forty selected source/test paths, including all eight `lib/customer-auth` files, all eleven `lib/sms` files, the complete Prisma schema, major guest/auth routes and five auth integration tests, matched GitHub Git blob metadata after allowing CRLF/LF normalization. The waitlist precommit UI fix does not affect these reviewed identity files. Other referenced source paths were reviewed in the available reconstructed snapshot; they are not individually attested against main unless explicitly stated.
- Reviewed current remote ADR, identity matrix, lifecycle, GF plan, November 16 G0–G9 roadmap, November 23 production topology and historical November 5 evidence. Documentation may be stale; current source and observed runtime status take precedence. Relevant docs: `docs/architecture/ADR-GUEST-FIRST-IDENTITY-OPTIONAL.md`, `docs/identity/GUEST-FIRST-ACCESS-MATRIX.md`, `docs/identity/GUEST-TO-CUSTOMER-LIFECYCLE.md`, `plans/guest-first-implementation-plan.md`, `docs/roadmaps/BAZARBAAZ-POST-HOTEL-P1-IDENTITY-MEMBERSHIP-OTP-SMS-ROADMAP-2026-11-16.md`.
- No focused test execution was performed in this audit: dependency installation, disposable DB, HTTPS browser, and private Runflare metadata were not available here. Prior test files and dated evidence were inspected, not re-executed. Four PMS gates on PR182 do not substitute for dedicated identity acceptance.
- Production database is Runflare, not Neon. Current topology documents application service 87432 and database service 87429, project 37622. Runtime DB binding and migration ledger are not established by public health. No remote connection was attempted. Any later authorized inspection must respect `DB_REMOTE_URI`, verified target identity and least privilege; no connection string or secrets in evidence.

## 2. Observed public runtime status

Read-only GET checks, no OTP/SMS or credentials sent:

| Endpoint | Observed result |
|---|---|
| https://bazarbaaz.ir/api/auth/customer/config | available=false; ssoAvailable=false; organization=null; homePath=null |
| https://damoon-hotel.ir/api/auth/customer/config | available=false; ssoAvailable=false; organization=damoon-hotel; homePath=/fa/damoon-hotel |
| https://akashoes.ir/api/auth/customer/config | available=false; ssoAvailable=false; organization=aka-shoes; homePath=/shop |
| https://fastfood13.ir/api/auth/customer/config | available=false; ssoAvailable=false; organization=italiano-13; homePath=/shop |
| https://bazarbaaz.ir/api/auth/recovery | available=false; automatic recovery not connected to verified channel |
| https://bazarbaaz.ir/api/health | status=ok; nodeEnv=production; revision=null; hasNextAuthSecret=true; googleOAuthConfigured=false; smsProvider=dry_run; smsDryRun=true; smsAllowRealSend=false; smsOperatorTargetConfirmed=false; smsIrConfigured=false; smsRealSendEnabled=false; webPushDryRun=true; webPushRealSendEnabled=false |

`www.fastfood13.ir` request timed out; `iran.leocafe.vip` and `www.hotel-damoon.ir` returned tool invalid_url. These results are NOT proof of outages. Canonical Damoon domain from roadmap is `damoon-hotel.ir`. No deployed SHA was reported by public health. Tenant recognition on three canonical domains proves context is available at those endpoints but does not identify which OTP/SSO prerequisite failed. iNoti worker schedule, actual credentials/credit/line, DB migration ledger, handset delivery and tenant-specific SMS configuration remain unknown. Do not infer global disabled flags solely from the platform host's null context.

## 3. Current conceptual/data model

| Entity | Purpose and scope |
|---|---|
| Visitor | Unauthenticated browser, not a persisted account |
| Guest | Interaction without account; not a new global role |
| User | Global account; name unique, email nullable unique, phone nullable not unique; password required, role, active/deleted/lock status |
| OrganizationMember | User–organization team roles; unique org/user; not customer club |
| GuestCustomer | Mutable account-less contact; globally unique sessionId; no organizationId on record; orders, appointments, USSD, CRM links |
| ShopCart | Organization slug + optional customerId or sessionId, separate unique keys, optional expiry |
| CustomerPhoneIdentity | Global verified phone unique and userId unique; separate from unverified User.phone |
| CustomerIdentity | Tenant CRM identity with optional userId, guestCustomerId, phone, phoneHash, email; unique org+phoneHash and org+email |
| CustomerClubMembership | Per organization+customer relationship, ACTIVE/PAUSED/LEFT/BLOCKED; separate from team access and marketing preferences |
| CustomerInteraction | Tenant-scoped relationship events |
| CustomerPhoneSession | Persisted revocable tenant session; JWT carries org and origin |
| CustomerAccessLink, CustomerPhoneAuthQuota | One-use challenge and durable issuance quota |
| CustomerSsoTicket | Digest-only short-lived cross-domain ticket, source session and target origin/challenge |
| CustomerAuthSmsOutbox | Dedicated encrypted authentication message queue |
| HotelGuestBookingRequest | Account-less enquiry and private tracking reference hash, no User required |
| HotelReservationGuest | Actual occupants of a particular reservation; not necessarily booker |
| HotelGuestProfile + Link | Property-scoped explicit individual profile link, separate from platform account or CRM identity |
| HotelReceptionWaitlist | Staff-managed queue, no automatic booking, user or SMS |

`UserRole` includes SUPER_ADMIN, ADMIN, MANAGER, STAFF, DRIVER, CUSTOMER and a historical GUEST enum. Preserve existing rows until audited; ADR forbids creating accounts merely to represent anonymous visitors. `User.phone` is not proof of ownership. A shared phone/name is not proof that two occupants are the same person. User-level account and tenant business relationship must be separated.

## 4. Access journeys and source gaps

- Public browse/discovery/PWA: public pages exist and do not inherently need a permanent account. Preserve guest-first principle.
- Legacy SHOP: `app/api/cart/route.ts`, `lib/services/cart.service.ts`, `app/api/orders/route.ts`, `lib/services/order.service.ts` implement session-based cart and createForGuest. Cookie defaults `guest_session_id` (7 days, HttpOnly, Secure in production, Lax). `ShopCart` is tenant-scoped, not a missing separate GuestCart model. `getCart` merges guest cart into user cart if both identities are present; merge performs multiple writes and delete, not one atomic transaction. It can be invoked from GET. Review concurrency, retries and ownership before reusing. Public order route `app/api/public/orders/[orderNumber]/route.ts` checks account/authorized org reader/original browser session/tracking token; payment PUT is blocked. This does not establish modern guest checkout or a universal secure claim system.
- Modern Retail v1: `app/api/retail/v1/cart/route.ts`, `checkout/quote/route.ts`, `checkout/route.ts`, favorites and order routes require an authenticated user and use userId; no guest flow in these handlers. Integrate guest support with modern quote/checkout/payment/recovery semantics, not a downgrade to the legacy flow. Legacy and modern UI are selected separately by published experience.
- APPOINTMENT: `app/api/appointments/route.ts` supports guest booking with name/phone, uses `GuestCustomer.upsert` keyed by browser session, then creates appointment. Default cookie is `guest_session_id_local` (30 days), inconsistent with shop if no env override. `customerPhoneAtBooking` / `customerEmailAtBooking` snapshots exist. `/api/public/appointments/lookup` now returns generic response on phone-only requests; however, it does not actually send tracking info in that branch. Reference + OTP branch invokes account-creating `customerPhoneAuthService.consume`, looks up reference scoped by organization but does not bind verified phone to appointment; no opaque token issuance or delivery. `/api/public/appointments/[id]` still permits phone OR reference and returns customer/guest/service/provider information without tenant context or strong ownership proof. This is a source-level access-control issue; no real records queried. Needs P0 repair and synthetic negative tests.
- HOTEL: enquiry `POST /api/hotel/v1/requests` and status route use `HotelGuestBookingRequest`, independent `HOTEL_GUEST_BOOKING_REQUEST_ENABLED=1`, hashed HMAC tracking reference and host organization scope. `REQUEST_ONLY` coordination branch is independent of operational reservation flag; availability-based enquiry branch also checks publication/availability. Existing GF2 docs need refresh. Separate anonymous reservation path `/api/hotel/v1/reservations` is behind `HOTEL_ANONYMOUS_RESERVATION_OPERATIONAL_ENABLED=1` outside demo, validates hold/replay and uses contact phone CRM resolution; not proof of phone ownership or live payment. Authenticated guest portal and guest reservations require operational gates, verified tenant context, CUSTOMER and schema readiness. Staff reservation guests and property profiles are not registered accounts. Preserve all PMS contracts. No new hotel guest accounts merely for occupants or waitlist entries.
- CRM: `resolveCustomerIdentity` matches OR of tenant phone hash/email/user/guest and fills null links; it does not authenticate ownership or reject all contradictory candidate links, and raw foreign references are not independently verified in that method. Staff route is role/scoped but requires link-ownership/conflict audit and tests. CRM serializer can use linked User or GuestCustomer; do not reuse resolver as authorization/claim engine. Tenant CRM records may exist without account; central verified phone is not cross-tenant consent. `CustomerIdentity.phoneHash` is unkeyed SHA-256 of organizationId and normalized phone, not anonymous or proof of ownership.
- Customer club: join/leave/status/tier routes already exist, per-tenant. Login path upserts active membership; hotel password join can explicitly update existing non-active membership including BLOCKED. Session validator requires active club membership. Authentication, operational customer access, club opt-in, marketing consent and blocked/left policies must be distinguished. NotificationPreference supports SMS, WEB_PUSH and IN_APP; default marketing SMS/push false, IN_APP true; no claim of universal marketing opt-out or consent versioning. Review manager membership APIs and cross-tenant mutation scope.
- User acquisition/conversion: no unified explicit non-destructive guest-to-user conversion/record claim found in reviewed source. Legacy cart merge is not account/history claim. Hotel profiles require explicit staff link and remain property-local. No automatic global merge/backfill by name, phone or email.

## 5. Authentication and OTP details

`lib/auth.ts`: NextAuth JWT 30 days; password credentials match username/email/phone; ambiguity fails closed; bcrypt; five failed attempts lock 15 minutes (concurrency requires review). Persisted credential binding and customer tenant session checks. Public registration creates CUSTOMER with username/password (minimum six characters); auto-login may fail after user creation. For CUSTOMER, password login requires recognized verified tenant context, exact origin, active club membership, no privileged memberships. This conflicts with generic platform signup and first-time customer onboarding. Hotel explicit join special path and customer club state changes need review. Google provider requires configured client id+secret; sign-in only existing email user, customer session prerequisites not satisfied by current Google callback. Public health reports not configured. Recovery endpoint/service exists but intentionally disabled; current GET confirms unavailable.

**OTP implementation** (`lib/customer-auth/core.server.ts`, `context.server.ts`, config/request routes, phone login UI):

- 4-digit cryptographic OTP, 120-second OTP expiry, 300-second link expiry, 60-second resend cooldown; intended three wrong attempts per challenge.
- Durable 15-minute issuance quotas: 3 per phone, 15 per IP, 100 per organization; advisory locks for issuance and phone identity consumption. HMAC OTP/token digest; encrypted AES-256-GCM outbox payload; no generic SMS delivery plaintext OTP.
- Request returns generic 202 (including disabled/suppressed/unavailable cases). UI currently says code was sent after successful HTTP response; delivery is not established. UI mostly Persian, hardcoded raw `/api/auth/customer/request`, return navigation to locale root, ASCII OTP entry; mobile/prefixed-app/I18N/return-to acceptance needed.
- OTP consumption can create User + verified CustomerPhoneIdentity + CustomerClubMembership + CustomerPhoneSession in one transaction. It refuses automatic adoption of an existing unverified legacy phone/username. This is good for takeover prevention but leaves no reconciled path for existing account holders. A successful OTP used for ownership verification must not have the same side effects as explicit account creation.
- Failed OTP attempt code performs a separate `db` update rather than `tx`, then throws. Sequential regression test exists. Initial precheck occurs before identity lock and is not atomically coupled to attempt reservation/claim. Concurrent attempt cap, lockout, consumed race, malformed/legacy hash and trusted proxy forwarded IP need dedicated real PostgreSQL acceptance; no confirmed brute-force bypass asserted. Do not merely change OTP length and assume fixed.
- Context refuses platform host as public tenant origin and only accepts verified ACTIVE domain, with DNS/TLS/provider readiness. Current platform public config null context matches this. Not universal platform sign-in.

Required live OTP prerequisites from actual code (not a recommendation to turn on): `CUSTOMER_PHONE_AUTH_ENABLED=1`, `CUSTOMER_AUTH_SMS_WORKER_ENABLED=1`, NEXTAUTH_SECRET length >=32, valid `INOTI_PLATFORM_SMS_TOKEN` and `INOTI_PLATFORM_SMS_LINE_NO`, `INOTI_ALLOW_LIVE_SMS=true`, `INOTI_RUNTIME_MUTATIONS_APPROVED=true`, verified tenant origin, DB schema and a functioning scheduled dispatcher. Public config only proves composite available=false for tested tenants; precise false prerequisite unknown. `.env.example` lacks the explicit customer phone/SSO/iNoti auth worker variables in the reviewed example, despite code requiring them.

## 6. SSO details

`lib/customer-auth/sso.server.ts`, `app/api/auth/customer/sso/{start,issue}/route.ts`, `components/auth/customer-sso-login.tsx`, Auth.js customer-sso provider: 32-byte random one-use ticket (60 seconds), digest stored, SHA-256 browser challenge, host-only HttpOnly verifier cookie (120 seconds, Secure in HTTPS, `__Host-`), ticket fragment, exact target origin/org and source persisted session. Revalidates verified phone identity, active nonstaff CUSTOMER, active source AND target club memberships. Does not autojoin a new organization. User-mediated, explicit two-domain flow, not central identity provider or silent global login. Production availability requires `CUSTOMER_SSO_ENABLED=1` plus >=32-char CUSTOMER_SSO_SECRET or NEXTAUTH_SECRET and verified tenant context. Sign-out revokes current session; other independently issued sessions survive by design; global logout not established. Old tests show this behavior. Public config false for three recognized tenants. HTTPS/PWA/cross-domain real runtime and new tenant enrollment unverified.

## 7. SMS provider paths — deliberately distinct

### A. Platform OTP: iNoti token transport

`lib/customer-auth/inoti-token-transport.server.ts`, `sms-runtime.server.ts`, `sms-outbox.server.ts`, `scripts/inoti/customer-auth-sms-worker.mts`. Uses platform-only token and line; does not accept tenant credential override. Actual transport code is implemented; response validation, bounded worker batches, claim lease 30s, send timeout 10s, retry only definite nonacceptance; ACCEPTED means provider queued, not handset delivered. Ambiguous/crashed sends -> UNCERTAIN with encrypted payload purged; no blind retry. Worker is one-shot CLI; scheduling/operator ownership not provided by this source path. No production scheduler/queue telemetry evidence. Provider GET query includes sensitive values; enforce redaction through proxy/APM before canary. No real send in this audit.

### B. Business iNoti: tenant routing foundation only

`lib/integrations/inoti-sms/{routing,provider}.ts`: organization ACTIVE integration/credential routing, separate PLATFORM_OTP and organization purposes. `sendMessage` returns INOTI_LIVE_SMS_DISABLED or INOTI_SMS_SEND_CONTRACT_UNVERIFIED even when live gate is open. `getMessageStatus` returns UNKNOWN/unverified. Not complete operational tenant SMS service. Active-line diagnostics are not send proof. No implicit platform-funded fallback.

### C. General notification SMS: SMS.ir

`lib/sms/*`, `lib/notifications/*`, notification operations dashboard: provider abstraction, dry-run, text/bulk/like-to-like/verify, delivery/pack/cost and report endpoints, internal/provider reconciliation, masked phone. `SmsDelivery` supports guest without customerId. Current client does implement report endpoints, unlike old P120E documentation. Guest order lifecycle router calls SMS with dryRun=true. General SMS.ir `sendVerifyCode` exists but is not the current OTP login transport.

Actual runtime `getSmsRuntimeConfig()` gates: `SMS_PROVIDER=sms_ir`, `SMS_DRY_RUN=false`, `DEPLOYED_ALLOW_REAL_SMS=1`, `DEPLOYED_SMS_TARGET_MOBILE` configured OR `SMS_REAL_SEND_OPERATOR_CONFIRMED=1`, `SMS_IR_USERNAME`, `SMS_IR_API_KEY`, `SMS_IR_LINE_NUMBER` or `SMS_IR_LINE`. Old docs/example list `SMS_REAL_SEND_ENABLED`, ACK and guest real-send flags; the reviewed runtime predicate does not read these switches. This is a policy/documentation mismatch needing P0 fail-closed contract/test reconciliation before activation. Live health reports dry_run and real send false. No actual delivery evidence.

### D. USSD

`CustomerUssdEnrollmentRoute` and `lib/customer-auth/ussd.server.ts` provide validated enrollment parsing, route lookup, destination resolution and call to the same OTP request service, not a separate trusted identity. The function was not found invoked by application route handlers in the scanned source; separate USSD integration routes exist. Wiring, provider callback identity and live enrollment need verification; no provider interaction performed.

## 8. Test and migration evidence

Existing migrations: `20260815000800_customer_identity_foundation`, `20261104170000_customer_phone_auth`, `20261105100000_customer_sso`, `20261105110000_customer_auth_sms_acceptance`, `20261106124758_add_customer_otp`; plus earlier customer club and SMS migrations, later hotel enquiry, guest profiles and waitlist migrations. Presence and CI migration on synthetic database do not establish production ledger.

Dedicated integration suites present and matched current Git blobs: `customer-phone-auth.local.test.ts`, `customer-phone-auth-http.local.test.ts`, `customer-sso.local.test.ts`, `customer-sso-http.local.test.ts`, `customer-inoti-sms.local.test.ts`. Unit suites cover crypto, auth core/outbox/runtime, token transport, SSO, password session and USSD enrollment. Historical `docs/handoffs/evidence/2026-11-05/customer-auth-sso-validation.json` reports 34/34 combined + 1 HTTP; `customer-inoti-sms-validation.json` reports 52/52 expanded; `customer-inoti-sms-postgresql.json` reports 3/3 mocked provider; SSO HTTP evidence reports distinct target session and target-only logout. Those were on earlier uncommitted source candidates, not current main. OTP implementation has since changed. Current workflow inventory shows no dedicated customer-auth/SSO PostgreSQL job and no references to these suites in available workflow files. Verify actual test invocation coverage and add focused permanent CI rather than assuming generic PMS gates suffice.

## 9. Prioritized findings and next steps

| ID | Priority | Evidence | Proposed remediation/acceptance |
|---|---|---|---|
| G0-01 | P0 | Legacy public appointment detail route permits weak proof, lookup partially patched | Strong resource-bound expiring token/verification-only proof; minimized DTO, tenant context, durable rate limit; negative tests for wrong phone/reference/origin and no account created |
| G0-02 | P0 | OTP consume creates user/club even for lookup; admission tied to club | Split challenge purpose (LOGIN/REGISTER/VERIFY_RESOURCE), explicit account creation, relationship admission separate from loyalty and consent |
| G0-03 | P0 | OTP attempt precheck and wrong-attempt write not atomically bounded; forwarded IP trust unresolved | Dedicated concurrent PostgreSQL tests and trusted proxy verification; preserve policy unless owner changes it |
| G0-04 | P0 | CRM OR match can fill null links without conflict/ownership proof | Verify candidate links and scope, explicit conflict quarantine, never use contact match alone to claim historical records |
| G0-05 | P0 | Documented SMS flags not actual runtime predicate, OTP GET redaction and worker operational evidence missing | Single tested fail-closed flag contract, secret-safe worker status, no network send in CI |
| G0-06 | P0 | Customer login/registration paths incompatible with platform and new tenant/no membership; hotel join can reactivate blocked membership | Separate central account from tenant authorization and club, preserve blocked policy, legacy verified linking, protected staff path |
| G0-07 | P1 | Modern Retail requires account; legacy guest cart/checkout exists | Reuse modern checkout guarantees with guest principal, tenant ownership, safe retry/claim and no fake User |
| G0-08 | P1 | GuestCustomer globally session-keyed, inconsistent cookie default/TTL, multiwrite merge via GET | Standard tenant-aware guest session, immutable transaction snapshots, atomic/idempotent cart transfer and explicit mutation |
| G0-09 | P1 | SSO only existing active memberships; no global logout, platform host unsupported | Retain safe ticket mechanism; define explicit new-tenant relationship flow, central session model if approved, HTTPS/PWA and revocation tests |
| G0-10 | P1 | No unified verified guest history conversion; CRM, account, occupants separate | Per-resource proof and append-only links, no automatic merge by phone/name, preserve historical snapshots, optional conversion |
| G0-11 | P1 | Tenant iNoti sends/status stub; USSD enrollment unverified; SMS.ir dry-run | Complete authorized provider routing/consent/delivery ledger; separate OTP and business accounts; canary only after owner approval |
| G0-12 | P1 | Recovery disabled; Google provider conditional/not ready for customers; Persian-only OTP UI | Secure recovery/linking, locale/mobile/PWA UX, avoid introducing unnecessary providers in initial delivery |
| G0-13 | P0 gate | Private runtime flag/worker/migration status and fresh identity tests unknown | Read-only metadata preflight + disposable synthetic tests on exact SHA; redacted booleans, no PII/secrets, no production mutations |

## 10. Suggested compact functional delivery sequence (not owner-approved yet)

1. **Identity safety and readiness:** G0 metadata and dedicated tests; fix G1 OTP resource-vs-login separation, appointment tracking, actual gates and unsafe linking/blocked membership as coherent security tranche. No real SMS.
2. **Unified Guest Access:** modern retail guest cart/checkout, normalized guest session and resource ownership, appointment tracking and hotel enquiry integration; retain legacy backwards compatibility and PMS. GF0/GF1/GF2 reconciled to actual current code.
3. **Progressive Customer Enrollment:** explicit account creation/linking, legacy conflict quarantine, guest history claim, per-tenant customer relationship and independent club/marketing consent; customer access without forced club membership.
4. **OTP/SSO and Messaging Release:** worker/recovery/SSO UX, tenant iNoti and SMS.ir routing, safe diagnostics and tests; separate approved production canary and migration/activation gates. Parallelize independent source work where safe; no documentation-only PR. Update existing G0/GF/G roadmap and Playbook in functional PRs. Housekeeping stays paused until owner decision.

## 11. Read-only evidence still needed for operational G0 closure

With separate authorized operator access: exact deployed revision and service identity, sanitized boolean state for each required OTP/SSO/SMS gate and credential presence/validity (not values), worker schedule/last execution/queue aggregate and delivery status counts (no phone/message/token), verified production database identity + migration ledger names/status for relevant auth schemas (no user rows or credential data), and fresh disposable PostgreSQL/HTTP/browser identity suite on exact baseline. Any live OTP/SMS canary must be separately approved with one controlled recipient; no current permission to send. No code modifications or new PR were made during this audit.


## G0-B executable baseline (2026-11-26)

Execution-agent runner evidence on exact main `1e50f5c2a9d6374014b5aca685e9dc57cff947a8`: Prisma validate/generate and full disposable PostgreSQL migration chain passed; 82/82 unit tests passed, phone-auth PG 8/10, SSO PG 7/7, iNoti SMS PG 3/3. Both HTTP suites failed readiness (3 cancelled subtests, no functional verdict). Worker check-only passed. Task-owned container removed, snapshot cleaned, tracked source unchanged. No production database access or real provider call. These are supplied executor results, not independently rerun by the Main Agent.

Root-cause review: the two phone-auth PG failures used a fixed clock or immediate reissuance contrary to the 60s resend cooldown. Separate code finding: pre-lock OTP attempt read and out-of-transaction failed-attempt write are not a safe atomic contract. G1-A candidate serializes issuance and consumption, commits bounded failure increments before generic rejection, supersedes older OTP challenges, preserves cooldown/quota, and adds deterministic concurrency tests plus bounded synthetic HTTP startup diagnostics. This is not acceptance evidence; run exact candidate against fresh disposable PG and actual HTTP before PR merge. Existing account/club creation semantics are not altered by G1-A; they require the subsequent explicit enrollment/authorization design. G0 private Runflare metadata, trusted-proxy boundary, account reconciliation, live sends and HTTPS/PWA remain unverified. No production activation, no Housekeeping.


## G1-A acceptance and G1-B1 appointment ownership boundary
- PR183 merged 2026-11-26 at `22fc1cc29d007d0f4ba369a73bc081ae8dbdd5ae`; head `0814137bcc9a672b96b76b5a7d476c1a1896cc27`. Local evidence 83 unit + 21 PostgreSQL + 3 HTTP (two runs); four hosted gates success. No production activation.
- G1-B1 candidate: appointment lookup/detail require an existing domain-bound CUSTOMER session or possession of the random guest session cookie used at booking; explicit organization and validated host/capability scope on every read. Ref is a filter, not authorization. No phone lookup, OTP consume, account creation, club enrollment, fake SMS acknowledgement, or private contact/internal notes in this public DTO. Legacy phone/ref GET and old lookup body are rejected. List bounded to 50 latest and optional reference filter. Account-less tracking remains same-browser only. Cookie loss, cross-device recovery, guest conversion, account/club decoupling, and full booking lifecycle claims remain pending. Do not infer phone verification from a cookie. Existing staff APIs and booking creation are not changed. No migration, flag activation or real SMS. New route tests require Node 24 module mocks; acceptance and CI evidence must be recorded after execution, not inferred from implementation.

### G1-B2 candidate — club-independent customer authentication

- PR184 reported squash-merged by Kilo, with 115 local cases, full TypeScript and four hosted gates on `c85b2bd0b8a2e75bfb2924428fda32640574eaa7`. Reported main `875d896072e8c8d1f1015cc425a8a40068dff665`; independent remote read unavailable at authoring. All exact target blobs must match before apply.
- This candidate removes automatic club creation from OTP sign-in and hotel registration, and removes the legacy hotel credential join/reactivation path. A missing club membership is not an authentication failure. Password and SSO sessions remain persisted and bound to verified tenant/origin; SSO first visit does not create memberships or entitlements. Existing explicit BLOCKED/PAUSED/LEFT rows continue to restrict access as a conservative transitional policy; never reactivate them implicitly. Separate tenant access restrictions from club lifecycle in the later consent/policy work; do not silently rewrite historical statuses.
- Hotel authenticated booking requires verified customer context rather than mandatory membership, with explicit existing restrictions, property/tenant and record ownership checks preserved. Guest enquiry remains independent. All real provider flags and deployment controls unchanged.
- OTP *sign-in* still has the existing account creation semantics; proof-only OTP and explicit progressive account enrollment are subsequent G3 work. Legacy orgSlug team application, recovery, historical consent and explicit audited club opt-in are not changed here. No migration, backfill, or automatic account/history linking.
- Acceptance pending: exact local TypeScript + unit/PG/HTTP and affected hotel regression gates; no live production acceptance implied.


### G2-A candidate — shared guest cart and explicit transfer
- PR185 reported merged at `62002bb9ba9b1116b617d5f225833d107354909f` (head `a73d8aafade8b07331fa043feda70102ed43aa35`, 120 local cases and four hosted gates). Independent GitHub fetch unavailable; executor must verify exact upstream evidence and base blobs.
- Modern and legacy cart APIs share the existing host-only random guest cookie and organization-scoped cart service. Reject wrong tenant, preview, inactive SHOP, foreign cart item and cross-origin mutation; replace an invalid cookie only on eligible guest reads/adds and reject unproven update/delete. Responses do not include the guest bearer. Existing legacy guest order cookie remains compatible.
- GET never transfers cart contents. Same-origin POST merge transfers only browser-owned selections into the verified tenant CUSTOMER cart, serializable and retryable. Preserve all selections (including unavailable lines); checkout revalidates stock and price. No history claiming, user creation, club enrollment or inventory reservation. Existing staff cart access remains separate; do not import guest selections to a privileged principal.
- Guest cart editing is available without an account. Modern final checkout still requires login in this tranche; guest quote/order/payment and safe resource tracking are G2-B work. Existing legacy guest checkout remains unchanged. No migration or activation. Cross-device recovery and explicit conversion remain G3. Local HTTP evidence and hosted CI required before merge.


### G2-B candidate — guest checkout and browser-owned order tracking
- Executor reports PR186 merged at `6b06418b512aac5175079baab74da5c742c3207e` (head `abbc45134d3c882fc06c83f018fba2b933dea732`, 123 local cases, four hosted gates); exact upstream check required.
- `RETAIL_GUEST_CHECKOUT_ENABLED=1` is an explicit runtime rollout gate, default OFF. Enable only in disposable fixtures unless separately authorized. Existing account checkout remains compatible. Guest checkout requires a reviewed quote, contact name/mobile (unverified, only coordination), configured fulfillment and enabled cash or bank-transfer policy. Account-only coupons and guest USSD fail closed. No provider calls.
- Same tenant + random browser cookie proves ownership; order guest row is immutable per order and stores a tenant-scoped digest + request key, not raw cookie. No user or membership creation, no claiming history by contact. Explicit account merge before new checkout; existing guest history on guest session only. Narrow recent-order listing and recovery use owner scope; bank time/receipt submission uses that same scope. Guest audit submitter uses `guest:<GuestCustomer.id>` (no User relation); money remains pending until merchant approval. Serializable order/inventory/payment transaction, bounded same-browser request budget, idempotent replay, existing expiry/cancellation preserved. Cross-browser recovery, conversion, stronger distributed abuse controls, guest USSD and account-bound discounts remain subsequent work. In particular, the recent-order budget is not proof against cookie rotation and public rollout needs stronger anti-abuse acceptance. Legacy order/appointment writers accept only existing UUID session formats; modern guest orders cannot be read by supplying an internal scope as a legacy cookie. No production activation or migration. Browser acceptance and rollout separately required.
