# Kilo Code overlay delivery playbook

Version: 1.6 (2026-11-27) — repository delivery standard; includes G3-B1 detached execution, diagnostic CI and owner deployment decisions.
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


### G1-A lessons (2026-11-26)
- Report exact full SHAs and CI results from `gh pr view`, `gh run view` and `git rev-parse`; do not reconstruct or hardcode a summary's SHA suffix. Verify the current PR head and remote main before merge. No admin override.
- If `NODE_TLS_REJECT_UNAUTHORIZED=0` is inherited, remove only that insecure override from the current command environment; do not change persistent config, weaken TLS or expose secrets. Preserve unrelated files.
- For isolated Next HTTP acceptance use the existing reviewed Webpack harness where needed; never copy old `.next`, raise deadlines merely to hide failures, or report cancelled cases as passes. Preflight React purity for authored client components; actual project ESLint remains mandatory.

### PR184 lessons — mandatory pre-push typecheck (2026-11-26)
- This repository uses Base UI Button, not Radix Button. Inspect the actual component contract; for navigation use `Link` with `buttonVariants` rather than unsupported `asChild` or nested interactive elements.
- For functional TypeScript/TSX overlays, before commit/push require the exact candidate to pass Prisma client generation, Next route type generation (`next typegen`), and `tsc --noEmit` using existing locked dependencies and a sanitized synthetic environment. Prefer an isolated tracked-source snapshot to exclude pre-existing untracked user files and stale `.next` artifacts. Fail closed on any error; report the first causal diagnostic to the Main Agent. Do not substitute syntax transpilation, ESLint, `tsx` tests or a full build for this check.
- An isolated pre-push typecheck is not a substitute for the hosted acceptance gates. For a fix on an open PR verify the cumulative manifest against the original PR base and verify all required CI gates on the new exact head. Do not restart unrelated local regression suites unless affected.

### PR184 Fix2 lessons — snapshot completeness and execution names
- Canonical brand: `BazarBaaz`, lowercase `bazarbaaz`, Persian بازارباز, domain `bazarbaaz.ir`. Use these spellings in all new temp directories, identifiers, evidence and documentation. Never rename an active directory mid-execution or modify historical names solely for spelling.
- Exact staged-tree snapshots must include source JS/TS/JSX/TSX/JSON modules in `public` and `artifacts`, not only app/lib TypeScript; these are real module imports, not optional media. Use Git tree enumeration and literal pathspecs in bounded Windows-safe batches, verify critical imported blobs, exclude secrets/generated `.next`/untracked files. Never stub imports or exclude tests to silence tsc. Reuse the snapshot for typegen, full tsc and applicable tests when feasible.
- Shell invocations may re-inherit `NODE_TLS_REJECT_UNAUTHORIZED=0`. Remove the insecure process-scoped override in the SAME invocation as each runner/local check; keep TLS verification enabled. Do not modify persistent settings without approval.
- If GitHub read access fails, report the evidence as Kilo-reported, not independently verified. For an exact archived source candidate, compare all pinned base blobs and actual remote main in the real checkout before apply; stop on mismatch and return exact source. No admin bypass or inferred success.


### G1-B2 verified execution pattern (2026-11-26)
- Reported PR185 acceptance used one staged snapshot for full TypeScript and the focused unit/PG/HTTP profile (120/120), with four hosted gates auto-triggered. Reuse this pattern for G2. Dispatch only missing applicable gates, never duplicates; match full head SHA for every result. Preserve exact asset-module extraction and same-invocation TLS guard. Report independent upstream verification separately from executor evidence.


### G2-A execution evidence (2026-11-26)
- Executor reported full staged candidate acceptance 123/123 and PR186 four hosted gates, with two path-filtered workflows dispatched. Preserve the exact staged-tree TypeScript + unit/PG/HTTP acceptance pattern. Use the same active Kilo session while it follows instructions; no redundant full tests after an unchanged accepted candidate. Record warnings honestly; fix relevant new warnings within functional packages, not separate cleanup PRs. Keep brand spelling `bazarbaaz`; use TLS guard in each PowerShell invocation.


### G2-B execution evidence / DTO contract discipline (2026-11-26)
PR187 reported 135/135 tests plus four hosted gates on exact head; initial mandatory full TypeScript gate stopped TS2345 before commit. Match API DTO (Decimal strings), view formatter types and component contracts before shipping; explicit conversion only at the presentation boundary, never alter money persistence to satisfy a UI type. Retain pre-push full typecheck and exact staged-tree acceptance. Reuse unchanged evidence only when scope is demonstrably unchanged. For precommit fix preserve previous staged tree and update only authored paths. Use canonical `BazarBaaz` / `bazarbaaz` spelling and remove insecure TLS override in every new PowerShell shell. When Main Agent remote verification is unavailable, executor must verify actual gh/git SHA, runs and all exact base blobs before applying. Do not count skipped tests or production/HTTPS/PWA as accepted by local HTTP.

