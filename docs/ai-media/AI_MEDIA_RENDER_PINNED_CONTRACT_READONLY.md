# AI Media Render Pinned Contract Read-Only Verification

Date: 2026-07-16

## Pinned Render Contract

- Deployed URL: `https://bazar-baz-ai-media-service.onrender.com`
- Expected OpenAPI fingerprint: `8bed184dd79980beacc553308652a44d99590c9705b7d37ab9418f4f83868f91`
- Expected OpenAPI path count: `42`
- Expected OpenAPI schema count: `40`
- Expected provider: `MOCK`
- Expected real generation state: disabled
- P07 status: blocked
- ai-media-service source commit: `7c2381fb7041fcfc9627600240fc203ac5493f55`
- ai-media-service docs commit that pinned deployment: `96dd5c4ab80ed14498c46d441502ce48a68e1fbb`

## What ai-media-service Proved

The service-side verification reported:

- `GET /health`: `200`, body shape equivalent to `{"status":"ok"}`
- `GET /ready`: `200`, provider `MOCK`, database ok, CUDA not required, GPU worker offline
- `GET /openapi.json`: `200`
- OpenAPI surface: `42` paths and `40` schemas
- Local/source and deployed OpenAPI fingerprints match the pinned fingerprint above

## What shadcn-rtl Verifies

`shadcn-rtl` now has a read-only pinned contract helper and quality gate:

- `lib/ai-media/pinned-render-contract.ts` stores the expected deployed URL, fingerprint, counts, provider, and blocked P07 state.
- `lib/ai-media/render-contract-verification.ts` computes a deterministic OpenAPI fingerprint and validates supplied read-only evidence.
- `scripts/quality/validate-ai-media-render-contract-readonly.mts` fetches only `/health`, `/ready`, and `/openapi.json`, then compares the deployed evidence to the pinned contract.
- `tests/unit/ai-media-render-contract-readonly.test.ts` uses mocked evidence and does not require live Render.

The fingerprint helper intentionally matches the ai-media-service algorithm:

- source algorithm: `sha256(json.dumps(app.openapi(), sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))`
- shadcn-rtl equivalent: recursively sort object keys with raw lexicographic ordering, stringify without spaces, hash UTF-8 bytes with SHA-256
- FastAPI/Pydantic numeric schema constraints that are emitted as integer-valued floats, such as `minimum: 1.0` and `maximum: 6.0`, are serialized with `.0` so JavaScript does not collapse them to `1` and `6`
- volatile endpoint response bodies are not included in the fingerprint; only `/openapi.json` is hashed

The previous mismatch was caused by JavaScript canonicalization parity: object keys were initially sorted with locale collation and parsed `1.0`/`6.0` schema constraints were emitted as `1`/`6`. Path and schema counts matched, but the byte-exact canonical OpenAPI string did not.

The live checker must fail closed if:

- `/health` is not `200`
- `/ready` is not `200`
- `/openapi.json` is missing or not JSON
- the deployed fingerprint differs from the pinned fingerprint
- path or schema counts drift
- the provider is not `MOCK`
- CUDA becomes required for this MOCK coordinator gate
- real generation is reported ready or enabled

## Safety Boundary

- Browser code never calls Render directly.
- Render credentials remain server-side.
- This phase does not use Render credentials.
- This phase does not call Render job creation, worker claim, worker progress, worker result, cancel, or any other mutation endpoint.
- This phase does not create AI jobs.
- This phase does not write to Production DB.
- This phase does not write to Preview DB.
- This phase does not write to Blob/storage.
- GPU worker offline is acceptable for the MOCK coordinator readiness gate.
- Render is a MOCK coordinator only for this phase.
- Real generation remains blocked.
- Bazar Baz write flows remain blocked until a separate Preview write E2E phase explicitly authorizes them.
- P07 controlled Production import remains blocked.
