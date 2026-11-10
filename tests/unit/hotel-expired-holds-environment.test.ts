import assert from "node:assert/strict";
import { test } from "node:test";
import { assertExpiredHoldsTestEnvironment } from "../helpers/hotel-expired-holds-environment";

const database = "bazarbaaz_hotel_expired_holds_verify";
const url = `postgresql://synthetic:synthetic@127.0.0.1:5432/${database}?schema=public`;
const local = {
  NODE_ENV: "test", DATABASE_RUNTIME_ADAPTER: "postgresql",
  LOCAL_BASELINE_BOOTSTRAP_DISPOSABLE: "true", LOCAL_PRISMA_EXPECTED_PORT: "5432",
  DATABASE_URL: url, DIRECT_URL: url,
};

test("accepts explicitly acknowledged dedicated loopback database", () => {
  assert.equal(assertExpiredHoldsTestEnvironment(local), database);
});

for (const [name, overrides] of Object.entries({
  production: { NODE_ENV: "production" },
  hostedProduction: { VERCEL_ENV: "production" },
  hostedRuntime: { VERCEL: "1" },
  noAcknowledgement: { LOCAL_BASELINE_BOOTSTRAP_DISPOSABLE: undefined },
  noPort: { LOCAL_PRISMA_EXPECTED_PORT: undefined },
  wrongAdapter: { DATABASE_RUNTIME_ADAPTER: "neon" },
  remoteRuntime: { DATABASE_URL: url.replace("127.0.0.1", "db.example.test") },
  remoteDirect: { DIRECT_URL: url.replace("127.0.0.1", "db.example.test") },
  hostnameSpoof: { DATABASE_URL: url.replace("127.0.0.1", "127.0.0.1.example.test") },
  wrongPort: { DATABASE_URL: url.replace(":5432/", ":5436/") },
  wrongDatabase: { DIRECT_URL: url.replace(database, "postgres") },
  arbitraryDatabase: { HOTEL_EXPIRED_HOLDS_TEST_DATABASE: "production" },
  connectionOverride: { DATABASE_URL: `${url}&host=remote.example.test` },
  malformed: { DATABASE_URL: "invalid-secret-value" },
})) {
  test(`refuses ${name} without exposing connection values`, () => {
    assert.throws(() => assertExpiredHoldsTestEnvironment({ ...local, ...overrides }), (error: Error) => {
      assert.ok(!error.message.includes("synthetic") && !error.message.includes("invalid-secret-value"));
      return true;
    });
  });
}
