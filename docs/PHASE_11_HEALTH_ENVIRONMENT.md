# Phase 11 — Deployment Health and Environment Validation

## Scope

Phase 11 adds operational readiness checks for deployed environments. The goal is to verify that the app can report safe health information, validate required runtime configuration, and test database connectivity without leaking secrets.

## Changes

- Added `GET /api/health`.
- Added optional deep database check through `GET /api/health?deep=1`.
- Added runtime environment validation in `lib/runtime-env.ts`.
- Added local environment validation script: `npm run health:env`.
- Added deployed smoke test: `npm run e2e:deployed:phase11`.
- Updated aggregate deployed smoke runner to include Phase 11.
- Updated project quality validator to require Phase 11 docs/scripts.

## Health endpoint behavior

`GET /api/health` returns a sanitized JSON payload:

```json
{
  "status": "ok",
  "service": "bazar-baz",
  "timestamp": "...",
  "uptimeSec": 123,
  "latencyMs": 2,
  "checks": {
    "environment": {
      "ok": true,
      "summary": {
        "nodeEnv": "production",
        "hasDatabaseUrl": true,
        "hasNextAuthSecret": true,
        "publicAppUrlConfigured": true,
        "deployedAppUrlConfigured": true,
        "authTrustHost": "true",
        "googleOAuthConfigured": false
      },
      "issues": []
    },
    "database": {
      "checked": false,
      "ok": null,
      "latencyMs": null,
      "error": null
    }
  }
}
```

`GET /api/health?deep=1` additionally runs a lightweight database connectivity query. It does not expose `DATABASE_URL`, `NEXTAUTH_SECRET`, connection strings, provider secrets, or stack traces.

## Required production configuration

At minimum:

```env
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=replace-with-a-strong-secret
AUTH_TRUST_HOST=true
NEXT_PUBLIC_DEPLOYED_APP_URL=https://your-domain.example
```

Google OAuth remains optional, but if it is enabled, both variables must be set:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Local checks

```bash
npm run health:env
npm run quality:local
```

## Deployed smoke test

PowerShell:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase11
```

Linux/macOS/Git Bash:

```bash
DEPLOYED_URL=https://zc0.runflare.run npm run e2e:deployed:phase11
```

The smoke test verifies:

- homepage reachability,
- `/api/health` reachability,
- sanitized health payload,
- environment summary presence,
- deep database health check,
- no-store cache headers.

## Notes

The health endpoint is intentionally public because platform routers/load balancers often need unauthenticated readiness checks. It only returns boolean/sanitized configuration status and generic failure messages.
