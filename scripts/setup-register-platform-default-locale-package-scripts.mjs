#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';

const pkgPath = 'package.json';
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.scripts = pkg.scripts || {};

const scripts = {
  'quality:platform-default-locale': 'node scripts/quality/validate-platform-default-locale.mjs',
  'e2e:platform-default-locale': 'node scripts/e2e/platform-default-locale-smoke.mjs',
};

let changed = false;
for (const [name, command] of Object.entries(scripts)) {
  if (pkg.scripts[name] !== command) {
    pkg.scripts[name] = command;
    changed = true;
  }
}

if (changed) {
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log('Registered platform default-locale scripts in package.json.');
} else {
  console.log('Platform default-locale package scripts already registered.');
}
