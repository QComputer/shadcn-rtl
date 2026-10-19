# Secure Hotel onboarding: operator and release package

**State: local implementation, PostgreSQL acceptance and authenticated development-server browser acceptance passed; Production activation remains pending.** This document describes the Hotel onboarding flow and the checks required before using it for Hotel Damoon. It does not authorize a Production write, schema change, deployment, invitation delivery, or public launch.

Routing was preserved in local commit `6b186d300ce23d22b8ee2ee2fad68fb62776dcbc` on `codex/platform-combined-integration-20261015`, following accepted combined HEAD `bcf3048931f255e7739cf79bb769bad0547214f2`. Resolve the final onboarding commit from that branch's reviewed local history; no remote push is part of this milestone.

## Provisioning boundaries

The SUPER_ADMIN bootstrap creates an organization with `vertical=HOTEL`, a closed `isOpen=false` setting, and exactly one enabled capability: `HOTEL_WEBSITE`. It creates the Hotel property and the ordinary organization/payment settings and writes an acquisition receipt plus audit entry. It does not grant `HOTEL_BOOKING`, create rooms or rates, enable public booking, create Hotel content, or publish a website revision.

The property model defaults `isActive=true`; there is no separate pending-onboarding property state in this bootstrap. Treat the property as operationally pending until its details and content are reviewed and an approved revision is explicitly published. The public Hotel route must remain unpublished meanwhile. `HOTEL_BOOKING` remains absent.

Bootstrap retries are idempotent for the same persisted SUPER_ADMIN actor, key, and request fingerprint. The existing `OrganizationAcquisition.metadata` row is the durable receipt. Reusing the key with a different actor or payload conflicts. Invitation issuance is also actor/key/request scoped; the initial response contains the one-time token, while a replay deliberately returns `oneTimeToken: null` because the secret is never stored for recovery.

The additive migration is `prisma/migrations/20261015160000_bound_organization_invitations/migration.sql`. It adds nullable binding fields for legacy invitation rows, constraints and indexes for new bound invitations, and immutable identity/terminal-state guards. A partial expression index enforces uniqueness of secure Hotel bootstrap keys in the existing acquisition metadata. This index, the CHECK constraint and trigger are deliberate SQL contracts, not fully representable in Prisma. A path-specific `.gitattributes` rule pins this new migration to LF so Windows checkout conversion cannot change its accepted checksum; historical migrations are untouched. The old unbound invitations are not redeemable through the new recipient-bound flow. Existing Production migration-lineage blockers must be resolved through their own approved process. No Production migration or mutation was run for this work.

## Operator preflight

Before a future authorized Production operation:

1. Confirm the operator is authenticated and has persisted global `User.role=SUPER_ADMIN`, with an active, non-deleted, unlocked account. The service checks the persisted global role against the session role; organization membership alone is insufficient.
2. Use a restricted, read-only existence check limited to the needed `User`, `Organization`, `OrganizationMember`, and `OrganizationCapability` fields. Check whether the intended organization/property and recipient accounts already exist before issuing any write. Do not inspect or request owner passwords, reset tokens, session tokens, or unrelated personal data.
3. For each invitee, verify the exact account ID, username, and current email. The account must be active and globally `CUSTOMER`; `User.emailVerified` must be set, and an `EmailVerification` row for that user and exact current email must have `verifiedAt` set no later than now. The service independently checks both verification records at issue and redemption.
4. Keep each recipient's role scoped to an `OrganizationMember` row with role `ADMIN` or `MANAGER`. Redemption never changes the global `User.role`; it only adds the scoped membership and sets `isTeamMember=true`. Existing customer memberships on other organizations are preserved. An active privileged-team membership on another organization blocks issuance/redemption.
5. Prepare the recipient's invitation delivery through an approved secure channel. This codebase does not implement email-verification delivery or invitation email delivery. Do not describe those workflows as implemented or verified.

The actual Damoon owner identities, exact user IDs, verified email addresses, and approved property name/slug have not been verified. The intended usernames are `damoon-admin` and `damoon-manager`; those names are not proof that matching accounts exist. Do not substitute guessed IDs or contact details.

## API operations

All mutations require an authenticated session and same-origin request. Responses are private and uncached. JSON bodies are limited to 8 KiB and strictly validated; server-derived actor identity must never be sent by the client. Replace every angle-bracket placeholder with a value verified for the intended operation. The example values below are templates, not live credentials or authorization.

