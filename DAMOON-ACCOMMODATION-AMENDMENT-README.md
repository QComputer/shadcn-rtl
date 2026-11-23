# Damoon — November 23 owner accommodation decision amendment

This ZIP is a **small, additive correction** to `Damoon_Documentation_Roadmap_Overlay_2026-11-23.zip` already installed by Agent B / PR146. It **does not replace** that earlier overlay or rewrite any historical master or questionnaire source. It contains four new documents/records, one JSON manifest, one guarded script and this README.

## Why this is needed

The previous overlay treated the inconsistent 7 VIP / 17 standard / 7 studio counts as a conflict that must wait for fresh subtype confirmation. The owner has **now explicitly selected** a five-category default: **3 single, 17 double, 6 three-person suites, 3 four-person suites, 2 five-person suites**; total **31 = 20 rooms + 11 suites**. Future corrections must be possible in an authorized management dashboard without repeated code releases. This newer owner decision supersedes only the relevant previous guidance; it does not approve invented physical inventory or activate booking.

## Files and safe installation

Extract **only into an assigned, clean or carefully reviewed checkout** of `QComputer/shadcn-rtl`; preserve all work from Agents A/B/C. Do not force checkout, reset, clean or override files in other agents' PRs.

1. Inspect this ZIP and compare payload hashes to `DAMOON-ACCOMMODATION-AMENDMENT-MANIFEST.json`.
2. Extract into repository root; all paths are new, so none should overwrite existing files.
3. Review the two new canonical docs: `docs/hotel/damoon/OWNER-DECISION-ACCOMMODATION-BASELINE-2026-11-23.md` and `docs/hotel/damoon/ACCOMMODATION-ADMIN-AND-CONTENT-CONTRACT-2026-11-23.md`.
4. Execute `python scripts/docs/apply-damoon-accommodation-amendment-20261123.py` (dry-run). It inspects the old overlay docs, checks exact anchors and lists planned changes.
5. Only if every anchor still matches, execute `python scripts/docs/apply-damoon-accommodation-amendment-20261123.py --apply`. It will amend the relevant old overlay instructions and add a decision reference to older entry points, backing up touched originals to ignored `.tmp/damoon-accommodation-amendment-20261123-backup/`.
6. **If any target was edited by Codex in PR146/PR147 or later, script stops without changing any file.** Manually reconcile only the relevant paragraphs preserving any fresh acceptance evidence and unmerged edits. Do not overwrite new CI/deploy evidence with stale snapshot files.
7. Review `git diff --check`, run relevant markdown/JSON validators, create a **focused docs amendment PR**. Apply the actual category UI/dashboard changes in independent implementation PRs, with source-level tests and Production smoke after deployment.

## Specific rules for Agent B

- Stop the in-flight "remove all unsupported room counts" approach where it contradicts this selected default. Keep the historical audit that says some subtype counts were assumptions; this is an explicit **new** selection, not false proof of earlier questionnaire approval.
- Verify the exact old URLs for room categories and map/redirect them; don't create fake physical unit identifiers, nightly availability or rate plans.
- Audit original Q01-Q90 documents when accessible in the local Windows Downloads/private ledger. Produce a complete **sanitized** 90-row feature coverage register. Never claim full questionnaire use on the basis of historical index alone.
- Make management content editable using existing CMS/Hotel management contracts. If new Prisma fields are needed, do not deploy their migration to Production without an independent approved migration plan.
- Existing PR145/P0 acceptance remains valid as evidence for its exact SHA; this new decision needs separate source/CI/deploy/live acceptance and should not rewrite history.

## Boundary

No Production database writes, migration, public booking, real payment/SMS, PR140 merge, release rerun or credential disclosure is authorized by this documentation correction.
