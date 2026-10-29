# Local delta review — 2026-10-29

Read-only comparison for the consolidation inventory at `C:\Users\disso\.codex\private-preservation\bazarbaaz-single-main-20261029\inventory.json`. The checkout was `ddd414184caadf479e357c5a7e19238592c08b40`; the fetched comparison tip was `origin/main` `4f0eb5d2a7ff65f977d2645682993cd0c7abc0a5`. No repository files, refs, worktrees, databases, provider services, or builds were changed or run.

## Main checkout status comparison

Expanded `git status --porcelain -uall` contained 702 paths. The accompanying `local-delta-classification.json` records each path and status plus local/remote blob IDs where applicable. It excludes config file contents. Categories mean:

| Classification | Paths | Meaning |
|---|---:|---|
| `same_path_content_differs` | 101 | Local file exists at a path present in `origin/main`, but its bytes differ. Review by feature context; the base checkout is 317 commits behind. |
| `local_delete_remote_present` | 194 | The local working tree lacks the file, while the refreshed remote has it. Keep the remote copy when rebuilding. |
| `new_local_path` | 283 | File exists locally at a path absent from the current remote tree and its path has no exact history entry in `origin/main`. This is a path-level difference, not an integration recommendation. |
| `superseded_by_remote_route_rename` | 19 | Exact local route path was used historically, but current origin has the route under the `[id]` segment. |
| `identical_to_origin` | 91 | Local file bytes match the current remote blob. |
| `operational_artifact` | 14 | Evidence/exports and catalog extraction artifacts; preserve as evidence, not application sources. |

The 194 missing-local files are all under `public/` in this manifest. This includes the legacy `aka-shoes` and `restaurant-13` tenant media groups. The current remote still has the blobs, so these local deletions are not losses and must not be replayed as deletions during normalization. Likewise, the 91 exact matches need no copy from the old checkout.

The 19 paths absent by exact spelling are the old `/api/organizations/[organizationId]/hotels/...` route files. Current `origin/main` has the corresponding route family under `/api/organizations/[id]/hotels/...`; treat the local copies as superseded by the renamed route tree, not as newly missing Hotel functionality.

## Current local-only source families

The 283 current-tree-absent paths split into a few distinct review buckets:

- **Damoon site refresh:** four new modules (`accommodation.css/js`, `hospitality.css/js`) plus six changed existing site modules (`app.js`, `booking.js`, `build.mjs`, `index.html`, `server.mjs`, `styles.css`). These add translated accommodation listing/detail pages and hospitality pages, and wire the existing date-planning/contact flow into them. Most other tracked site files and source images/fonts are byte-identical to `origin/main`. The generated `sites/damoon/dist/` output is not in the source manifest and should remain build output. This is the clearest cohesive candidate delta. No online booking/payment claim is made by this source: page copy says to coordinate by contact, and concept images are labeled as concepts.
- **Fastfood13 branding/media:** 218 new paths under `public/brand/tenants/fastfood13/` (brand/browser/PWA/social assets, source references, selected menu media and variants). Similar older material exists under the distinct `restaurant-13` tenant slug in remote history, but these paths are not byte/path duplicates. Preserve the whole asset package. Integration needs a deliberate tenant slug/routing decision; this audit does not establish that `fastfood13` may replace `restaurant-13`.
- **IAM/business identity and integrations:** one new public IAM page, six `components/iam` files, `lib/iam-content.ts`, `lib/seo-entity-policy.ts`, four `lib/business-entity` files, and the `lib/integrations/inoti-imenu` adapter/observer with associated tests. These are path-new. Current `origin/main` already has its own graph-backed `lib/business-entity/business-entity.service.ts`, so compare these contracts with the graph-backed service before merging rather than treating the absent paths as independent by default.
- **Hotel/API/schema/test/doc set:** many new local-only paths appear in the status and are captured individually in the JSON. This is not a greenfield addition to historical project state: the prior 2026-10-27 worktree report says Hotel public F2 and F5 work had been integrated by that point. The 19 local organization hotel route files match a route family still present in current origin under the renamed `[id]` segment. Preserve the local originals, but do not restore these superseded route paths or duplicate current APIs. Historical closure documents are not fresh runtime evidence.
- **Diagnostics and evidence:** nine `scripts/check-*`, `inspect-*`, `test-resolver*`, `tmp-*`, `inoti-discover-*`, and `verify-media*` paths are operator/diagnostic tooling, not user-facing product. Keep them in the private archive; do not promote automatically. The 14 operational-artifact paths include audit exports, local discovery output and extracted catalog files.

## Other registered worktrees

The inventory lists 56 paths: 48 exist and 8 are stale/prunable records. Ten existing worktrees have dirty status (including the main checkout); the other 38 existing worktrees are clean. Read-only dirty-worktree review found:

- `aka-shoes-product-storefront`: only untracked `AGENTS.md`, not application code.
- `bb-prod-db-attestation-20261016`: tracked changes in the temporary DB-attestation route and `proxy.ts`; retain as scoped security/diagnostic work, not general release code. This agrees with the prior report.
- `hotel-damoon-f2-public-integration` and `retail-r3-20261013`: local changes are config/evidence/media classes; no separate product-source path surfaced after excluding protected config and evidence paths.
- `platform-combined-integration-20261015`: an untracked internal tenant-config audit route plus manifests/inspection fixtures; retain as audit evidence/tooling, not the public product surface.
- `retail-r4a-promotions-payments-20261014` and `runflare-npm-lockfile`: only protected/config or artifact paths. `.npmrc` and `.neon` values were not read.
- `aka-shoes-visibility-hotfix`: four uncommitted storefront/menu-filter changes share the same base as main edits but differ materially in all four files (shop page and unit test most). Preserve this second patch separately and compare before deciding which hunks to carry.
- `shadcn-rtl-release`: two resolver/public-catalog diagnostic logging changes and `check-dbs.js`; no product integration recommendation, consistent with the previous report.

## Handling conclusion

Keep the verified private preservation snapshot as the recovery authority. For normalization onto `4f0eb5d`, start with the remote tree so its 194 locally absent public assets remain present, then treat Damoon as the focused website delta, Fastfood13 as a preserved but slug-dependent branding package, and IAM/business entity/inoti as a design-level comparison against the newer remote architecture. The old Hotel route family, diagnostic scripts, media exports and prior closure documents should remain preserved without being replayed automatically. No tests or installs were run for this triage.