### G3-A1 delivery clarification (2026-11-27)
- Main Agent independently re-read GitHub PR188, exact main and five successful run heads using public GitHub API; use byte-exact archive files only after matching actual Git blobs. Record any main drift and stop before application.
- For a server-only authentication increment run full staged-tree Prisma generation, Next typegen, TypeScript, lint, and focused identity, USSD, SSO and existing HTTP regression cases. Do not rerun unrelated completed guest or hotel suites solely because of a new handoff. Preserve the staged candidate and stop after the first failed causal check. New or changed public journeys require their own isolated HTTP/browser acceptance; service-only tests do not establish that acceptance. No unattended commit/push/merge where owner has prohibited production changes; main auto-deploy remains a distinct gate.


### G3-A2 execution improvements — 2026-11-27 (owner-approved operating policy)

- Standing owner authorization: technically accepted PRs may be merged into main, including the ordinary automatic Git-based Runflare deployment that follows. The Main Agent still reviews exact final HEAD, required CI and applicable safety/activation gates; Kilo only merges within the supplied execution scope. Never use admin bypass. This is NOT authorization for manual deploy/restart, production configuration or DB access/migrations, feature activation, real SMS/OTP/payments, or Housekeeping. A PR with a migration or any new production mutation needs separate authorization before merge if automatic deployment could execute it.
- Session management: the Main Agent labels each task CONTINUE EXISTING SESSION or START NEW SESSION. Keep the same free Kilo model while reliable; use a short SHA-pinned checkpoint and a new session after a completed cohesive stage or stale/compacted context, conflicting assumptions, degraded execution or changed responsibility. No restart of completed work. G3-A2 begins a fresh session.
- Before expensive checks: verify synthetic fixture DNS in the test process, required ports and already-installed browser dependencies if browser acceptance is required. On Windows, use an allowlisted process-local resolver for only the exact synthetic `.localhost` names; preserve Host/Origin, leave hosts/system DNS/TLS intact. The accepted G3-A1 resolver verified all five synthetic hostname pairs. Do not map arbitrary production names.
- On first causal failure, stop, retain exact candidate tree, logs and evidence JSON. A Main Agent-authored scoped recovery runner may carry earlier PASS evidence only if tree, relevant test inputs/conditions, test counts and evidence integrity remain exact; no skipped/cancelled tests or assertion weakening. Rerun only the blocked/affected gates. Keep tool wall time separate from agent output time; report concise evidence, not repeated reasoning.
- Hosted gates: inspect automatically triggered runs first; dispatch missing path-filtered workflows only once on the exact branch/head. Verify every required workflow's exact headSha and success. Vercel Preview suspended/BLOCKED is not PASS. Never infer a green deployment from green CI.
- Runflare CLI 1.2.2 is authenticated on the operator machine. Read-only help/version and bounded status/event/log inspection only; do not follow logs indefinitely or use mutating commands. Current non-interactive `-y` uses a cached target, and status does not prove deployment metadata. Do not treat an unverified cached target or `Next.js Ready` log as proof of project 37622/service 87432 or deployed Git SHA. Report target, build SHA and deployment history as UNVERIFIED unless separately established by authorized provider metadata. Never read or disclose token files or secrets. No manual deployment, restart, DB or configuration mutation.
- If a fresh remote source-blob request fails, previously verified immutable merged tree plus exact accepted overlay and reconstructed source may be used for a provisional authored package; the executor MUST refresh origin/main and verify the pinned commit/tree, every replacement base blob and declared dependency blob before any write. Any mismatch blocks the entire apply. Report the limitation; do not claim fresh independent blob verification. No guessed edits or Kilo-authored fixes.

### G3-A2 browser routing preflight (2026-11-27)
- A green auth API does not prove the same tenant's page is reachable: API bypass and custom-domain/operational application path allowlists are distinct. For new auth routes, check exact public and operational route classifications for FA/EN/AR and unlocalized entry, including negative adjacent paths. Never widen a protected route to an arbitrary prefix merely to make a browser test pass.
- Before browser interaction, assert fixture resolver identity, document status and expected page shell; record sanitized route/config status and static chunk failure counts on failure. No sensitive request/response bodies, cookie/OTP/secret logs. Use the actual isolated Next port explicitly. Run the previously blocked journey early after fixture setup and before expensive full TypeScript; retain the full staged-tree typecheck before acceptance. Changes to shared routing invalidate affected browser/API and integration evidence; do not transfer PASS indiscriminately across changed trees. Preserve staged candidate and fix only exact authorized paths with a Main Agent-authored transition manifest.


### G3-A2 browser transport isolation (2026-11-27)
- Chromium `--host-resolver-rules` and Playwright `BrowserContext.request` are separate network transports. The latter may resolve through Node/OS independently of the browser. Do not assume a successful Node DNS smoke or a Chromium executable check validates both. For browser session acceptance use a real browser page in the same context/cookie jar, with the exact synthetic tenant URL and origin; never replace the tenant URL with a bare IP or inject a session cookie to get a green test.
- Before expensive fixture setup, exercise actual Chromium navigation and a cookie-backed session probe on the same synthetic hostname via a second tab. Use a fresh isolated loopback HTTP server, exact hostname allowlist and bounded timeouts. Keep the existing Node DNS smoke for Node HTTP suites. No persistent DNS, hosts or TLS changes.
- A second tab avoids races with SPA navigation after successful sign-in. Preserve real callback, CUSTOMER role, tenant ID, user ID and no-club assertions. Record only sanitized callback/session status and probe counts on failure; never record cookies, tokens, phone numbers or session bodies. A changed test blob requires fresh exact-tree acceptance, not unconditional carry-forward of prior PASS results.

