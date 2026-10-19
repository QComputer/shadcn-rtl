# BB-ORG-DAMOON integrated acceptance

## Source and scope

Local branch: `codex/platform-combined-integration-20261015`.
Secure-onboarding parent: `a446ba239248689104af31649e7306f27ac6181f`.
Accepted Hotel source: `5cb10499efac86693d1177c7e19c79629720d893`, integrated as
`0eb6e28e6cd50f21341edf9c4cdbc1c49bfec319` with its original SHA in the commit trailer.
Only that presentation commit was picked; older Hotel branches were not merged again.
The component conflict preserves both platform `organizationSlug` requests and preloaded private/public presentation.
The subsequent integration commit containing this document is the candidate acceptance boundary.

Public paths: `/damoon-hotel` redirects to `/fa/damoon-hotel`, preserving query parameters;
`/fa/damoon-hotel`, `/en/damoon-hotel`, `/ar/damoon-hotel` render only current approved publication data.
The runtime code is generic; Damoon identifiers occur only in examples and synthetic tests.
CMS: `/{locale}/dashboard/hotel-website/{organizationId}/{propertyId}`.
Its existing private preview tab calls the existing authenticated revision-preview API.
Activation: `/{locale}/onboarding/organization-invitation`; sign out/in after redemption.
These are source/local acceptance paths, not a claim that Production is live.

## Executed acceptance (2026-10-15)

Final run: `.tmp/hotel-secure-onboarding-4b5b4f339aac/`.
`result.json`: **PASSED**, `exitCode=0`, `cleanup=PASSED`.
`browser-result.json`: **PASSED**, `exitCode=0`, `LOCAL_PRODUCTION_SERVER`, `SYNTHETIC_FIXTURES_ONLY`.

- PostgreSQL 17, task database `hotel_onboarding_4b5b4f339aac`, role `hotel_onboarding_test`, public schema.
- Docker container `cf3d7576a3c4c450fa24890f34af2fbbbe6d7363ab37f3c33a807eda4cc9b6aa`; volume `hotel-secure-onboarding-4b5b4f339aac`; loopback port 52759.
- Independent Docker/host READ ONLY probes agreed before migration: empty public schema and absent ledger.
- **103/103 migrations** applied; each successful ledger checksum matched its exact source SQL; no unsuccessful ledger entries.
- **14/14 PostgreSQL tests**, including concurrent bootstrap/redemption with observed lock barriers, tenant-scoped membership, identity rejection, immutable invitation bindings, and forced audit rollback.
- **10/10 authenticated Chromium scenarios** against `next start` on task port 65269: real credential login, form activation/relogin, both roles entering CMS, independent foreign-tenant rejection, Manager UI creation of a localized draft and media association, private rendered preview, Manager UI submission, independent Admin UI approval/publication, exact public revision in fa/en/ar, media bytes/MIME/browser decode, self-approval denial, publication preservation, media eligibility changes, revocation and capability disabling.
- Public fa used a 390x844 mobile viewport; en/ar used 1280x850 desktop. Document language/direction, localized title/description, canonical platform origin, noindex and private/no-store response behavior were asserted.
- **15/15 component-browser cases**: `.tmp/damoon-integration-component-browser-final.log`; synthetic browser-only fixtures cover focus/keyboard/calendar/gallery/locale behavior and known-synthetic public presentation rejection. They are separate from the real API-backed browser run.
- **85/85 focused source/route/CMS regressions**: `.tmp/damoon-integration-regressions.log`, no skips.
- Full `pnpm typecheck`: exit 0, `.tmp/damoon-integrated-final-typecheck.log`.
- Prisma validation: exit 0, `.tmp/damoon-integration-prisma.log`. No schema or migration change was needed in this integration; the existing independently generated candidate client was reused.
- Full production webpack build: exit 0, `.tmp/damoon-integrated-accepted-build.log`; 311 static routes generated. Its TypeScript phase also passed.
- Targeted ESLint: exit 0; two existing unescaped-quote warnings in the unchanged lower portion of the shared organization page. Final harness checks: exit 0.
- `git diff --check`: passed. Build/cache/screenshots/logs are not source changes.

Container and volume were removed by exact identity/labels; PostgreSQL and application ports have no listener. The exact task-created synthetic upload was removed. Other resources were not removed.

The Chromium process maps the canonical hostname only to loopback and blocks external requests. Its narrowly scoped secure-origin flag enables native `crypto.randomUUID()` for this local HTTP origin. This is not real TLS, physical-device, deployed staging or Production acceptance; no insecure fallback was added to application code. The media fixture is a CRC-valid synthetic 1x1 PNG, not Hotel photography.

## Demonstrated defects and harness corrections

