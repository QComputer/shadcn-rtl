// Apply only the reviewed Retail theme/media migration; never scan shared history.
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { resolveDatabaseRuntimeConfiguration } from "../../lib/database-runtime-config.ts";

export const MIGRATION_NAME = "20261104093000_retail_theme_image_derivatives";
export const MIGRATION_SHA256 = "4bdd69e53ba42b7bfdfc876d0984913b44d183873efea40ea6e18816ca112b62";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const EXPECTED_COLUMNS = [
  { table: "ProductCategory", column: "darkImage" },
  { table: "Image", column: "derivatives" },
];

function parseArgs(argv) {
  const [databaseName, mode, ...rest] = argv;
  let migrationFile;
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] !== "--migration-file" || migrationFile || !rest[index + 1]) {
      throw new Error("Usage: node scripts/db/deploy-retail-theme-media.mjs <verified-database-name> --apply [--migration-file <verified-sql-file>]");
    }
    migrationFile = rest[index + 1];
    index += 1;
  }
  if (!databaseName || mode !== "--apply" || !/^[A-Za-z0-9_-]+$/.test(databaseName)) {
    throw new Error("Usage: node scripts/db/deploy-retail-theme-media.mjs <verified-database-name> --apply [--migration-file <verified-sql-file>]");
  }
  return { databaseName, migrationFile };
}

function loadMigration(migrationFile) {
  const file = migrationFile ? resolve(migrationFile) : join(ROOT, "prisma/migrations", MIGRATION_NAME, "migration.sql");
  let sql;
  try { sql = readFileSync(file, "utf8").replaceAll("\r\n", "\n"); }
  catch { throw new Error("Reviewed Retail theme/media migration SQL is unavailable."); }
  const checksum = createHash("sha256").update(sql).digest("hex");
  if (checksum !== MIGRATION_SHA256) throw new Error("Retail theme/media migration SQL checksum does not match the reviewed migration.");
  return sql;
}

