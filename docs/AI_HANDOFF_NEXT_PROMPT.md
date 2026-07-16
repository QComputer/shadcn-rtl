# AI Handoff — Next Prompt

## Recommended Next Prompt

```
PHASE: BAZAR-BAZ-AI-NETWORK-PREVIEW-ENV-VERIFICATION-READONLY-01

MISSION:
Verify Preview env separation for Bazar Baz AI Media Network using read-only diagnostics only.

BASELINE:
The repository should be on main at or after 40d2b2d60e64597fc9628819ebc2458d5749df96.

RULES:
- Do NOT push.
- Do NOT deploy unless explicitly authorized.
- Do NOT change Vercel env.
- Do NOT run production DB migrations.
- Do NOT add migrations.
- Do NOT write to Production DB.
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
2. Add a read-only Preview env verification script that:
   - checks VERCEL_ENV / NODE_ENV classification
   - verifies Preview DATABASE_URL is not Production
   - verifies Preview BLOB_READ_WRITE_TOKEN is not Production
   - verifies Preview AI_MEDIA_SERVICE_URL is not Production
   - reports findings as diagnostics only
   - does not mutate anything
   - does not call external services unless explicitly safe and read-only
3. Add or update docs with Preview verification results.
4. Run validation gates.
5. Commit only if green. Do NOT push.

FALLBACK:
If Vercel/Preview access is not available, do not fake verification.
Stop and document that human-provided outputs are required.
Proceed with source-only AI job mirror design docs instead.
```

## Fallback Note

If KiloCode/AI does not have Vercel/Preview access, do not fake verification. Stop and ask for human-provided outputs. Proceed with source-only AI job mirror design docs instead. No write flow until Preview isolation and Render pinning are proven.
