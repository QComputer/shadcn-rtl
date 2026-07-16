# AI Handoff - Next Prompt

## Recommended Next Prompt

```text
PHASE: BAZAR-BAZ-AI-NETWORK-RENDER-CONTRACT-PINNING-READONLY-01

MISSION:
Pin the deployed Render AI media contract using read-only health/readiness/OpenAPI evidence, then decide whether the next implementation phase can move from source design to schema planning.

BASELINE:
The repository should be on main at or after 8a5253322ad43f2ec3ea22265eb7c619b5e2d86e, plus the local AI media platform domain foundation commit if it has been accepted.

CURRENT ACCEPTED SOURCE WORK:
- PRE-P07 AI media network status mapping.
- Preview isolation source gate.
- Preview env verification readonly gate.
- AI job mirror source design with pure TypeScript helper and validator.
- AI media platform domain foundation with import planning, Baz spend-hold planning, contribution mirror planning, and schema proposal docs.

RULES:
- No write flow is authorized: no AI writes, no Blob writes, no DB writes.
- Do NOT push unless the user explicitly asks.
- Do NOT deploy.
- Do NOT change Vercel env.
- Do NOT run production DB migrations.
- Do NOT add migrations unless the user starts a separate schema phase with explicit scope.
- Do NOT write to Production DB.
- Do NOT write to Preview DB.
- Do NOT write to Blob/storage.
- Do NOT create AI media jobs.
- Do NOT call Render write endpoints.
- Do NOT expose Render secrets to browser/client code.
- Do NOT add NEXT_PUBLIC Render secrets.
- Do NOT implement Baz wallet/ledger or real balance mutation.
- Do NOT implement worker portal.
- Do NOT implement Super Admin console.
- Do NOT implement desktop Control Center.
- Do NOT implement installer.
- Do NOT implement real generation.
- Do NOT add secrets.

TASKS:
1. Inspect baseline with git status, HEAD, and validation scripts.
2. Inspect Render health, readiness, and OpenAPI using read-only calls only if credentials/access are available.
3. Compare deployed contract fingerprint with the expected source contract.
4. Update docs with read-only findings and remaining blockers.
5. Run validation gates.
6. Commit only if green. Do NOT push.

FALLBACK:
If Render access is not available, do not fake verification. Document the missing read-only evidence and keep write compatibility pending.

ALTERNATIVE SAFE NEXT PHASES:
1. MOCK-safe Render deployment + deployed fingerprint pinning, if explicitly authorized.
2. Bazar Baz AI platform schema/migration planning only after Preview/Render gates are ready.
3. App-managed storage import implementation after schema and storage isolation.
4. Baz ledger implementation after schema planning approval.
```

## Fallback Note

Preview env verification tooling is available for redacted/human-provided evidence. If KiloCode/AI does not have Vercel/Preview access, do not fake verification. No AI write flow is allowed until Preview isolation and Render pinning are proven.
