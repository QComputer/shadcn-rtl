import { readFileSync } from "node:fs";
import { parse } from "node:path";
import { Client } from "pg";

function loadEnv() {
  const envPath = parse("C:/Users/disso/Project/shadcn-rtl/.env");
  try {
    const raw = readFileSync("C:/Users/disso/Project/shadcn-rtl/.env", "utf8");
    const vars = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      vars[key] = value;
    }
    return vars;
  } catch {
    return {};
  }
}

const connectionString = loadEnv().DB_REMOTE_URI;

if (!connectionString) {
  console.error("ERROR: DB_REMOTE_URI not found in .env");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: false,
  connectionTimeoutMillis: 15000,
});

const results = {
  connection: { success: false, database: null, version: null, host: null, ssl: null },
  errors: [],
  tables: { public: null, neon_auth: null },
  businessRecords: {},
  prisma: { migrations: [], total: null, successful: null, rolledBack: null },
  pendingMigrations: [],
  manuallyUnavailable: { exists: null, details: null },
  extensions: [],
  repositoryMigrations: [],
};

async function run() {
  await client.connect();

  // Enforce read-only transaction and statement timeout
  await client.query("BEGIN READ ONLY");
  await client.query("SET statement_timeout = 30000");

  try {
    // 1. Database identity and version
    const dbInfo = await client.query(
      "SELECT current_database() AS db_name, version() AS pg_version"
    );
    results.connection.success = true;
    results.connection.database = dbInfo.rows[0].db_name;
    results.connection.version = dbInfo.rows[0].pg_version;
    results.connection.ssl = false;

    // Extract host from connection string for reporting (sanitized)
    const uriMatch = connectionString.match(/@([^:/]+):/);
    results.connection.host = uriMatch ? uriMatch[1] : "unknown";

    // Confirm database identity
    if (results.connection.database !== "databasewhy_db") {
      results.errors.push(
        `Unexpected database: ${results.connection.database}, expected databasewhy_db`
      );
    }

    // 2. Table counts in public and neon_auth
    const publicTables = await client.query(
      `SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = 'public'`
    );
    results.tables.public = parseInt(publicTables.rows[0].count, 10);

    const neonAuthTables = await client.query(
      `SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = 'neon_auth'`
    );
    results.tables.neon_auth = parseInt(neonAuthTables.rows[0].count, 10);

    // List public tables
    const publicTableList = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );
    results.tables.publicList = publicTableList.rows.map((r) => r.table_name);

    // List neon_auth tables
    const neonAuthTableList = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'neon_auth' ORDER BY table_name`
    );
    results.tables.neonAuthList = neonAuthTableList.rows.map((r) => r.table_name);

    // 3. Business record counts
    const businessTables = [
      "Organization",
      "User",
      "Product",
      "ProductVariant",
      "Order",
      "OrderItem",
    ];
    for (const table of businessTables) {
      try {
        const countResult = await client.query(
          `SELECT COUNT(*) AS count FROM "${table}"`
        );
        results.businessRecords[table] = parseInt(countResult.rows[0].count, 10);
      } catch (e) {
        results.businessRecords[table] = `ERROR: ${e.message}`;
      }
    }

    // 4. Prisma migration ledger
    try {
      const migrations = await client.query(
        `SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at`
      );
      results.prisma.migrations = migrations.rows.map((r) => ({
        name: r.migration_name,
        finished_at: r.finished_at,
        rolled_back_at: r.rolled_back_at,
      }));
      results.prisma.total = migrations.rowCount;
      results.prisma.successful = migrations.rows.filter(
        (r) => r.finished_at && !r.rolled_back_at
      ).length;
      results.prisma.rolledBack = migrations.rows.filter(
        (r) => r.rolled_back_at
      ).length;
    } catch (e) {
      results.errors.push(`Prisma migration ledger query failed: ${e.message}`);
    }

    // 5. Pending migrations - compare with repository
    const repoMigDir = "C:/Users/disso/Project/shadcn-rtl/prisma/migrations";
    try {
      const fs = await import("node:fs");
      const repoEntries = fs.readdirSync(repoMigDir, { withFileTypes: true });
      const repoMigrations = repoEntries
        .filter((d) => d.isDirectory() && d.name !== "migration_lock.toml")
        .map((d) => d.name)
        .sort();
      results.repositoryMigrations = repoMigrations;

      const appliedNames = new Set(
        results.prisma.migrations.map((m) => m.name)
      );
      results.pendingMigrations = repoMigrations.filter(
        (name) => !appliedNames.has(name)
      );
    } catch (e) {
      results.errors.push(`Repository migration scan failed: ${e.message}`);
    }

    // 6. ProductVariant.manuallyUnavailable column
    try {
      const columnCheck = await client.query(
        `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'ProductVariant' AND column_name = 'manuallyUnavailable'`
      );
      results.manuallyUnavailable.exists = columnCheck.rowCount > 0;
      results.manuallyUnavailable.details = columnCheck.rows;
    } catch (e) {
      results.errors.push(`manuallyUnavailable column check failed: ${e.message}`);
    }

    // 7. Extensions including btree_gist
    try {
      const extensions = await client.query(
        `SELECT extname, extversion FROM pg_extension ORDER BY extname`
      );
      results.extensions = extensions.rows.map((r) => ({
        name: r.extname,
        version: r.extversion,
      }));
    } catch (e) {
      results.errors.push(`Extension check failed: ${e.message}`);
    }

    // 8. Row counts for key tables (business data preservation)
    const rowCountTables = ["Organization", "User", "Product", "ProductVariant", "Order"];
    for (const table of rowCountTables) {
      try {
        const countResult = await client.query(
          `SELECT COUNT(*) AS count FROM "${table}"`
        );
        results.businessRecords[`${table}_rows`] = parseInt(countResult.rows[0].count, 10);
      } catch (e) {
        results.businessRecords[`${table}_rows`] = `ERROR: ${e.message}`;
      }
    }
  } catch (e) {
    results.errors.push(`Query execution failed: ${e.message}`);
  } finally {
    try { await client.query("ROLLBACK"); } catch { /* ignore rollback errors */ }
    await client.end();
  }

  // Print sanitized report (no connection string, no credentials)
  console.log("========================================");
  console.log("  RunFlare PostgreSQL Read-Only Audit");
  console.log("========================================\n");

  console.log("Connection:");
  console.log(`  Success: ${results.connection.success}`);
  console.log(`  Database: ${results.connection.database}`);
  console.log(`  Host: ${results.connection.host}`);
  console.log(`  PostgreSQL: ${results.connection.version ? results.connection.version.split(" ")[0] : "N/A"}`);
  console.log(`  SSL/TLS: ${results.connection.ssl === false ? "NOT AVAILABLE (server does not support SSL)" : results.connection.ssl}`);

  if (results.errors.length > 0) {
    console.log("\nErrors:");
    for (const err of results.errors) {
      console.log(`  - ${err}`);
    }
  }

  console.log("\nTables:");
  console.log(`  public schema: ${results.tables.public}`);
  console.log(`  neon_auth schema: ${results.tables.neon_auth}`);

  console.log("\nBusiness Records:");
  for (const [table, count] of Object.entries(results.businessRecords)) {
    console.log(`  ${table}: ${count}`);
  }

  console.log("\nPrisma Migrations:");
  console.log(`  Total: ${results.prisma.total}`);
  console.log(`  Successful: ${results.prisma.successful}`);
  console.log(`  Rolled back: ${results.prisma.rolledBack}`);
  console.log(`  Pending (in repo, not applied): ${results.pendingMigrations.length}`);
  if (results.pendingMigrations.length > 0) {
    for (const m of results.pendingMigrations) {
      console.log(`    - ${m}`);
    }
  }

  console.log("\nmanuallyUnavailable column:");
  console.log(`  Exists: ${results.manuallyUnavailable.exists}`);

  console.log("\nExtensions:");
  for (const ext of results.extensions) {
    console.log(`  ${ext.name} v${ext.version}`);
  }

  // Save sanitized report to file
  const fs = await import("node:fs");
  const reportPath = "C:/Users/disso/Project/shadcn-rtl/scripts/audit/runflare-db-audit-results.json";
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nFull sanitized report saved to: ${reportPath}`);
}

run().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
