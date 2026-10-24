import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyExactTypecheckRun,
  githubRepositoryFromRemote,
  readSafeCgroupMemoryLimitBytes,
  runRunflareTypecheckGate,
  shouldRequireRunflareTypecheck,
  waitForExactTypecheck,
} from '../../scripts/build/runflare-typecheck-gate.mjs';

const sha = 'a'.repeat(40);
const otherSha = 'b'.repeat(40);
const run = (headSha, fields = {}) => ({ name: 'RunFlare TypeScript', head_sha: headSha, app: { slug: 'github-actions' }, status: 'completed', conclusion: 'success', started_at: '2026-10-24T10:00:00Z', id: 1, ...fields });

test('skip gate is opt-in and never bypasses Vercel checks', () => {
  assert.equal(shouldRequireRunflareTypecheck({ env: {} }), false);
  assert.equal(shouldRequireRunflareTypecheck({ env: { RUNFLARE_SKIP_DUPLICATE_TYPECHECK: 'true' } }), false);
  assert.equal(shouldRequireRunflareTypecheck({ env: { RUNFLARE_SKIP_DUPLICATE_TYPECHECK: '1', VERCEL: '1' } }), false);
  assert.equal(shouldRequireRunflareTypecheck({ env: { RUNFLARE_SKIP_DUPLICATE_TYPECHECK: '1' } }), true);
});

test('classifies only the named check for the exact commit SHA', () => {
  assert.equal(classifyExactTypecheckRun([run(otherSha)], sha).state, 'pending');
  assert.equal(classifyExactTypecheckRun([{ ...run(sha), name: 'TypeScript' }], sha).state, 'pending');
  assert.equal(classifyExactTypecheckRun([run(sha, { app: { slug: 'other-publisher' } })], sha).state, 'pending');
  assert.equal(classifyExactTypecheckRun([run(sha)], sha).state, 'success');
  assert.equal(classifyExactTypecheckRun([run(sha, { conclusion: 'skipped' })], sha).state, 'skipped');
  assert.equal(classifyExactTypecheckRun([run(sha, { conclusion: 'failure' })], sha).state, 'failure');
});

test('latest exact-SHA retry controls the result', () => {
  const olderSuccess = run(sha, { id: 1, started_at: '2026-10-24T10:00:00Z' });
  const newerPending = run(sha, { id: 2, status: 'in_progress', conclusion: null, started_at: '2026-10-24T11:00:00Z' });
  assert.equal(classifyExactTypecheckRun([olderSuccess, newerPending], sha).state, 'pending');
});

test('resolves HTTPS and SSH public GitHub remotes only', () => {
  assert.equal(githubRepositoryFromRemote('https://github.com/QComputer/shadcn-rtl.git'), 'QComputer/shadcn-rtl');
  assert.equal(githubRepositoryFromRemote('git@github.com:QComputer/shadcn-rtl.git'), 'QComputer/shadcn-rtl');
  assert.throws(() => githubRepositoryFromRemote('https://example.com/QComputer/shadcn-rtl.git'), /public github.com/);
});

test('reports only a safe cgroup memory limit value', () => {
  assert.match(readSafeCgroupMemoryLimitBytes(), /^(?:max|unavailable|\d+)$/);
});

test('gate polls pending exact-SHA checks and fails closed on skipped or missing checks', async () => {
  let calls = 0;
  const accepted = await waitForExactTypecheck({
    repository: 'QComputer/shadcn-rtl', sha,
    attempts: 3, intervalMs: 0, sleep: async () => {},
    fetchImpl: async url => {
      calls += 1;
      assert.ok(url.includes(`/commits/${sha}/check-runs`));
      return { ok: true, json: async () => ({ check_runs: calls === 1 ? [] : [run(sha)] }) };
    },
  });
  assert.equal(accepted.head_sha, sha);
  assert.equal(calls, 2);

  await assert.rejects(waitForExactTypecheck({ repository: 'QComputer/shadcn-rtl', sha, attempts: 1, fetchImpl: async () => ({ ok: true, json: async () => ({ check_runs: [run(sha, { conclusion: 'skipped' })] }) }) }), /concluded skipped/);
  await assert.rejects(waitForExactTypecheck({ repository: 'QComputer/shadcn-rtl', sha, attempts: 1, fetchImpl: async () => ({ ok: true, json: async () => ({ check_runs: [run(otherSha)] }) }) }), /Timed out waiting/);
});

test('opted-in gate reads HEAD and remote and does not print or need a token', async () => {
  const gitCalls = [];
  const result = await runRunflareTypecheckGate({
    env: { RUNFLARE_SKIP_DUPLICATE_TYPECHECK: '1' },
    git: args => { gitCalls.push(args); return args[0] === 'rev-parse' ? sha : 'git@github.com:QComputer/shadcn-rtl.git'; },
    fetchImpl: async () => ({ ok: true, json: async () => ({ check_runs: [run(sha)] }) }),
  });
  assert.deepEqual(gitCalls, [['rev-parse', 'HEAD'], ['remote', 'get-url', 'origin']]);
  assert.deepEqual(result, { required: true, sha });
});

test('source archive fallback requires a pinned SHA matching public main and its exact successful check', async () => {
  const urls = [];
  let mainQueries = 0;
  const result = await runRunflareTypecheckGate({
    env: { RUNFLARE_SKIP_DUPLICATE_TYPECHECK: '1', RUNFLARE_SOURCE_COMMIT_SHA: sha },
    git: () => { throw new Error('Git metadata is unavailable'); },
    fetchImpl: async url => {
      urls.push(url);
      if (url.endsWith('/commits/main')) {
        mainQueries += 1;
        return { ok: true, json: async () => ({ sha }) };
      }
      assert.ok(url.endsWith(`/commits/${sha}/check-runs?per_page=100`));
      return { ok: true, json: async () => ({ check_runs: [run(sha)] }) };
    },
  });
  assert.deepEqual(result, { required: true, sha });
  assert.equal(urls.length, 3);
  assert.equal(mainQueries, 2);
});

test('source archive fallback fails closed when pin is absent or stale', async () => {
  const noGit = () => { throw new Error('Git metadata is unavailable'); };
  await assert.rejects(runRunflareTypecheckGate({
    env: { RUNFLARE_SKIP_DUPLICATE_TYPECHECK: '1' }, git: noGit,
    fetchImpl: async () => { throw new Error('GitHub must not be queried without a valid pin'); },
  }), /requires RUNFLARE_SOURCE_COMMIT_SHA/);
  await assert.rejects(runRunflareTypecheckGate({
    env: { RUNFLARE_SKIP_DUPLICATE_TYPECHECK: '1', RUNFLARE_SOURCE_COMMIT_SHA: sha }, git: noGit,
    fetchImpl: async url => {
      assert.ok(url.endsWith('/commits/main'));
      return { ok: true, json: async () => ({ sha: otherSha }) };
    },
  }), /does not match the current main branch tip/);
  let mainQueries = 0;
  await assert.rejects(runRunflareTypecheckGate({
    env: { RUNFLARE_SKIP_DUPLICATE_TYPECHECK: '1', RUNFLARE_SOURCE_COMMIT_SHA: sha }, git: noGit,
    fetchImpl: async url => {
      if (url.endsWith('/commits/main')) {
        mainQueries += 1;
        return { ok: true, json: async () => ({ sha: mainQueries === 1 ? sha : otherSha }) };
      }
      return { ok: true, json: async () => ({ check_runs: [run(sha)] }) };
    },
  }), /does not match the current main branch tip/);
});
