# Retail worktree preservation and retirement handoff

Initial inventory snapshot recorded 2026-10-15 from `git worktree list --porcelain`, local Git refs/status, selected evidence-file presence, and nonrecursive Windows item metadata. This is an inventory for eventual Retail/Aka Shoes worktree retirement, not authorization to retire anything or an acceptance report. Registered paths and historical evidence remain protected until their owners confirm disposition.

## Registered Retail and Aka Shoes worktrees

| Worktree | Branch / HEAD | Git status | Selected evidence and generated directories |
|---|---|---|---|
| `C:\Users\disso\.codex\worktrees\aka-shoes-branded-pwa\shadcn-rtl` | `feat/aka-shoes-branded-pwa` / `9824f2e2678bccdda99b99902e8ba4410f6653b8` | clean (0 tracked changes, 0 untracked) | `.next` and `node_modules` present as directories; no link target reported |
| `C:\Users\disso\.codex\worktrees\bb-pwa-r6-platform-integration-20261015\shadcn-rtl` | `codex/bb-pwa-r6-platform-integration-20261015` / `54fe7bc9d07e3c2ceb6fd6f6a6bd78755e17e324` | clean | R6 handoff and integration docs present; `.next` and `node_modules` absent |
| `C:\Users\disso\.codex\worktrees\platform-combined-integration-20261015\shadcn-rtl` | `codex/platform-combined-integration-20261015` / `117d24d35584b5d80fd775938f30a53b6952dd99` | R6 staged (22 paths; 645 insertions, 54 deletions); 0 tracked unstaged; 18 untracked historical artifact files | P14 is committed at HEAD; R6 integration remains uncommitted. The 18 artifacts are under `artifacts/branding-audit/live/`, `artifacts/hotel-f2-1/`, and `artifacts/hotel-f2/`; preserve all. `.next`/`node_modules` were not traversed for this inventory; their sizes are unknown. Principal testing is pending. |
| `C:\Users\disso\.codex\worktrees\retail-aka-rehearsal-20261015\shadcn-rtl` | `codex/retail-r6-tenant-pwa-20261015` / `d1680a1d57e4b12180d7d09c28a8c5038e49675d` | clean | R6 source handoff present; `.next` and `node_modules` absent |
| `C:\Users\disso\.codex\worktrees\retail-h2-aka-shoes-20261014\shadcn-rtl` | `codex/retail-h2-aka-shoes-20261014` / `24e655eb375934edb960ccba8b84f9223795a238` | clean | `.next` absent; `node_modules` present as directory, no link target reported |
| `C:\Users\disso\.codex\worktrees\retail-h2-r5-integration-20261014\shadcn-rtl` | `codex/retail-h2-r5-integration-20261014` / `c1eedb82503629356397106d8b6e2ec5b63b9cd3` | 4 tracked modifications and 1 untracked `.neon` | Preserve local changes and `.neon`; do not inspect or expose its contents. `.next` and `node_modules` absent |
| `C:\Users\disso\.codex\worktrees\retail-h2-taxonomy-20261014\shadcn-rtl` | `codex/retail-h2-taxonomy-20261014` / `6a5c4caedbcc7271b6be28e4834328e7c665c7c9` | clean | `.next` and `node_modules` absent |
| `C:\Users\disso\.codex\worktrees\retail-r0-dashboard-rtl-20261013\shadcn-rtl` | `codex/retail-r0-dashboard-rtl-20261013` / `6f27b0e4c163d47b73faed033bf63aaa321574f5` | clean | `.next` and `node_modules` absent |
| `C:\Users\disso\.codex\worktrees\retail-r0-r1-20261013\shadcn-rtl` | `codex/retail-r0-r1-foundation-20261013` / `fd0574be1beec6429a78b2c7f52b3664398ef4a6` | clean | `.next` and `node_modules` present as directories; no link target reported |
| `C:\Users\disso\.codex\worktrees\retail-r2-20261013\shadcn-rtl` | `codex/retail-r2-catalog-20261013` / `5a5bc6e2fa452c97534c7fa671c8cf936389b9a2` | clean | `.next` and `node_modules` present as directories; no link target reported |
| `C:\Users\disso\.codex\worktrees\retail-r2-dashboard-rtl-20261013\shadcn-rtl` | `codex/retail-r2-dashboard-rtl-20261013` / `2bc5893ec148ac349630a886ff3262b2bd43bda7` | clean | `.next` and `node_modules` absent |
| `C:\Users\disso\.codex\worktrees\retail-r3-20261013\shadcn-rtl` | `codex/retail-r3-merchant-flow-20261013` / `c283e461af2cbb7e05f9e1b9efcd839762a0eaec` | 0 tracked modifications; 151 untracked files | `docs/retail/RETAIL-R3-ACCEPTANCE.md` is present. It records PostgreSQL 17.10 seed/verify evidence. The 151 figure is the untracked-file count, not a test count. `.next` and `node_modules` present as directories; no link target reported. Preserve all untracked evidence/source. |
| `C:\Users\disso\.codex\worktrees\retail-r4-checkout-20261013\shadcn-rtl` | `codex/retail-r4-checkout-20261013` / `a51e8ddd18fe1b82d828d59fe078a182a34f23f0` | clean | `.next` and `node_modules` absent |
| `C:\Users\disso\.codex\worktrees\retail-r4a-promotions-payments-20261014\shadcn-rtl` | `codex/retail-r4a-promotions-payments-20261014` / `30282527a743039bd0bd13d26045f1b82efa6c74` | clean | `.next` absent; `node_modules` present as directory, no link target reported |
| `C:\Users\disso\.codex\worktrees\retail-r5-ussd-routing\shadcn-rtl` | `codex/retail-r5-platform-ussd-routing-20261014` / `81a1a89a79e33edc02dc45b1a416068941b6a11e` | clean | `.next` and `node_modules` absent |
| `C:\Users\disso\.codex\worktrees\tenant-pwa-branding-fix-20261013\shadcn-rtl` | `codex/tenant-pwa-branding-fix-20261013` / `b979b82a71a77b9e12188414ed5be61be7389b17` | clean | `.next` absent; `node_modules` present as directory, no link target reported |
| `C:\Users\disso\Project\aka-shoes-inventory-baseline` | detached / `a4bb751c68a10ff125652e74dfb60441c846c80d` | clean | `.next` absent; `node_modules` present as directory, no link target reported |
| `C:\Users\disso\Project\aka-shoes-inventory-sync` | `codex/aka-shoes-inventory-sync` / `bd82cf82e029d1179a093c8875dc106d05291434` | clean | `.next` and `node_modules` present as directories; no link target reported |
| `C:\Users\disso\Project\aka-shoes-visibility-hotfix` | `codex/aka-shoes-visibility-hotfix` / `ddd414184caadf479e357c5a7e19238592c08b40` | 4 tracked modifications; 0 untracked | `.next` and `node_modules` present as directories; no link target reported |
| `C:\Users\disso\Project\aka-shoes-visibility-hotfix-prod` | `codex/aka-shoes-visibility-hotfix-prod` / `a4bb751c68a10ff125652e74dfb60441c846c80d` | clean | `.next` and `node_modules` present as directories; no link target reported |