### Bootstrap the Hotel organization and first property

`POST /api/platform/organization-onboarding/hotel`

Required headers: `Content-Type: application/json` and `Idempotency-Key: <unique-8-to-128-character-ASCII-key>`.

```json
{
  "name": "<verified Hotel organization name>",
  "slug": "damoon-hotel",
  "locale": "fa",
  "property": {
    "name": "<approved property name>",
    "slug": "<approved property slug>"
  }
}
```

The route only accepts `fa`, `en`, or `ar` for locale; the default is `fa`. Use the same key and identical payload to safely retry an uncertain response. A successful first response supplies organization/property IDs and `replayed: false`; an exact replay returns the persisted IDs with `replayed: true`. A conflicting owner, key, or fingerprint fails closed.

### Issue an invitation bound to an existing verified customer

`POST /api/platform/organization-onboarding/invitations`

Required headers: `Content-Type: application/json` and a fresh `Idempotency-Key` with the same syntax as bootstrap.

```json
{
  "organizationId": "<verified organization ID>",
  "recipientUserId": "<verified user ID>",
  "recipientEmail": "<exact current verified email>",
  "recipientUsername": "damoon-admin",
  "invitedRole": "ADMIN",
  "ttlHours": 24
}
```

Use `damoon-manager` with `invitedRole: "MANAGER"` for the second invitee. `ttlHours` defaults to 24 and may be set from 1 through 72. Only `ADMIN` and `MANAGER` are valid invite roles. The first successful response returns the token once; deliver it through the approved secure channel. A retry with the same actor, key, and request does not reveal the token again. If delivery is lost, explicitly revoke the still-unused invitation and issue a replacement with a new idempotency key; do not attempt token recovery.

### Revoke an unused invitation

`POST /api/platform/organization-onboarding/invitations/revoke`

Required header: `Content-Type: application/json`.

```json
{
  "invitationId": "<invitation ID from the issuance response>"
}
```

Revocation is for an unused invitation. A claimed invitation is terminal and cannot be revoked. Revoking an invitation does not deactivate an already-created membership; that requires a separately authorized, narrowly scoped membership action.

### Redeem as the invited recipient

The recipient signs into the exact invited account and opens `/fa/onboarding/organization-invitation`. The page has no token in its URL and requires authentication. The recipient enters the one-time code received through the approved secure channel; the code is submitted to `POST /api/organization-invitations/redeem` in a same-origin JSON body:

```json
{
  "token": "<43-character one-time code received securely>"
}
```

Redemption requires the authenticated user ID, global CUSTOMER role, username, current email, `User.emailVerified`, and a matching current `EmailVerification.verifiedAt` record to agree with the invitation. The code must also be unused, unexpired, unrevoked, and for an active Hotel organization with `HOTEL_WEBSITE`. It atomically claims the invitation and creates/reuses the scoped membership without elevating global role. After success, the user must sign out and sign in again to load the new membership context. The activation page clears the code from its input and directs the user to reauthenticate.

## Hotel Damoon target package

| Item | Intended value | Verification state |
|---|---|---|
| Organization slug | `damoon-hotel` | Intended only; check existence before any authorized write. |
| Administrator username | `damoon-admin` | Intended only; exact account ID, current email, active state, and verification evidence unverified. |
| Manager username | `damoon-manager` | Intended only; exact account ID, current email, active state, and verification evidence unverified. |
| Website target | `https://bazarbaaz.ir/damoon-hotel` | Expected public path; live redirect, domain routing, content, and Production behavior have not been verified here. |
| Locale redirect | Persian `/fa` | Expected route behavior; verify on the approved deployment before release. |
| Property name and slug | To be supplied by the authorized operator | Not verified; do not invent these values. |
| Public booking | Disabled / unavailable | No `HOTEL_BOOKING` capability is granted by onboarding. |
| Published content | None at bootstrap | Keep the site unpublished until a separate content review and publication approval. |

The root path `/damoon-hotel` is expected to resolve to the Persian route `/fa/damoon-hotel`. That expectation is not live acceptance evidence. Do not expose or advertise the site until the authorized release checks confirm the redirect and the intended unpublished/published state.

## Verification and release gates

The focused local runner is:

