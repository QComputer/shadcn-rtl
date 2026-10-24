#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const RUNFLARE_TYPECHECK_NAME = 'RunFlare TypeScript';
const DEFAULT_ATTEMPTS = 30;
const DEFAULT_INTERVAL_MS = 20_000;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_WAIT_MS = 10 * 60_000;

export function shouldRequireRunflareTypecheck({ env = process.env } = {}) {
  return env.RUNFLARE_SKIP_DUPLICATE_TYPECHECK === '1' && !env.VERCEL;
}

export function selectLatestExactTypecheckRun(checkRuns, expectedSha) {
  if (!Array.isArray(checkRuns)) return null;
  return checkRuns
    .filter(run => run?.name === RUNFLARE_TYPECHECK_NAME
      && run?.app?.slug === 'github-actions'
      && run?.head_sha?.toLowerCase() === expectedSha.toLowerCase())
    .sort((a, b) => {
      const aStarted = Date.parse(a.started_at || a.created_at || '') || 0;
      const bStarted = Date.parse(b.started_at || b.created_at || '') || 0;
      return bStarted - aStarted || Number(b.id || 0) - Number(a.id || 0);
    })[0] || null;
}

export function classifyExactTypecheckRun(checkRuns, expectedSha) {
  const run = selectLatestExactTypecheckRun(checkRuns, expectedSha);
  if (!run || run.status !== 'completed') return { state: 'pending', run };
  if (run.conclusion === 'success') return { state: 'success', run };
  if (run.conclusion === 'skipped') return { state: 'skipped', run };
  return { state: 'failure', run };
}

export function githubRepositoryFromRemote(remoteUrl) {
  const value = String(remoteUrl || '').trim();
  let path;
  if (/^git@github\.com:/i.test(value)) path = value.replace(/^git@github\.com:/i, '');
  else {
    let parsed;
    try { parsed = new URL(value); } catch { throw new Error('RunFlare typecheck gate requires a public github.com origin remote.'); }
    if (parsed.hostname.toLowerCase() !== 'github.com') throw new Error('RunFlare typecheck gate requires a public github.com origin remote.');
    path = parsed.pathname.replace(/^\//, '');
  }
  const repository = path.replace(/\.git$/i, '').replace(/\/$/, '');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('RunFlare typecheck gate could not resolve the public GitHub repository.');
  }
  return repository;
}

export async function waitForExactTypecheck({ repository, sha, fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), attempts = DEFAULT_ATTEMPTS, intervalMs = DEFAULT_INTERVAL_MS, requestTimeoutMs = REQUEST_TIMEOUT_MS, maxWaitMs = MAX_WAIT_MS }) {
  if (!/^[a-f0-9]{40}$/i.test(sha)) throw new Error('RunFlare typecheck gate received an invalid HEAD SHA.');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('RunFlare typecheck gate received an invalid GitHub repository.');

  const url = `https://api.github.com/repos/${repository}/commits/${sha}/check-runs?per_page=100`;
  const deadline = Date.now() + maxWaitMs;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    let response;
    try {
      response = await fetchImpl(url, {
        headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        signal: AbortSignal.timeout(Math.max(1, Math.min(requestTimeoutMs, remainingMs))),
      });
    } catch {
      throw new Error('RunFlare typecheck gate could not query GitHub check runs.');
    }
    if (!response?.ok) throw new Error(`RunFlare typecheck gate GitHub query failed with HTTP ${response?.status || 'unknown'}.`);

    let payload;
    try { payload = await response.json(); } catch { throw new Error('RunFlare typecheck gate received an invalid GitHub response.'); }
    if (!Array.isArray(payload?.check_runs)) throw new Error('RunFlare typecheck gate received an invalid GitHub response.');

    const result = classifyExactTypecheckRun(payload.check_runs, sha);
    if (result.state === 'success') return result.run;
    if (result.state === 'failure' || result.state === 'skipped') {
      throw new Error(`RunFlare TypeScript check for exact HEAD ${sha} concluded ${result.run.conclusion || 'without success'}.`);
    }
    const sleepMs = Math.min(intervalMs, deadline - Date.now());
    if (attempt + 1 < attempts && sleepMs > 0) await sleep(sleepMs);
  }

  throw new Error(`Timed out waiting for a successful RunFlare TypeScript check for exact HEAD ${sha}.`);
}

export function readSafeCgroupMemoryLimitBytes() {
  for (const file of ['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes']) {
    try {
      const value = readFileSync(file, 'utf8').trim();
      if (value === 'max') return 'max';
      if (/^\d+$/.test(value)) return value;
    } catch {
      // Try the other standard cgroup layout; never emit file contents.
    }
  }
  return 'unavailable';
}

function gitOutput(args) {
  try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { throw new Error('RunFlare typecheck gate could not inspect the current Git checkout.'); }
}

export async function runRunflareTypecheckGate({ env = process.env, git = gitOutput, fetchImpl = fetch, sleep } = {}) {
  if (!shouldRequireRunflareTypecheck({ env })) return { required: false };
  const sha = git(['rev-parse', 'HEAD']);
  const repository = githubRepositoryFromRemote(git(['remote', 'get-url', 'origin']));
  const run = await waitForExactTypecheck({ repository, sha, fetchImpl, ...(sleep ? { sleep } : {}) });
  return { required: true, sha: run.head_sha };
}

async function main() {
  if (!shouldRequireRunflareTypecheck()) return;
  process.stdout.write(`RunFlare prebuild cgroup memory limit bytes: ${readSafeCgroupMemoryLimitBytes()}\n`);
  try {
    const result = await runRunflareTypecheckGate();
    if (result.required) process.stdout.write(`RunFlare TypeScript check succeeded for exact HEAD ${result.sha}.\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'RunFlare typecheck gate failed.'}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
