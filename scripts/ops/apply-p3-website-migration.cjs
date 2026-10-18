// Apply only this additive migration to the owner-authorized DEMO database.
// Usage: node --use-env-proxy scripts/ops/apply-p3-website-migration.cjs <env-file>
const fs = require('node:fs');
const { createHash, randomUUID } = require('node:crypto');
require('dotenv').config({ path: process.argv[2] || '.env.local', quiet: true, override: true });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
const migration = '20261018150000_tenant_website_revisions';
const source = fs.readFileSync(`prisma/migrations/${migration}/migration.sql`, 'utf8');
const checksum = createHash('sha256').update(source).digest('hex');
(async () => {
  const [identity] = await sql.query(`SELECT current_setting('neon.project_id',true) AS project,current_setting('neon.branch_id',true) AS branch,current_database() AS db`);
  if (identity.project !== 'aged-star-89488704' || identity.branch !== 'br-small-queen-aii58cw9' || identity.db !== 'neondb') throw new Error('Refused: DEMO database identity mismatch');
  const applied = await sql.query('SELECT checksum,finished_at FROM "_prisma_migrations" WHERE migration_name=$1 AND rolled_back_at IS NULL', [migration]);
  if (applied.length) {
    if (applied.length !== 1 || applied[0].checksum !== checksum || !applied[0].finished_at) throw new Error('Migration history mismatch');
    console.log('P3 migration already applied with matching checksum'); return;
  }
  const statements = source.split(';').map((s) => s.trim()).filter(Boolean);
  await sql.transaction([
    ...statements.map((statement) => sql.query(statement)),
    sql.query('INSERT INTO "_prisma_migrations" (id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES ($1,$2,NOW(),$3,NOW(),1)', [randomUUID(),checksum,migration]),
  ]);
  console.log(JSON.stringify({ migration, checksum, identity, applied: true }));
})().catch((error) => { console.error({ error: String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]') }); process.exitCode=1; });
