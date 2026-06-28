#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const packageJsonPath = resolve(process.cwd(), "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

packageJson.scripts = packageJson.scripts || {};

const desiredScripts = {
  "e2e:custom-domain-smoke": "node scripts/e2e/custom-domain-smoke.mjs",
  "e2e:deployed:custom-domain-smoke": "node scripts/e2e/custom-domain-smoke.mjs",
  "quality:custom-domain-smoke": "node scripts/quality/validate-custom-domain-smoke.mjs",
};

let changed = false;
for (const [name, command] of Object.entries(desiredScripts)) {
  if (packageJson.scripts[name] !== command) {
    packageJson.scripts[name] = command;
    changed = true;
  }
}

if (changed) {
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  console.log("Registered custom-domain smoke scripts in package.json.");
} else {
  console.log("Custom-domain smoke scripts are already registered.");
}
