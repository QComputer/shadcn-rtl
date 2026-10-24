#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { planDatabaseTransfer, planMediaTransfer } from './planner.mjs';

function usage() {
  return 'Usage: node scripts/migration/runflare/plan.mjs --dry-run --kind database|media --input <safe-json-file>\nNo command is executed; database JSON must contain exact target proof; media JSON accepts references and blobObjects.';
}
function parseArgs(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') { out.dryRun = true; continue; }
    if (['--kind', '--input'].includes(arg)) { if (!args[i + 1]) throw new Error(`Missing value for ${arg}`); out[arg.slice(2)] = args[++i]; continue; }
    throw new Error(`Unknown option: ${arg}`);
  }
  if (!out.dryRun || !['database', 'media'].includes(out.kind) || !out.input) throw new Error(usage());
  return out;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const data = JSON.parse(await readFile(args.input, 'utf8'));
  const plan = args.kind === 'database' ? planDatabaseTransfer(data) : planMediaTransfer(data);
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error?.message || 'Planning failed'}\n${usage()}\n`);
  process.exitCode = 2;
}
