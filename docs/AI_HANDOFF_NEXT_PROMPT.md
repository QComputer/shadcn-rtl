# AI Handoff — Next Prompt

## Recommended Next Prompt

```
PHASE: BAZAR-BAZ-AI-NETWORK-RENDER-CONTRACT-PINNING-READONLY-01

MISSION:
Pin the deployed Render AI media contract using read-only health/readiness/OpenAPI evidence, then decide whether the next source-only phase should be AI job mirror design.

BASELINE:
The repository should be on main at or after a890a0fb88f718b1e269e519e7d87d4360f7035f, plus the local Preview env verification tooling commit if it has been accepted.

RULES:
- No write flow is authorized: no AI writes, no Blob writes, no DB writes.
- Do NOT push.
- Do NOT deploy.
- Do NOT change Vercel env.
- Do NOT run production DB migrations.
- Do NOT add migrations.
- Do NOT write to Production DB.
- Do NOT write to Preview DB.
- Do NOT write to Blob/storage.
- Do NOT create AI media jobs.
- Do NOT call Render write endpoints.
- Do NOT expose Render secrets to browser/client code.
- Do NOT add NEXT_PUBLIC Render secrets.
- Do NOT implement Baz wallet/ledger.
- Do NOT implement worker portal.
- Do NOT implement Super Admin console.
- Do NOT implement desktop Control Center.
- Do NOT implement installer.
- Do NOT implement real generation.
- Do NOT add secrets.

TASKS:
1. Inspect baseline with git status, HEAD, and validation scripts.
2. If operator evidence is available, run Preview env verification tooling with redacted fingerprints only.
3. Inspect Render health, readiness, and OpenAPI using read-only calls only if credentials/access are available.
4. Compare deployed contract fingerprint with the expected source contract.
5. Update docs with read-only findings and remaining blockers.
6. Run validation gates.
7. Commit only if green. Do NOT push.

FALLBACK:
If Vercel/Preview access is not available, do not fake verification.
Document that human-provided outputs are required.
Proceed only with source-safe AI job mirror design docs if asked.
```

## Fallback Note

Preview env verification tooling is available for redacted/human-provided evidence. If KiloCode/AI does not have Vercel/Preview access, do not fake verification. No AI write flow is allowed until Preview isolation and Render pinning are proven.
