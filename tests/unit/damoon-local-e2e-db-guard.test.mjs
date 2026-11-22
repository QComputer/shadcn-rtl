import assert from "node:assert/strict";
import { test } from "node:test";
import { validateLocalDamoonTarget } from "../../scripts/hotel/verify-damoon-local-e2e-db.mjs";

const suffix = "abcdef0123456789";
const databaseName = `damoon_${suffix}`;
const user = `damoon_test_${suffix}`;
const url = `postgresql://${user}:f00dbabe@127.0.0.1:55439/${databaseName}?schema=public`;
const safeEnv = () => ({
  DAMOON_LOCAL_E2E: "1",
  DAMOON_E2E_ENABLED: "1",
  NODE_ENV: "test",
  VERCEL_ENV: "development",
  LOCAL_PRISMA_EXPECTED_PORT: "55439",
  DATABASE_URL: url,
  DIRECT_URL: url,
  DAMOON_CI_DATABASE_NAME: databaseName,
  DAMOON_E2E_DATABASE_USER: user,
});

test("accepts an explicitly opted-in dedicated loopback PostgreSQL 17 target", () => {
  assert.equal(validateLocalDamoonTarget(safeEnv()).ok, true);
});

test("rejects alternate ports without the explicit local opt-in", () => {
  const env = safeEnv();
  delete env.DAMOON_LOCAL_E2E;
  assert.equal(validateLocalDamoonTarget(env).ok, false);
});

test("rejects the preserved default PostgreSQL port for local acceptance", () => {
  const env = safeEnv();
  env.LOCAL_PRISMA_EXPECTED_PORT = "5432";
  env.DATABASE_URL = env.DIRECT_URL = url.replace(":55439/", ":5432/");
  assert.equal(validateLocalDamoonTarget(env).ok, false);
});

test("rejects remote, Neon, mismatched, and non-dedicated targets", () => {
  for (const mutate of [
    env => { env.DATABASE_URL = env.DIRECT_URL = url.replace("127.0.0.1", "ep-example.neon.tech"); },
    env => { env.DIRECT_URL = url.replace("damoon_abcdef0123456789", "damoon_0000000000000000"); },
    env => { env.DAMOON_CI_DATABASE_NAME = "postgres"; },
    env => { env.DAMOON_E2E_DATABASE_USER = "postgres"; },
    env => { env.DATABASE_URL = env.DIRECT_URL = url.replace("f00dbabe", "postgres"); },
  ]) {
    const env = safeEnv();
    mutate(env);
    assert.equal(validateLocalDamoonTarget(env).ok, false);
  }
});

test("rejects production and schema override configurations", () => {
  for (const mutate of [
    env => { env.NODE_ENV = "production"; },
    env => { env.VERCEL_ENV = "production"; },
    env => { env.DATABASE_URL = env.DIRECT_URL = url.replace("schema=public", "schema=other"); },
  ]) {
    const env = safeEnv();
    mutate(env);
    assert.equal(validateLocalDamoonTarget(env).ok, false);
  }
});
