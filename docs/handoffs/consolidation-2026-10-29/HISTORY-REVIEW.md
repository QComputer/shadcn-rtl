# Historical worktree disposition review

Date: 2026-10-29. Read-only comparison base: `origin/main` = `4f0eb5d2a7ff65f977d2645682993cd0c7abc0a5`. Input inventory: `C:\Users\disso\.codex\private-preservation\bazarbaaz-single-main-20261029\inventory.json`. Prior review: `C:\Users\disso\Documents\Codex\2026-10-27\bazarbaaz-worktree-audit\REPORT.fa.md` and the four subject reports beside it.

## Decision summary

- Do not merge old branches wholesale. Against the refreshed base, 23 unique existing worktree HEADs are non-ancestors. Their commits cover superseded implementations, equivalent/squashed work, separate deferred decisions, operational/diagnostic material, and two narrow follow-up candidates. The non-ancestor count is not a count of missing features.
- **H4.1** (`a1ae4dd8ffdfba162a98374bf793aec39d9bc29f`) remains optional, advisory-only Hotel source. Preserve its branch/worktree and history as reviewable archival material; do not integrate into product main unless the Hotel product owner elects to expose the feature and supplies/approves the governing occupancy policies. H4 foundation (`86385fe95326f3ded712a34f77b46d8026f2f3f7`) is represented in main; the missing composition file is the optional delta. The source is one domain module plus its unit test, and its own handoff (`edd5e77`) records the boundary. This is not a website, F5, or consolidation prerequisite.
- **Generic product inventory tracking** (`bd82cf82e029d1179a093c8875dc106d05291434`) is a real, narrow source gap at refreshed `origin/main`. The generic edit form has a `trackInventory` toggle/state but does not hydrate it from the loaded product or serialize it in PATCH; the generic create form does not expose or serialize the setting. The dedicated Retail editor already does all of these. Recommend a minimal transplant of only the three form changes (edit hydration, edit payload, create control/default/payload) and the focused test from that commit, if `/dashboard/products` remains a supported editor. Do not merge the inventory-sync branch wholesale. This finding is source-level only; no tests were rerun and no claim is made about a live defect.
- The dirty primary checkout remains untouched. No Git refs, repository files, database/provider state, deployments, or worktrees were changed.

## Evidence and scope

