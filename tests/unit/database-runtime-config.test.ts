import test from "node:test";
import assert from "node:assert/strict";
import { applyPrismaPostgresEnvironment, resolveDatabaseRuntimeConfiguration } from "../../lib/database-runtime-config";

const url = "postgresql://fixture:fixture@127.0.0.1:54713/retail_test";

test("existing deployments retain Neon unless PostgreSQL is explicitly selected", () => {
  assert.equal(resolveDatabaseRuntimeConfiguration(url, {}).adapter, "neon");
  const selected = resolveDatabaseRuntimeConfiguration(url, { DATABASE_RUNTIME_ADAPTER: "postgresql" });
  assert.equal(selected.adapter, "postgresql");
  assert.equal(selected.connectionString, url);
  assert.equal(selected.max, 5);
});

test("PostgreSQL uses bounded explicit pool settings without changing URL TLS options", () => {
  const secure = url + "?sslmode=verify-full";
  const actual = resolveDatabaseRuntimeConfiguration(secure, { DATABASE_RUNTIME_ADAPTER: "postgresql", DATABASE_POOL_MAX: "8", DATABASE_CONNECT_TIMEOUT_MS: "30000" });
  assert.equal(actual.connectionString, secure);
  assert.equal(actual.max, 8);
  assert.equal(actual.connectionTimeoutMillis, 30000);
});

test("unknown adapter, invalid URL and unsafe pool settings fail without exposing credentials", () => {
  assert.throws(() => resolveDatabaseRuntimeConfiguration(url, { DATABASE_RUNTIME_ADAPTER: "other" }), /Unsupported/);
  for (const bad of ["0", "-1", "1.5", "101", "NaN"]) {
    assert.throws(() => resolveDatabaseRuntimeConfiguration(url, { DATABASE_POOL_MAX: bad }), /DATABASE_POOL_MAX/);
  }
  assert.throws(() => resolveDatabaseRuntimeConfiguration("https://example.test/db", {}), /Invalid database/);
  assert.throws(() => resolveDatabaseRuntimeConfiguration("invalid-secret", {}), error => error instanceof Error && !error.message.includes("invalid-secret"));
});

test("explicit PostgreSQL adapter builds a URL from standard PG settings with encoded credentials", () => {
  const env = {
    DATABASE_RUNTIME_ADAPTER: "postgresql",
    PGHOST: "db.internal",
    PGPORT: "55432",
    PGDATABASE: "runflare-db",
    PGUSER: "deploy user",
    PGPASSWORD: "!#:@/?% leading",
  };
  const result = resolveDatabaseRuntimeConfiguration(undefined, env);
  const parsed = new URL(result.connectionString);
  assert.equal(result.adapter, "postgresql");
  assert.equal(parsed.hostname, "db.internal");
  assert.equal(parsed.port, "55432");
  assert.equal(decodeURIComponent(parsed.username), env.PGUSER);
  assert.equal(decodeURIComponent(parsed.password), env.PGPASSWORD);
  assert.equal(decodeURIComponent(parsed.pathname.slice(1)), env.PGDATABASE);
});

test("PostgreSQL CLI environment derives only missing URLs and leaves Neon unchanged", () => {
  const pg: Record<string, string | undefined> = {
    DATABASE_RUNTIME_ADAPTER: "postgresql",
    PGHOST: "db.internal",
    PGDATABASE: "runflare-db",
    PGUSER: "deploy",
    PGPASSWORD: "secret",
    DIRECT_URL: "postgresql://explicit-direct@direct.internal/db",
  };
  applyPrismaPostgresEnvironment(pg);
  assert.equal(pg.DATABASE_URL, "postgresql://deploy:secret@db.internal:5432/runflare-db");
  assert.equal(pg.DIRECT_URL, "postgresql://explicit-direct@direct.internal/db");

  const neon = { DATABASE_URL: url };
  applyPrismaPostgresEnvironment(neon);
  assert.deepEqual(neon, { DATABASE_URL: url });

  const existingPgUrl = { DATABASE_RUNTIME_ADAPTER: "postgresql", DATABASE_URL: url };
  applyPrismaPostgresEnvironment(existingPgUrl);
  assert.deepEqual(existingPgUrl, { DATABASE_RUNTIME_ADAPTER: "postgresql", DATABASE_URL: url });
});

test("PostgreSQL env configuration rejects bad ports and incomplete settings without exposing secrets", () => {
  const base = { DATABASE_RUNTIME_ADAPTER: "postgresql", PGHOST: "db.internal", PGDATABASE: "db", PGUSER: "user", PGPASSWORD: "sensitive-value" };
  for (const port of ["0", "65536", "1.5", "bad"]) {
    assert.throws(() => resolveDatabaseRuntimeConfiguration(undefined, { ...base, PGPORT: port }), error => error instanceof Error && /PGPORT/.test(error.message) && !error.message.includes("sensitive-value"));
  }
  assert.throws(() => resolveDatabaseRuntimeConfiguration(undefined, { ...base, PGPASSWORD: undefined }), error => error instanceof Error && /PGHOST/.test(error.message) && !error.message.includes("sensitive-value"));
});