### G3-B1 scope and deployment-evidence discipline (2026-11-27)
- After G3-A2 PR190 closure, start a NEW Kilo session on the same free model; exact main/tree and previous accepted evidence are provided by the package. Do not reopen prior work. For any core OTP change run the affected old and new unit, PostgreSQL and real HTTP/browser regression cases; the new service-only claim API is not publicly wired, so no claim browser journey is represented as accepted.
- Record claim must be a single exact record, explicit affirmative consent, independently validated customer session, actual tenant/origin and server-read browser cookie plus record-bound OTP. Never treat phone, generic proof, reference or a guessed record as authority. Preserve the original guest row and financial/booking snapshots, prevent repeat effects, reject existing owner and cross-tenant use. Claim outside the entire rolling guest creation budget (strictly older than its boundary), so a claim cannot free a current quota slot. Do not introduce a public route until trusted context and rate-limit/ingress, customer-owned projection and both success/failure browser journeys are reviewed. No source-authored changes by Kilo.
- Runflare owner browser can be read without mutating Production: service page https://portal.runflare.com/project/37622/service/87432 and linked Git page https://portal.runflare.com/project/37622/service/87432/git. Record target identity, active version, pod status, repo/branch and latest visible Git commit as distinct facts. Direct SHA-to-version mapping/deployment history require explicit provider evidence; owner confirmation must remain labeled owner-confirmed, not independent. For PR190, v167 and linked main e1fc64994e were observed; mapping owner-confirmed. Do not use cached CLI target or Ready log to infer SHA, and do not resolve old warnings by modifying production. Standing merge authorization, default-OFF flags and Housekeeping freeze remain.


### v1.6 — G3-B2 execution and acceptance (2026-11-27)
Not applied to tracked Playbook in this recovery (candidate must remain unchanged).
- Tool timeout is interruption, not a test failure; no automatic retry or cleanup.
- Run long deterministic acceptance via a single detached, one-use launcher, with explicit PID, logs, durable per-step evidence and final acceptance gate. Test timeout budgets remain unchanged. Detached survival under host job control must be verified, never assumed.
- Record resource ownership before/after creation, including exact local Docker context, random label and full container ID. Never remove a container by name alone; only explicitly authorized exact identity, with original runner absent. Never kill unverified processes.
- Interrupted run may carry prior results only with sufficient verified evidence tied to exact candidate and test conditions. Here prior final structured evidence was missing, so fresh complete acceptance is required.
- No deletion of old snapshots/orphans without separate verified ownership and authorization. No global housekeeping.
- Report ACTIVE/INTERRUPTED/LAUNCH_BLOCKED/finished separately. No duplicate runner, no removal of one-use lock. PowerShell TLS hygiene in every invocation.

- G3-B1 recovery passed 86/86 and all four hosted gates. Long acceptance uses a one-use detached launcher, durable per-gate evidence and exact staged manifest. The executor monitors using bounded read-only status commands until terminal status or 15-minute monitoring limit; never starts another runner on ACTIVE or destroys uncertain resources. On INTERRUPTED, preserve evidence and request Main Agent direction.
- Distinguish branch/path filters of workflows from individual job/step guards. PR191 Damoon workflow was dispatchable; only two operational steps are branch-guarded. On CI failure preserve exact head and original run/attempt, collect complete sanitized assertion and compare against pinned main if authorized. One controlled diagnostic rerun may be explicitly authorized; do not infer candidate regression or unrelated flaky failure from one observation. Never repeat other passed gates or weaken assertions.
- HOTEL-QA-001 remains OPEN: intermittent empty check-in date in hotel manual reception browser form. PR191 Hotel run 45920832895 attempt 1 failed, pinned baseline 45921366712 passed, attempt 2 on exact candidate passed without edits. Root cause unconfirmed. Keep failure history; separate hotel stabilization work when authorized.
- Runflare: service and linked Git pages established exact project/service, repo/branch, visible Git commit and active v167 for PR190; direct SHA-to-version mapping owner-confirmed. Do not infer deployment from CLI cached target. PR191 production deployment not independently verified.
- G3-B2 begins a NEW Kilo session; use same free model. No production flag activation. The public claim HTTP route requires all three explicit auth/progressive/guest-claim gates, a validated domain-bound CUSTOMER session, verified identity and original host-only guest cookie; scope never accepted from client. Discovery is bounded to 20 candidate rows per requested kind and exact core eligibility. Browser tests seed synthetic original-browser cookies and use real NextAuth and claim APIs; issuance alone uses an isolated fixture with no provider contact. Separate public order/appointment record claims from hotel, cross-browser recovery and real SMS readiness.
