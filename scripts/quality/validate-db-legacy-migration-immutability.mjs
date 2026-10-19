#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];
const add = (name, pass, detail = "") => checks.push({ name, pass: Boolean(pass), detail });

const paths = {
  foundation: "prisma/migrations/20260628000300_export_hub_foundation/migration.sql",
  corrected: "prisma/migrations/20260707000200_export_hub_extend_data_types/migration.sql",
};

// The foundation migration remains byte-for-byte immutable. The recovery decision
// in DATABASE_MIGRATION_CHAIN_RECOVERY.md explicitly permits one exact, reviewed
// correction to the not-yet-deployed duplicate enum-extension migration.
const expectedChecksums = {
  [paths.foundation]: "4974061a2ac04ba878d11b7ce20aec9f2bcc2f6ffd98adca69893cdee9ed58a3",
  [paths.corrected]: "7781531739ffd2a222e9a0e73d1cd762109aa96179ea14b011bfe752e449dc5f",
};

function read(rel) {
  return fs.readFileSync(path.join(root, rel));
}

for (const [rel, checksum] of Object.entries(expectedChecksums)) {
  const bytes = read(rel);
  const actual = createHash("sha256").update(bytes).digest("hex");
  const kind = rel === paths.foundation ? "immutable Production" : "reviewed recovery";
  add(`${rel} matches exact ${kind} checksum`, actual === checksum, actual);
}

const corrected = read(paths.corrected).toString("utf8");
const foundation = read(paths.foundation).toString("utf8");
const recoveryDocPath = "docs/database/DATABASE_MIGRATION_CHAIN_RECOVERY.md";
const recoveryDoc = read(recoveryDocPath).toString("utf8");

add("recovery decision is explicitly CASE A in-place correction", /CASE A[\s\S]{0,80}correct the not-yet-deployed migration in place/i.test(recoveryDoc));
add("recovery records no Production migration was run", /No Production migration was run/i.test(recoveryDoc));
add("corrected migration uses guarded enum blocks", /DO\s+\$\$[\s\S]*IF\s+NOT\s+EXISTS/i.test(corrected));
add("corrected migration checks ExportDataType labels through pg_enum", /pg_enum/i.test(corrected) && /typname\s*=\s*'ExportDataType'/i.test(corrected) && /enumlabel\s*=\s*'CUSTOMERS'/i.test(corrected) && /enumlabel\s*=\s*'FANPAGE_POSTS'/i.test(corrected));
add("corrected migration does not drop or recreate ExportDataType", !/\b(?:DROP|CREATE)\s+TYPE\s+"ExportDataType"/i.test(corrected));
add("corrected migration has no destructive table or data operation", !/\b(?:DROP\s+TABLE|TRUNCATE|DELETE\s+FROM|UPDATE\s+"AiMediaAsset"|ALTER\s+TABLE\s+"AiMediaAsset"\s+DROP)\b/i.test(corrected));
add("foundation defines the intended ExportDataType labels", /CREATE TYPE "ExportDataType" AS ENUM\s*\('PRODUCTS',\s*'PRODUCT_CATEGORIES',\s*'ORDERS',\s*'CUSTOMERS',\s*'FANPAGE_POSTS'\)/i.test(foundation));

for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(`DB legacy migration immutability validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}
console.log("DB legacy migration immutability validation passed.");