/** Preflight through the locked pg dependency without exposing the connection string. */
export async function inspectTarget(client, expectedDatabaseName, expectedChecksum = MIGRATION_SHA256) {
  const identityResult = await client.query(`
    SELECT current_database() AS database_name,
      current_user AS database_user,
      pg_is_in_recovery() AS is_replica,
      current_setting('transaction_read_only') AS transaction_read_only,
      has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_in_database,
      has_schema_privilege(current_user, 'public', 'USAGE') AS can_use_public,
      has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_in_public,
      current_setting('server_version') AS server_version,
      to_regclass('public._prisma_migrations') IS NOT NULL AS has_migration_ledger
  `);
  const identity = identityResult.rows[0];
  if (!identity || identity.database_name !== expectedDatabaseName) throw new Error("Connected database does not match the explicitly verified database name.");
  if (identity.is_replica || identity.transaction_read_only === "on" || !identity.can_create_in_database || !identity.can_use_public || !identity.can_create_in_public) {
    throw new Error("Target is not a writable primary with the required public-schema privileges.");
  }

  const columnsResult = await client.query(`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND ((table_name = 'ProductCategory' AND column_name = 'darkImage')
        OR (table_name = 'Image' AND column_name = 'derivatives'))
  `);
  const columns = columnsResult.rows;
  const present = new Map(columns.map((column) => [`${column.table_name}.${column.column_name}`, column]));
  const columnPresence = EXPECTED_COLUMNS.map(({ table, column }) => {
    const found = present.get(`${table}.${column}`);
    if (found && (found.is_nullable !== "YES" || !["text", "jsonb"].includes(found.data_type))) {
      throw new Error(`Target column ${table}.${column} has an incompatible type or nullability.`);
    }
    return { table, column, present: Boolean(found) };
  });

  if (!identity.has_migration_ledger) {
    if (columns.length) throw new Error("Retail theme/media columns exist without a matching Prisma migration ledger.");
    throw new Error("Target has no Prisma migration ledger; reconcile its baseline before applying this migration.");
  }
  const ledgerResult = await client.query(`
    SELECT checksum, finished_at, rolled_back_at
    FROM public._prisma_migrations
    WHERE migration_name = $1
    ORDER BY started_at
  `, [MIGRATION_NAME]);
  const ledgerRows = ledgerResult.rows;
  const unfinished = await client.query(`
    SELECT count(*)::int AS count
    FROM public._prisma_migrations
    WHERE finished_at IS NULL AND rolled_back_at IS NULL
  `);
  if (Number(unfinished.rows[0]?.count ?? 0) > 0) throw new Error("Target has unfinished, non-rolled-back Prisma migrations; reconcile the ledger first.");

  const finishedRows = ledgerRows.filter((row) => row.finished_at && !row.rolled_back_at);
  if (finishedRows.length > 1) throw new Error("Target has duplicate successful rows for the Retail theme/media migration.");
  if (finishedRows.length === 1) {
    if (finishedRows[0].checksum !== expectedChecksum) throw new Error("Applied Retail theme/media migration checksum differs from the reviewed checksum.");
    if (columnPresence.some((column) => !column.present)) throw new Error("Migration is recorded as applied, but its expected columns are missing.");
    return { status: "already-applied", databaseName: identity.database_name, databaseUser: identity.database_user, serverVersion: identity.server_version, checksum: expectedChecksum, columns: columnPresence };
  }
  if (columns.length) throw new Error("Retail theme/media columns already exist without a successful matching migration row.");
  return { status: "pending", databaseName: identity.database_name, databaseUser: identity.database_user, serverVersion: identity.server_version, checksum: expectedChecksum, columns: columnPresence };
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const { databaseName, migrationFile } = parseArgs(argv);
  const sql = loadMigration(migrationFile);
  const connection = resolveDatabaseRuntimeConfiguration(env.DATABASE_URL, env).connectionString;
  let url;
  try { url = new URL(connection); } catch { throw new Error("Runtime database URL is invalid."); }
  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol) || decodeURIComponent(url.pathname.slice(1)) !== databaseName) {
    throw new Error("Runtime database target does not match the explicitly verified database name.");
  }

  const require = createRequire(join(ROOT, "package.json"));
  const { Client } = require("pg");
  const client = new Client({ connectionString: connection, connectionTimeoutMillis: 10_000, query_timeout: 15_000 });
  try {
    await client.connect();
    const result = await inspectTarget(client, databaseName);
    console.log(JSON.stringify({ ...result, checksum: createHash("sha256").update(sql).digest("hex") }));
    if (result.status === "already-applied") return;
  } catch (error) {
    if (error instanceof Error && /^(Connected database|Target |Retail theme\/media|Applied Retail|Migration is|Target has|Runtime database)/.test(error.message)) throw error;
    throw new Error("Retail theme/media database preflight failed; no migration was started.");
  } finally {
    await client.end().catch(() => {});
  }

  const requireFromRoot = createRequire(join(ROOT, "package.json"));
  const cli = requireFromRoot.resolve("prisma/build/index.js");
  const directory = mkdtempSync(join(tmpdir(), "retail-theme-media-"));
  try {
    const migrations = join(directory, "migrations");
    mkdirSync(join(migrations, MIGRATION_NAME), { recursive: true });
    writeFileSync(join(migrations, "migration_lock.toml"), 'provider = "postgresql"\n');
    writeFileSync(join(migrations, MIGRATION_NAME, "migration.sql"), sql);
    const schema = join(directory, "schema.prisma");
    writeFileSync(schema, 'datasource db {\n provider = "postgresql"\n url = env("DIRECT_URL")\n}\n');
    execFileSync(process.execPath, [cli, "migrate", "deploy", "--schema", schema], {
      cwd: directory, env: { ...env, DIRECT_URL: connection }, stdio: "inherit",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
  }

  const verify = new Client({ connectionString: connection, connectionTimeoutMillis: 10_000, query_timeout: 15_000 });
  try {
    await verify.connect();
    const result = await inspectTarget(verify, databaseName);
    if (result.status !== "already-applied") throw new Error("Prisma migration completed without the expected ledger and columns.");
    console.log(JSON.stringify({ status: "verified", databaseName: result.databaseName, databaseUser: result.databaseUser, serverVersion: result.serverVersion, checksum: result.checksum, columns: result.columns }));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Prisma migration completed")) throw error;
    throw new Error("Post-migration verification failed; inspect the target ledger and columns before retrying.");
  } finally {
    await verify.end().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Retail theme/media migration failed.");
    process.exitCode = 1;
  });
}
