# Bazar Baz Handoff Snapshot 09 - Deployment Report

## Production

Production URL: `https://www.bazar-baz.ir`

Vercel project:

| Item | Value |
| --- | --- |
| Project | `shadcn-rtl` |
| Framework | Next.js |
| Node version | 24.x |
| Latest deployment | `dpl_5G2pu15bDSVz7v2z8tyB4iQeco4F` |
| Deployment state | `READY` |
| Target | production |
| Source | git |
| Commit | `b5624c48fe4820cbeae9a2ef8cea514ffed6d7d5` |
| Commit message | `test(b2b): finalize custom domain onboarding acceptance` |

Production aliases include `www.bazar-baz.ir`, `bazar-baz.ir`, Vercel project aliases, and existing custom shop domains such as `www.khalae.ir`, `www.leocafe.ir`, `www.cafechakme.ir`, and `www.sicilyfastfood.ir`.

## HTTP Checks

Checked with Node `fetch` from the local workspace:

| URL | Status | Notes |
| --- | ---: | --- |
| `https://www.bazar-baz.ir/` | 307 | redirects to `/fa` |
| `https://www.bazar-baz.ir/fa` | 200 | Persian homepage |
| `https://www.bazar-baz.ir/fa/features` | 200 | B2B features |
| `https://www.bazar-baz.ir/fa/demo` | 200 | demo portfolio |
| `https://www.bazar-baz.ir/fa/request-demo` | 200 | lead form |
| `https://www.bazar-baz.ir/fa/pricing` | 200 | conversion page |
| `https://www.bazar-baz.ir/fa/contact` | 200 | contact page |
| `https://www.bazar-baz.ir/fa/trust` | 200 | trust page |
| `https://www.bazar-baz.ir/fa/privacy` | 200 | privacy page |
| `https://www.bazar-baz.ir/fa/terms` | 200 | terms page |
| `https://www.bazar-baz.ir/api/health` | 200 | health endpoint |

PowerShell `Invoke-WebRequest -Method Head` returned connection-closed errors from this environment; Node `fetch` GET checks succeeded.

## Custom Domain Readiness

Source readiness: accepted by P11-FIX1.

Production readiness remains conditional:

- P11 migration must be confirmed/applied in production.
- Provider configuration must be confirmed.
- Exact real-mutation ACK is required before Vercel add/check/remove mutations.
- Authorized real-domain smoke test is still pending.
- Do not automatically activate or remove domains during handoff.

## Environment Notes

No environment values are included in this report. Local ignored env files exist in the workspace and must remain excluded from the ZIP.