```powershell
node scripts/ops/verify-hotel-onboarding-local.mjs --browser
```

It provisions a task-owned loopback Docker PostgreSQL 17 database and, with `--browser`, launches a local development server and installed Chromium using synthetic identities and generated local-only credentials. It does not use Production credentials or the repository `.env` for the task database. Preserve its `result.json`, `browser-result.json`, logs, and cleanup result under `.tmp/hotel-secure-onboarding-<run-id>/`; report only sanitized metadata.

Final local acceptance evidence is retained under `.tmp/hotel-secure-onboarding-5ac6a28b548a/`:

- `result.json`: `status=PASSED`, `exitCode=0`, `cleanup=PASSED`.
- 103/103 migrations applied to a fresh, independently identified PostgreSQL 17 database; every ledger checksum matched the source SQL. No failed or rolled-back ledger rows.
- `postgres-tests.log`: 14/14 tests passed, including independent concurrent clients, scoped memberships, identity conflicts, immutable invitation bindings, audit failure rollback for all four onboarding operations, website publication/revocation and absence of booking/payment records.
- The strengthened concurrency rerun is `.tmp/hotel-secure-onboarding-9cafdf3f969e/result.json`, also `PASSED`/exit 0/cleanup `PASSED`: 103 migrations and 14/14 tests. It used database lock barriers and observed all five bootstrap writers and both redemption writers waiting concurrently before releasing the barriers; final state still contained one operation result and one scoped membership.
- `browser-result.json`: 6/6 scenarios passed using real credential login, authenticated invitation form activation, logout/relogin and CMS navigation. Editorial operations used actual authenticated browser HTTP requests, not mocked handlers. Published fa/en/ar content and RTL/LTR direction passed at mobile/desktop sizes. Screenshots are synthetic fixtures, not owner-approved Hotel content.
- A startup-readiness race and two browser failures were retained separately and repaired: readiness now probes TCP rather than the initialization socket; configured dev origins now use a hostname; the document locale comes from route params and cannot be overridden by an older locale cookie. Staff login chooses an actual staff membership rather than an older customer relationship.
- Focused source/route regressions passed 45/45 with no skips. Full TypeScript, Prisma validation/client generation, and the production webpack build passed. Targeted ESLint had no errors; its two existing `no-explicit-any` warnings in the shared locale layout remain outside this change. Build evidence: `.tmp/damoon-onboarding-production-build.log`; focused test evidence: `.tmp/damoon-onboarding-unit-tests.log`.

This evidence is local development-server acceptance. It is not staging, Production, physical-device or real-account activation acceptance. Before release, separately authorize source deployment and the new additive migration, resolve the known Production migration-lineage blockers, and complete the restricted read-only identity/organization/capability existence check. Verify the expected public route after deployment. No Production migration, bootstrap, invitation delivery, or data mutation is authorized by this document.

### Restricted Production existence verification

Use only an established read-only operator connection after verifying its exact target and scope. Begin `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY` and verify `current_database()::text`, `current_user::text`, endpoint/branch evidence and `current_setting('transaction_read_only')`; do not substitute the broad Production owner role. Limit queries to organization slug `damoon-hotel`, usernames `damoon-admin`/`damoon-manager`, and their matching memberships/capabilities/property. Select IDs, active/deleted states, global/membership roles, email verification evidence and approved contact identity only. Never select password, session, reset or verification token columns. End with `ROLLBACK`.

If a matching organization lacks this workflow's durable bootstrap receipt, the new operation deliberately returns a conflict. Prepare an explicit existing-record adoption/reconciliation review; do not alter its metadata, role or capability to force a retry to pass. If a username is already occupied, prove the real invitee's identity before any grant. An unverified account remains unprivileged. Real owner-approved contact identities and a supported trusted verification/delivery process are still required.

## Safe reversal

For an unused invitation, revoke it through the SUPER_ADMIN endpoint and record the result. If onboarding must be disabled, disable the `HOTEL_WEBSITE` capability through the approved administrative workflow; this preserves organization, property, content, audit, and other retained records. A claimed invitation cannot be revoked to undo access: separately authorize and perform a narrowly scoped membership deactivation, then verify the global user role remains unchanged. Do not delete user or organization accounts, delete retained Hotel data, or roll back financial ledgers as an onboarding reversal.
