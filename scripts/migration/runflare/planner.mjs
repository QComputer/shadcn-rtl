import { createHash } from 'node:crypto';

export const REQUIRED_TARGET = Object.freeze({ service: 'database-giu-service', database: 'databasewhy_db' });
export const SOURCE_BASELINE = Object.freeze({ providerProject: 'aged-star-89488704', branch: 'br-small-queen-aii58cw9', endpoint: 'ep-little-river-aifwxtf7', database: 'neondb' });
export const LEDGER_BASELINE = Object.freeze({ total: 115, successful: 111, rolledBack: 4, unfinished: 0 });
const NEON_AUTH_EXPECTED_TABLES = 9;
const APPLICATION_STORAGE_NAMESPACES = new Set(['creative-studio', 'tenants', 'retail-payment']);

function fail(message) { throw new Error(message); }
function safeName(value, label) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_.-]+$/.test(value)) fail(`${label} must be a safe operator alias`);
  return value;
}

/** Build an inert native PostgreSQL transfer plan. This module never spawns processes. */
export function planDatabaseTransfer(input) {
  const source = input?.source;
  const target = input?.target;
  if (!source || source.engine !== 'postgresql' || typeof source.expectedIdentity !== 'object') fail('source PostgreSQL identity is required');
  for (const [field, expected] of Object.entries(SOURCE_BASELINE)) {
    if (source.expectedIdentity[field] !== expected) fail(`source identity does not match the reviewed ${field} baseline`);
  }
  if (!target || target.service !== REQUIRED_TARGET.service || target.database !== REQUIRED_TARGET.database) fail('target must be the owner-confirmed existing databasewhy_db on database-giu-service');
  if (target.database !== target.proof?.database || target.service !== target.proof?.service || target.proof?.isPrimary !== true || target.proof?.empty !== true || target.proof?.identityVerified !== true) fail('target identity/primary/emptiness proof is missing or conflicting');
  const srcSvc = safeName(source.pgservice, 'source PGSERVICE');
  const dstSvc = safeName(target.pgservice, 'target PGSERVICE');
  if (srcSvc === dstSvc) fail('source and target PGSERVICE aliases must differ');
  const archive = input.archivePath ?? '<protected-archive-path>';
  const sourceDb = safeName(source.expectedIdentity.database, 'source database');
  const ledger = input.ledger;
  const ledgerBaseline = input.sourceBaseline?.ledger;
  if (!ledger || !ledgerBaseline || Object.keys(LEDGER_BASELINE).some((key) => ledger[key] !== LEDGER_BASELINE[key] || ledgerBaseline[key] !== LEDGER_BASELINE[key])) fail('migration ledger must match the supplied reviewed source baseline: 115 rows (111 successful, 4 rolled back, 0 unfinished)');
  if (!ledgerBaseline || Object.keys(LEDGER_BASELINE).some((key) => ledger[key] !== ledgerBaseline[key])) fail('live ledger evidence differs from the supplied source baseline; stop for reconciliation');
  const neonAuthTables = input.sourceBaseline?.neonAuthTables;
  if (!Array.isArray(neonAuthTables) || neonAuthTables.length !== NEON_AUTH_EXPECTED_TABLES || new Set(neonAuthTables.map((table) => table?.name)).size !== NEON_AUTH_EXPECTED_TABLES || neonAuthTables.some((table) => typeof table.name !== 'string' || !Number.isSafeInteger(table.rows) || table.rows < 0)) fail('baseline must inventory all nine neon_auth tables using sanitized names and row counts');
  const authCounts = Object.fromEntries(neonAuthTables.map(({ name, rows }) => [name, rows]));
  if (authCounts.user !== 1 || authCounts.account !== 1 || authCounts.project_config !== 1 || neonAuthTables.filter((table) => !['user', 'account', 'project_config'].includes(table.name)).some((table) => table.rows !== 0)) fail('neon_auth row-count baseline drifted; preserve every table and row and re-audit');
  const extensionPlan = input.extensionPlan;
  const targetExtensions = target.proof?.extensions;
  if (!targetExtensions || targetExtensions.btreeGist !== true || typeof targetExtensions.pgSessionJwt !== 'boolean') fail('target extension capability evidence for btree_gist and pg_session_jwt is required');
  if (targetExtensions.pgSessionJwt && extensionPlan?.strategy !== 'preserve-native') fail('available pg_session_jwt requires preserve-native strategy');
  if (!targetExtensions.pgSessionJwt) {
    if (extensionPlan?.strategy !== 'omit-pg-session-jwt-extension-entry-only' || extensionPlan.reviewed !== true || !/^[a-f0-9]{64}$/i.test(extensionPlan.sourceTocSha256 ?? '')) fail('unsupported pg_session_jwt requires reviewed source TOC SHA-256 and extension-entry-only filtering');
    if (extensionPlan.neonAuthHandling !== 'preserve-schema-and-all-data' || extensionPlan.neonAuthTableCount !== NEON_AUTH_EXPECTED_TABLES) fail('extension portability mode must preserve neon_auth schema and all nine tables with every row');
  }
  const sourceDbname = `service=${srcSvc} dbname=${sourceDb}`;
  const targetDbname = `service=${dstSvc} dbname=${REQUIRED_TARGET.database}`;
  const restoreArgs = ['pg_restore', '--verbose', '--exit-on-error', '--no-owner', '--no-acl'];
  if (!targetExtensions.pgSessionJwt) restoreArgs.push('--use-list=<reviewed-filtered-archive-toc-file>');
  restoreArgs.push(`--dbname=${targetDbname}`, archive);
  const expectedIdentity = Object.fromEntries(['providerProject', 'branch', 'endpoint', 'database', 'serverVersion'].filter((k) => typeof source.expectedIdentity[k] === 'string').map((k) => [k, source.expectedIdentity[k]]));
  if (expectedIdentity.database !== sourceDb) fail('source identity database must match source database');
  return Object.freeze({ mode: 'dry-run', executesCommands: false, target: REQUIRED_TARGET,
    environment: { PGSERVICEFILE: '<operator-managed protected service file; secret values never read by planner>' },
    commands: [
      ['pg_dump', '--format=custom', `--file=${archive}`, '--dbname', sourceDbname],
      ['pg_restore', '--list', archive],
      restoreArgs,
    ],
    restoreExecution: { enabled: false, reason: 'Planner output is inert. Any future executor requires explicit execution authorization, live identity proof, verified target backup, and repeat identity/empty-state proof immediately before restore.' },
    sourceIdentity: expectedIdentity,
    targetIdentity: { service: REQUIRED_TARGET.service, database: REQUIRED_TARGET.database, proof: { identityVerified: true, isPrimary: true, empty: true, extensions: { btreeGist: targetExtensions.btreeGist, pgSessionJwt: targetExtensions.pgSessionJwt } } },
    ledger: { ...ledger },
    sourceBaseline: { neonAuthTables, authImplementation: 'NextAuth public User/Account/Session; no application Neon Auth integration identified by static source scan' },
    extensionPlan: { targetPgSessionJwtAvailable: targetExtensions.pgSessionJwt, strategy: extensionPlan.strategy, neonAuthHandling: 'preserve-schema-and-all-data', sourceTocSha256: targetExtensions.pgSessionJwt ? null : extensionPlan.sourceTocSha256, excludedTocEntries: targetExtensions.pgSessionJwt ? [] : ['EXTENSION pg_session_jwt', 'COMMENT EXTENSION pg_session_jwt'] },
    warnings: ['Keep the complete unmodified native archive containing all schemas, objects, and rows as the authoritative source. If target lacks pg_session_jwt, filter only its exact EXTENSION and COMMENT TOC records; preserve all auth functions, pgrst.pre_config, neon_auth schema/data, and every other TOC item. Do not implement an auth/JWT fallback.', 'Do not use --clean, db push, seed, or migration replay.', 'PGSERVICE aliases resolve through operator-owned PGSERVICEFILE; never pass credentials in argv.'],
  });
}

