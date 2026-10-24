#!/usr/bin/env node
import { open, readFile } from 'node:fs/promises';
import { filterPgSessionJwtToc, planDatabaseTransfer, planMediaTransfer } from './planner.mjs';

function usage() {
  return 'Usage: node scripts/migration/runflare/plan.mjs --dry-run --kind database|media --input <safe-json-file>\n       node scripts/migration/runflare/plan.mjs --filter-pg-session-jwt-toc --input <toc-file> --output <new-toc-file> --expected-sha256 <64-hex> --target-extension-absent --reviewed\nNo command is executed; TOC output is created exclusively and never overwrites an existing file.';
}
function parseArgs(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') { out.dryRun = true; continue; }
    if (['--filter-pg-session-jwt-toc', '--target-extension-absent', '--reviewed'].includes(arg)) { out[arg.slice(2).replaceAll('-', '')] = true; continue; }
    if (['--kind', '--input', '--output', '--expected-sha256'].includes(arg)) { if (!args[i + 1]) throw new Error(`Missing value for ${arg}`); out[arg.slice(2).replaceAll('-', '')] = args[++i]; continue; }
    throw new Error(`Unknown option: ${arg}`);
  }
  const tocMode = out.filterpgsessionjwttoc;
  if (tocMode) {
    if (out.dryRun || out.kind || !out.input || !out.output || !out.expectedsha256 || !out.targetextensionabsent || !out.reviewed) throw new Error(usage());
  } else if (!out.dryRun || !['database', 'media'].includes(out.kind) || !out.input || out.output || out.expectedsha256 || out.targetextensionabsent || out.reviewed) throw new Error(usage());
  return out;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.filterpgsessionjwttoc) {
    const toc = await readFile(args.input, 'utf8');
    const filtered = filterPgSessionJwtToc(toc, { targetPgSessionJwtAvailable: false, reviewed: true, expectedSourceTocSha256: args.expectedsha256 });
    const handle = await open(args.output, 'wx');
    try { await handle.writeFile(filtered.filteredToc, 'utf8'); } finally { await handle.close(); }
    const excludedIds = filtered.excludedEntries.map((line) => line.match(/^\s*(\d+);/)?.[1]).filter(Boolean);
    process.stdout.write(`${JSON.stringify({ created: true, sourceSha256: filtered.sourceSha256, filteredSha256: filtered.filteredSha256, excludedTocIds: excludedIds })}\n`);
  } else {
    const data = JSON.parse(await readFile(args.input, 'utf8'));
    const plan = args.kind === 'database' ? planDatabaseTransfer(data) : planMediaTransfer(data);
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  }
} catch (error) {
  process.stderr.write(`${error?.message || 'Planning failed'}\n${usage()}\n`);
  process.exitCode = 2;
}
