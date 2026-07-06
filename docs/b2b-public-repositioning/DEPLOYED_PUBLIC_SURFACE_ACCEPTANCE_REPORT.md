# Deployed Public Surface Acceptance Report

Generated: 2026-07-06
Target: https://www.bazar-baz.ir
Test type: HTTP-only production smoke (`e2e:deployed:b2b-public-surface`), no browser required.

## Summary

| Area | Result |
| --- | --- |
| Public B2B pages return 200 | PASS |
| B2B copy visible | PASS |
| Marketplace-first wording absent | PASS |
| Conversion links present | PASS |
| Trust/legal disclaimer copy present | PASS |
| Secret/leak scan clean | PASS |
| Marketplace discovery restricted (`/fa/shops` 404) | PASS |

## Page status

| Route | Status | Notes |
| --- | --- | --- |
| `/` | 307 | Locale redirect to `/fa` (acceptable) |
| `/fa` | 200 | B2B homepage |
| `/fa/demo` | 200 | Demo portfolio |
| `/fa/features` | 200 | Feature pages |
| `/fa/dashboard-showcase` | 200 | Dashboard showcase |
| `/fa/request-demo` | 200 | Conversion funnel |
| `/fa/contact` | 200 | Contact |
| `/fa/pricing` | 200 | Pricing |
| `/fa/trust` | 200 | Trust/data ownership |
| `/fa/privacy` | 200 | Privacy notice |
| `/fa/terms` | 200 | Terms of service |

## Safety checks

- No DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, AUTH_SECRET, SMS_IR_API_KEY, VAPID_PRIVATE, PRIVATE_KEY.
- No api.sms.ir/v1/send/bulk key, localhost:4001, /socket.io/?EIO=, or ERR_CONNECTION_REFUSED in public HTML.
- No full Iranian mobile numbers exposed publicly.
- No real SMS sent; no production mutation performed by smoke.

## Positioning checks

- B2B positioning visible (بازارباز، کسب‌وکار، داشبورد، باشگاه مشتریان، پیامک، اعلان، نوبت‌دهی، سفارش).
- Marketplace-first homepage removed; demo page clearly example-only (نمونه نمایشی).
- Request-demo / pricing / contact / dashboard-showcase / features / demo paths visible.
- Marketplace discovery nav avoided on public pages.

## Caveats

- Playwright browser unavailable; HTTP smoke is the verification method.
- No authentication or mutation performed.
- Production reflects up to commit b35032f (P08); P09 added docs/script only.
