import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationRoot = path.join(root, "prisma", "migrations");
const acceptedR5 = "81a1a89a79e33edc02dc45b1a416068941b6a11e";
const acceptedH2 = "6a5c4caedbcc7271b6be28e4834328e7c665c7c9";
const h2Migration = "20261014160000_retail_h2_product_taxonomy";

function hash(bytes) {
  // Windows checkouts may apply core.autocrlf. Compare canonical SQL bytes so
  // the manifest remains stable across Windows and GitHub's Linux runner.
  const canonical = Buffer.isBuffer(bytes) ? bytes.toString("utf8").replace(/\r\n/g, "\n") : bytes.replace(/\r\n/g, "\n");
  return createHash("sha256").update(canonical).digest("hex");
}

function committedMigrationFiles(commit) {
  const files = execFileSync("git", ["ls-tree", "-r", "--name-only", commit, "--", "prisma/migrations"], {
    cwd: root,
    encoding: "utf8",
  }).trim().split(/\r?\n/).filter((file) => file.endsWith("/migration.sql"));
  const byName = new Map();
  for (const file of files) {
    const name = file.split("/")[2];
    assert.ok(name, `invalid migration path in ${commit}: ${file}`);
    const sql = execFileSync("git", ["show", `${commit}:${file}`], { cwd: root });
    byName.set(name, hash(sql));
  }
  return byName;
}

function workingMigrationFiles() {
  const directories = fs.readdirSync(migrationRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const byName = new Map();
  for (const entry of directories) {
    const sqlPath = path.join(migrationRoot, entry.name, "migration.sql");
    assert.ok(fs.existsSync(sqlPath), `migration directory has no SQL: ${entry.name}`);
    byName.set(entry.name, hash(fs.readFileSync(sqlPath)));
  }
  return byName;
}

const r5 = committedMigrationFiles(acceptedR5);
const h2 = committedMigrationFiles(acceptedH2);
const current = workingMigrationFiles();
assert.equal(r5.size, 101, `accepted R5 baseline should contain 101 SQL migrations, found ${r5.size}`);
assert.equal(h2.size, 100, `accepted H2 baseline should contain 100 SQL migrations, found ${h2.size}`);
assert.equal(current.size, 102, `combined chain should contain 102 SQL migrations, found ${current.size}`);
assert.ok(current.has(h2Migration), "combined chain must include the accepted H2 taxonomy migration");
assert.equal([...current.keys()].sort().at(-1), h2Migration, "H2 taxonomy must be the final ordered migration");

const r5Names = new Set(r5.keys());
const h2Names = new Set(h2.keys());
assert.deepEqual([...current.keys()].filter((name) => !r5Names.has(name)).sort(), [h2Migration],
  "combined chain may add only the accepted H2 migration to accepted R5");
assert.deepEqual([...r5Names].filter((name) => !current.has(name)), [], "combined chain must retain every accepted R5 migration");
assert.deepEqual([...current.keys()].filter((name) => !h2Names.has(name)).sort(), [
  "20261014100000_retail_r5_inoti_merchant_routing",
  "20261014110000_retail_payment_expiration",
].sort(), "relative to accepted H2, the combined chain may add only R5's two ordered migrations");

for (const [name, expectedHash] of [...r5, ...h2]) {
  const baseline = name === h2Migration ? h2.get(name) : r5.get(name) ?? h2.get(name);
  assert.equal(current.get(name), baseline, `working migration SQL checksum differs from accepted baseline for ${name}`);
  if (r5.has(name) && h2.has(name)) {
    assert.equal(r5.get(name), h2.get(name), `accepted H2 and R5 SQL differ on shared migration ${name}`);
  }
  assert.ok(expectedHash, `missing accepted checksum for ${name}`);
}

const common = execFileSync("git", ["merge-base", acceptedH2, acceptedR5], { cwd: root, encoding: "utf8" }).trim();
assert.equal(common, "a51e8ddd18fe1b82d828d59fe078a182a34f23f0", "accepted H2 and R5 should share the accepted R4 ancestry");
const sorted = [...current.keys()].sort();
console.log(JSON.stringify({
  status: "PASS",
  acceptedR5MigrationCount: r5.size,
  acceptedH2MigrationCount: h2.size,
  combinedMigrationCount: current.size,
  commonBase: common,
  r5Only: sorted.filter((name) => r5Names.has(name) && !h2Names.has(name)),
  h2Only: sorted.filter((name) => h2Names.has(name) && !r5Names.has(name)),
  sharedChecksumMismatches: 0,
}));
