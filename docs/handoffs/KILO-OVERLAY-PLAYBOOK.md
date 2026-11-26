# Kilo Code overlay delivery playbook

Version: 1.1 (2026-11-26) — repository standard proposed in 1C-F.
Scope: BazarBaaz platform, QComputer/shadcn-rtl. Hotel-specific gates below are the current PMS profile, not universal rules for every platform change.

## 1. Delivery contract

Speed is the primary delivery priority. Ship cohesive functional increments using existing architecture, tests and CI. Avoid unnecessary local builds, dependency downloads, repeated historical audits, separate routine documentation PRs and long conversational summaries. Do not trade away tenant isolation, authorization, inventory/financial correctness, integrity of authored source, or production boundaries.

The Main Development Agent owns analysis, architecture, source, tests, overlay generation and independent acceptance. Kilo Code executes the supplied package, focused checks, Git and CI operations; it does not redesign, write substitute code, change feature flags or weaken assertions unless the Main Agent explicitly provides a new scope. The owner directs product priorities and authorizes production operations. A new agent reads this playbook, AGENTS.md, the active platform handoff, and relevant module roadmap/status before proceeding.

The repository and exact SHA are authoritative; conversation summaries and old PRs are historical context. Use one active checkout and serialize Git operations as required by AGENTS.md. Same Kilo session is preferred while context remains reliable. If compacted context conflicts with current evidence, replace it with a short task checkpoint (accepted main SHA, current branch, overlay, stage, CI state, next action); do not repeat completed work. Start a fresh session with that checkpoint only when needed.

## 2. Main Agent: build the overlay

1. Refresh remote main/target PR and record the full 40-character base SHA and intended branch. Check applicable production and owner gates. For a fix overlay, pin the exact failed PR head and reuse its branch/PR. Do not assume the latest historical summary is current.
2. Obtain byte-faithful source from Git or the owner's source archive, plus accepted overlays as needed. Compare all replaced paths against Git blob metadata at the pinned base. If raw web retrieval changes text encoding or cannot verify a file, use an exact Git blob/source archive instead. Do not author against guessed source. When an archive is needed, prefer relevant tracked source and tests, excluding large assets, secrets and generated output; owner's upload ceiling is 20 MB per file.
3. Reuse current contracts and locked dependencies; read applicable Next documentation for this repository version. Read current tsconfig and package scripts. At this baseline, TypeScript target is ES2017: use `BigInt(...)` rather than bigint literals, preserve bigint semantics, and do not change target merely to repair a test. Inspect existing Playwright API contracts (use a string for APIRequestContext.get URLs), accessible names and FA/EN/AR translations. Preserve stable selectors and update tests when a deliberate UI contract changes.
4. Keep business changes, focused regression tests, and relevant existing roadmap/status changes in the same package. Include negative cases where material: tenant boundaries, unauthorized roles, atomic rollback, capacity, idempotency and stale versions. Do not claim local syntax transpilation is full TypeScript or DB acceptance. No speculative extra features solely to reach a fixed file count.
5. Check workflow `paths` filters against the proposed diff so required gates trigger. If a needed workflow is absent, explicitly resolve it using its existing dispatch capability or a justified scoped filter update. Do not label skipped/absent gates PASS.
6. Build a minimal ZIP with `README.md`, `PROMPT-FOR-KILO.md`, `manifest.json`, `apply.mjs`, and `payload/<repository-relative-path>` for every new/replaced tracked file. No dependencies, archives of old work, .env, tokens, private fixtures or unrelated files. Prefer UTF-8 without BOM and LF for authored text, preserving existing Git attributes/clean filters. Use binary reads/writes. Record actual checks and unexecuted checks in README.
7. Independently validate the package (ZIP integrity, exact path set, SHA256, Git blob, UTF-8, syntax, selected tests). Exercise apply/stage/commit in a disposable Git fixture when possible. Clearly label what was not tested. Never claim a check passed merely because it is scripted.

## 3. Package contract (compatible with 1C-E manifest)

Manifest fields: `baseCommit`, `branch`, and `files[]` with `path`, `operation` (`add` or `replace`), `expectedBaseBlob`, `baseNormalizedSha256`, `payloadBytes`, `payloadSha256`, `expectedIndexBlob`. For additions, both base fields are null. Base SHA256 may normalize CRLF to LF for UTF-8 text; Git base blob is still checked independently. Payload SHA256 is byte-exact, and expected index blob is the authored Git blob after intended clean-filter handling. Reject duplicate or unsafe paths, path traversal, absolute paths, Windows drive/ADS paths, symlinks (including parent components) and unexpected existing files. A deletion/rename/binary package needs an explicitly supported schema and validation, not an implicit workaround.

