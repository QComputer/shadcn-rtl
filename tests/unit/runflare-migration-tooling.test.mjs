import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { filterPgSessionJwtToc, planDatabaseTransfer, planMediaTransfer } from '../../scripts/migration/runflare/planner.mjs';

const dbInput = () => ({
  source: { engine: 'postgresql', pgservice: 'source-ro', expectedIdentity: { providerProject: 'aged-star-89488704', branch: 'br-small-queen-aii58cw9', endpoint: 'ep-little-river-aifwxtf7', database: 'neondb', serverVersion: '17.11' } },
  target: { service: 'database-giu-service', database: 'databasewhy_db', pgservice: 'runflare-target', proof: { service: 'database-giu-service', database: 'databasewhy_db', identityVerified: true, isPrimary: true, empty: true, extensions: { btreeGist: true, pgSessionJwt: true } } },
  ledger: { total: 115, successful: 111, rolledBack: 4, unfinished: 0 },
  sourceBaseline: { ledger: { total: 115, successful: 111, rolledBack: 4, unfinished: 0 }, neonAuthTables: [
    { name: 'user', rows: 1 }, { name: 'account', rows: 1 }, { name: 'project_config', rows: 1 },
    ...['auth_a', 'auth_b', 'auth_c', 'auth_d', 'auth_e', 'auth_f'].map((name) => ({ name, rows: 0 })),
  ] },
  extensionPlan: { strategy: 'preserve-native' },
});

test('database plan targets only the confirmed database and never executes restore', () => {
  const plan = planDatabaseTransfer(dbInput());
  assert.equal(plan.executesCommands, false);
  assert.equal(plan.restoreExecution.enabled, false);
  assert.deepEqual(plan.target, { service: 'database-giu-service', database: 'databasewhy_db' });
  assert.deepEqual(plan.ledger, { total: 115, successful: 111, rolledBack: 4, unfinished: 0 });
  assert.equal(plan.sourceBaseline.neonAuthTables.length, 9);
  assert.equal(plan.extensionPlan.strategy, 'preserve-native');
  assert.ok(plan.commands.some((argv) => argv[0] === 'pg_dump'));
  assert.ok(plan.commands.some((argv) => argv[0] === 'pg_restore'));
  assert.ok(plan.commands.flat().every((part) => !/postgres(?:ql)?:\/\/|password|token=/i.test(part)));
});

test('database planner rejects wrong or conflicting target identity', () => {
  const alternate = dbInput(); alternate.target.database = 'anotherdb'; alternate.target.proof.database = 'anotherdb';
  assert.throws(() => planDatabaseTransfer(alternate), /owner-confirmed existing/);
  const conflict = dbInput(); conflict.target.proof.database = 'anotherdb';
  assert.throws(() => planDatabaseTransfer(conflict), /proof is missing or conflicting/);
});

test('database planner requires complete historical ledger and identity proof', () => {
  const missingLedger = dbInput(); missingLedger.ledger.rolledBack = 0;
  assert.throws(() => planDatabaseTransfer(missingLedger), /reviewed source baseline/);
  const noProof = dbInput(); noProof.target.proof.empty = false;
  assert.throws(() => planDatabaseTransfer(noProof), /proof is missing or conflicting/);
});

test('database plan rejects source identity or ledger drift from reviewed baseline', () => {
  const wrongSource = dbInput(); wrongSource.source.expectedIdentity.providerProject = 'other-project';
  assert.throws(() => planDatabaseTransfer(wrongSource), /source identity does not match/);
  const driftedLedger = dbInput(); driftedLedger.ledger.rolledBack = 3;
  assert.throws(() => planDatabaseTransfer(driftedLedger), /migration ledger must match/);
});

test('database planner gates unsupported pg_session_jwt and requires preservation evidence', () => {
  const missing = dbInput(); missing.target.proof.extensions.pgSessionJwt = false; missing.extensionPlan = { strategy: 'preserve-native' };
  assert.throws(() => planDatabaseTransfer(missing), /reviewed source TOC SHA-256/);
  const candidate = dbInput(); candidate.target.proof.extensions.pgSessionJwt = false;
  candidate.extensionPlan = { strategy: 'omit-pg-session-jwt-extension-entry-only', reviewed: true, sourceTocSha256: 'b'.repeat(64), neonAuthHandling: 'preserve-schema-and-all-data', neonAuthTableCount: 9 };
  const plan = planDatabaseTransfer(candidate);
  assert.equal(plan.extensionPlan.neonAuthHandling, 'preserve-schema-and-all-data');
  assert.deepEqual(plan.extensionPlan.excludedTocEntries, ['EXTENSION pg_session_jwt', 'COMMENT EXTENSION pg_session_jwt']);
  assert.equal(plan.extensionPlan.sourceTocSha256, 'b'.repeat(64));
  assert.ok(plan.commands.find((argv) => argv[0] === 'pg_restore' && argv.includes('--verbose')).includes('--use-list=<reviewed-filtered-archive-toc-file>'));
});

