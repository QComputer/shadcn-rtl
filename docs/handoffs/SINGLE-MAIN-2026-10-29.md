# Single-main consolidation and continuation

Owner decision: 2026-10-29. Use one active checkout at
`C:/Users/disso/Project/shadcn-rtl`, on `main`, to continue Hotel, Retail and
shared Bazarbaaz work. Do not create additional worktrees by default.

## Completed local workspace state

`git worktree list --porcelain` now contains exactly one entry, this checkout
on `main`. All 47 other existing registered worktrees were closed: 42 workspace
directories were removed by Git, and five filesystem residuals were moved into
the private recovery root after Git removed their registration/metadata. Eight
stale registrations were pruned after their metadata and HEADs were preserved.
An additional old provisioning directory without Git metadata was also moved
into the private archive with its contents retained.

The original 48 existing checkouts have 48 verified ZIP snapshots containing
66,422 preserved files (1,297,080,381 compressed bytes), plus the history bundle,
binary deltas, index files and worktree metadata. Source branches remain
recoverable; closing a worktree did not delete its branch.

Measured C: free space was 5,609,074,688 bytes immediately before worktree
retirement and 16,963,477,504 bytes after it. These are host observations rather
than summed logical file sizes. Main's dependency target was checked and kept.

The initial combined cosmetic-cleanup command was rejected by automatic tool
review (`blocked by policy`). On the owner's explicit follow-up, narrower native
PowerShell operations succeeded: old ignored `.kilo` state was moved intact to
`main-original-files/.kilo` in the private recovery root, and 23 verified empty
wrapper directories were removed without recursion. Twelve nonempty wrappers
were retained: ten have Codex name markers, one has an `uploads` directory, and
one has a dependency junction. Their contents were not deleted or traversed.
These retained directories are not registered worktrees. The active checkout
remains the single main workspace.

The source integration is `148330c487a4e52d774746d176b06c6066380939` and the
generated shared Damoon package is
`9019bb06c9336b59c36fc7ca08754dd1778f19c9`. Documentation-only commits may follow;
use `git rev-parse main` for the latest local HEAD. No push or hosted deployment
was performed; `origin/main` remains `4f0eb5d` at the last full fetch.

## Consolidated source

The integration starts from GitHub main
`4f0eb5d2a7ff65f977d2645682993cd0c7abc0a5`. Earlier Platform P1/P2/P3,
Retail and Hotel integrations are retained through that history. Old branches
were compared with this source; they were not merged wholesale.

Additional retained product changes:

- Damoon's prepared accommodation and hospitality pages: four new modules and
  six changed modules in `sites/damoon`. This includes the date/guest planning
  state passed to room/contact links, translated pages, gallery and responsive
  interior layouts. Concept-image labeling and the contact-based flow remain.
- The generic product editor loads and serializes `trackInventory`. The generic
  creation form exposes and serializes it as well. This is a selective transfer
  from historical fix `bd82cf82e029d1179a093c8875dc106d05291434`; the modern
  Retail editor already implements that contract.
- Damoon's post-release documentation and the responsibility-transfer record.

These local changes do not activate real Hotel bookings, rates, inventory,
payments, notifications or new tenant publication. They are not a new hosted
release. Source integration and operational acceptance are separate.

## Preservation and source disposition

Private recovery root:
`C:/Users/disso/.codex/private-preservation/bazarbaaz-single-main-20261029`.
This directory has restricted Windows permissions and can contain protected
configuration, database snapshots and browser state. Do not upload it or add
its payloads to Git.

- `all-history.bundle` preserves all branch refs and dedicated preservation refs
  for all 56 worktree registrations, including detached HEADs. Bundle integrity
  was verified. SHA-256:
  `81dfa4df9cee41441e51d6fa72dba8edb3452b179a3ef9f19382b49268b66729`.
- `preserved-refs.json` maps each original worktree to its preserved commit.
- `archives/wt-NN.zip` and the adjacent JSON retain dirty/untracked/ignored
  material, file hashes, original state and the original root. Index files and
  binary staged/working patches are in `git-deltas/wt-NN/`. Regenerable direct
  dependency/build trees are excluded from the preservation payload.
- `main-original-files/` retains original primary-checkout files relocated
  during normalization. Inherited environment values are archived, not loaded
  into the normalized development checkout.
- `inventory.json`, `history-review.md`, `local-delta-review.md` and
  `local-delta-classification.json` record source disposition. The latter covers
  every one of 702 expanded local status paths, rather than treating directory
  entries as individual files.
- Committed copies of the source-disposition reviews, the local path manifest,
  worktree recovery map and validation summary are under
  `docs/handoffs/consolidation-2026-10-29/`; private payloads are not committed.
