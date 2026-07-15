#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];
const add = (name, pass, detail = "") => checks.push({ name, pass: Boolean(pass), detail });

const expected = {
  "prisma/migrations/20260628000300_export_hub_foundation/migration.sql": "4974061a2ac04ba878d11b7ce20aec9f2bcc2f6ffd98adca69893cdee9ed58a3",
  "prisma/migrations/20260707000200_export_hub_extend_data_types/migration.sql": "a024000331ef7d5383ac8043e618619470487911bb35d0662169a38c13465b68",
};

function read(rel) {
  return fs.readFileSync(path.join(root, rel));
}

for (const [rel, checksum] of Object.entries(expected)) {
  const bytes = read(rel);
  const actual = createHash("sha256").update(bytes).digest("hex");
  add(`${rel} matches Production checksum`, actual === checksum, actual);
}

const extendMigration = read("prisma/migrations/20260707000200_export_hub_extend_data_types/migration.sql").toString("utf8");
const foundationMigration = read("prisma/migrations/20260628000300_export_hub_foundation/migration.sql").toString("utf8");
add("extend migration is not edited into idempotent variant", !/IF\s+NOT\s+EXISTS/i.test(extendMigration));
add("foundation migration keeps Production checksum enum labels", /CUSTOMERS/.test(foundationMigration) && /FANPAGE_POSTS/.test(foundationMigration));
add("legacy replay issue is documented", fs.existsSync(path.join(root, "docs/db/LEGACY_MIGRATION_BASELINE_STRATEGY.md")));
add("migration audit document exists", fs.existsSync(path.join(root, "docs/db/MIGRATION_IMMUTABILITY_AUDIT.md")));

for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(`DB legacy migration immutability validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}
console.log("DB legacy migration immutability validation passed.");
