#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REQUIRED_PNPM = '10.15.0';

/** Decide whether the opt-in RunFlare prebuild should install the pinned lockfile tool. */
export function planRunflareLockfileGuard({ env = process.env, nodeVersion = process.versions.node } = {}) {
  if (env.RUNFLARE_ENFORCE_LOCKFILE !== '1' || env.VERCEL) return { action: 'skip' };

  const userAgent = typeof env.npm_config_user_agent === 'string' ? env.npm_config_user_agent : '';
  if (new RegExp(`^pnpm/${REQUIRED_PNPM}(?:\\s|$)`).test(userAgent)) return { action: 'allow' };
  if (!/^npm\/\d+(?:\.\d+){1,2}(?:\s|$)/.test(userAgent)) {
    return { action: 'error', reason: 'RunFlare lockfile enforcement supports only npm or pnpm 10.15.0.' };
  }

  const major = Number.parseInt(String(nodeVersion).split('.')[0], 10);
  if (major !== 24) return { action: 'error', reason: 'RunFlare lockfile enforcement requires Node.js 24.' };

  const npmExecPath = typeof env.npm_execpath === 'string' ? env.npm_execpath : '';
  if (!npmExecPath || basename(npmExecPath).toLowerCase() !== 'npm-cli.js' || !/(?:^|[\\/])node_modules[\\/]npm[\\/]bin[\\/]npm-cli\.js$/i.test(npmExecPath)) {
    return { action: 'error', reason: 'RunFlare lockfile enforcement requires npm with a valid npm-cli.js path.' };
  }

  return {
    action: 'spawn',
    executable: process.execPath,
    args: [npmExecPath, 'exec', '--yes', `--package=pnpm@${REQUIRED_PNPM}`, '--', 'pnpm', 'install', '--frozen-lockfile', '--ignore-scripts'],
  };
}

function main() {
  const plan = planRunflareLockfileGuard();
  if (plan.action === 'skip' || plan.action === 'allow') return;
  if (plan.action === 'error') {
    process.stderr.write(`${plan.reason}\n`);
    process.exitCode = 1;
    return;
  }

  const result = spawnSync(plan.executable, plan.args, {
    stdio: 'inherit',
    env: { ...process.env, CI: 'true' },
  });
  if (result.error || result.status !== 0) {
    process.stderr.write('RunFlare frozen pnpm install failed; stopping before build.\n');
    process.exitCode = result.status && result.status > 0 ? result.status : 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
