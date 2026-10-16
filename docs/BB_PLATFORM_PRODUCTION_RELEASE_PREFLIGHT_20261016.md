# Bazarbaaz Production release preflight — 2026-10-16

Status: **HOLD — no Production migration or customer-domain promotion**.

## Immutable source and staged build

- Accepted application baseline: `2dd7707d84efbbd0494eccade9dbd908cc9a8d00`.
- Packaging-only commit: `8f7c7019135b38fd99ec1e5780e5614713cc9f64` excludes internal evidence, docs, the tracked dump and local secrets from Vercel source upload.
- Clean Git archive SHA-256: `DE168AC4EE723928DE6AC42D6C81F442E90951B0A582156562F497918BD8A209`.
- Vercel Production-environment staging deployment with `--skip-domain`: `dpl_EBM1bd5kombYN6ReoYRXsujS3RUF`, READY, build/TypeScript successful. Immutable URL: `https://shadcn-1a1nxnijf-ahmads-projects-1b4ce1dc.vercel.app`.
- The deployment moved the project-generated `shadcn-rtl-ahmads-projects-1b4ce1dc.vercel.app` alias despite `--skip-domain`; it was reassigned to the previous deployment and verified. Customer domains remained on `dpl_7hwJXyte1mLxQ7P7qa7AKorx4nuK` throughout.
- Unauthenticated staging `/api/health` redirects to Vercel SSO. Authenticated `vercel curl` returned HTTP 200 for `/api/health` and `?deep=1`; the deep check reported database connectivity. Neither result identifies the database endpoint.

## Release blockers

1. **Current deployment binding:** The Vercel Production `DATABASE_URL` and `DIRECT_URL` records are Sensitive. Their metadata is visible but no deployment-specific runtime identity is exposed by the inspected deployment record or health route. An earlier runtime attestation and verified Neon metadata are not proof of this staged deployment's resolved connection. A guarded read-only runtime identity check is required before migration or promotion.
2. **Production-source compatibility:** The serving source `0a48cd189ea5ba3a3c5dbb67831a5ba8e8430c15` and candidate are sibling histories (merge base `ddd414184caadf479e357c5a7e19238592c08b40`). Candidate lacks the serving organization-branding form and homepage selection controls and changes legacy zero-stock menu behavior. These require semantic integration and focused regressions before customer promotion.
3. **Old-writer overlap:** Pending `20261014100000_retail_r5_inoti_merchant_routing` makes `UssdPaymentIntent.merchantAccountKey` and `merchantCodeName` non-null and adds binding constraints/triggers. The serving source's `UssdPaymentIntent` model has no `merchantAccountKey`. Applying the chain while old payment-intent writes continue can fail. A verified write freeze or compatible bridge deployment is required for migration/cutover.
4. **Backup timing:** A Neon snapshot create attempt returned `snapshots limit exceeded`. A no-compute, parent-derived recovery branch `br-muddy-wind-ai3qmhsg` was created at 2026-10-16 12:52:01 UTC from parent `br-small-queen-aii58cw9`, parent LSN `0/868A0A78`, expiring 2026-10-23 12:51:00 UTC. Its metadata is accessible. It is a preflight restore point, not a substitute for a fresh, verified restore point immediately before migration. Restoring it would lose writes after its creation time.

## Source preservation

- Complete accepted-history Git bundle: `C:\Users\disso\.codex\evidence\bb-platform-release\platform-accepted-2dd7707.bundle`, SHA-256 `7A9C0C00A238C2F5A6C7E68B897D66B6EF2148183C2D141CF380D7460282C157`.
- Complete packaging-head bundle: `C:\Users\disso\.codex\evidence\bb-platform-release\platform-release-8f7c701.bundle`, SHA-256 `B3EC90C370B1F3451AEA714591AB17EE4BFCC3377EAA6945212D36F27C7BFA85`.
- Both bundles passed `git bundle verify`. No Git push was attempted because tracked dump and commercial evidence require a reviewed publication destination/scope. The bundles are on the same local C: volume and should be copied to independent secure storage before a release.

## Safe continuation

Reconcile serving-source UI/shop contracts into the candidate; run targeted tests and restage the resulting immutable source. Add or invoke a temporary guarded, read-only identity check on that exact staged Production-environment deployment. Verify a fresh recoverable database point and an operational write freeze/bridge. Reconfirm the parent's ledger and target, then apply the 19 pending migrations once and promote only after post-migration checks pass. Preserve the previous deployment for application rollback; do not equate application rollback with database restoration.

No Production migration, business-data write, payment/provider call, or customer-domain promotion occurred in this preflight.
