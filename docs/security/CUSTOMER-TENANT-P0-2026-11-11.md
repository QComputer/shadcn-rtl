# Customer tenant boundary P0 — 2026-11-11

Development only. Base: 4cc3313e25988ff3f0ed255b2821436799e27033. PR48 remains at 976aa6abd9ad2b8616ed8dd2a00bacd79a703d4e. No migration or Production/provider changes.

## Confirmed defects and changes

- Dashboard, order and appointment reads previously used a global customer identity without a domain-bound organization. Resource ownership alone allowed the same customer to access another organization's records. Customer requests now require the verified Host/trusted-proxy context, signed origin and organization, a live persisted customer session, active club membership, and resource ownership.
- Password customers now receive the same organization-bound persisted session contract as OTP/SSO. Platform-host customer login is denied; staff password login remains available. Client organization parameters can only narrow the verified context.
- Customer notifications (including the alternate dashboard API), preferences, push subscriptions, club membership and profile membership projections are scoped. Appointment confirmation now checks active organization authorization as well as role.
- Account-global conversations have no organization ownership field. CUSTOMER access to their four handlers is explicitly denied pending a tenant-owned messaging contract; staff messaging remains unchanged. This is a deliberate temporary functionality restriction, not a claim that global messaging became tenant-scoped.
- Legacy customer sessions lacking the signed origin/session context must sign in again. No stored customer data is migrated or removed.

## Local evidence

- 15 unit tests passed: phone-auth core/crypto and SSO core.
- 17 PostgreSQL integration tests passed: phone auth and SSO, including revocation, active memberships and one-time exchange. Fixture cleanup passed.
- Real HTTP/NextAuth + PostgreSQL: two verified synthetic domains, two organizations and one shared CUSTOMER identity; password login, scoped dashboard/orders/appointments/notifications, foreign resource denial, membership/preference mutation denial with DB verification, forged header isolation, blocked/left memberships, and four global messaging denials. ADMIN own-organization confirmation succeeded; ADMIN/STAFF foreign confirmation failed. Status PASSED, exitCode 0, cleanup PASSED.
- Existing real HTTP OTP-to-SSO exchange passed again after the new origin claim: separate host-only target session, negative exchanges, replay and logout isolation; cleanup PASSED.
- PostgreSQL 17.10 ran in a disposable Docker tmpfs container on loopback port 55439. Prisma schema push plus the existing customer-phone revocation triggers were installed only there. This is not a full migration-lineage or Production acceptance claim.
- Initial failures were fixture/environment defects (missing revocation triggers, stale cooldown expectations, wildcard localhost DNS and Node fetch Host handling); fixed without weakening the OTP cooldown or tenant checks.

Raw local logs and sanitized result receipt: `.tmp/customer-identity-p0/`. Locked dependencies used. Real SMS, payment, Hotel cron and anonymous-hold operational gates remain off. No main push or release approval is included.

## Remaining scope

Customer messaging needs a separate tenant ownership contract before enabling it. Guest bearer-key flows, public storefront behavior, unrelated staff messaging and all application APIs are not certified by this focused P0. Hosted reverse-proxy/Production behavior still requires its own release acceptance.

Quality gates: full repository TypeScript check exited 0; scoped ESLint exited 0 with no remaining warnings. The final focused HTTP rerun also verifies staff self-membership access in its own organization remains available and foreign membership access is denied.
