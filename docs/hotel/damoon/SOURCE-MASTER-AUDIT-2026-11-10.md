# Damoon source and Master v1.1 audit — 2026-11-10

Read-only file and provenance audit. This records availability and status; it does not install or approve the Master or its source material. SHA-256 values identify files without reproducing their contents. The broader bounded source inventory is in [SOURCE-INVENTORY-2026-11-10](evidence/SOURCE-INVENTORY-2026-11-10.json).

## Master package inventory

Statuses distinguish file presence from installation:

- `AVAILABLE_VERIFIED`: file exists, is readable, and its recorded hash was checked.
- `AVAILABLE_UNVERIFIED`: file exists, but content equivalence, provenance, or applicability is not established.
- `MISSING`: exact named item was not found in the searched locations.
- `OWNER_APPROVAL_REQUIRED`: a source or public-use decision is still pending with the owner/manager.

| Item | Actual location and SHA-256 | Status | Installation finding |
| --- | --- | --- | --- |
| Master v1.1.0 | `C:/Users/disso/Downloads/DAMOON_ORG_MASTER_FA_v1_1.md` · `424F1AAEB96C889FE54D29F1D463B99BAE1BEB6F8392989B94BA2F0EBC6FE25C` | `AVAILABLE_VERIFIED` | Readable and hash matches the installer instruction. **Not installed**: `docs/hotel/damoon/DAMOON-ORG-MASTER.md` is absent; no tracked document or scoped tracked-text match for the v1.1 dossier was found. |
| Master v1.0.0 | `C:/Users/disso/Downloads/DAMOON_ORG_MASTER_FA_v1_0.md` · `F4F0BD7AB3A6450D6566B5C6A68B3FBB73CC23E60DFD2D0741DC2D694DD34F62` | `AVAILABLE_VERIFIED` | Readable, but superseded by v1.1.0. No repository copy found. |
| Installation instructions | `C:/Users/disso/Downloads/KILO_DAMOON_MASTER_INSTALL_v1_1.md` · `3ED82D9441FCD9AEAE8AC13514D6A544C90BE019E71504F0C3242B79EB3220A6` | `AVAILABLE_VERIFIED` | Readable plan only; not executed. It requests a Master, source-reference and README update, then Git actions. This audit did none of those actions. |
| Optional handoff ZIP | Exact name `DAMOON_ORG_HANDOFF_v1_1.zip`; bounded recursive filename search of `C:/Users/disso/Downloads` and `C:/Users/disso/Project` returned no match. | `MISSING` | The installer describes it as optional and the individual named files are available, so this does not prevent this source audit. No ZIP inventory could be read. |

The requested Master destination, source directory, and README link were checked separately: `docs/hotel/damoon/DAMOON-ORG-MASTER.md` is absent; `docs/hotel/damoon/sources/Damoon-Questionnaire-Typed-Updated-2026-10-10.md` is absent; `docs/hotel/damoon/README.md` does not link to a Master. Current phase-one documents remain separate and do not imply Master installation.

## Referenced source files

