# Bazarbaaz Delivery Roadmap

Updated: 2026-11-13. Short execution sequence; acceptance evidence belongs to the exact source SHA and environment that produced it.

| Order | Milestone | Acceptance gate | Status |
|---|---|---|---|
| 1 | PR64 Damoon guest request and reception workflow | Disposable PostgreSQL 17, real Next API plus standalone bridge, Chromium flow in FA/EN/AR, persistence, idempotency, reception update, negative tenant/origin/auth cases, no reservation/payment | Focused workflow and tests prepared; local Node acceptance 13/13 PASS; hosted PostgreSQL/browser **NOT_VERIFIED** |
| 2 | Review and merge PR64 | All required Actions checks pass on final SHA, acceptance evidence attached, PR reviewed and merged under repository rules | Not started |
| 3 | Controlled Hotel operational-readiness package | Independently verify publication approval, inventory, tenant domain/routing, staffing and safe feature-gate plan; no automatic Production activation | Not started; owner approval required for Production changes |

## Delivery constraints

- Keep guest accommodation requests distinct from confirmed reservations and payments.
- Use locked dependencies and ephemeral CI fixtures. Do not run expensive local builds or install dependencies while disk space is critically low.
- Preserve PR60, PR62, PR59 and all unrelated worktrees/files. Stage only task-owned paths.
- No Production database, Runflare settings, live booking, payment, SMS or `main` changes without the applicable owner authorization.
- Keep the UI scoped to necessary workflow behavior; avoid broad redesign and duplicate booking logic.
