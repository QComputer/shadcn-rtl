# Retail UI E2E recovery (2026-11-10)

## Recovered artifacts

The Nov 9 temporary artifacts were preserved in the verified private recovery
ZIP recorded in `MASTER-TAKEOVER-2026-11-10.md`. Original identities:

| Source artifact | Original SHA-256 | Original bytes |
| --- | --- | ---: |
| `retail-ui-e2e.spec.ts` | `BD18D24BE8986556699D8EAFCEF34476481558818615475685B418A4766E612E` | 11,100 |
| `playwright.config.ts` | `C2519B242312B3FDEC213133ED903946A37DD61145F18EF5D3DCA5103AA2C800` | 399 |
| `seed.mts` | `1A04B91A3DC56BEE1D37EED48C9A58CAC236D82B05BA7B63493C472CFA01E9DC` | 7,022 |
| `retail-ui-e2e-runner.mjs` | `34BA75915665FA1630BEECB1C44BDB1B7B4F6A8DDB006652211E7571E4BFCECD` | 12,536 |

The maintained Playwright executable is `tests/e2e/retail-recovery/retail-ui-e2e-runner.mjs`;
the duplicate original spec/config stay in the private archive. It covers product
creation and editing with save/reload, custom colors/sizes, exact cart persistence,
real cross-tenant denial, XLSX upload/preview/execution and a mobile RTL viewport.
The guarded seed checks connected DB identity, an empty organization table and
an empty user table before writing. Fixture IDs use valid CUID syntax. Negative
cart requests use a valid existing variant in the wrong real tenant, with a valid
same-origin header: malformed IDs or CSRF rejection cannot establish this gate.

The source temp artifacts were ignored/untracked recovery material. Their hashes identify the originals; the guarded copies have intentional changes and are not byte-identical.

## Safety boundary

`safety.mjs` fails closed unless the caller sets `RETAIL_RECOVERY_DISPOSABLE=true`, `LOCAL_PRISMA_EXPECTED_PORT=5436`, and `DATABASE_RUNTIME_ADAPTER=postgresql`; pins the app to `http://127.0.0.1:3107`; and proves both `DATABASE_URL` and `DIRECT_URL` point to the same `127.0.0.1:5436` database named by `E2E_DATABASE_NAME`, matching `retail_ui_e2e_*`. Only an optional `schema=public` query parameter is allowed. Production indicators and all endpoint/name mismatches are rejected. The guard never prints URL values.

Use `scripts/e2e/retail-recovery-local.mjs` to create a fresh random database and
drop only that database in finally. It reads credentials internally from the local
`pg-cron` PostgreSQL container, connects only to loopback:5436, refuses an occupied
app port and never reuses an existing app server or database. No credentials are
printed or written to evidence. Never run the seed against a shared, hosted,
Production or pre-existing database.

## Prior blocker and evidence boundary

The Nov 9 dev server reached Ready on loopback port 3107, but its server logs show repeated Prisma P1001 failures to connect to PostgreSQL on loopback port 5436, including Auth.js `user.findMany()` and organization/product lookups. The run therefore did not establish whether credentials or the Retail UI flows work. Screenshots show skeleton pages. `test-results/.last-run.json` records failure without named failed tests. Treat this as a DB-availability blocker and incomplete UI acceptance, not a passing login or browser result.

The current recovered orchestration may use a newly created database such as `retail_ui_e2e_20261110_main`; exact endpoint credentials must be passed only through the local process environment and must never be printed or recorded here. No database, server, build, or install operation was run while preparing this recovery.

## Commands

After a successful isolated local build, run with Node 24 and existing repository
dependencies, Docker `pg-cron` published on 5436, and installed Windows Chrome:

```powershell
& 'C:/Users/disso/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' scripts/e2e/retail-recovery-local.mjs --disposable-local --built
```

This runs migrations, guarded fixtures, the Cafe catalog/order regression and
all six browser scenarios. `--built` starts the locally built app with optimized
runtime behavior, bound to 127.0.0.1:3107 and its new disposable database. It does
not deploy anywhere. Omitting `--built` selects development mode; the former dev
runs exposed hydration/refresh timing and are not the authoritative acceptance.

The guard itself can be checked without starting the app or connecting to PostgreSQL:

```powershell
pnpm exec node --test tests/e2e/retail-recovery/safety.test.mjs
```

Each run writes `.tmp/retail-recovery/<stamp>/result.json` containing source SHA,
dirty-state marker, command exit codes, browser results and cleanup. Accept only
`status=PASSED`, `exitCode=0`, `cleanup=PASSED`, and six passed browser scenarios.
`browser-results.json` contains per-scenario evidence; screenshots and a token-free
import preview are retained beside it. The source snapshot remains dirty because
inherited owner changes are preserved. Public HTTPS, real merchant/payment,
physical Android/PWA and deployed Restaurant/Cafe remain separate acceptance.
