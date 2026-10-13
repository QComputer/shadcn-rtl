import assert from "node:assert/strict";
import test from "node:test";
import { parsePsql } from "../../scripts/db/hotel-website-c1b2-identity-gate.mjs";

const valid = { database: "bazarbaaz_hotel_c1b2_abcdef12", user: "c1b2_test", schema: "public", serverVersionNum: 170005, publicObjectCount: 0, migrationLedger: null };
const expected = { database: valid.database };

test("identity gate accepts only expected empty PostgreSQL 17 database identity", () => {
  assert.deepEqual(parsePsql(JSON.stringify(valid), expected), { database: valid.database, user: "c1b2_test", schema: "public", majorVersion: 17, publicObjectCount: 0, migrationLedger: null });
});

for (const [name, input] of [
  ["empty output", ""],
  ["malformed output", "not json"],
  ["wrong database", JSON.stringify({ ...valid, database: "other" })],
  ["wrong user", JSON.stringify({ ...valid, user: "postgres" })],
  ["wrong schema", JSON.stringify({ ...valid, schema: "private" })],
  ["wrong server version", JSON.stringify({ ...valid, serverVersionNum: 160000 })],
  ["nonempty schema", JSON.stringify({ ...valid, publicObjectCount: 1 })],
  ["existing migration ledger", JSON.stringify({ ...valid, migrationLedger: "_prisma_migrations" })],
]) {
  test(`identity gate rejects ${name}`, () => assert.throws(() => parsePsql(input, expected)));
}
