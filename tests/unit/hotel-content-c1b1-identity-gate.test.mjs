import assert from "node:assert/strict";
import { test } from "node:test";
import { assertMatchingIdentitySources, expectedContext, parseCommandJson, taskRunFilters, validateDatabaseIdentity } from "../../scripts/db/hotel-content-c1b1-identity-gate.mjs";

const expected = { database: "bazarbaaz_hotel_c1b1_abcdef123456", user: "c1b1_test" };
const valid = { database: expected.database, user: expected.user, schema: "public", majorVersion: 17, publicObjectCount: 0, migrationLedger: null };

test("identity gate accepts matching empty PostgreSQL 17 identity output", () => {
  assert.deepEqual(parseCommandJson({ status: 0, stdout: JSON.stringify(valid) }, "synthetic psql"), valid);
  assert.deepEqual(validateDatabaseIdentity(valid, expected), valid);
  assert.deepEqual(assertMatchingIdentitySources(valid, { ...valid }), valid);
});
test("identity gate rejects empty output", () => {
  assert.throws(() => parseCommandJson({ status: 0, stdout: "  \n", stderr: "" }, "synthetic psql"), /empty output/);
});

test("identity gate rejects invalid JSON and text", () => {
  assert.throws(() => parseCommandJson({ status: 0, stdout: "connection refused", stderr: "" }, "synthetic psql"), /invalid JSON/);
});

test("identity gate rejects the wrong database and user", () => {
  assert.throws(() => validateDatabaseIdentity({ ...valid, database: "other" }, expected), /database identity mismatch/);
  assert.throws(() => validateDatabaseIdentity({ ...valid, user: "postgres" }, expected), /database user mismatch/);
});

test("identity gate rejects disagreement between independent SQL sources", () => {
  assert.throws(() => assertMatchingIdentitySources(valid, { ...valid, database: "other" }), /identity disagree on database/);
});

test("Docker inspection is restricted to the exact task and run labels", () => {
  assert.deepEqual(taskRunFilters("abcdef123456"), ["--filter", "label=codex.task=hotel-content-c1b1-db-acceptance", "--filter", "label=codex.run_id=abcdef123456"]);
  assert.throws(() => taskRunFilters("invalid"), /valid run ID/);
});

test("identity gate rejects non-public schema, nonempty schema, or an existing ledger", () => {
  assert.throws(() => validateDatabaseIdentity({ ...valid, schema: "private" }, expected), /unexpected database schema/);
  assert.throws(() => validateDatabaseIdentity({ ...valid, publicObjectCount: 1 }, expected), /public schema must be empty/);
  assert.throws(() => validateDatabaseIdentity({ ...valid, migrationLedger: "_prisma_migrations" }, expected), /migration ledger already exists/);
});

test("identity gate rejects version mismatch", () => {
  assert.throws(() => validateDatabaseIdentity({ ...valid, majorVersion: 16 }, expected), /major version must be 17/);
});

test("identity gate rejects connection errors and nonzero command results", () => {
  assert.throws(() => parseCommandJson({ status: 1, stdout: "", stderr: "connection refused" }, "host query"), /exit 1.*connection refused/);
  assert.throws(() => parseCommandJson({ status: null, stdout: "", stderr: "spawn failed" }, "docker exec"), /exit unknown.*spawn failed/);
});

test("identity gate requires explicit process-local URL and refuses non-loopback or mismatched direct URLs", () => {
  const env = {
    HOTEL_CONTENT_C1B1_PG_ACCEPTANCE: "1",
    AI_MEDIA_LOCAL_DOCKER_E2E: "1",
    HOTEL_CONTENT_C1B1_RUN_ID: "abcdef123456",
    HOTEL_CONTENT_C1B1_CONTAINER_ID: "a".repeat(64),
    HOTEL_CONTENT_C1B1_VOLUME_NAME: "hotel-content-c1b1-abcdef123456",
    DATABASE_URL: "postgresql://c1b1_test:synthetic@127.0.0.1:54321/bazarbaaz_hotel_c1b1_abcdef123456",
  };
  assert.throws(() => expectedContext({}), /explicit C1B1.*guards/);
  assert.throws(() => expectedContext(env), /same target/);
  assert.deepEqual(expectedContext({ ...env, DIRECT_URL: env.DATABASE_URL }).database, expected.database);
  const nonLoopbackUrl = env.DATABASE_URL.replace("127.0.0.1", "localhost");
  assert.throws(() => expectedContext({ ...env, DATABASE_URL: nonLoopbackUrl, DIRECT_URL: nonLoopbackUrl }), /loopback PostgreSQL port/);
});