For `.next` and `node_modules`, presence/absence was checked without traversing directory contents. Where present, Windows `Get-Item` reported `Directory` with no `LinkType` or `Target`; this check does not certify target size. No recursive disk-size measurement was performed. The separate registered `C:\Users\disso\Project\shadcn-rtl` main checkout has HEAD `ddd414184caadf479e357c5a7e19238592c08b40` and 378 default-porcelain dirty paths, reverified 2026-10-16. Its dirty content must not be equated with the visibility-hotfix worktree. Preserve it unchanged.

## Initial R6 provenance and acceptance status

The R6 source handoff is [PLATFORM_PWA_HANDOFF_R6.md](PLATFORM_PWA_HANDOFF_R6.md), and the integration record is [RETAIL-R6-PLATFORM-INTEGRATION.md](RETAIL-R6-PLATFORM-INTEGRATION.md). Source commit `d1680a1` remains independently recoverable in its registered worktree. Integration branch `54fe7bc` preserves the R6 cherry-pick (`21ee601`), tenant-branded integration (`76aea2c`), and branding fallback (`54fe7bc`). The combined candidate has the integration staged on P14 commit `117d24d`; the patch has not been committed. These local checks do not establish remote push status.

The R6 notes record focused test and lint results, while listing full typecheck/build, PostgreSQL browser E2E with screenshots, and genuine browser/OS installation as incomplete. Combined-candidate principal testing is pending. Do not mark R6 or overall Retail retirement accepted based on the earlier focused evidence.

## Preservation and retirement gates

- Do not remove, archive, prune, reset, clean, or repurpose any registered Retail/Aka Shoes worktree or branch based on this inventory. The dirty H2-R5 and visibility-hotfix checkouts, all 151 R3 untracked files, the combined candidate's 18 historical artifacts, and the `.neon` file need explicit owner disposition and retention before any retirement action.
- Preserve the R6 source, integration branch, staged combined patch, historical acceptance evidence, and generated artifacts until principal testing and Platform ownership acceptance are recorded.
- Complete the outstanding R6 checks recorded in the integration handoff, including full typecheck/build, guarded database-backed browser evidence, tenant-branding/isolation/offline/reconnect coverage, and genuine installation checks where supported.
- Inventory evidence and test counts must remain separate: the verified `151` is R3 untracked-file count only. No claim that 151 tests passed is supported by this inventory.
- Before final retirement, identify each worktree's owner, confirm its unique source/evidence has been preserved elsewhere, resolve dirty and untracked content explicitly, and record owner acceptance for the applicable milestone. This document does not authorize deletion.

