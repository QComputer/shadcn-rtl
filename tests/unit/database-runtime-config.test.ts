import test from "node:test";
import assert from "node:assert/strict";
import { resolveDatabaseRuntimeConfiguration } from "../../lib/database-runtime-config";

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