Protocol 1.1 modes: `--verify-package`, `--check`, `--apply`, `--stage`, `--verify-staged`, `--local-checks`, `--verify-commit`. `--stage` was validated on PR181 CI Fix1. `--local-checks` runs the reviewed manifest commands, stops on nonzero exit, and checks the staged index before and after. The Main Agent tests runner guards locally; Windows execution and hosted checks still need evidence. Do not silently change existing package semantics or expect older ZIPs to support new modes. Use a protocol version for new manifest formats.

Required behavior:

- Verify ZIP/payload byte hashes, valid UTF-8 and expected blobs; verify repository root, branch and base commit. Check all target working paths before writing; refuse overlapping local modifications or pre-existing staged changes. Do not clear another agent's staging.
- Apply only declared paths with `fs.writeFileSync(path, buffer)` or equivalent byte copy. Verify bytes and Git clean-filter result after apply. Never pass source text through PowerShell Get-Content/Set-Content/Out-File, clipboard, editor or lossy web extraction.
- `--stage` must preflight exact base/branch and working payload; refuse unrelated pre-existing index changes, allow already staged intended files only when their blobs match, then run Git with literal pathspecs using separate arguments (`git --literal-pathspecs add -- <manifest paths>`). Immediately verify exact staged path set and index blobs. No `git add -A`, `git add .`, global reset or clean.
- `--verify-commit` checks exact parent, complete changed-path set and committed blobs. For current single-commit packages, parent must be the pinned base. Fail closed on drift. On CI fix overlays, validate only the fix commit against its own base and also retain/check the combined PR scope against the original package plus approved fix.
- Preserve all unrelated untracked/modified files. A CRLF warning alone is not a failure if normalized base bytes and expected Git blobs agree. Never globally change Git line-ending settings to silence it.

## 4. Kilo execution — Windows PowerShell

Every package prompt must contain exact commands (not just “run tests”), exact base/branch, expected result count, lint paths, commit message, CI requirements and failure/stop conditions. Use the package script's absolute path while working from the repository root. Stop on nonzero exit; do not continue a chained sequence after failure. Kilo checks `$LASTEXITCODE` for native commands when needed.

Typical flow (substitute package-specific variables; do not copy placeholders literally):

```powershell
$pkg = 'C:\path\to\extracted-overlay'
$apply = Join-Path $pkg 'apply.mjs'
git status --short
git rev-parse HEAD
git branch --show-current
node $apply --verify-package
# Verify the exact base, then create the declared branch if not already on it.
node $apply --check
node $apply --apply
# Protocol 1.1: node $apply --stage
# For legacy packages, explicit manifest-only staging (after checking index is empty):
$m = Get-Content -Raw -LiteralPath (Join-Path $pkg 'manifest.json') | ConvertFrom-Json
$paths = @($m.files | ForEach-Object { [string]$_.path })
git --literal-pathspecs add -- @paths
node $apply --verify-staged
# Protocol 1.1: node $apply --local-checks
# Legacy packages: execute exact package-specific focused test and lint commands.
git diff --cached --check
node $apply --verify-staged
# Commit using the supplied message; verify before pushing.
node $apply --verify-commit
```

`Get-Content` above reads only manifest metadata; never use it to rewrite source bytes. For 1C-E, the exact unit command is `pnpm exec tsx --test tests/unit/hotel-reception-professional.test.ts` (10 tests). For packages with server-only imports, use the existing `--require=./scripts/e2e/register-server-only.cjs` where required by the actual test. MJS tests may use `node --test`; inspect existing test imports and workflows rather than guessing. Lint the exact relevant paths with `pnpm exec eslint ...` (for literal bracketed filenames, use the installed ESLint API or a tested escaping strategy). For syntax-only MJS checks, `node --check <file>`. Do not run Jest for `node:test`, invoke `npx` to fetch missing test tools, or use Unix `tail` in PowerShell (use `Select-Object -Last` if necessary, and retain full failure output). Use already installed locked tooling; if missing, report it or use the approved frozen-lockfile installation only when necessary. Do not disable TLS verification; never print secrets.

If wrong files were staged during this task, unstage only the task-owned accidental changes using explicit paths, preserving the working files and any pre-existing staged changes. If ownership is uncertain, stop. Do not rerun apply on an already applied package. Resume at the first uncompleted step, after checking actual state.

## 5. Hosted acceptance and failure handling

Push the verified commit and open one PR. For current Hotel PMS packages require the following four hosted gates on the final PR head (or verified equivalent merge-tree evidence for a deliberately dispatched supplemental run):

