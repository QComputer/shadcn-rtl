#!/usr/bin/env node
// Read-only source inventory. Does not read environment files or connect to a database.
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../../prisma/migrations", import.meta.url)));
const dirs = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const name of dirs) {
  const sql = await readFile(join(root, name, "migration.sql"));
  const sha256 = createHash("sha256").update(sql).digest("hex");
  console.log(`${name}\t${sha256}`);
}
console.log(`TOTAL\t${dirs.length}`);
