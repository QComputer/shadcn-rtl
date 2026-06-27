import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const packagePath = join(process.cwd(), "package.json");
const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
pkg.scripts = pkg.scripts || {};
pkg.scripts["quality:vercel-domain-automation"] = "node scripts/quality/validate-vercel-domain-automation.mjs";
writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log("Registered Vercel domain automation quality script in package.json.");