- The audit also covered 188 local/cached remote branch refs and 37 commits
  reachable only through branches outside the inventoried worktree histories.

Material deliberately retained for a separate integration decision:

| Work | Recovery source | Why not replayed into current main |
| --- | --- | --- |
| Fastfood13 asset package, 218 local paths | `archives/wt-00.zip`, `public/brand/tenants/fastfood13/` | Tenant slug/identity migration needs deliberate mapping; preserve the current Restaurant 13 behavior. |
| Local IAM/business-identity/iNoti IMENU modules and tests | `archives/wt-00.zip` and the path classification | Compare with the newer graph-backed business-entity contracts before integrating. |
| Hotel H4.1 advisory composition | `a1ae4dd8ffdfba162a98374bf793aec39d9bc29f`, preserved Hotel history | Optional feature with business-policy dependencies; not required for the website. |
| Older Damoon multi-page site and EN/AR content | `b4f54e4`, `e13b9cc`, `469a242` in bundled branches | Alternate source/content; current accepted site has a newer implementation. |
| Two distinct old Aka visibility patches | `archives/wt-00.zip`, `archives/wt-45.zip` and their binary patches | Overlapping old implementations differ; current public Retail contract is the baseline. Original inventory maps archive IDs to roots. |
| CafeLeo external CL-3, Restaurant 13 slug migration, payment drain tools | Original branches in the bundle and history review | Separate historical operational/product decisions; not implied by consolidation. |
| Temporary DB/tenant attestation endpoints, resolver diagnostics, old schema/shop experiments | Original branch refs and per-worktree archives | Preserve provenance without activating temporary operator endpoints or replacing current tenant contracts. |

Existing local deletions of 194 public assets were not replayed. The assets
still present in current GitHub main are retained. Nineteen old Hotel route
files using `[organizationId]` are represented by the current `[id]` family;
both parameter-folder families must not be installed together.

To inspect historical committed source without opening another worktree, use
`git show <preserved-sha>:<repository-path>`. To recover uncommitted material,
read its archive JSON, extract the selected files to a private review folder,
and compare them with current main. Never import archived configuration or
database files merely to reproduce a source change.

## Validation and continuation

The transferred Damoon pages passed a fresh local Chrome run: 210/210 checks,
42 language/routes, exitCode 0, cleanup PASSED; the local server was stopped.
Evidence is in `hotel-qa/durableresult.json` under the private recovery root.
This is separate from the saved v46 public evidence (201/201).

The shared Next.js runtime also passed 210/210 Chrome checks over 42 routes with
the actual Damoon Host mapped to loopback. A local TLS proxy and a test-only
certificate exception supplied the browser's secure-origin requirement. This
is local routing/package evidence, not public TLS or live RunFlare acceptance.
The preliminary plain-HTTP run had only the expected secure-origin COOP console
failure and is retained as failed evidence; application/network assertions
passed. Both local servers were stopped after the successful run.

At source commit `148330c`: frozen installation, Prisma generation, route type
generation and full TypeScript succeeded; ten selected existing test files
passed 101/101; scoped ESLint had zero errors and 51 warnings; the full webpack
production build succeeded and generated 337 pages. The later static-package
commit synchronizes `public/damoon-front` with the same source and was verified
through the shared runtime; it changes no compiled TypeScript implementation.
No database-backed merchant save/reload, shared database mutation, physical PWA
installation or real payment/booking acceptance was performed for consolidation.

Dependency restoration uses `pnpm install --frozen-lockfile --ignore-scripts`
and the repository's Node 24 / pnpm 10.15.0 contract. Local Prisma generation,
type generation, tests and build must use loopback-only placeholder or an
explicit isolated test database. Generation/build is not permission to migrate
or seed a shared database. Use the recorded final validation result for the
exact local commit; historical reports do not establish present runtime health.

The subsequent local synthetic merchant edit/save/reopen/reload and anonymous
catalog slice passed, including a repeated-attribute label fix, tenant denial,
93 focused contract tests and full data cleanup. See
`RETAIL-HOTEL-ACCEPTANCE-2026-10-29.md` for its exact environment and limits.
Next Retail slice: reviewed hosted release and real `aka-shoes` owner/domain
verification, with separate order/payment and live Restaurant/Cafe acceptance.
Next Hotel slice: complete the dedicated `damoon-hotel` frontend on the accepted
design, and separately resolve real photographs, VTour playback and approved
rates/inventory/policies before operational booking integration.

The consolidated main is a local development baseline. Pushing main may start
RunFlare Auto Pull; release it through the reviewed deployment workflow rather
than treating workspace consolidation as an automatic Production deployment.
