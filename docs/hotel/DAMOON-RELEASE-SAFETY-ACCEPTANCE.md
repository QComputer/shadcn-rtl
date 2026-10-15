# Damoon release safety acceptance

Milestone: `BB-PLATFORM-RELEASE-SAFETY-01`. Security source commit: `6ea1398581a7f5c35bebe427a941be35631af43c`, parent `f247456a6a1de6be66f41ea6b24c6f33c771d670`, branch `codex/platform-combined-integration-20261015`.

## Confirmed defects and resulting boundaries

- Bare User ORM responses could include password/authentication fields. `publicUserSelect` and `toPublicUserDto` now independently allowlist fields; organization-managed profiles, nested member services/hours and user lists remain scoped to the authorized organization. Current-tenant self profiles no longer return foreign memberships. Own membership discovery remains available through the authenticated dedicated endpoint.
- Legacy organization methods wrote global `User.role` during scoped membership changes. They now preserve global authority and other memberships. Active global authority is reread from persisted User state, not accepted from a stale JWT claim.
- Legacy member and user activation paths had inconsistent ADMIN protection. They now share `OrganizationMembershipService`, persisted authorization, exact tenant/target checks, organization row locking, Serializable transactions and bounded retry. MANAGER cannot grant, demote or deactivate ADMIN; self-membership changes fail closed; at least one effective active ADMIN must remain. Global disable/delete cannot bypass active ADMIN membership protection; deletion uses guarded soft deletion and retains identity/history.
- Existing inactive or newly promoted Hotel privileged membership cannot be activated through legacy member endpoints; identity-bound invitation activation remains mandatory. Organization bootstrap/activation still leaves global roles CUSTOMER.
- Capability replacement now requires persisted platform SUPER_ADMIN plus same-origin protection. Tenant ADMIN/MANAGER retain authorized reads and existing feature settings, but cannot grant/deactivate platform capabilities through this endpoint. No capability was activated for an existing tenant.
- Membership selection is ordered by joinedAt then ID. An explicit stale/foreign tenant context is rejected, not silently retargeted. A global CUSTOMER with active scoped ADMIN/MANAGER remains authorized for the existing CMS and organization membership interfaces.
- Membership/global-account updates and durable audit insertion share the same transaction. Existing last-ADMIN, same-origin, tenant and identity checks are applied before writes. Mutation responses never serialize raw User records.

## Executed validation

All entries below were executed against the reviewed source; no Production database or providers were used.

| Gate | Result | Local evidence |
| --- | --- | --- |
| Focused guard/DTO/route tests | 20/20 PASS | Included in the regression log below |
| Security + onboarding + Hotel management/public/metadata regressions | 56/56 PASS, no skips | `.tmp/release-safety-regressions.log` |
| Full TypeScript | PASS, exit 0 | `.tmp/release-safety-typecheck.log`; production build also performed TypeScript |
| Targeted ESLint | PASS, exit 0; zero errors/warnings | `.tmp/release-safety-lint.log` |
| Prisma validation | PASS, exit 0; existing client reused, no schema changes | `.tmp/release-safety-prisma.log` |
| Fresh Next.js production webpack build | PASS, exit 0; 311 static routes | `.tmp/release-safety-production-build.log` |
| PostgreSQL onboarding acceptance | 14/14 PASS | `postgres-tests.log` in the task evidence directory |
| New PostgreSQL release-safety acceptance | 9/9 PASS, eight subcases plus parent | `release-safety-tests.log` in the task evidence directory |
| Authenticated Chromium against that production build | 11/11 scenarios PASS | `browser-result.json` and screenshots in the task evidence directory |
| Import/syntax/whitespace | TypeScript, `node --check` on runner, `git diff --check` PASS | Source and validation logs |

