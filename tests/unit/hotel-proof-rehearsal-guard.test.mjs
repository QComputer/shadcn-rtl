import test from "node:test";
import assert from "node:assert/strict";
import { validateProofRehearsalEnvironment as validate } from "../../scripts/db/hotel-proof-rehearsal-guard.mjs";
const url = "postgresql://hotel_gap_test:fixture@127.0.0.1:55439/damoon_migration_gap_rehearsal?schema=public";
const good = { NODE_ENV: "test", DATABASE_URL: url, DIRECT_URL: url };
test("accepts only matching isolated fixture URLs", () => assert.equal(validate(good).hostname, "127.0.0.1"));
test("rejects unsafe connection variants before database access", () => {
  for (const bad of [
    { NODE_ENV: "production" }, { DATABASE_URL: url.replace("postgresql:", "http:") },
    { DATABASE_URL: url.replace("127.0.0.1", "localhost") }, { DATABASE_URL: url.replace("127.0.0.1", "example.com") },
    { DATABASE_URL: url.replace("55439", "5432") }, { DATABASE_URL: url.replace("hotel_gap_test", "other") },
    { DATABASE_URL: url.replace("damoon_migration_gap_rehearsal", "other") }, { DIRECT_URL: url.replace("fixture@", "other@") },
    { DATABASE_URL: url + "&host=example.com" }, { DATABASE_URL: url + "&options=-csearch_path%3Dpublic" },
    { DATABASE_URL: url + "&schema=public" }, { DATABASE_URL: url + "#fragment" }, { DIRECT_URL: "" },
  ]) assert.throws(() => validate({ ...good, ...bad }));
});
