# Hotel Damoon — owner-selected accommodation baseline

**Date:** 2026-11-23 / 2 Azar 1405. **Decision:** `OWNER_DIRECT — BASELINE_APPROVED_FOR_PRODUCT_IMPLEMENTATION`.
**Applies to:** Hotel Damoon public accommodation presentation, scoped management configuration, multilingual copy and acceptance tests.
**Does not authorize:** Production database mutations, unreviewed migrations, real inventory seeding, automatic availability/rate calculation, booking activation, payments or rewriting historical questionnaire evidence.

## Decision and precedence

The owner instructs the team to choose one coherent initial accommodation breakdown when historical questionnaire data conflicts, to proceed without repeated approval loops, and to support later corrections from the **hotel management dashboard**.

Use the following as the **current selected implementation baseline**:

| Initial category / code | Persian | English | Arabic | Unit kind | Initial count |
|---|---|---|---|---|---:|
| `single-room` | اتاق یک‌نفره | Single room | غرفة مفردة | ROOM | 3 |
| `double-room` | اتاق دونفره | Double room | غرفة مزدوجة | ROOM | 17 |
| `suite-3-bed` | سوئیت سه‌نفره | Three-person suite | جناح لثلاثة أشخاص | SUITE | 6 |
| `suite-4-5-bed` or **new dedicated subtype** | سوئیت چهارنفره | Four-person suite | جناح لأربعة أشخاص | SUITE | 3 |
| **New distinct subtype** | سوئیت پنج‌نفره | Five-person suite | جناح لخمسة أشخاص | SUITE | 2 |
| **Total** | **۳۱ واحد؛ ۲۰ اتاق و ۱۱ سوئیت** | **31 units: 20 rooms, 11 suites** | **٣١ وحدة: ٢٠ غرفة و١١ جناحًا** | | **31** |

The labels and identifiers above are **candidate category mappings**: Codex must inspect current routes, slugs, data contracts, redirects and CMS entities before adopting identifiers. Do not repurpose a shared 4–5-bed route to imply a precise split without an explicit compatibility plan. Prefer canonical durable category IDs with alias redirects that preserve old links, room selections and existing tour associations. The five **names/counts** are the owner-selected initial configuration; their exact technical slugs are not a separately approved migration plan.

### Important distinction: what is, and is not, independently verified

- Aggregate **31 total / 20 rooms / 11 suites** was explicitly owner-confirmed in `OWNER-DECISION-OVERRIDE-2026-11-17.md`.
- The exact **3 / 17 / 6 / 3 / 2 subtype breakdown** was drawn from `DAMOON-31-UNIT-DRAFT-RECONCILIATION-2026-11-17.json`, where many subgroup values were `QUESTIONNAIRE_TRANSCRIBED` or `MODEL_ASSUMED`. It is **now selected as an implementation default by the owner**, not retroactively proven as the original questionnaire's verified physical inventory.
- An accommodation category name such as “five-person suite” is **not** a verified legal occupancy, exact bed count, extra-bed policy, floor plan, amenity set or bookable stock count. Do not infer these fields. Category quantities are initial business configuration, not database proof of usable physical rooms.
- The historical 7 VIP / 17 standard / 7 studio categories were inconsistent with 20 rooms / 11 suites under the current descriptions. They are superseded as **numerical public presentation defaults**, but historical source material and previous PR evidence remain intact.
- The draft JSON explicitly said `databaseRoomTypesCreated:false`, `databasePhysicalRoomsCreated:false`, `saleableInventoryCreated:false`, `applicationAllowed:false`. This decision does not convert those assertions into permission for Production writes.

## Management dashboard is the future source of truth

1. Implement/edit categories through the **existing** hotel CMS and management service boundaries. Determine whether localized public description, commercial category counts and operational `HotelRoomType` / physical-room records are distinct. Do not build a competing room subsystem.
2. Authorized managers can edit localized category title, description, display order, count/status, hero/gallery/media associations and publication state, with validation, audit/version history and explicit publication approval where required. Authorized operational staff can adjust physical room assignments and occupancy only using the existing safe Hotel management workflow.
3. Public pages should read a **published, tenant- and property-scoped snapshot**, with a safe fallback during migration. Once managed data is active, avoid treating static `sites/damoon/content.js` numbers as the permanent authority.
4. A public **editable displayed quantity** must not silently mutate nightly capacity, create/delete physical rooms or reopen an occupied/maintenance-blocked room. Operational inventory is derived from eligible verified physical rooms, assignments, holds, maintenance and business constraints.
5. A change to room/suite split must be validated against the 31-unit aggregate (or explicitly update the aggregate as a reviewed owner change) and preserve identifier referential integrity, room links, tracking references, published content snapshots, rate plans and existing reservations.
6. Distinguish `DRAFT`, `REVIEW`, `PUBLISHED`, `REVOKED` states according to the existing CMS contract. Preserve independent reviewers where required. Show last updated, actor and revision. After publishing an authorized content edit, frontend presentation should update **without a new code deployment**.
7. Existing schema may not support the desired editorial data; inspect before implementing. Any necessary schema change may be developed and tested against disposable PostgreSQL but **Production migration stays gated**.

## Implementation sequence and no-go boundaries

- **P0 / Agent B:** stop removing the now-selected five category counts merely because old sources conflicted; reconcile any in-flight PR, implement or maintain multilingual public classification with old URL compatibility. Run focused/browser tests; submit the narrow change separately from other agents' work.
- **P1 / Agent B + CMS:** inventory currently available management fields, identify missing edit/publish capabilities, build minimal scoped workflow and test safe publication from the dashboard. If schema is blocked, report a separate gated migration dependency and still deliver schema-free UX/docs as feasible.
- **P2 / Agent A + C:** reconcile verified physical room identities and rates only after operator preflight; no automatic 31-record Production seed, no PR140 merge, no Production migrations from this decision.

Other owner decisions remain unchanged: arrival 14:00, departure 12:00, complimentary breakfast in an operational breakfast hall per 2026-11-20 update; no standalone operating restaurant or café; four verified VTour scenes only; request-only booking and noindex remain in force.

## Acceptance

- Site and dashboard show the same **selected baseline** once the approved content is published; FA/EN/AR consistent; aggregate math correct (3+17=20, 6+3+2=11).
- Existing slugs/aliases, selection state, CTA, dates, guests, VTour, contact and tracking links survive changes.
- Editing published category content in a disposable environment persists and is visible after an authorized publication without rebuilding code.
- Cross-tenant/cross-property access denied; authorized roles only; audit/revision and invalid count negatives tested.
- No added fake physical room codes, verified capacities, rate plans, guest records or availability; no Production write without separate permitted release.

**Priority:** This owner instruction supersedes the earlier “do not pick a subtype until the manager confirms it” instruction in `OWNER-DECISION-DELTA-2026-11-23.md`, `EXECUTION-ROADMAP-2026-11-23.md`, `CURRENT-STATE-2026-11-23.md` and `NEXT-AGENT-HANDOFF-2026-11-23.md`. Historical questionnaire/transcription records are preserved unchanged.
