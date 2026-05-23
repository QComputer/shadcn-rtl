#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const deployedUrl = process.env.E2E_DEPLOYED_URL?.trim() || process.env.E2E_BASE_URL?.trim() || process.env.DEPLOYED_URL?.trim();
const isDeployed = Boolean(deployedUrl);
const specs = ['tests/e2e/workflow-smoke.spec.ts', 'tests/e2e/calendar-interactions.spec.ts'];
const existingSpecs = specs.filter((spec) => existsSync(spec));

if (existingSpecs.length === 0) {
  console.error('[e2e-runner] Missing E2E spec files: ' + specs.join(', '));
  process.exit(2);
}

const require = createRequire(import.meta.url);
const candidates = ['@playwright/test/cli', '@playwright/test/cli.js', 'playwright/cli', 'playwright/cli.js'];
const fallbacks = [
  join(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js'),
  join(process.cwd(), 'node_modules', 'playwright', 'cli.js'),
];
let cli = null;
for (const candidate of candidates) {
  try {
    const resolved = require.resolve(candidate);
    if (existsSync(resolved)) { cli = resolved; break; }
  } catch {}
}
if (!cli) {
  cli = fallbacks.find((candidate) => existsSync(candidate)) ?? null;
}
if (!cli) {
  console.error('[e2e-runner] Missing local Playwright CLI. Run npm install / pnpm install first.');
  process.exit(1);
}

const args = [cli, 'test', '--config', 'playwright.config.ts', '--reporter=list', ...existingSpecs];
if (isDeployed && existingSpecs.includes('tests/e2e/workflow-smoke.spec.ts')) {
  args.push('--grep-invert', '^reports workflow shell renders$');
}
console.log(`[e2e-runner] Running appointment lifecycle suite${isDeployed ? ` against ${deployedUrl}` : ''}`);
console.log(`[e2e-runner] Specs: ${existingSpecs.join(', ')}`);
if (isDeployed && existingSpecs.includes('tests/e2e/workflow-smoke.spec.ts')) {
  console.log('[e2e-runner] Deployed mode: excluding reports workflow shell smoke from appointment lifecycle; reports route coverage belongs to the dedicated reports deployed suites.');
}
const result = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    ...(isDeployed ? { E2E_BASE_URL: deployedUrl, E2E_START_SERVER: 'false', E2E_TARGET: 'deployed', CI: process.env.CI ?? '1' } : {}),
  },
});
if (result.error) {
  console.error(`[e2e-runner] Failed to launch Playwright: ${result.error.message}`);
  process.exit(1);
}
if (result.signal) {
  console.error(`[e2e-runner] Playwright exited because of signal ${result.signal}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
