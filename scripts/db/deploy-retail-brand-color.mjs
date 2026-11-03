// Deploy only this additive migration; never replay unrelated historical files.
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { resolveDatabaseRuntimeConfiguration } from "../../lib/database-runtime-config.ts";

const migration = "20261103120000_add_storefront_primary_color";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const expected = process.argv[2];
if (!expected || process.argv[3] !== "--apply") {
  throw new Error("Usage (Node 24): node scripts/db/deploy-retail-brand-color.mjs <verified-database-name> --apply; requires the explicit runtime database environment.");
}
const connection = resolveDatabaseRuntimeConfiguration(process.env.DATABASE_URL, process.env).connectionString;
const url = new URL(connection);
if (!["postgresql:", "postgres:"].includes(url.protocol) || decodeURIComponent(url.pathname.slice(1)) !== expected) {
  throw new Error("Database target does not match the explicitly verified name.");
}
const require = createRequire(join(root, "package.json"));
const cli = require.resolve("prisma/build/index.js");
const directory = mkdtempSync(join(tmpdir(), "retail-brand-color-"));
try {
  const migrations = join(directory, "migrations");
  mkdirSync(join(migrations, migration), { recursive: true });
  writeFileSync(join(migrations, "migration_lock.toml"), 'provider = "postgresql"\n');
  const sql = readFileSync(join(root, "prisma/migrations", migration, "migration.sql"), "utf8").replaceAll("\r\n", "\n");
  writeFileSync(join(migrations, migration, "migration.sql"), sql);
  const schema = join(directory, "schema.prisma");
  writeFileSync(schema, 'datasource db {\n provider = "postgresql"\n url = env("DIRECT_URL")\n}\n');
  execFileSync(process.execPath, [cli, "migrate", "deploy", "--schema", schema], {
    cwd: directory, env: { ...process.env, DIRECT_URL: connection }, stdio: "inherit",
  });
} finally {
  rmSync(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
}
