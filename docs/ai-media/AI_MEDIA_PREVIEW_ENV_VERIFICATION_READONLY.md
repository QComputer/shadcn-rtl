# AI Media Preview Env Verification Readonly

Date: 2026-07-16

## Purpose

`BAZAR-BAZ-AI-NETWORK-PREVIEW-ENV-VERIFICATION-READONLY-01` adds source tooling for read-only Preview environment evidence review.

This phase does not mutate any environment. This phase does not deploy. This phase does not create AI jobs.

The goal is to prove that Preview database, Preview storage, and Preview AI media service identity are isolated from Production before any AI write flow is enabled.

## Boundaries

- No Vercel environment variables are changed.
- No Production database write is allowed.
- No Preview database write is allowed.
- No migration, seed, or `db push` is allowed.
- No Blob/storage list, upload, delete, or write is allowed.
- No Render write endpoint is called.
- No AI media job is created.
- No real generation is enabled.
- Browser must never call Render directly.
- Render credentials must stay server-side.

If the AI assistant does not have real Vercel/Preview environment access, it must not fake verification. Real Preview verification then requires human-provided env/runtime outputs with secrets redacted.

## Required Isolation

Preview DB must differ from Production DB. Use endpoint fingerprints or hashes, not full connection URLs.

Preview Blob/storage must differ from Production Blob/storage. Use storage identity fingerprints, not tokens.

Preview AI media service identity must differ from Production AI media service identity. Use the service URL/identity label without exposing internal keys.

Render credentials must remain server-side. Do not add `NEXT_PUBLIC_*` Render or AI media secrets.

AI write flows remain blocked until this verification and deployed Render contract pinning are green.

## Human Evidence Checklist

Provide the following evidence with all secrets redacted:

1. Preview deployment URL
2. Production deployment URL
3. Preview env summary with secrets redacted
4. Production env summary with secrets redacted
5. Preview DB endpoint fingerprint/hash, not full URL
6. Production DB endpoint fingerprint/hash, not full URL
7. Preview storage identity/fingerprint, not secret
8. Production storage identity/fingerprint, not secret
9. Preview AI media service URL/identity
10. Production AI media service URL/identity
11. Confirmation that Preview does not use Production Render identity
12. Confirmation that Preview does not use Production Blob/storage
13. Confirmation that no AI write flow is enabled

## Source Tooling

The pure helper is:

```text
lib/ai-media/preview-env-verification.ts
```

It accepts JSON-safe, human-provided evidence and returns:

- `ok`
- `blockers`
- `warnings`
- `evidenceSummary`

It does not perform network calls, database calls, Blob calls, or Render calls.

The validator is:

```text
scripts/quality/validate-ai-media-preview-env-verification.mts
```

Run:

```powershell
pnpm run test:ai-media:preview-env-verification
pnpm run quality:ai-media-preview-env-verification
```

## Evidence Rules

The verifier fails when:

- Preview and Production deployment URLs match.
- Preview and Production DB fingerprints match.
- Preview and Production storage fingerprints match.
- Preview and Production AI media service identities match.
- Preview exposes a public Render secret.
- Production exposes a public Render secret.
- Preview AI write flow is enabled.
- Production AI write flow is enabled for this verification phase.
- Render credentials are not confirmed server-only.
- raw secret-like evidence is supplied instead of safe fingerprints.

Missing evidence is a warning by default and a blocker in strict mode.

## Current Status

This phase adds the verification gate and documentation only. It does not prove the real Vercel Preview runtime by itself.

Real Preview environment verification remains pending until an operator supplies the evidence checklist or grants a separate read-only inspection path that does not expose secrets.

P07 remains blocked.
