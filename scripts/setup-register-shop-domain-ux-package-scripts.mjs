#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const packageJsonPath = resolve(process.cwd(), "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

packageJson.scripts = packageJson.scripts || {};

const desiredScripts = {
  "quality:shop-domain-ux": "node scripts/quality/validate-shop-domain-ux-polish.mjs",
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
  console.log("Registered shop-domain UX quality script in package.json.");
} else {
  console.log("Shop-domain UX quality script is already registered.");
}
