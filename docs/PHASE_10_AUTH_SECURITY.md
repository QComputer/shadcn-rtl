# Phase 10 — Authentication and Security Headers

## Scope

Phase 10 hardens authentication behavior and adds baseline security response headers without changing the deployed UI routes.

## Changes

- Credentials login now accepts username, email, or phone through the same username field.
- Credentials login ignores soft-deleted users.
- Disabled users cannot sign in.
- Locked accounts cannot sign in until `lockedUntil` expires.
- Failed credentials attempts increment `failedLoginAttempts`.
- Accounts are temporarily locked for 15 minutes after 5 failed attempts.
- Successful credentials login resets `failedLoginAttempts`, clears `lockedUntil`, and records `lastLoginAt`.
- Google sign-in is allowed only for an existing active, non-deleted, unlocked user with a matching email.
- Full user/session payloads are no longer logged from NextAuth events.
- Baseline security headers are configured in `next.config.ts`:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy`
  - `Cross-Origin-Opener-Policy`
- Added a small in-memory rate-limit helper for lightweight public endpoint protection.
- Public search now has a conservative per-IP rate limit.

## Deployed smoke test

PowerShell:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase10
```

Git Bash / Linux / macOS:

```bash
DEPLOYED_URL=https://zc0.runflare.run npm run e2e:deployed:phase10
```

The test verifies:

- Homepage is reachable.
- Security headers are present.
- Public search still responds.
- Protected users and dashboard notification APIs remain blocked without authentication.

## Notes

The in-memory rate limiter is a best-effort protection suitable for a single process or light serverless use. For high-traffic production, use a shared store such as Redis or a platform/CDN-level rate limiter.
