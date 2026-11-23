import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const LOCAL_DATABASE_PREFIX = "bazarbaaz_hotel_c1b2_";
const LOCAL_DATABASE_ROLE = "c1b2_test";

function reject(message) {
  throw new Error(message);
}

function isLoopback(hostname) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/**
 * Validates an explicitly authorized disposable-local audit target.
 * The URI is read only from DB_REMOTE_URI. No dotenv file or alternate URI
 * variable is consulted. This tool intentionally refuses every remote host.
 */
export function validateAuditEnvironment(env = process.env) {
  const connectionString = env.DB_REMOTE_URI;
  if (typeof connectionString !== "string" || connectionString.trim() === "") {
    reject("DB_REMOTE_URI is required; no file or alternate-variable fallback is permitted");
  }
  if (env.RUNFLARE_DB_AUDIT_TARGET !== "disposable-local") {
    reject("RUNFLARE_DB_AUDIT_TARGET must be disposable-local");
  }
  if (env.RUNFLARE_DB_AUDIT_READ_ONLY_AUTHORIZATION !== "LOCAL_DISPOSABLE_CONFIRMED") {
    reject("Explicit local disposable read-only authorization is required");
  }

  let uri;
  try {
    uri = new URL(connectionString);
  } catch {
    reject("DB_REMOTE_URI must be a valid PostgreSQL URI");
  }
  if (uri.protocol !== "postgres:" && uri.protocol !== "postgresql:") {
    reject("DB_REMOTE_URI must use the PostgreSQL protocol");
  }
  if (!isLoopback(uri.hostname)) reject("Remote database targets are disabled in this local audit tool");

  const database = decodeURIComponent(uri.pathname.replace(/^\//, ""));
  const username = decodeURIComponent(uri.username);
  if (!database.startsWith(LOCAL_DATABASE_PREFIX) || !/^[a-f0-9]{8,16}$/i.test(database.slice(LOCAL_DATABASE_PREFIX.length))) {
    reject("Database name is not an approved disposable C1B2 test database");
  }
  if (username !== LOCAL_DATABASE_ROLE) reject("Database role is not the disposable C1B2 test role");

  return Object.freeze({ connectionString, database, username, hostname: uri.hostname });
}

function safeErrorCode(error) {
  return typeof error?.code === "string" && /^[A-Z0-9_]{1,32}$/.test(error.code) ? error.code : "UNCLASSIFIED";
}

export async function runReadOnlyAudit(config, ClientConstructor) {
  if (!ClientConstructor) {
    // pg is a declared dependency of Prisma's PostgreSQL adapter in this
    // workspace; resolve it from that package rather than assuming hoisting.
    const requireFromPgAdapter = createRequire(import.meta.resolve("@prisma/adapter-pg"));
    const { Client } = requireFromPgAdapter("pg");
    ClientConstructor = Client;
  }
  const client = new ClientConstructor({
    connectionString: config.connectionString,
    connectionTimeoutMillis: 5000,
    application_name: "runflare-db-audit-local-readonly",
  });
  let transactionOpen = false;
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    transactionOpen = true;
    await client.query("SET LOCAL statement_timeout = 5000");

    const identity = await client.query(`
      SELECT current_database() AS database_name,
             current_user AS user_name,
             current_setting('transaction_read_only') AS transaction_read_only,
             current_setting('server_version_num')::int AS server_version_num
    `);
    const row = identity.rows[0];
    if (!row || row.database_name !== config.database || row.user_name !== config.username || row.transaction_read_only !== "on") {
      reject("Connected database identity or read-only transaction verification failed");
    }

    const migrations = await client.query(`
      SELECT migration_name, finished_at IS NOT NULL AND rolled_back_at IS NULL AS successful
      FROM public._prisma_migrations
      ORDER BY migration_name
    `);
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    return Object.freeze({
      connection: Object.freeze({
        success: true,
        database: row.database_name,
        username: row.user_name,
        transactionReadOnly: row.transaction_read_only === "on",
        postgresMajorVersion: Math.floor(Number(row.server_version_num) / 10000),
      }),
      publicTableCount: tables.rowCount,
      migrations: Object.freeze(migrations.rows.map(({ migration_name, successful }) => Object.freeze({ name: migration_name, successful }))),
    });
  } finally {
    if (transactionOpen) {
      try { await client.query("ROLLBACK"); } catch { /* Never replace the primary audit result with rollback detail. */ }
    }
    try { await client.end(); } catch { /* Do not expose connection diagnostics. */ }
  }
}

async function main() {
  try {
    const config = validateAuditEnvironment(process.env);
    const report = await runReadOnlyAudit(config);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    // Database drivers may include target metadata in exception text. Report
    // only a compact code; never echo URI, credentials, host, or server text.
    console.error(`Runflare DB audit refused or failed (${safeErrorCode(error)})`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
