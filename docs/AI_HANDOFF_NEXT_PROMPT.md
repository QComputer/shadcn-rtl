# AI Handoff - Next Prompt

## Recommended Next Prompt

```text
PHASE: BAZAR-BAZ-AI-NETWORK-PREVIEW-MOCK-WRITE-E2E-FOUNDATION-01

MISSION:
Build the first Preview-only MOCK write E2E foundation for Bazar Baz AI media, using the pinned Render contract and strict isolated Preview resources. This is the first phase that may authorize AI write flow, and only inside Preview with explicit safeguards.

BASELINE:
The repository should be on main at or after `43034edf745fd52c4f9613e342c4ef4f909bfb68`, plus the pinned Render contract read-only verification commit if it has been accepted.

CURRENT ACCEPTED SOURCE WORK:
- PRE-P07 AI media network status mapping.
- Preview isolation source gate.
- Preview env verification readonly gate.
- AI job mirror source design with pure TypeScript helper and validator.
- AI media platform domain foundation with import planning, Baz spend-hold planning, contribution mirror planning, and schema proposal docs.
- Pinned Render MOCK contract read-only verification from the Bazar Baz side.
- Pinned Render URL: `https://bazar-baz-ai-media-service.onrender.com`
- Pinned OpenAPI fingerprint: `8bed184dd79980beacc553308652a44d99590c9705b7d37ab9418f4f83868f91`
- Pinned OpenAPI counts: 42 paths, 40 schemas.
- Render provider expectation: `MOCK`; real generation remains blocked.
- shadcn-rtl verifier uses the same fingerprint algorithm as ai-media-service: sorted compact `app.openapi()` JSON, UTF-8 SHA-256, and FastAPI/Pydantic `.0` numeric constraint preservation.

RULES:
- No write flow is authorized outside isolated Preview MOCK-only scope.
- Write flow must remain Preview-only and MOCK-only.
- Do NOT touch Production DB.
- Do NOT touch Production Blob/storage.
- Do NOT change Vercel env.
- Do NOT run production DB migrations.
- Do NOT add migrations unless the user starts a separate schema phase with explicit scope.
- Do NOT write to Production DB.
- Do NOT call real generation.
- Do NOT call Render worker claim/result/progress endpoints.
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
2. Re-run the pinned Render read-only checker before enabling any Preview write flow.
3. Verify isolated Preview DB/storage/AI identity evidence.
4. Add the smallest Preview-only MOCK write E2E foundation authorized by the phase.
5. Keep browser-to-Render direct access forbidden.
6. Run validation gates and document remaining blockers.

FALLBACK:
If Render access is not available, do not fake verification. Document the missing read-only evidence and keep write compatibility pending.

ALTERNATIVE SAFE NEXT PHASES:
1. Bazar Baz AI platform schema/migration planning only after Preview/Render gates are ready.
2. App-managed storage import implementation after schema and storage isolation.
3. Baz ledger implementation after schema planning approval.
```

## Fallback Note

Preview env verification tooling is available for redacted/human-provided evidence. If KiloCode/AI does not have Vercel/Preview access, do not fake verification. No Production write flow is allowed until Preview isolation, pinned Render contract verification, and explicit write-flow rules are all proven.
