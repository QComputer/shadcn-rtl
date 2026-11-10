import assert from "node:assert/strict";

/** The cron scans every Hotel tenant: this suite requires an empty disposable DB. */
export function assertExpiredHoldsTestEnvironment(env: Readonly<Record<string, string | undefined>>) {
  assert.notEqual(env.NODE_ENV, "production", "Refusing Production test execution.");
  assert.notEqual(env.VERCEL_ENV, "production", "Refusing Production test execution.");
  assert.ok(!env.VERCEL, "Refusing hosted test execution.");
  assert.equal(env.DATABASE_RUNTIME_ADAPTER, "postgresql", "Explicit PostgreSQL adapter required.");
  assert.equal(env.LOCAL_BASELINE_BOOTSTRAP_DISPOSABLE, "true", "Explicit disposable DB acknowledgement required.");
  const database = env.HOTEL_EXPIRED_HOLDS_TEST_DATABASE ?? "bazarbaaz_hotel_expired_holds_verify";
  assert.match(database, /^bazarbaaz_hotel_expired_holds_verify(?:_[a-z0-9]+)?$/, "Dedicated expired-holds test DB required.");
  const port = env.LOCAL_PRISMA_EXPECTED_PORT;
  assert.ok(port && /^\d+$/.test(port) && Number(port) >= 1 && Number(port) <= 65535, "Explicit local test port required.");
  for (const name of ["DATABASE_URL", "DIRECT_URL"] as const) {
    const value = env[name];
    assert.ok(value, `${name} required.`);
    let url: URL;
    try { url = new URL(value); } catch { throw new Error(`${name} must be a valid local PostgreSQL URL.`); }
    assert.ok(["postgres:", "postgresql:"].includes(url.protocol), `${name} must use PostgreSQL.`);
    assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), `${name} must use loopback.`);
    assert.equal(url.port || "5432", port, `${name} must match the pinned test port.`);
    assert.equal(url.pathname, `/${database}`, `${name} must match the dedicated test DB.`);
    assert.equal(url.hash, "", `${name} must not contain a fragment.`);
    for (const [key, value] of url.searchParams) {
      assert.ok(key === "schema" && value === "public", `${name} contains unsupported connection options.`);
    }
  }
  return database;
}
