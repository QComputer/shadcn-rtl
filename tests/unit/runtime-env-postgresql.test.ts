import test from "node:test";
import assert from "node:assert/strict";
import { validateRuntimeEnvironment } from "../../lib/runtime-env";

const keys = ["NODE_ENV", "DATABASE_RUNTIME_ADAPTER", "DATABASE_URL", "PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD", "NEXTAUTH_SECRET"] as const;

function withEnvironment(values: Partial<Record<(typeof keys)[number], string>>, run: () => void) {
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, values);
    run();
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else Object.assign(process.env, { [key]: value });
    }
  }
}

test("complete PostgreSQL PG environment satisfies database health without hiding production auth errors", () => {
  withEnvironment({
    NODE_ENV: "production",
    DATABASE_RUNTIME_ADAPTER: "postgresql",
    PGHOST: "db.internal",
    PGPORT: "55432",
    PGDATABASE: "health-test",
    PGUSER: "health-user",
    PGPASSWORD: "test-secret-value",
  }, () => {
    const result = validateRuntimeEnvironment();
    assert.equal(result.summary.hasDatabaseUrl, false);
    assert.equal(result.summary.hasDatabaseConfiguration, true);
    assert.equal(result.issues.some(issue => issue.name === "DATABASE_URL"), false);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some(issue => issue.name === "NEXTAUTH_SECRET" && issue.severity === "error"));
    assert.equal(JSON.stringify(result).includes("test-secret-value"), false);
  });
});

test("incomplete PostgreSQL PG environment fails health without exposing credentials", () => {
  withEnvironment({
    NODE_ENV: "test",
    DATABASE_RUNTIME_ADAPTER: "postgresql",
    PGHOST: "db.internal",
    PGUSER: "health-user",
    PGPASSWORD: "test-secret-value",
  }, () => {
    const result = validateRuntimeEnvironment();
    assert.equal(result.summary.hasDatabaseUrl, false);
    assert.equal(result.summary.hasDatabaseConfiguration, false);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some(issue => issue.name === "DATABASE_RUNTIME_CONFIGURATION" && issue.severity === "error"));
    assert.equal(JSON.stringify(result).includes("test-secret-value"), false);
  });
});