The first offline combined regression invocation lacked its inert DATABASE_URL and failed during module initialization, before any database connection. It was rerun with explicit process-local loopback port 1 configuration; all 56 tests passed. This was test environment setup, not a suppressed application failure. The build likewise used explicit inert loopback connection settings and did not connect to Production.

Task evidence directory: `.tmp/hotel-secure-onboarding-de7b28bb5935/`. Its durable `result.json` has `status=PASSED`, `exitCode=0`, `cleanup=PASSED`. Browser results have `environment=LOCAL_PRODUCTION_SERVER`, `provenance=SYNTHETIC_FIXTURES_ONLY`, `status=PASSED`, `exitCode=0`. These are local production-mode results, not Vercel staging, physical-device or real Damoon activation acceptance. Logs/screenshots are retained locally and excluded from source commits.

## Disposable database and concurrency proof

The existing guarded runner used one task-owned PostgreSQL 17 container `7516f1b097a4b2c0bbc3ee6732f4fb852fe5831b298d0f70947ae31442fab85d`, matching task/run labels, volume `hotel-secure-onboarding-de7b28bb5935`, database `hotel_onboarding_de7b28bb5935`, dedicated synthetic role `hotel_onboarding_test` and loopback port 52991. Independent Docker/host READ ONLY probes agreed on target/schema/major version and proved an empty public schema and absent migration ledger before deployment.

103/103 migrations finished successfully, with each ledger checksum matching its source file. The sorted `migration-name<TAB>SHA256<LF>` manifest hash is `0723d2c6ac5e42a79d7b2631a84adba0fe7967d655c11f5bb6172b0ae7a58231`. Final migration is `20261015160000_bound_organization_invitations`, SQL SHA-256 `a24f520b4ffcd177292f110dda46cd446b76a70cea114383ccda3cd3e026abb0`. No Prisma schema or migration file changed in this milestone.

The security suite used independent Prisma connections and held an organization row lock until PostgreSQL reported two waiting lock-dependent writers in `pg_stat_activity`. Exactly one concurrent ADMIN removal succeeded; the other failed and one active ADMIN remained. It also verified manager/foreign-tenant denials, preserved global CUSTOMER and foreign memberships, alternate user/service last-ADMIN guards, bound-invite-only Hotel activation, and forced membership/global-user audit failures with complete rollback and no orphan membership/audit rows.

The browser ran real credentials and synthetic verified identities: SUPER_ADMIN bootstrap, two independent invitation activations, global CUSTOMER scoped ADMIN/MANAGER logins, CMS navigation, legacy endpoint escalation denials, manager draft/media editing, private preview, independent approval/publication, exact published fa/en/ar content, media invalidation, foreign-tenant denial, revocation, disabled capability and no booking/payment/hold/reservation mutations. External browser origins were blocked by the harness. The HTTP loopback secure-context flag was confined to this task's mapped test origin; no Production transport/auth policy changed.

Cleanup verified exact container/volume removal and closed assigned port. No broad cleanup, existing database or other worktree modification occurred.

## Release disposition

Confirmed source security findings are closed by executable local evidence. Operational requirements are detailed in `DAMOON-RELEASE-SAFETY-OPERATIONS.md`: restricted Production views/identity, current schema/ledger reconciliation, immutable release provenance, approved protected preview artifact, verified real invitee identities and separately authorized provisioning, delivery and publication.

Production state remains UNVERIFIED. Historical 27 checksum divergences, four rolled-back attempts, three reported ordering inversions with missing detail, and the Production-only branding migration remain separate blockers; fresh 103-migration acceptance does not resolve them. No P14 execution Wizard was implemented. The accepted standalone Hotel bootstrap remains available locally without claiming future P14 transactional integration is complete.

Safety: `PRODUCTION_MUTATIONS=NO`, `PRODUCTION_DEPLOYMENT=NO`, `REMOTE_PUSH=NO`, `LIVE_PROVIDER_CALLS=0`. The dirty main checkout and active Hotel/Retail worktrees and inherited artifacts were preserved.