/** Filter only the reviewed extension and its COMMENT record from a pg_restore --list TOC. */
export function filterPgSessionJwtToc(tocText, { targetPgSessionJwtAvailable, reviewed, expectedSourceTocSha256 } = {}) {
  if (typeof tocText !== 'string' || !tocText.trim()) fail('archive TOC text is required');
  const sourceSha256 = createHash('sha256').update(tocText).digest('hex');
  if (targetPgSessionJwtAvailable === true) return { sourceSha256, filteredSha256: sourceSha256, excludedEntries: [], filteredToc: tocText, changed: false };
  if (targetPgSessionJwtAvailable !== false || reviewed !== true || !/^[a-f0-9]{64}$/i.test(expectedSourceTocSha256 ?? '')) fail('extension TOC filtering requires explicit review, confirmed target absence, and expected source TOC SHA-256');
  if (sourceSha256 !== expectedSourceTocSha256.toLowerCase()) fail('archive TOC SHA-256 does not match the reviewed planner baseline');
  const lines = tocText.split(/\r?\n/);
  const extension = [];
  const comment = [];
  const keep = [];
  for (const line of lines) {
    const match = line.match(/^\s*\d+;\s+\d+\s+\d+\s+(EXTENSION|COMMENT)\s+-\s+(.+?)\s*$/);
    if (!match) { keep.push(line); continue; }
    const [, type, description] = match;
    if (type === 'EXTENSION' && description === 'pg_session_jwt') extension.push(line);
    else if (type === 'COMMENT' && description === 'EXTENSION pg_session_jwt') comment.push(line);
    else keep.push(line);
  }
  if (extension.length !== 1 || comment.length > 1) fail('archive TOC must contain exactly one pg_session_jwt EXTENSION record and at most one exact COMMENT record');
  const filteredToc = keep.join('\n');
  return { sourceSha256, filteredSha256: createHash('sha256').update(filteredToc).digest('hex'), excludedEntries: [...extension, ...comment], filteredToc, changed: true };
}

