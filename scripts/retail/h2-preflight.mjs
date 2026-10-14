import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const expected = {
  database: process.env.RETAIL_H2_EXPECTED_DATABASE || "bazarbaaz_retail_r4",
  role: process.env.RETAIL_H2_EXPECTED_ROLE || "retail_r4",
  schema: "public",
  port: process.env.LOCAL_PRISMA_EXPECTED_PORT || "55433",
};
for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
  const url = new URL(process.env[key] ?? "");
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol), `${key} must be PostgreSQL`);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), `${key} must be loopback-only`);
  assert.equal(url.port, expected.port, `${key} port mismatch`);
  assert.equal(url.pathname, `/${expected.database}`, `${key} database mismatch`);
  assert.equal(url.username, expected.role, `${key} role mismatch`);
}
assert.equal(process.env.RETAIL_R4_EXPECTED_DATABASE, expected.database);
assert.equal(process.env.LOCAL_PRISMA_EXPECTED_PORT, expected.port);
const runLabel = `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`;
assert.ok(process.env.GITHUB_RUN_ID && process.env.GITHUB_RUN_ATTEMPT, "GitHub run identity required");
const expectedTaskLabel = process.env.RETAIL_H2_EXPECTED_TASK_LABEL || "retail-h2-taxonomy";
const containerIds = execFileSync("docker", ["ps", "--filter", `label=bazarbaaz.task=${expectedTaskLabel}`, "--filter", `label=bazarbaaz.run=${runLabel}`, "--format", "{{.ID}}"], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
assert.equal(containerIds.length, 1, "exactly one task/run-labeled PostgreSQL service container is required");
const details = JSON.parse(execFileSync("docker", ["inspect", containerIds[0]], { encoding: "utf8" }))[0];
assert.equal(details.Config.Image, "postgres:17");
assert.equal(details.State.Running, true);
assert.equal(details.Config.Labels["bazarbaaz.task"], expectedTaskLabel);
assert.equal(details.Config.Labels["bazarbaaz.run"], runLabel);
const bindings = details.NetworkSettings.Ports["5432/tcp"];
assert.equal(bindings.length, 1);
assert.equal(bindings[0].HostIp, "127.0.0.1");
assert.equal(bindings[0].HostPort, expected.port);

const prisma = new PrismaClient();
try {
  const rows = await prisma.$queryRaw`SELECT current_database() AS database, current_user AS role, current_schema() AS schema, current_setting('server_version_num')::int AS version_num`;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].database, expected.database);
  assert.equal(rows[0].role, expected.role);
  assert.equal(rows[0].schema, expected.schema);
  assert.ok(rows[0].version_num >= 170000 && rows[0].version_num < 180000, "PostgreSQL 17 required");
  const relations = await prisma.$queryRaw`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','S','f') ORDER BY c.relname`;
  assert.deepEqual(relations, [], "public schema must be empty before migrations");
  assert.equal(relations.some(row => row.relname === "_prisma_migrations"), false, "Prisma migration ledger must not exist before migrations");
  console.log(JSON.stringify({ status: "PREFLIGHT_PASS", database: rows[0].database, role: rows[0].role, schema: rows[0].schema, postgresMajor: 17, hostBinding: `127.0.0.1:${expected.port}`, containerId: containerIds[0], taskLabel: expectedTaskLabel, runLabel, emptyPublicSchema: true }));
} finally {
  await prisma.$disconnect();
}
