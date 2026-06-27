import { readFileSync, writeFileSync } from "node:fs";

const packagePath = "package.json";
const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
pkg.scripts = pkg.scripts || {};

const scriptsToRegister = {
  "quality:custom-domain-default-locale": "node scripts/quality/validate-custom-domain-default-locale.mjs",
};

let changed = false;
for (const [name, command] of Object.entries(scriptsToRegister)) {
  if (pkg.scripts[name] !== command) {
    pkg.scripts[name] = command;
    changed = true;
  }
}

if (changed) {
  writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log("Registered custom-domain default-locale quality script in package.json.");
} else {
  console.log("custom-domain default-locale quality script already registered.");
}