function normalizeKey(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let value = raw.trim();
  if (value.includes('\\') || value.includes('%')) return null;
  try { if (/^https?:\/\//i.test(value)) value = new URL(value).pathname; } catch { return null; }
  value = value.replace(/^\/+/, '').replace(/^(?:uploads|public)\//, '');
  const pieces = value.split('/');
  if (pieces.some((p) => !p || p === '.' || p === '..' || p.includes('\0'))) return null;
  return pieces.join('/');
}

const refKeys = ['key', 'storageKey', 'url', 'path', 'filename'];
const blobKeys = ['key', 'pathname', 'url', 'filename'];
function keyOf(item, keys) { for (const k of keys) { const n = normalizeKey(item?.[k]); if (n) return n; } return null; }

/** Reconcile DB-safe references and Blob metadata into a deterministic, non-copying manifest. */
export function planMediaTransfer({ references = [], blobObjects = [] } = {}) {
  if (!Array.isArray(references) || !Array.isArray(blobObjects)) fail('references and blobObjects must be arrays');
  const rows = new Map();
  for (const ref of references) {
    const key = keyOf(ref, refKeys);
    const rawKey = refKeys.map((k) => ref?.[k]).find((v) => typeof v === 'string' && v.trim());
    const id = key ?? `blocked:${String(rawKey ?? 'missing')}`;
    const current = rows.get(id) ?? { key, references: [], tenants: new Set(), access: new Set(), expectedBytes: new Set(), expectedSha256: new Set(), blocked: new Set() };
    if (!key) current.blocked.add('invalid-or-traversal-key');
    const tenant = typeof ref.tenantId === 'string' && ref.tenantId.trim() ? ref.tenantId.trim() : null;
    if (tenant) current.tenants.add(tenant);
    else current.blocked.add('unowned-reference');
    const family = typeof ref.family === 'string' && /^[a-zA-Z0-9_.:-]{1,80}$/.test(ref.family) ? ref.family : 'unspecified';
    current.references.push(family);
    current.access.add(ref.private === true || ref.access === 'private' ? 'private' : ref.private === false || ref.access === 'public' ? 'public' : 'unknown');
    if (Number.isSafeInteger(ref.sizeBytes) && ref.sizeBytes >= 0) current.expectedBytes.add(ref.sizeBytes);
    if (typeof ref.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(ref.sha256)) current.expectedSha256.add(ref.sha256.toLowerCase());
    rows.set(id, current);
  }
  const objects = new Map();
  for (const obj of blobObjects) {
    const key = keyOf(obj, blobKeys);
    const id = key ?? `blocked:${String(obj.key ?? obj.pathname ?? 'missing')}`;
    const current = objects.get(id) ?? { key, entries: [] };
    current.entries.push({ sizeBytes: Number.isSafeInteger(obj.sizeBytes) && obj.sizeBytes >= 0 ? obj.sizeBytes : null, sha256: typeof obj.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(obj.sha256) ? obj.sha256.toLowerCase() : null });
    objects.set(id, current);
  }
  const all = new Set([...rows.keys(), ...objects.keys()]);
  const manifest = [...all].sort().map((id) => {
    const r = rows.get(id); const o = objects.get(id); const key = r?.key ?? o?.key ?? null;
    const tenants = [...(r?.tenants ?? [])].sort(); const access = [...(r?.access ?? [])].sort();
    const blocked = new Set(r?.blocked ?? []);
    if (!key) blocked.add('invalid-or-traversal-key');
    if (tenants.length > 1) blocked.add('cross-tenant-ownership-conflict');
    if (tenants.some((tenant) => !/^[a-zA-Z0-9_-]{1,100}$/.test(tenant))) blocked.add('unsafe-tenant-id');
    if (access.includes('unknown') || access.length > 1) blocked.add('public-private-access-ambiguous');
    const sourceObjects = o?.entries ?? [];
    if (sourceObjects.length > 1) blocked.add('blob-key-collision');
    const expectedSize = r?.expectedBytes?.size === 1 ? [...r.expectedBytes][0] : null;
    if (r?.expectedBytes?.size > 1) blocked.add('reference-size-conflict');
    const expectedHash = r?.expectedSha256?.size === 1 ? [...r.expectedSha256][0] : null;
    if (r?.expectedSha256?.size > 1) blocked.add('reference-checksum-conflict');
    const blob = sourceObjects[0] ?? null;
    if (r && !blob) blocked.add('referenced-object-metadata-missing');
    if (!r && blob) blocked.add('unreferenced-blob-object');
    if (blob && expectedSize !== null && blob.sizeBytes !== expectedSize) blocked.add('size-mismatch');
    if (blob && expectedHash && blob.sha256 && blob.sha256 !== expectedHash) blocked.add('checksum-mismatch');
    let targetKey = null;
    if (key && tenants.length === 1 && !blocked.has('unsafe-tenant-id')) {
      const segments = key.split('/');
      if (APPLICATION_STORAGE_NAMESPACES.has(segments[0])) {
        if (segments[1] !== tenants[0]) blocked.add('target-namespace-ownership-mismatch');
        else targetKey = key;
      } else {
        targetKey = `tenants/${tenants[0]}/uploads/${segments.at(-1)}`;
      }
    }
    return { sourceKey: key, targetKey, tenantId: tenants.length === 1 ? tenants[0] : null, access: access.length === 1 ? access[0] : 'ambiguous', referenceCount: r?.references.length ?? 0,
      referenceFamilies: [...new Set(r?.references ?? [])].sort(), objectCount: sourceObjects.length, bytes: blob?.sizeBytes ?? null,
      expectedBytes: expectedSize, sha256: blob?.sha256 ?? expectedHash, status: blocked.size ? 'blocked' : 'planned', blockers: [...blocked].sort() };
  });
  const targetCounts = new Map();
  for (const item of manifest) if (item.targetKey) targetCounts.set(item.targetKey, (targetCounts.get(item.targetKey) ?? 0) + 1);
  for (const item of manifest) if (item.targetKey && targetCounts.get(item.targetKey) > 1) {
    item.blockers = [...new Set([...item.blockers, 'target-key-collision'])].sort();
    item.status = 'blocked';
  }
  const payload = { version: 1, action: 'plan-only-no-download-no-copy', objectCount: manifest.length, bytes: manifest.reduce((n, x) => n + (x.bytes ?? 0), 0), entries: manifest };
  const canonical = JSON.stringify(payload);
  return Object.freeze({ ...payload, manifestSha256: createHash('sha256').update(canonical).digest('hex') });
}
