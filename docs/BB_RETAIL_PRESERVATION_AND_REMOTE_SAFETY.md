# Retail Preservation and Public-Repository Safety

**No push, cleanup, branch deletion, or worktree modification was performed.** Paths below are local evidence; do not publish private Retail material.

## Accepted source and recoverability

- Combined Platform branch: `codex/platform-combined-integration-20261015`, HEAD `9cf3dfbd81e13bfa1b69a96c8452be14f3ce2472`. P14 (`117d24d35584b5d80fd775938f30a53b6952dd99`) and R6 (`a370d6588f26efdf318578f16b0006b8a2581aaf`) are ancestors.
- Additional accepted source commits verified as ancestors of this exact candidate: Platform PWA `b979b82a71a77b9e12188414ed5be61be7389b17`; corrected branding `a5334f65f2cbd3ca3b1b9d4910ce3190facfd993`; Retail H2+R5 `c1eedb82503629356397106d8b6e2ec5b63b9cd3`; Hotel F5 `f24d5d04b18ef58a4b4434d2fbd6b1fca3109edf`.
- Accepted Retail H2+R5 source: `c1eedb82503629356397106d8b6e2ec5b63b9cd3`, present in combined history.
- R3 worktree `C:\Users\disso\.codex\worktrees\retail-r3-20261013\shadcn-rtl`, branch `codex/retail-r3-merchant-flow-20261013`, HEAD `c283e461af2cbb7e05f9e1b9efcd839762a0eaec`; the branch tracks `origin/codex/retail-r3-merchant-flow-20261013` at the same HEAD. It has 151 untracked artifact files under `artifacts/retail-r3*`, totaling 6,717,545 bytes, and no tracked source edits. Preserve the worktree, branch and evidence.
- Accepted H2+R5 worktree reported clean at the implementation SHA; it was not modified.

Four Retail documentation commits remain unique and are **not** ancestors of the combined candidate:

| Commit | Unique material | Disposition |
|---|---|---|
| `30282527a743039bd0bd13d26045f1b82efa6c74` | `docs/retail/RETAIL-R4A-INTEGRATION.md`, checkout/coupon/payment interface contract. | Retain for later scoped import/review; do not treat as implementation. |
| `0da4c583f1bd046774d50ae6e5dfa24eae7c7b00` | `RETAIL-AKA-CATALOG-MAPPING-AND-RELEASE-REHEARSAL.md`, `RETAIL-TO-PLATFORM-HANDOFF.md`. | Handoff has useful unique engineering context. Catalog mapping includes production product IDs/prices/order/domain/media information; keep private. |
| `b4b5f9ff046de4dd40a7d6a141cdf92dc3d20425` | Update to `RETAIL-TO-PLATFORM-HANDOFF.md`. | Preserve version history; inspect/redact before any public use. |
| `10d626524e1acff076c621eeda378fe4e6f582e1` | Update to `RETAIL-TO-PLATFORM-HANDOFF.md`. | Preserve version history; inspect/redact before any public use. |

These commits remain on their original branch. No source functionality unique to these docs should be assumed integrated. Keep the R3 evidence for provenance and future forensic comparison. A local-only manifest at `docs/retail/BB_RETAIL_ARTIFACT_MANIFEST.csv` records relative paths, Git state, sizes, and SHA-256 values; it remains untracked and is excluded from this public-repository commit because private evidence filenames can themselves disclose operational or commercial context. The manifest contains no artifact payloads.

## Preserved artifacts

The manifest covers **203 files**:

- 52 files / 14,654,254 bytes under the combined candidate `artifacts/` tree: 34 tracked and 18 inherited untracked files from branding and Hotel F2/F2.1 evidence.
- 151 untracked R3 evidence files / 6,717,545 bytes, all under R3 `artifacts/retail-r3*`.

Recommended retention: keep all accepted-run JSON, logs, screenshots and migration/browser evidence at least through final R6 acceptance, Production lineage review, and owner-approved Retail transfer. The CSV is an integrity inventory only; hashes do not prove authenticity or that an artifact is a passing result. The original evidence files remain in place. No Retail or inherited artifact was removed.

## Public GitHub history review

The configured public repository is `QComputer/shadcn-rtl`; local `origin/main` and `git ls-remote origin main` both reported `ddd414184caadf479e357c5a7e19238592c08b40`. The combined candidate is 201 commits ahead of that `main`. `git ls-remote` returned no branch named `codex/platform-combined-integration-20261015`; the accepted combined head is currently local-only. This is a real source-recoverability risk if the worktree or host is lost.

The tracked root file `bazar-baz-current.dump` is present on public `origin/main` and also in candidate `HEAD` as Git blob `c1c20d2cdb4f04ecee7341f6658106922d7af7ea` (223,055 bytes; SHA-256 `DA29E4D118B6BA7332C904A0DE43A043EE78F8A559BD5B452297BB7E8BA21AF5`). Its contents were not opened or printed. Whether it contains private records, credentials, or operational data remains **UNRESOLVED**. A custom pattern scan of newly reachable blobs found no matches for the checked common private-key/token forms, but that is not a comprehensive secret scan and did not clear the already-public dump.

Before any public feature-branch push:

1. Have an authorized security/data owner safely classify the existing public dump without exposing its contents in chat or this report. If credentials were included, rotate them. Do not rewrite public history or delete the file under this mission.
2. Run a formal secret scanner over every newly reachable commit and review commercial/customer artifacts. Confirm Retail private handoff files are not in the push scope.
3. Produce a reviewed exact commit range and manifest against the current remote main. Push only the named non-force feature branch after separate push approval; verify the remote branch SHA equals the intended HEAD.

The existing pattern scan reviewed 1,028 unique new blob contents across the 201-commit range for selected key/token patterns and found no matches. This does not establish that all secrets or personal/commercial data are absent. `gitleaks` and `trivy` were not available in the inspected environment. Do not present that scan as a release clearance.

## Preservation and cleanup decision

- Dirty main checkout: left untouched; prior inventory reported 378 dirty paths.
- R3 and H2+R5 worktrees, branches and evidence: left untouched.
- Combined candidate inherited evidence: left untouched.
- No destructive cleanup, remote push, merge, deployment or database access occurred.

**VERIFIED:** current branch/HEAD and ancestry; R3 tracked cleanliness and 151 untracked files; unique docs are not integrated; remote main SHA and absence of remote combined branch; root dump blob identity/size/hash metadata only.
**INFERRED:** current candidate source is recoverable locally but not remotely; public dump content may be sensitive and needs disposition.
**BLOCKED:** safe public preservation push pending dump classification, formal new-history scan/review and separate push authorization.
**NOT CHECKED:** dump payload contents, any Production data, or full semantic review of Retail handoff material.