| Source | Actual location and SHA-256 | Status | Scope/limit |
| --- | --- | --- | --- |
| Updated 90-answer questionnaire (copy 1) | `C:/Users/disso/Downloads/Damoon-Questionnaire-Typed-Updated-2026-10-10 (1).md` · `C8EAC14C2B3BC5C33FE43883664A37F563DDEFEC5E50818597077EB16D862D3D` | `AVAILABLE_VERIFIED` | Readable source referenced by v1.1; installer's expected SHA matches. |
| Updated 90-answer questionnaire (copy 2) | `C:/Users/disso/Downloads/Damoon-Questionnaire-Typed-Updated-2026-10-10.md` · same SHA as copy 1 | `AVAILABLE_VERIFIED` | Byte-identical duplicate of copy 1 by SHA-256; neither copy is installed in the repo source directory. Keep as internal evidence, not public website copy. |
| Updated questionnaire PDF copies | `C:/Users/disso/Downloads/Damoon-Questionnaire-Typed-Updated-2026-10-10.pdf` and `(1).pdf` · `024466D7A5FA9B15E95C5202C4E89754170FB614A9D20E54C04C4E95F334F964` | `AVAILABLE_UNVERIFIED` | Both files exist, have the same size/hash, and the nine-page text layer was readable. The Master explicitly says equivalence with its Markdown source is unverified; treat PDF and Markdown as separate renditions until reconciled. |
| Hotel cancellation rules PDF | `C:/Users/disso/Downloads/Telegram Desktop/قوانین کنسلی هتل.pdf` · `BE2F9412323767B65C07D7A93F7CD10541A87889778C4F35F952EC9DF82DC38F` | `AVAILABLE_VERIFIED` | One-page source visually read and consistent with the Master’s summary of single-night penalty tiers. The source does not fully define interval boundaries/time handling; definitive fee publication needs manager approval, and automated booking-policy enforcement is outside phase one. Approved informational rules remain within the phase-one policy page scope. |
| Older questionnaire and master-data files | Named files exist in Downloads, including the blank questionnaire, filled transcription, completed-questionnaire PDF copies, management questionnaire v2, and Hotel Master Data v2. | `AVAILABLE_UNVERIFIED` | Inventory-only in this audit; contents and equivalence to v1.1 inputs were not re-audited. The scanned/completed questionnaire files may contain private details; do not copy them into the public repo based on filename presence. |

The updated questionnaire’s filename date and its internal Persian date are not reconciled by the Master (`D-030`). Preserve that source-metadata issue; do not infer a date equivalence. The cancellation source exists, but its partial timing rules are not a complete operational policy.

## Asset provenance and current phase-one boundary

- The Master records the decision to preserve the existing logo geometry (Q49; §6.1), but this proves a design decision, not the availability of an approved original logo file. The owner’s direct 2026-11-10 answer is that the original approved logo and current approved photographs are **not ready**. Mark the source assets `OWNER_APPROVAL_REQUIRED`; do not request them again or substitute any similarly named generic file.
- Local candidate images exist outside the active site package, including files under `C:/Users/disso/Project/damoon-preview/asset-research/damoon/` and VTour-labelled files in Downloads. Their names or presence do not establish current condition, rights, owner approval, or suitability for phase one. Keep the phase-one finding that real-media replacement is blocked on approved source assets. The current site’s concept/reference assets remain labelled as concepts/references.
- The Master’s existing-image rule (§6.1) requires a concept/sample label for conceptual or old imagery and owner rights/approval for actual-current photos. The direct owner answer makes the current status explicit: approved source logo/photos are pending.
- The Master’s contact decision is not owner confirmation. §2 says the address/phone in newer site material came from public sources and is not direct new management confirmation; `D-010` remains `OPEN` for management confirmation of official numbers/address/contact. The active phase-one public-correlated values may remain provisional; do not label them manager-approved.
- Restaurant-ready and café-being-completed are the newer current owner decisions recorded in the Master (§6.1). Retain those statuses; do not take older questionnaire answers about café availability as proof it is currently open.
- The Master contains broader booking, payment, VTour and cancellation-policy work. Its top priority and install guide’s “resume booking” steps are superseded for the current task by `PHASE1-2026-11-10.md`: this phase excludes VTour integration, SEO/PWA, definitive booking and payment. The current phase-one report says A/C/D are locally accepted and B remains partial pending the owner-supplied approved media. Do not import the old operational priority or expose cancellation tiers as phase-one marketing copy.

## Result

Master v1.1 is a real, readable, checksum-matched Downloads input, but it is **not installed in the tracked repository**. The optional bundle is missing; the core Master, installer instructions, updated questionnaire Markdown and cancellation PDF are individually present. The Master is useful internal evidence, not publication approval. Current owner decisions and phase-one boundaries take precedence over its older booking-first execution instruction.

No files besides this new audit document were changed. No installation, extraction from a ZIP, app/API/database change, Git mutation, or test run was performed.
