# Phase 1 — Security and Dashboard API Baseline

Phase 1 introduced the first production-hardening layer for authentication-sensitive APIs and unsafe public write surfaces.

## Completed scope

- Added server-side API guard helpers.
- Hardened user and organization-member APIs.
- Removed unsafe guest appointment user creation with a static password.
- Protected upload, image delete, and QR save endpoints.
- Hardened public appointment lookup.
- Hardened NextAuth production secret/provider behavior.
- Added deployed smoke coverage without Playwright.

## Deployed smoke test

PowerShell:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase1
```

Linux/macOS/Git Bash:

```bash
DEPLOYED_URL=https://zc0.runflare.run npm run e2e:deployed:phase1
```

## Notes

This phase did not redesign the data model. It established server-side guard patterns that later phases expanded.
