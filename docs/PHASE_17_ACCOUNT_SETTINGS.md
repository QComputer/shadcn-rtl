# Phase 17 — Profile, Settings, and Account Self-Service Hardening

## Scope

Phase 17 hardens account self-service and dashboard settings workflows.

The main goals were:

- make `/api/users/me` use the same server-side guard/error pattern as the hardened dashboard APIs;
- validate and audit user profile changes;
- make password changes safer and rate-limited;
- fix `/api/users/me/business-hours` ownership and organization membership handling;
- clean up `/dashboard/settings` so profile, security, appearance, memberships, and business hours use the hardened APIs;
- add a deployed smoke test that does not require Playwright.

## API changes

### `/api/users/me`

`GET` now returns only the authenticated active user's public/self-service fields and active memberships.

`PATCH` accepts only self-service profile preferences:

- `firstName`
- `lastName`
- `phone`
- `locale`
- `theme`

It does not allow self-editing role, status, email, username, organization membership, lockout fields, or security metadata.

`POST` is reserved for password changes. It now:

- requires the current password;
- requires the new password to be at least eight characters;
- requires confirmation to match;
- rejects unchanged passwords;
- rate-limits password-change attempts per user/IP;
- hashes the new password with bcrypt;
- writes an audit log.

### `/api/users/me/business-hours`

The route now uses `requireAuthSession()` and organization membership resolution instead of relying on a nullable session organization field.

`GET` returns business hours for the user's active membership organization, or a specifically requested `organizationId` if the user belongs to it.

`PUT`:

- requires active organization membership;
- requires an allowed organization role: `ADMIN`, `MANAGER`, or `STAFF`;
- validates the business-hours schema;
- rejects duplicate days;
- updates only the current user's business hours for the resolved organization;
- writes an audit log.

## Dashboard settings changes

`/[locale]/dashboard/settings` was simplified and reconnected to the hardened APIs.

The settings page now separates:

- profile fields;
- security/password change;
- appearance and locale;
- active memberships;
- self business hours;
- notification placeholders.

Organization creation was removed from this general settings page to avoid mixing account self-service with organization onboarding/admin workflows.

## Deployed smoke test

Run:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase17
```

The test checks:

- homepage is reachable;
- settings page does not server-error unauthenticated;
- `/api/users/me` blocks unauthenticated users;
- profile update blocks unauthenticated users;
- password change blocks unauthenticated users;
- business-hours read/update block unauthenticated users;
- membership endpoint still blocks unauthenticated users;
- health endpoint is reachable.

## Notes

This phase intentionally does not add email-change or account-deletion flows. Those need separate verification and recovery rules.

Future improvements:

- add an authenticated deployed smoke test using seeded credentials;
- add email-change verification flow;
- add password reset and active-session management UI;
- persist notification preferences in a dedicated table.
