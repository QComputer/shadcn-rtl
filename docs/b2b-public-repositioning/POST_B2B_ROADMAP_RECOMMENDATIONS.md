# Post-B2B Roadmap Recommendations

Generated: 2026-07-06
Context: Bazar Baz B2B public repositioning completed through BB-B2B-P09.

## Status

The public B2B repositioning is complete and deployed:
- Homepage, demo, features, dashboard-showcase, request-demo, pricing, contact, trust, privacy, terms are live.
- Marketplace discovery is restricted; tenant direct pages preserved.
- All B2B validators (P01–P08) pass; deployed HTTP smoke passes.

## Recommended next phases (do NOT start Creative Studio unless explicitly requested)

### A. B2B-P10 — Request-demo Lead Storage and Admin Review
The current `/request-demo` form is UI-only preview. Recommended:
- Add a `Lead` model with migration.
- Add a safe, rate-limited API.
- Add an admin review dashboard.
- Keep no SMS on submission; require consent.

### B. B2B-P11 — Tenant Custom-Domain Onboarding Flow
Build the self-service flow for businesses to request/configure custom domains, reusing existing custom-domain infrastructure.

### C. B2B-P12 — Business Onboarding Wizard
Guided setup: business profile, products/services, staff, branding, first campaign.

### D. B2B-P13 — Production Demo Tenant Creation
Gated dry-run-to-write flow to create controlled demo tenants from the existing registry, without auto-writing production data.

### E. B2B-P14 — Resolve Legacy Validator Backlog
Address the 25 known legacy validators classified as unrelated to the B2B roadmap (outside B2B scope).

### F. B2B-P15 — Deployed Browser Smoke
Introduce Edge/local browser workaround for Playwright to enable richer deployed E2E where the CDN-restricted browser download is unavailable.

## Explicitly out of scope for now

- Creative Studio apply/rollback (paused unless user asks).
- Real SMS sending.
- New AI generation workflows.
- Full pricing/billing engine.
- Rebuilding checkout/order/booking internals.