test('TOC filter requires review and removes exactly pg_session_jwt extension and its comment', () => {
  const toc = [
    '; archive header',
    '1; 0 0 EXTENSION - plpgsql',
    '2; 0 0 EXTENSION - pg_session_jwt',
    '3; 0 0 COMMENT - EXTENSION pg_session_jwt',
    '4; 0 0 FUNCTION pgrst pre_config()',
    '5; 2606 2200 TABLE DATA neon_auth user',
    '6; 0 0 FUNCTION auth jwt_claims()',
  ].join('\n') + '\n';
  const sourceTocSha256 = createHash('sha256').update(toc).digest('hex');
  assert.throws(() => filterPgSessionJwtToc(toc, { targetPgSessionJwtAvailable: false, reviewed: false, expectedSourceTocSha256: sourceTocSha256 }), /explicit review/);
  assert.throws(() => filterPgSessionJwtToc(toc, { targetPgSessionJwtAvailable: false, reviewed: true, expectedSourceTocSha256: 'c'.repeat(64) }), /does not match/);
  const filtered = filterPgSessionJwtToc(toc, { targetPgSessionJwtAvailable: false, reviewed: true, expectedSourceTocSha256: sourceTocSha256 });
  assert.equal(filtered.excludedEntries.length, 2);
  assert.match(filtered.filteredToc, /FUNCTION pgrst pre_config\(\)/);
  assert.match(filtered.filteredToc, /TABLE DATA neon_auth user/);
  assert.match(filtered.filteredToc, /FUNCTION auth jwt_claims\(\)/);
  assert.doesNotMatch(filtered.filteredToc, /EXTENSION - pg_session_jwt|COMMENT - EXTENSION pg_session_jwt/);
  assert.equal(filterPgSessionJwtToc(toc, { targetPgSessionJwtAvailable: true }).filteredToc, toc);
});

test('media planner blocks ownership conflicts, alias collisions, and unsafe paths', () => {
  const plan = planMediaTransfer({
    references: [
      { path: 'uploads/logo.png', tenantId: 'tenant-a', access: 'public', family: 'organization-logo' },
      { path: '/logo.png', tenantId: 'tenant-b', access: 'public', family: 'gallery' },
      { path: '../secret.png', tenantId: 'tenant-a', access: 'private' },
    ],
    blobObjects: [{ key: 'logo.png', sizeBytes: 12 }, { pathname: 'logo.png', sizeBytes: 12 }],
  });
  assert.equal(plan.action, 'plan-only-no-download-no-copy');
  assert.equal(plan.entries[0].sourceKey, null);
  const logo = plan.entries.find((entry) => entry.sourceKey === 'logo.png');
  assert.ok(logo.blockers.includes('cross-tenant-ownership-conflict'));
  assert.ok(logo.blockers.includes('blob-key-collision'));
  assert.equal(logo.tenantId, null);
});

test('media manifest is deterministic and resolves public/uploads aliases and known checksums', () => {
  const data = {
    references: [{ url: 'https://cdn.example/uploads/tenant/logo.png?sig=redacted', tenantId: 'tenant_1', access: 'public', family: 'branding', sizeBytes: 3, sha256: 'a'.repeat(64) }],
    blobObjects: [{ key: 'tenant/logo.png', sizeBytes: 3, sha256: 'a'.repeat(64) }],
  };
  const a = planMediaTransfer(data); const b = planMediaTransfer(data);
  assert.deepEqual(a, b);
  assert.equal(a.entries[0].targetKey, 'tenants/tenant_1/uploads/logo.png');
  assert.equal(a.entries[0].access, 'public');
  assert.equal(a.entries[0].status, 'planned');
  assert.equal(a.entries[0].bytes, 3);
});

test('media planner preserves adapter namespaces and rejects backslash or percent-encoded traversal', () => {
  const plan = planMediaTransfer({ references: [
    { key: 'creative-studio/org-a/assets/a.webp', tenantId: 'org-a', access: 'private' },
    { key: 'retail-payment/org-a/receipt.png', tenantId: 'org-a', access: 'private' },
    { key: 'uploads/org-a/public/logo.png', tenantId: 'org-a', access: 'public' },
    { key: 'uploads/org-a/%2e%2e/escape.png', tenantId: 'org-a', access: 'public' },
    { key: 'uploads/org-a\\..\\escape.png', tenantId: 'org-a', access: 'public' },
  ] });
  const bySource = new Map(plan.entries.map((entry) => [entry.sourceKey, entry]));
  assert.equal(bySource.get('creative-studio/org-a/assets/a.webp').targetKey, 'creative-studio/org-a/assets/a.webp');
  assert.equal(bySource.get('retail-payment/org-a/receipt.png').targetKey, 'retail-payment/org-a/receipt.png');
  assert.equal(bySource.get('org-a/public/logo.png').targetKey, 'tenants/org-a/uploads/logo.png');
  assert.equal(bySource.get(null).status, 'blocked');
  assert.ok(plan.entries.filter((entry) => entry.sourceKey === null).every((entry) => entry.blockers.includes('invalid-or-traversal-key')));
});

test('media planner blocks flattened target collisions and namespace ownership mismatch', () => {
  const plan = planMediaTransfer({ references: [
    { key: 'first/logo.png', tenantId: 'org-a', access: 'public' },
    { key: 'second/logo.png', tenantId: 'org-a', access: 'public' },
    { key: 'creative-studio/org-b/assets/private.png', tenantId: 'org-a', access: 'private' },
  ] });
  assert.ok(plan.entries.filter((entry) => entry.targetKey === 'tenants/org-a/uploads/logo.png').every((entry) => entry.blockers.includes('target-key-collision')));
  const wrongOwner = plan.entries.find((entry) => entry.sourceKey?.startsWith('creative-studio/'));
  assert.equal(wrongOwner.targetKey, null);
  assert.ok(wrongOwner.blockers.includes('target-namespace-ownership-mismatch'));
});

test('CLI requires dry-run, outputs plan only, and refuses bad target without executing commands', () => {
  const result = spawnSync(process.execPath, ['scripts/migration/runflare/plan.mjs', '--dry-run', '--kind', 'database', '--input', 'package.json'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source PostgreSQL identity is required/);
  assert.equal(result.stdout, '');
});