The supplied inventory reports primary HEAD `ddd414184caadf479e357c5a7e19238592c08b40`, with extensive tracked and untracked local changes. It was not used as the comparison base. The comparison used the refreshed `origin/main` ref above and the commit objects already present in the repository. Each existing inventory worktree HEAD was ancestry-checked; 23 unique HEADs were outside its ancestry (rather than the prior report's 24, reflecting mainline advancement). The associated commits, file summaries, and the two candidate source paths were inspected read-only. Prior conversation dispositions and validation history were taken from the supplied reports; historical test/deployment statements were not re-run or upgraded to current evidence.

At `origin/main`, `components/dashboard/retail-product-editor.tsx` loads `product.trackInventory`, maintains the setting, and sends it in create/update payloads. In the generic pages, `app/[locale]/dashboard/products/[id]/page.tsx` declares the setting and renders a switch, but the source has no `setTrackInventory(productData.trackInventory)` and the PATCH body omits `trackInventory`. `app/[locale]/dashboard/products/new/page.tsx` declares the model field type, but has no tracking state/control/payload. The old fix changes those two files and adds `tests/unit/product-inventory-tracking.test.ts`.

The H4.1 commit adds only `lib/hotel/domain/room-recommendation-composition.ts` and `tests/unit/hotel/room-recommendation-composition.test.ts`; it preserves commercial ranking and labels suggestions advisory. The code's documented assumptions and the Hotel review both leave real occupancy/child/extra-bed/multi-room/accessibility rules to approved business policy. The F2 public presentation and F5 work have later mainline implementations/acceptance per the prior Hotel report; remerging that branch would reintroduce accumulated unrelated history.

## Non-ancestor HEAD dispositions

| HEAD | Inventory worktree / distinctive commits | Disposition against `origin/main` |
|---|---|---|
| `0a48cd189ea5` | production-source-recovery; temporary DB-attestation lifecycle (`03841eb`, `ce3ef6b`, `abda328`, `3c0d388`, `0a48cd`) | Historical recovery/diagnostic work; temporary attestation is removed within the branch. Preserve as audit history; no product integration. No provider/DB access. |
| `19df088098cd` | restaurant13-canonical-identity | Deferred slug/identity migration, a separate product/data decision. Not required by current site behavior per prior review; do not migrate automatically. |
| `24e655eb3759` | retail H2 merchant catalog | Superseded by later Retail editor, service and public catalog; do not re-add the early subsystem. |
| `2dda61701812` | Hotel F2D presentation | Superseded by integrated public site presentation; no wholesale merge. |
| `30282527a743` | Retail R4A checkout integration document | Documentation-only checkout contract; review for current applicability if a later payment cutover needs it. Not product source. |
| `31968783def2` | Kilo `bazar-baz` map/static-param workaround and smoke scripts | Historical workaround; current locale static params and later builds supersede the source workaround. Keep historical evidence; do not replace current files. |
| `47b210dcc841` | Hotel CMS v2 integration (`d371c43`) | Stale CMS integration line; later Hotel implementation is in mainline. No wholesale merge. |
| `543e818f63e5` | production release-integration freeze snapshot | Historical release-candidate/evidence commit, not a source delta to re-merge. |
| `5a7c4bee2a89` | payment bridge validation (`efb443b`, `e13c588`) | Potential operational reference for a future payment migration/cutover only. Preserve for that review; not evidence of current payment failure and not general product integration. |
| `5cb10499efac` | Hotel public integration; includes H4/H4.1 and F2 history | F2 is represented by later mainline source and acceptance. H4 foundation is represented; retain H4.1 optional source under this history/branch for a policy decision. Do not merge accumulated branch. |
| `6a1f8ad6bbe1` | Aka Shoes storefront worktree | Its landing/storefront work is superseded/equivalent to later approved mainline landing work; compare the exact landing diff only if future behavior is disputed. |
| `6f2cd37ce06a` | Damoon F2E contrast/mobile polish | Superseded by the later approved Damoon landing rebuild at `4f0eb5d`; no integration. |
| `8662455150a8` | combined Platform integration | Relevant settings/domain fixes are covered by newer mainline source; remaining inventory-local untracked material is outside this commit and must remain preserved separately. No wholesale merge. |
| `89ff16140c88` | Restaurant 13 integration (`553e203`, `8e3387b`, `89ff161`, plus historical scheduler `5a52140`) | Historically deployed according to its chat, but not a current runtime attestation. Branding/catalog work is an older integration line; scheduler is operational. Preserve for historical comparison and any separately authorized live-state review; do not fold in as a unit. |
| `91d557f78c6f` | organization-shell/domain merge | Shell and capability-aware routing are represented by later mainline work. Treat old branch as historical source, not missing implementation. |
| `93372d1cfb63` | CafeLeo CL-3 release fix (`f38c6c3`) | Base-path/framework plumbing has current mainline equivalents; external CafeLeo proxy/E2E closure remains unverified in the prior report. Preserve as separate CL-3 reference; don't infer live readiness or merge wholesale. |
| `9824f2e2678b` | Aka branding / configurable homepage | Branding and homepage behavior are represented by generic, later mainline implementation; no wholesale merge. |
| `9fc8c8a489dd` | temporary production DB attestation | Diagnostic-only branch with local tracked changes in inventory. Preserve intact for its original review context; no product integration or cleanup. |
| `a2a874b8df20` | CafeLeo CL-3A integration (`0938c8e`, `a2a874b`) | Mainline has generic trusted APP-path plumbing; CafeLeo-specific authenticated proxy/E2E was not proven by the previous report. Keep scoped as a separate review item, not a general product merge. |
| `a4bb751c68a1` | Aka inventory baseline / show tracked out-of-stock products | The old visibility behavior is covered by newer Retail source per prior review. No duplicate fix. |
| `b2ce5a9af416` | mainline consolidation / dependency and local lookup changes | Contains consolidation-era fixes and dependencies; prior review found the current source line covers relevant platform work. Recheck individual hunks only if a current regression points to one; no wholesale merge. |
| `bd82cf82e029` | Aka inventory-sync | **Retain as the minimal generic-form fix candidate described above.** This is the only source change identified here for possible narrow integration; branch source is recoverable. |
| `e5518a3c1295` | Hotel public read/API docs and gated APIs (`202cd88`, `32c08ea`, `e5518a3`) | Public Hotel API/presentation work is represented by later integrated Hotel implementation. Keep historical contract/acceptance evidence; no duplicate implementation. |

## Preservation note

This review grants no archive/delete authority. The branch refs for both `bd82cf8` and the Hotel integration line remain available in the supplied inventory/repository refs; preserve the complete Hotel branch/worktree as reviewable source until an archive plan explicitly records its commit/history and supporting evidence. If the primary consolidation chooses an archive operation, retain the original commit IDs and source/test paths in the archive manifest. The generic inventory candidate can be transplanted later as a focused patch while keeping `bd82cf8` as provenance. All other dirty, untracked, or diagnostic material remains governed by the input inventory and the prior reports; this review did not enumerate untracked payload contents or treat them as merge candidates.

## Supplemental audit: branch refs beyond inventory worktree HEADs

The previous section covers every inventory HEAD. I also enumerated every local and `origin/*` branch ref, without fetching or changing refs. The repository currently has **188 local/remote branch refs** in scope. **52** tips are outside `origin/main` ancestry. Comparing all commits reachable from those 52 tips with all commit histories reachable from the inventory's 26 non-ancestor HEADs (including historical/missing worktree paths) leaves **37 unique commits only reachable through branch refs**, not covered by those inventory histories. The remaining branch-only commits are documentation, duplicate patch-equivalents, already-present source, release merges, or older alternatives listed below. Ref names often occur as both local and remote copies; counts above deduplicate commit objects where appropriate. The comparison includes local refs only and makes no claim about remote branches not present in the local ref cache.

| Unique branch-only commit | Branch/ref family | Disposition |
|---|---|---|
| `00977ec24144` | `codex/platform-integration-tenant-pwa-20261015` | Platform integration blocker/handoff documentation; retain as historical decision record. |
| `071df1d72954` | `codex/aka-shoes-product-storefront` | Retail catalog handoff/tool-routing change is present in current main source, including the legacy tools link; equivalent source, no merge. |
| `088e4357543c` | `codex/damoon-service-content` | Damoon v44 acceptance/documentation update; preserve the conversation/source history. |
| `0da4c583f1bd` | `codex/retail-aka-rehearsal-20261015` | Retail/Platform handoff document; not product code. |
| `0db15213f9bd` | `codex/damoon-coded-front` | Older Damoon static-site theme/mobile polish; current approved landing work has since changed the site. Preserve as alternate history. |
| `0db94e3f1d6d` | `codex/aka-shoes-explicit-retail-activation` | Catalog opt-in fix is patch-equivalent to main; no merge. |
| `10d626524e1a` | `codex/retail-aka-rehearsal-20261015` | Records that cache cleanup lacked authorization; retain as a preservation/operations note. |
| `14c05e98a5de` | `codex/aka-shoes-catalog-navigation` | Retail catalog navigation fix is patch-equivalent to main; no merge. |
| `1c22a571d665` | Restaurant 13 branding refs | Older Restaurant 13 tenant branding implementation overlaps the branding work in the `89ff161` integration history; current generic branding source supersedes it. Preserve as alternate history; no additional merge. |
| `202524e40709` | `codex/cafeleo-cl3a-integration` | Base-path-safe dashboard sign-out is represented by `appPath(...)` in main's dashboard sidebar. |
| `2bc5893ec148` | `codex/retail-r2-dashboard-rtl-20261013` | Locale direction sidebar fix; source is represented by current dashboard direction handling. |
| `4201a455b5d7` | Platform integration docs | Integration-plan documentation; retain as historical handoff. |
| `469a2429266a` | `codex/damoon-service-content` | Damoon service/reception delivery documentation. The branch history also retains a multi-page static Hotel site implementation (`b4f54e4cdb7c`) and English/Arabic translation work (`e13b9cc5df60`). Main has substantially revised `sites/damoon/*` under the later approved landing design; treat the old multi-page source as an alternate, recoverable design/content archive, not a merge candidate without an explicit Hotel content/site decision. |
| `4869f9f8d8f5` | `kilo/restaurant-13-presence-research` | Restaurant 13 digital-presence research document; preserve for provenance, not executable source. |
| `54c982d89eed` | `codex/damoon-public-redirect-fix` | Older static Damoon redirect and asset-manifest fix; inspect only if restoring that alternate static site. No general product integration. |
| `57c583907b52` | `codex/bazarbaaz-runflare-security-fix` | Internal tenant lookups over loopback are present in `origin/main:proxy.ts` (`internalApiUrl`, `127.0.0.1`, resolver calls). Source already integrated. |
| `67dc34786b6d` | `codex/legacy-product-link-compat` | Tenantless product links resolve through the unambiguous tenant-scoped redirect in main (`app/[locale]/product/shop/[productId]/page.tsx`, `lib/public-catalog/legacy-product-routing.ts`). Source already represented. |
| `6f27b0e4c163` | `codex/retail-r0-dashboard-rtl-20261013` | Duplicate locale-direction sidebar fix; source is represented in main. |
| `80f8654f228d` | `codex/aka-shoes-product-storefront` | Tenant-domain storefront links/root catalog behavior are represented in main (`forcePublishedRetailCatalog`, `shouldLoadPublishedRetailCatalog`); no merge. |
| `81b315d8285f` | Vercel install/configure branch | Optional Vercel Speed Insights instrumentation. Not in main and not required for current RunFlare behavior; retain branch if observability work is later authorized. |
| `81d92d40a39b` | `codex/bazarbaaz-animated-business-landing` | Older server-safe Bazarbaaz homepage link behavior; later approved landing work supersedes this implementation. |
| `8770fca56dca` | `codex/shop-root-product-links` | Tenant product links from shop root are patch-equivalent to main. |
| `9b4c60d917ff` | `codex/aka-shoes-product-storefront` | Retail root published-catalog behavior is represented in main (`app/[locale]/[slug]/page.tsx`, shop page, `lib/retail/shop-experience.ts`). |
| `9d110fea7215` | `kilo/custom-domain-readiness` | Custom-domain readiness audit, documentation only. |
| `9e2cbd4e6452` | R5 USSD routing handoff | Operational handoff document; preserve if that workstream resumes. No code merge. |
| `9e63463155cf` | Restaurant 13 SEO preparation | Draft SEO/content preparation; keep as review material until business facts and publication are approved. |
| `a097f7294332` | temporary platform release-attestation branch | Adds a short-lived Production DB diagnostic endpoint. Not product source; keep isolated as diagnostic history and do not activate/reintroduce. |
| `a47c582311ec` | `try6` / old business-home line | Earlier Bazarbaaz business showcase/homepage treatment and sample tenant images. The current approved public landing is materially different; preserve as design/source history, not a wholesale merge. |
| `b4b5f9ff046d` | `codex/retail-aka-rehearsal-20261015` | Disk cleanup handoff note; it does not authorize cleanup. |
| `b4f54e4cdb7c` | `codex/damoon-coded-front` / service-content line | Initial multi-page Damoon static site source; see `469a242` disposition. Preserve the source and reference assets via its branch/history pending the product decision. |
| `c00f4a29bdb7` | `codex/bazarbaaz-landing-server-render` | Duplicate older server-safe homepage link commit; superseded as above. |
| `d1680a1d57e4` | Retail R6 PWA branch | Core PWA source patch is represented in main. Remaining branch-only items are handoff/disk/blocked-cleanup documentation. |
| `d34018b33478` | Vercel Speed Insights branch | Same optional instrumentation family as `81b315d`; no current product integration. |
| `e014a70a3dd7` | Aka storefront branch merge | Merge commit importing mainline into the branch; no separate source delta. |
| `e13b9cc5df60` | Damoon multi-locale site | English/Arabic static-site translations belong with the alternate `sites/damoon` history above; main's later site has its own translation/content state. Preserve for recoverability, do not merge without an explicit locale/content decision. |
| `eb3d99043d38` | `try6` old commerce experiment | The message `.` commit changes an alternate shop/cart/schema/API routing line. Its provenance and acceptance are not established by the inventory reports; preserve as experimental branch history, do not merge into current tenant-scoped shop architecture. |
| `f47a4c13e0a8` | `codex/legacy-product-link-compat` | Node test-runner format conversion only; product route behavior is already in main. |

The only newly highlighted **source that should be explicitly retained as an alternate archive** is the older Damoon multi-page site and its EN/AR content (`b4f54e4`, `e13b9cc`, `469a242`). It is separate from the approved landing in current main and should remain recoverable even if not integrated. No additional branch-only code gap was found that supersedes the two targeted outcomes above; this is a source/ref audit, not runtime acceptance or a content approval.
