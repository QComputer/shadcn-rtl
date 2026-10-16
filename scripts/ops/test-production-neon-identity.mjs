import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { neonServerIdentityMatches } from "./inspect-production-migration-metadata.mjs";

const target = {
  mode: "production",
  projectId: "aged-star-89488704",
  branchId: "br-small-queen-aii58cw9",
  endpointId: "ep-little-river-aifwxtf7",
};

test("accepts only the exact server-reported Neon project, branch, and endpoint", () => {
  assert.equal(neonServerIdentityMatches({
    neonProjectId: target.projectId,
    neonBranchId: target.branchId,
    neonEndpointId: target.endpointId,
  }, target), true);
});

for (const field of ["neonProjectId", "neonBranchId", "neonEndpointId"]) {
  test(`rejects a mismatched ${field}`, () => {
    const identity = {
      neonProjectId: target.projectId,
      neonBranchId: target.branchId,
      neonEndpointId: target.endpointId,
      [field]: "unexpected",
    };
    assert.equal(neonServerIdentityMatches(identity, target), false);
  });
}

test("rejects missing server-reported Neon identity for Production", () => {
  assert.equal(neonServerIdentityMatches({}, target), false);
});

test("does not require Neon server identity for loopback synthetic PostgreSQL", () => {
  assert.equal(neonServerIdentityMatches({}, { mode: "synthetic" }), true);
});

test("psql refusal branches stop with a nonzero SQL error under ON_ERROR_STOP", () => {
  const sql = readFileSync(new URL("./production-migration-readonly-inspection.sql", import.meta.url), "utf8");
  const refusalCount = (sql.match(/^  \\echo REFUSED:/gm) ?? []).length;
  const failClosedCount = (sql.match(/^  SELECT 1 \/ 0;$/gm) ?? []).length;

  assert.match(sql, /^\\set ON_ERROR_STOP on$/m);
  assert.equal(refusalCount, failClosedCount);
  assert.equal(sql.includes("\\quit"), false);
});