| Gate | Workflow |
|---|---|
| RunFlare TypeScript | `.github/workflows/runflare-typecheck.yml` |
| focused-regressions | `.github/workflows/retail-damoon-regressions.yml` |
| hotel-phase1-operational-pg | `.github/workflows/hotel-phase1-operational-pg.yml` |
| request-to-reception | `.github/workflows/damoon-booking-acceptance.yml` |

Verify exact SHA, job conclusion and scope; pending, skipped, cancelled, absent and failed are not pass. The known suspended Vercel Preview is a separate blocked status, not a PASS; preserve the exception only while applicable and permitted by repository rules. Never bypass protections. For other modules, use their existing applicable acceptance profile, not all hotel workflows indiscriminately. If a gate is missing, dispatch on the exact branch/head if possible before merge; check the returned SHA. Do not create a documentation-only PR to trigger CI. Avoid rerunning unchanged successful evidence merely for investigation; after a fix obtain required acceptance on the new final head.

On failure, stop and report full head SHA, gate/job URL, first meaningful error, exact assertion/source line, expected vs actual, relevant sanitized stack/server/browser evidence and blob state. Retrieve complete logs via authenticated `gh run view <run-id> --job <job-id> --log` or `--log-failed`; inspect available artifacts, not just timeout summaries. No substitute source, new feature flags, increased timeouts or weakened tests. If evidence is unavailable, state what is missing. Main Agent independently distinguishes source/encoding corruption, fixture/test error, real runtime failure, trigger issue or environmental problem; produces a scoped fix overlay on the same PR. The PR178 incident showed that a label timeout can be mojibake rather than a disabled feature; compare exact blobs before changing UI labels or flags.

## 6. Merge, release and handoff

Merge only after required acceptance and repository rules permit; do not merge duplicate historical PRs or change a completed phase based on stale context. Record PR URL, original base, accepted head, merge SHA and current main separately (squash and merge commits differ from PR head). Main Agent independently reads GitHub metadata, checks gate conclusions and relevant final blob(s); verify full manifest in main when integrity risk warrants it. Report tool/access limitations honestly. A successful CI run is not proof of live deployment, production migration or payment acceptance.

No production DB migration or mutation, real payment activation, SMS, or production configuration changes without explicit authorization. For schema changes, check the actual deployment/migration behavior before merge: if merge could auto-apply a production migration or start a dependent feature without authorization, resolve the release gate first. Use disposable PostgreSQL for migration tests. Current PMS boundary: stop before any Housekeeping implementation; owner defines intervening phase and explicitly authorizes resumption.

Update applicable roadmap/status and active handoff with delivered scope, remaining scope, known blockers and next action in the next functional PR. Do not claim the current PR is merged before merge; reference actual PR/Git history for final evidence. Keep the final Kilo report compact:

```text
PR / branch / base / exact accepted HEAD / merge SHA / current main
Manifest: staged + committed blobs (count, result; details if mismatch)
Local: exact focused command(s), outcome; unexecuted checks
CI: required gates, URLs, SHA, result; known exceptions separately
Schema: migration identifier and disposable-CI evidence if applicable
Production: no changes or separately authorized evidence
Next: stop; or exact blocking error with full diagnostics
```

## 7. Maintenance of this playbook

This document is the single reusable process reference. AGENTS.md links to it; module docs contain module-specific status, not another full copy of the process. Version and update this document in the next relevant functional PR when a repeated failure or a verified improvement warrants it. Keep protocol changes backward-compatible or explicitly versioned. No separate PR solely for routine bookkeeping. Prefer deterministic script improvements over longer prompts. Track avoidable CI cycles, unnecessary installs and accidental staging qualitatively; optimize actual delivery latency, not the number of steps alone.

### Change history

- v1.0: consolidates PR174 (ES2017/BigInt), PR175 (Playwright URL and accessible names), PR176 (workflow paths), PR178 (UTF-8 and blob integrity), PR179/180 (accepted guarded delivery), and 1C-E execution incident (stale session, accidental staging, wrong test runner, unnecessary install).

- v1.1: PR181 verified manifest-exclusive `--stage`; exact node:test invocation replaces Jest guessing; local-check runner introduced in 1C-F. Read SHA values from gh/git, not reconstructed from abbreviated hashes. Before claiming root cause, capture API error body and verify mutable fixtures (room out-of-service state, price fallback) against prior steps. Keep GitHub access failures separate from reported acceptance. If a local Playbook copy exists at the singular `docs/handoff/` path, preserve it; canonical tracked path is `docs/handoffs/`.
