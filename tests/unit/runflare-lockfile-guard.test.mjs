import test from 'node:test';
import assert from 'node:assert/strict';
import { planRunflareLockfileGuard } from '../../scripts/build/runflare-lockfile.mjs';

const npmEnvironment = {
  RUNFLARE_ENFORCE_LOCKFILE: '1',
  npm_config_user_agent: 'npm/11.6.0 node/v24.22.1 win32 x64',
  npm_execpath: 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js',
};

test('lockfile guard is inert unless explicitly enabled outside Vercel', () => {
  assert.deepEqual(planRunflareLockfileGuard({ env: {}, nodeVersion: '24.0.0' }), { action: 'skip' });
  assert.deepEqual(planRunflareLockfileGuard({ env: { ...npmEnvironment, VERCEL: '1' }, nodeVersion: '24.0.0' }), { action: 'skip' });
});

test('lockfile guard accepts the required pnpm version without recursion', () => {
  const plan = planRunflareLockfileGuard({ env: { ...npmEnvironment, npm_config_user_agent: 'pnpm/10.15.0 npm/? node/v24.22.1 win32 x64' }, nodeVersion: '24.22.1' });
  assert.deepEqual(plan, { action: 'allow' });
});

test('npm entry point plans pinned pnpm frozen install with scripts disabled', () => {
  const plan = planRunflareLockfileGuard({ env: npmEnvironment, nodeVersion: '24.22.1' });
  assert.equal(plan.action, 'spawn');
  assert.ok(plan.executable);
  assert.deepEqual(plan.args, [
    npmEnvironment.npm_execpath,
    'exec', '--yes', '--package=pnpm@10.15.0', '--', 'pnpm', 'install', '--frozen-lockfile', '--ignore-scripts',
  ]);
});

test('lockfile guard fails closed for unsupported package managers, Node versions, and npm paths', () => {
  assert.match(planRunflareLockfileGuard({ env: { ...npmEnvironment, npm_config_user_agent: 'yarn/1.22.22' }, nodeVersion: '24.22.1' }).reason, /supports only npm or pnpm/);
  assert.match(planRunflareLockfileGuard({ env: { ...npmEnvironment, npm_config_user_agent: 'bun/1.2.0' }, nodeVersion: '24.22.1' }).reason, /supports only npm or pnpm/);
  assert.match(planRunflareLockfileGuard({ env: npmEnvironment, nodeVersion: '22.15.0' }).reason, /Node.js 24/);
  assert.match(planRunflareLockfileGuard({ env: { ...npmEnvironment, npm_execpath: 'pnpm.cjs' }, nodeVersion: '24.22.1' }).reason, /valid npm-cli.js/);
});
