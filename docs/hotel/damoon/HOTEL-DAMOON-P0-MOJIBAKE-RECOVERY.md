# HOTEL-DAMOON-P0 — Persian/Arabic text corruption

**Priority:** P0, public-facing defec
**Status:** `TESTED_LOCALLY; PR_PENDING`
**Scope:** Dedicated Damoon frontend only; Hotel reservation, payment, and operational behavior is excluded.

## Evidence and initial diagnosis

- The live homepage at `https://damoon-hotel.ir/` visibly renders corrupted Persian in navigation, hero copy, buttons, page descriptions, footer labels, and accessibility names. The brand heading `هتل دامون` and several static captions remain readable.
- In a live Chrome session, the page declared `charset=UTF-8`, `lang="fa"`, and `dir="rtl"`; `document.fonts.status` was `loaded` and the body font stack began with Vazirmatn. The visible corruption therefore is not explained by a missing font or incorrect page-level charset.
- The first damaged `app.js` literals appear in commit `4e5e27306b10a71dbeb6a7827d8032b8d5d79354`; its parent contains clean Persian copy. The current source and mirrored asset contained CP437-decoded UTF-8 byte runs. Reversing CP437 to UTF-8 restored 524 runs exactly in each affected source and bundle, including the Persian unit-count digits; a sample byte check matches the clean text, with no wording guessed.
- The static generator reads source with UTF-8 and writes UTF-8; it did not introduce the corruption. It faithfully copied already damaged source literals into the published bundle.
- Persian in `sites/damoon/translations.js` is intentionally absent; the file documents that its Persian copy lives in `content.js` and `app.js`. Several UI strings therefore fall back to the damaged `faUI` in `app.js`.

## Delivery checklis

- [x] Confirm the first commit that introduced corrupted literals and preserve all subsequent frontend behavior.
- [x] Restore Persian and Arabic copy only from reversible source bytes or authoritative clean repository records; do not invent factual or business wording.
- [x] Add a generated-asset integrity check that rejects known mojibake signatures before manifests are written or public assets are packaged.
- [x] Regenerate the published Damoon bundle; source and generated `app.js` are now UTF-8 text with matching app logic.
- [x] Confirm generated manifest hashes and all public paths match regenerated output.
- [x] Verify fa RTL, ar RTL, and en LTR; loaded Vazirmatn; light/dark themes; and responsive layouts in Chromium at 1440x900 and 390x844 (no horizontal overflow). Mobile menu open and theme toggle also pass. Screenshots: `evidence/damoon-fa-desktop.png`, `evidence/damoon-fa-mobile.png`.
- [x] Capture desktop and mobile Persian screenshots.\n- [ ] Merge through a dedicated PR, deploy through Runflare, and verify the live revision and browser rendering.

## Release evidence

Local source repair, generated-asset checks, PR/merge state, Runflare deployment, and live browser acceptance must be recorded separately. This item is not complete on source repair alone. Reconcile its final state into the project source-of-truth and delivery roadmaps during the planned documentation refresh after GF1's release decision.\n