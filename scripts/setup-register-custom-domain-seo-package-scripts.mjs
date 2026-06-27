import { readFileSync, writeFileSync } from "node:fs";

const packagePath = "package.json";
const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
pkg.scripts ||= {};
pkg.scripts["quality:custom-domain-seo"] = "node scripts/quality/validate-custom-domain-seo-hardening.mjs";
writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log("Registered custom-domain SEO quality script in package.json.");
