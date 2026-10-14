import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationRoot = path.join(root, "prisma", "migrations");
const h2Name = "20261014160000_retail_h2_product_taxonomy";
const names = fs.readdirSync(migrationRoot, { withFileTypes: true })
  .filter(item => item.isDirectory() && /^\d{14}_/.test(item.name))
  .map(item => item.name).sort();
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
