import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const mode = process.argv[2];
assert.ok(mode === "before" || mode === "after", "usage: node verify-tenant-pwa-ci-db.mjs before|after");

const expectedDatabase = "bazarbaaz_tenant_pwa_ci";
const expectedUser = "tenant_pwa_ci";
const databaseUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_URL;
assert.ok(databaseUrl, "DATABASE_URL must be explicit for CI database verification");
assert.ok(directUrl, "DIRECT_URL must be explicit for CI database verification");

for (const [name, value] of [["DATABASE_URL", databaseUrl], ["DIRECT_URL", directUrl]]) {
  const url = new URL(value);
  assert.equal(url.protocol, "postgresql:", `${name} must use PostgreSQL`);
  assert.equal(url.hostname, "127.0.0.1", `${name} must target the loopback-only CI service`);
  assert.equal(url.port, "5432", `${name} must target the CI service port`);
  assert.equal(decodeURIComponent(url.username), expectedUser, `${name} must use the synthetic CI user`);
  assert.equal(url.pathname.slice(1), expectedDatabase, `${name} must use the synthetic CI database`);
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
try {
  const [identity] = await prisma.$queryRaw`
    SELECT current_database() AS database,
           current_schema() AS schema,
           current_user AS "user",
           current_setting('server_version_num')::int AS version_num
  `;
  assert.equal(identity.database, expectedDatabase, "connected database identity");
  assert.equal(identity.schema, "public", "connected schema identity");
  assert.equal(identity.user, expectedUser, "connected user identity");
  assert.ok(identity.version_num >= 170000 && identity.version_num < 180000, "PostgreSQL major version is 17");

  const [objects] = await prisma.$queryRaw`
    SELECT count(*)::int AS count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
  `;
  const migrationTable = await prisma.$queryRaw`
    SELECT to_regclass('public._prisma_migrations')::text AS name
  `;

  if (mode === "before") {
    assert.equal(objects.count, 0, "public schema must be empty before migrations");
    assert.equal(migrationTable[0].name, null, "Prisma migration ledger must not exist before migrations");
  } else {
    const expectedMigrations = readdirSync(resolve("prisma/migrations"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const rows = await prisma.$queryRaw`
      SELECT migration_name, finished_at, rolled_back_at, logs
        FROM public._prisma_migrations
       ORDER BY migration_name
    `;
    assert.equal(rows.length, expectedMigrations.length, "migration ledger row count matches source manifest");
    assert.deepEqual(rows.map((row) => row.migration_name).sort(), expectedMigrations, "migration ledger matches source manifest");
    assert.ok(rows.every((row) => row.finished_at && !row.rolled_back_at && !row.logs), "all migration rows are successful and not rolled back");
  }

  console.log(JSON.stringify({
    result: "PASS",
    mode,
    database: identity.database,
    schema: identity.schema,
    user: identity.user,
    postgresMajor: 17,
    publicObjects: objects.count,
    migrationLedgerRows: mode === "after" ? expectedMigrationCount() : 0,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}

function expectedMigrationCount() {
  return readdirSync(resolve("prisma/migrations"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).length;
}
