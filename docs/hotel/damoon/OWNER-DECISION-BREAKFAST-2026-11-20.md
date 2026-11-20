# Hotel Damoon — breakfast hall owner decision update

Date: **2026-11-20**

Authority: **explicit direct owner confirmation**

Status: **OWNER_APPROVED_PUBLIC_CONTENT — PENDING_APPLICATION_AND_DEPLOYMENT**

## Current confirmed facts

1. **The guest breakfast hall is ready for use and operational.**
2. **Breakfast is complimentary (free of charge) for hotel guests.**
3. Serving hours are not confirmed. Ask reception; do not publish assumed hours or service details.
4. This confirmation does not mean the hotel operates a restaurant, banquet hall, or standalone café. Café-style refreshments are served to guests in rooms.

## Authority and reconciliation

This owner confirmation supersedes the November 17 `UNDER_PREPARATION` / `not operational` statements only for the breakfast hall and complimentary guest breakfast in `OWNER-DECISION-OVERRIDE-2026-11-17.md`, `DAMOON-31-UNIT-DRAFT-RECONCILIATION-2026-11-17.json`, and earlier snapshots. Historical files preserve their original dated evidence; this dated update is the current source of truth. Do not infer a broader dining operation.

## Application scope

- Public Damoon content in fa/en/ar, including `/restaurant`, `/facilities`, and accommodation descriptions.
- Regenerate and synchronize `public/damoon-front` assets and `release-manifest.json` with the supported `sites/damoon/build.mjs` workflow.
- Update owner-public-content tests and verify old unavailable/preparation claims are absent from current guest-facing output.
- Do not alter accommodation counts, room data, rates, availability, cancellation policy, booking gates, payments, or database records.
- Verify the live deployment independently before changing this document's pending status.