No worktree was modified by this inventory. No files were deleted, no directory contents were traversed for size measurement, and no database, deployment, provider, DNS, remote Git, or cleanup operation was performed.

## Final Platform transfer update — 2026-10-16

This section supersedes pending acceptance statements and candidate status in the initial inventory above. It does not replace or discard that historical snapshot.

- Reviewed local merge: `a370d6588f26efdf318578f16b0006b8a2581aaf`, parents P14 `117d24d35584b5d80fd775938f30a53b6952dd99` and R6 `54fe7bc9d07e3c2ceb6fd6f6a6bd78755e17e324`.
- The original R6 `d1680a1d57e4b12180d7d09c28a8c5038e49675d` and cherry-pick `21ee601e094520463dd7fe873d8a9965c47334de` have stable patch ID `c6e39375d8023a09b3ccdd2e1df174f79142f92c`.
- Original source-only documentation commits `0da4c583f1bd046774d50ae6e5dfa24eae7c7b00`, `b4b5f9ff046de4dd40a7d6a141cdf92dc3d20425` and `10d626524e1acff076c621eeda378fe4e6f582e1` remain preserved on the Retail source history. Do not remove branches until any unique content has explicit retained disposition.
- Final guarded run `8bf53267b400`: exit 0, status PASSED, cleanup PASSED, 104 migrations/checksums, 23 proxy checks, authenticated account/browser acceptance and two genuine standalone Chrome installations with deep links and offline/reconnect. Full TypeScript/build and 66 focused offline/Hotel tests passed. See the final acceptance report for exact scope and device limitations.
- Platform owns the integrated Retail catalog/PWA source and tests. No further Retail agent implementation is required for the accepted source. Production merchant data mapping/media, migration-history reconciliation, real tenant configuration and physical-device acceptance transfer as documented backlog; they remain release blockers where applicable, not a reason to lose engineering ownership.
- Immediate generated-artifact recovery from the clean R6 source and R6 integration worktrees is **0 measured bytes**: neither contains `.next` or `node_modules`. Sizes and safe disposition of older build/dependency trees are not established by this nonrecursive inventory. Do not quote logical historical estimates as reclaimed physical space.
- All 20 inventoried worktrees, dirty changes, 151 R3 untracked files, `.neon`, and 18 inherited combined-candidate artifacts remain protected. No retirement deletion occurred. Remote reachability/publication is not established by these local checks; no push is authorized here.
- Before a separate cleanup: confirm accepted Platform transfer, retain each unique commit/document/evidence item, resolve owner disposition of dirty/untracked files, check active processes and junctions, then authorize exact generated-artifact paths. Do not remove the Retail worktree or branch as part of this acceptance milestone.

Final engineering acceptance and evidence are in [RETAIL-R6-FINAL-ACCEPTANCE.md](RETAIL-R6-FINAL-ACCEPTANCE.md). Remaining physical-device/native path-install gates are explicitly pending; cleanup/retirement execution remains a separate controlled step.

## Final installation verification update — 2026-10-16

Run `49e0575cdeed` supersedes the prior NOT_TESTED status for same-origin path installation: two synthetic tenant PWAs were genuinely installed simultaneously by Windows Chrome 155 from distinct application paths on one origin, launched standalone, used distinct manifest IDs/scopes and icon sets, reached their own account deep links, and passed offline/reconnect. The same run verified a synthetic authenticated customer session across both tenant paths. Full evidence and limitations are recorded in `RETAIL-R6-FINAL-ACCEPTANCE.md` and `.tmp/hotel-secure-onboarding-49e0575cdeed/`.

Android physical installation remains blocked by the absence of an attached Android device/ADB on the test host. Production tenant records and Production migration history remain unverified. Therefore the R6 source and desktop installation acceptance are transferred to Platform, but the overall milestone remains `BB_PWA_R6_CODE_ACCEPTED_INSTALL_VERIFICATION_PENDING`; do not report retirement-ready and do not remove Retail branches, worktrees, or artifacts. The 18 inherited untracked candidate artifacts were re-counted and remain present. A separate owner-approved retirement/cleanup action is still required after Android/device disposition and source/evidence retention review.
