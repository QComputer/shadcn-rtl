import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationRoot = path.join(root, "prisma", "migrations");
const h2Name = "20261014160000_retail_h2_product_taxonomy";
const entries = fs.readdirSync(migrationRoot, { withFileTypes: true })
  .filter(item => item.isDirectory());
const missingSql = entries.filter(item => !fs.existsSync(path.join(migrationRoot, item.name, "migration.sql")));
if (missingSql.length) {
  throw new Error(`Migration directories without migration.sql: ${missingSql.map(item => item.name).join(", ")}`);
}
// Existing committed migrations include both 14-digit names without an
// underscore and 8-digit legacy prefixes. Include every actual migration
// directory rather than silently dropping those historical entries.
const names = entries.map(item => item.name).sort();
if (names.length !== 100 || names.at(-1) !== h2Name) {
  throw new Error(`Expected exactly 100 ordered R4+H2 migrations ending in ${h2Name}; found ${names.length} ending in ${names.at(-1)}`);
}
const tempRoot = process.env.RUNNER_TEMP;
if (!tempRoot || !path.isAbsolute(tempRoot)) throw new Error("RUNNER_TEMP must be an absolute ephemeral runner path");
const target = path.join(tempRoot, "retail-h2-r4-base-prisma");
if (fs.existsSync(target)) throw new Error("Refusing to overwrite existing temporary migration stage");
fs.mkdirSync(path.join(target, "migrations"), { recursive: true });
fs.copyFileSync(path.join(root, "prisma", "schema.prisma"), path.join(target, "schema.prisma"));
fs.copyFileSync(path.join(migrationRoot, "migration_lock.toml"), path.join(target, "migrations", "migration_lock.toml"));
for (const name of names.filter(name => name !== h2Name)) {
  fs.cpSync(path.join(migrationRoot, name), path.join(target, "migrations", name), { recursive: true, errorOnExist: true });
}
console.log(JSON.stringify({ status: "prepared", baseMigrationCount: names.length - 1, h2Migration: h2Name, target }));
