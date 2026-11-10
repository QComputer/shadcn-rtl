import assert from "node:assert/strict";
import test from "node:test";
import { assertRetailRecoveryEnvironment } from "./safety.mjs";

const database = "retail_ui_e2e_20261110_main";
const url = `postgresql://synthetic:synthetic@127.0.0.1:5436/${database}?schema=public`;
const safe = {
  RETAIL_RECOVERY_DISPOSABLE: "true",
  LOCAL_PRISMA_EXPECTED_PORT: "5436",
  E2E_BASE_URL: "http://127.0.0.1:3107",
  E2E_DATABASE_NAME: database,
  DATABASE_URL: url,
  DIRECT_URL: url,
  DATABASE_RUNTIME_ADAPTER: "postgresql",
};

test("accepts only the explicitly named local disposable Retail database", () => {
  assert.deepEqual(assertRetailRecoveryEnvironment(safe), {
    appUrl: "http://127.0.0.1:3107",
    databaseName: database,
  });
});

test("refuses missing disposable authorization", () => {
  assert.throws(() => assertRetailRecoveryEnvironment({ ...safe, RETAIL_RECOVERY_DISPOSABLE: undefined }), /disposable/);
});

test("refuses a non-loopback application URL", () => {
  assert.throws(() => assertRetailRecoveryEnvironment({ ...safe, E2E_BASE_URL: "https://example.test" }), /E2E_BASE_URL/);
});

test("refuses a non-loopback or wrong-port database", () => {
  const remote = `postgresql://synthetic:synthetic@db.example.test:5432/${database}`;
  assert.throws(() => assertRetailRecoveryEnvironment({ ...safe, DATABASE_URL: remote }), /127.0.0.1:5436/);
  assert.throws(() => assertRetailRecoveryEnvironment({ ...safe, DIRECT_URL: url.replace(":5436/", ":5432/") }), /127.0.0.1:5436/);
});

test("refuses database URL parameters that can alter the connection target", () => {
  assert.throws(() => assertRetailRecoveryEnvironment({ ...safe, DATABASE_URL: `${url}&host=db.example.test` }), /schema=public/);
  assert.throws(() => assertRetailRecoveryEnvironment({ ...safe, DATABASE_RUNTIME_ADAPTER: "neon" }), /runtime adapter/);
});

test("refuses production indicators and database-name mismatches", () => {
  assert.throws(() => assertRetailRecoveryEnvironment({ ...safe, NODE_ENV: "production" }), /production/);
  assert.throws(() => assertRetailRecoveryEnvironment({ ...safe, VERCEL: "1" }), /production/);
  assert.throws(() => assertRetailRecoveryEnvironment({ ...safe, E2E_DATABASE_NAME: "production" }), /same disposable database/);
  assert.throws(() => assertRetailRecoveryEnvironment({ ...safe, DATABASE_URL: url.replace(database, "neondb") }), /disposable/);
});
