import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

for (const [label, flag, vercel, expected] of [
  ['ordinary builds retain checking', '', '', false],
  ['explicit RunFlare build skips duplicate checking', '1', '', true],
  ['Vercel retains checking even with flag', '1', '1', false],
]) {
  test(label, () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', '-e',
      "const config = require('./next.config.ts').default; console.log(JSON.stringify(config.typescript.ignoreBuildErrors));"], {
      encoding: 'utf8',
      env: { ...process.env, RUNFLARE_SKIP_DUPLICATE_TYPECHECK: flag, VERCEL: vercel },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout.trim()), expected);
  });
}
