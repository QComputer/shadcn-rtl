# Bazarbaaz / Retail / Hotel responsibility transfer

Recorded: 2026-10-29 (Asia/Tehran).
Receiving chat: `01a18781-ccf3-7490-aed4-f86143a8c3e0`.
Source chat: `01a172be-7045-73d2-88ff-7b4e3dcdbeac`, title `بررسی چت مهاجرت به Runflare`.

## Scope and evidence

The owner requested that this chat read the source chat first and take over responsibility. The source chat was paginated to its beginning using read_thread. The recent turns of `Build retail storefront platform` (`01a134f1-5b34-76c0-a1d0-745b57a96203`), `Hotel agent` (`01a10257-c361-7c20-846e-e9ab4fc26d97`) and `Implement Bazarbaaz P3 Preview` (`01a15016-b8ff-72a0-9ec6-a74bb212dd16`) were also read.

Latest owner priorities in the source chat: stop image generation; review the project and Retail/Hotel histories; produce a reliable AI handoff; accelerate Retail while maintaining a separate Hotel track. RunFlare is the hosting target. Damoon uses a dedicated coded frontend, independent of the Website Studio editor.

This transfer is an evidence inventory, not a new deployment or complete application audit. No business data, credentials, provider settings, DNS or existing source files were changed. No chat was stopped, messaged, archived or renamed. The source chat still reported active/inProgress; that flag does not prove continuing work. Recheck ownership/activity before writing to a shared worktree.

## Current Git and file locations

- Live Git remote query `git ls-remote origin refs/heads/main` returned `4f0eb5d2a7ff65f977d2645682993cd0c7abc0a5`.
- The main checkout at `C:/Users/disso/Project/shadcn-rtl` remains on `ddd414184caadf479e357c5a7e19238592c08b40`, with extensive inherited modified/deleted/untracked content. Preserve it. Do not pull/merge/reset this checkout as a synchronization shortcut.
- Existing worktree `C:/Users/disso/.codex/worktrees/aka-shoes-product-storefront/shadcn-rtl` is now branch `codex/damoon-reference-redesign`, HEAD `6a1f8ad`. Its only default-status untracked entry was `AGENTS.md`. Its directory name no longer describes its active branch.
- New Hotel interior-page work is in the main checkout's untracked `sites/damoon/`, including `accommodation.js/.css`, `hospitality.js/.css` and edits to app/booking/build/server/index/styles. It is absent from the prior release worktree. Preserve and compare explicit source files before integration; exclude generated `dist/` and unrelated main-checkout work.
- Approximate free C: space observed: 6.86 billion bytes. No installs, builds or worktree creation were performed for this transfer.

## Hotel delivery state

`docs/hotel/damoon/DELIVERY-2026-10-29.md` records PR #41 merged at main `4f0eb5d`, RunFlare v46/image613731 and public acceptance. The saved durable evidence was read:

- `C:/Users/disso/Documents/Codex/2026-10-29/damoon-reference-live/durable-live-result.json`: PASSED, exitCode 0, cleanup PASSED, 201 successful checks and 0 failed, 42 routes. This is saved public evidence, not a new provider observation in this transfer.
- `C:/Users/disso/Documents/Codex/2026-10-29/damoon-inner-pages-qa/durableresult.json`: PASSED, exitCode 0, cleanup PASSED, 210 successful checks and 0 failed. This covers local interior-page work; it is not evidence that those changes were published.

Preserve the approved desktop/mobile references, fa/en/ar, independent palette and light/dark choices, selected dates/guests, responsive controls and noindex. Images remain conceptual. Real VTour playback and real rate/inventory/reservation/payment operations remain separate incomplete work. Do not infer operational hotel readiness from static UI acceptance.

Next Hotel slice: preserve the interior-page source delta, review date/guest persistence and localization, verify the exact candidate, then integrate and release through the established reviewed workflow. Image generation is not a prerequisite.

## Retail delivery state and next slice

The historical Retail agent was frozen and transferred its integrated implementation to Platform. The source chat's later work records R0-R6 incorporation and subsequent product-editor/catalog changes. Do not merge entire old Retail branches based on their old handoff status.

Useful documents in the release worktree:

- `docs/retail/RETAIL-R6-RETIREMENT-HANDOFF.md`: includes a later final Platform transfer update that supersedes earlier pending acceptance text. It records local guarded acceptance and genuine desktop Chrome installation evidence; physical-device and current deployed acceptance must remain distinct.
- `docs/retail/P1.3-commerce-readiness.md`: historical catalog, fulfillment and operational gaps. Its old account-security findings must be read alongside P1.4 rather than repeated as current defects.
- `docs/retail/P1.4-account-security.md`: implements credential-bound session invalidation; self-service recovery delivery remains explicitly CONFIGURATION_REQUIRED. Source documentation alone is not a fresh deployed security check.

Next Retail slice: assess the current main implementation against the merchant's practical flow: open a product, edit details/media/options/price/inventory/publication, save, reopen, reload and verify the public catalog. Check restaurant and tenant isolation regressions. The earlier worktree audit identifies a possible legacy generic-product inventory form issue; reproduce on the current source before fixing it. Keep operational catalog facts and physical stock dependent on merchant-confirmed data. Do not enable real financial operations from historical DEMO evidence.

## Coordination and release boundaries

Retail owns its catalog/editor and associated tests. Hotel owns `sites/damoon` and its focused tests. Shared auth, tenant routing, PWA, schema, deployment and final integration need one coordinating owner and explicit file boundaries. Parallel work must use separate branches/worktrees and avoid simultaneous changes to shared files; this transfer did not dispatch agents.

Preserve inherited branches, untracked evidence, protected configuration and dirty source. Historical cleanup attempts were policy-blocked; this handoff does not authorize a deletion workaround. Do not reopen an external plaintext database port, create a public migration tunnel, print secrets or reuse old restore artifacts without current validation. Old RunFlare restore/cutover blockers are historical and must not be reported as current without checking later evidence.

Immediate order: establish a current-main acceptance baseline and file ownership; prioritize a bounded Retail merchant-flow acceptance/fix; keep the already prepared Hotel interior delta recoverable; close each slice with exact SHA, focused tests, appropriate browser evidence and clear local versus public status.