1. The accepted presentation adapter allowed missing required public translations and `/uploads/..`; it now returns a missing-translation state or rejects unsafe preview paths/URLs.
2. Empty optional localized objects (for example an editorial heading) now become null in both public and private adapters, without inventing copy or hiding an otherwise valid page.
3. The denied CMS workspace needed a segment-specific unavailable view so the shared error boundary did not display a generic error screen. HTML may already be streamed with status 200; the browser asserts the unavailable view/no controls/noindex and the private API remains 403.
4. Metadata formerly indexed every published revision. It now uses the same request-local publication snapshot as rendering and defaults to noindex: existing editorial approval does not establish owner-approved provenance or indexing consent.
5. Failed runs are retained at `7f70a655e37f`, `2d130772a26f`, and `8f51dffb90c4` (same `.tmp/hotel-secure-onboarding-` prefix); cleanup passed for each. They identified denied-view behavior, the HTTP secure-context harness defect, and an empty description-tag assertion (Next omits an empty tag). Assertions still reject leaked draft/old metadata. No authorization check was relaxed.

Media authorization is checked on every new association request against tenant, property, current approved publication, room approval and current Image eligibility. Already downloaded public bytes cannot be recalled. CMS preview never falls back to public/synthetic content; failed revalidation clears its prior preview. No rooms, policies, occupancy or prices are fabricated. The test fixture has no room categories and no genuine owner-approved Hotel content.

## Exact integration change manifest

- `app/[locale]/[slug]/page.tsx`
- `app/[locale]/dashboard/hotel-website/[organizationId]/[propertyId]/page.tsx`
- `app/[locale]/dashboard/hotel-website/layout.tsx`
- `app/[locale]/dashboard/hotel-website/not-found.tsx`
- `components/hotel-cms/hotel-cms-workspace.tsx`
- `components/published-hotel-website-page.tsx`
- `docs/hotel/HOTEL-ORGANIZATION-SITE-INTEGRATION.md`
- `docs/hotel/HOTEL-P14-ONBOARDING-ADAPTER-BOUNDARY.md`
- `docs/hotel/HOTEL-INTEGRATED-ONBOARDING-ACCEPTANCE.md`
- `lib/hotel-cms/hotel-cms-dashboard-context.server.ts`
- `lib/hotel/content/hotel-website-public.service.ts`
- `lib/hotel/organization-site-presentation.ts`
- `lib/hotel/organization-site-public.server.ts`
- `lib/hotel/website-metadata.ts`
- `scripts/ops/verify-hotel-onboarding-local.mjs`
- `tests/fixtures/published-hotel-website.browser.tsx`
- `tests/organization-onboarding.browser.ts`
- `tests/published-hotel-website.browser.mjs`
- `tests/unit/hotel-website-metadata.test.ts`
- `tests/unit/hotel-website-public.service.test.ts`
- `tests/unit/hotel/organization-site-presentation.test.ts`

## Production preflight and minimum release boundary

**One operational access blocker:** no approved restricted Production read-only path is established. Do not substitute `neondb_owner`. No Production rows were inspected. Real Damoon organization, usernames, IDs, invitee verification, property and publication remain UNVERIFIED.

An authorized least-privilege preflight must inspect only the exact intended organization slug `damoon-hotel`, proposed `damoon-admin`/`damoon-manager` identity conflicts, active/deleted and verified-email state (no password or verification token selection), existing scoped memberships, Hotel website/booking capabilities, property and current publication. Confirm the previously attested runtime endpoint/branch against the actual read target before queries; use READ ONLY. Verify approved invitee identities and secure delivery authority separately. Never adopt an existing account or slug by overwriting it.

Deployment preflight must capture the actual serving immutable deployment and compatible source/rollback reference. Check existing F5/C1A/C1B1 tables and the bound-invitation migration `20261015160000_bound_organization_invitations`, including SQL-only constraints/triggers. The reported Production checksum discrepancies, failed/rolled-back rows, ordering inversions and Production-only branding migration remain unresolved. Fresh 103-migration acceptance does not resolve them. Do not edit historical SQL/ledger or run migrate-resolve to conceal them.

Prepare only the reviewed compatible dependency closure: existing F5 public/management services and models, secure onboarding/bound invitations, and this presentation/metadata integration. Do not automatically release unrelated Retail/Hotel changes from the combined branch. No new migration is introduced here, but Production schema compatibility must be proven before rollout. Obtain separate approval for any Production migration, deployment, tenant bootstrap/invitation delivery, and public operational-gate activation. Keep booking, holds, payments and notifications disabled. Public content needs a separate independent editorial approval/publication and actual owner-approved media/translations. Indexing remains disabled until an explicit persisted provenance/consent contract exists.

Rollback preparation: retain the last healthy immutable deployment, roll application code back to that exact artifact if authorized, and close the website operational gate if necessary. Preserve organizations, revisions, publications and audits; do not delete tenant data or roll back migration history. Revoke only unused invitations through the supported workflow if authorized; membership deactivation needs its own scoped approval. Post-release acceptance must repeat actual login/activation/CMS/public routes/media/noindex/tenant-denial checks on the approved deployment. No Production release is asserted by this document.

P14 integration is a contract only: see `HOTEL-P14-ONBOARDING-ADAPTER-BOUNDARY.md`. P13 approval/readiness is preserved; transactional execution primitives and an immutable approved-plan receipt are future work, not a second permanent provisioning system.

Safety: Production mutations NO; Production deployment NO; remote push NO; live provider calls 0. Dirty main and Hotel/Retail worktrees were not changed. Local fixture success is not real Damoon activation or owner acceptance.
