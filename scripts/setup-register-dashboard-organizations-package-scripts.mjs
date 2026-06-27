import { readFileSync, writeFileSync } from "node:fs";

const packagePath = "package.json";
const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
pkg.scripts = pkg.scripts ?? {};

const additions = {
  "quality:dashboard-organizations-published": "node scripts/quality/validate-dashboard-organizations-published.mjs",
};

let changed = false;
for (const [name, command] of Object.entries(additions)) {
  if (pkg.scripts[name] !== command) {
    pkg.scripts[name] = command;
    changed = true;
  }
}

if (changed) {
  writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log("Registered dashboard organizations quality script in package.json.");
} else {
  console.log("Dashboard organizations quality script already registered.");
}
