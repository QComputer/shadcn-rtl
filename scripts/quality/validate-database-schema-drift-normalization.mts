import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

function read(relativePath: string) {
  const path = `${projectRoot}${relativePath.startsWith("/") ? "" : "/"}${relativePath}`;
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function report(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  return ok;
}

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260719000000_normalize_schema_drift/migration.sql");
const driftScript = read("scripts/db/validate-schema-drift-normalization.mjs");
const packageJson = read("package.json");
const recoveryMigration = read("prisma/migrations/20260707000200_export_hub_extend_data_types/migration.sql");
const storageKeyMigration = read("prisma/migrations/20260717200000_add_ai_media_asset_storage_key/migration.sql");
const assetGuard = read("lib/ai-media/asset-consumption-feature-guard.ts");
const normalizationDoc = read("docs/database/DATABASE_SCHEMA_DRIFT_NORMALIZATION.md");
const recoveryDoc = read("docs/database/DATABASE_MIGRATION_CHAIN_RECOVERY.md");
const handoffDocs = [
  read("docs/AI_HANDOFF_CURRENT_STATE.md"),
  read("docs/AI_HANDOFF_NEXT_PROMPT.md"),
  read("docs/AI_HANDOFF_VALIDATION.md"),
  read("docs/CURRENT_SOURCE_OF_TRUTH.md"),
  read("docs/NEXT_PHASE_ROADMAP.md"),
  read("docs/ai-media/BAZAR_BAZ_AI_MEDIA_NETWORK_MASTER_ROADMAP.md"),
].join("\n");

const migrationFolders = readdirSync(`${projectRoot}/prisma/migrations`, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const checks: Array<[string, boolean]> = [
  ["forward normalization migration exists", migrationFolders.includes("20260719000000_normalize_schema_drift") && migration.length > 0],
  ["historical ExportDataType recovery remains guarded", /pg_enum/.test(recoveryMigration) && /enumlabel = 'CUSTOMERS'/.test(recoveryMigration) && /enumlabel = 'FANPAGE_POSTS'/.test(recoveryMigration)],
  ["storageKey migration remains intact", /ADD COLUMN IF NOT EXISTS "storageKey"/.test(storageKeyMigration) && /AiMediaAsset_storageKey_idx/.test(storageKeyMigration)],
  ["ImageAccess schema has canonical values", /enum ImageAccess\s*\{[\s\S]*PUBLIC[\s\S]*PRIVATE[\s\S]*\}/.test(schema)],
  ["ImageAccess migration is additive and guarded", /CREATE TYPE "ImageAccess" AS ENUM \('PUBLIC', 'PRIVATE'\)/.test(migration) && /ADD COLUMN IF NOT EXISTS "access"/.test(migration)],
  ["DomainStatus schema has canonical lifecycle values", /enum DomainStatus\s*\{[\s\S]*REQUESTED[\s\S]*PROVIDER_PENDING[\s\S]*DNS_REQUIRED[\s\S]*VERIFYING[\s\S]*ACTIVE[\s\S]*ERROR[\s\S]*DISABLED[\s\S]*REMOVAL_PENDING[\s\S]*REMOVED[\s\S]*\}/.test(schema)],
  ["DomainStatus migration removes legacy labels by explicit cast failure", /DomainStatus_old/.test(migration) && /PENDING->REQUESTED/.test(migration) && /FAILED->ERROR/.test(migration) && /USING \("status"::text::"DomainStatus"\)/.test(migration)],
  ["OrganizationDomain ownership constraints are restored", /OrganizationDomain_createdById_fkey/.test(migration) && /OrganizationDomain_updatedById_fkey/.test(migration) && /OrganizationDomain_reviewedById_fkey/.test(migration)],
  ["SmsDelivery FK semantics normalized", /SmsDelivery_customerId_fkey/.test(migration) && /ON DELETE SET NULL/.test(migration)],
  ["timestamp/default drift normalized", /NotificationDeliveryAttempt/.test(migration) && /DROP DEFAULT/.test(migration) && /TIMESTAMP\(3\)/.test(migration)],
  ["index differences are treated as renames", /ALTER INDEX/.test(migration) && /RENAME TO/.test(migration) && !/DROP INDEX/.test(migration)],
  ["validator has inspect, fresh, upgrade, repeat, all modes", /mode === "inspect"/.test(driftScript) && /mode === "fresh"/.test(driftScript) && /mode === "upgrade"/.test(driftScript) && /mode === "repeat"/.test(driftScript) && /mode === "all"/.test(driftScript)],
  ["validator uses migrate deploy not db push", /migrate", "deploy"/.test(driftScript) && !/db", "push"|db push|migrate dev|migrate reset/.test(driftScript)],
  ["validator asserts final migrate diff", /migrate", "diff"/.test(driftScript) && /assertZeroUnexpectedDrift/.test(driftScript)],
  ["validator reproduces original drift without filtering acceptance diff", /inspectPath/.test(driftScript) && /original-drift/.test(driftScript) && /unexpected drift/.test(driftScript)],
  ["validator has local URL guards", /classifyDatabaseUrl/.test(driftScript) && /LOCAL_DISPOSABLE/.test(driftScript) && /PRODUCTION_LIKE/.test(driftScript)],
  ["validator rejects production environment", /VERCEL_ENV === "production"/.test(driftScript)],
  ["validator uses Docker localhost dynamic ports", /127\.0\.0\.1::5432/.test(driftScript) && /postgres:16-alpine/.test(driftScript)],
  ["validator generates a random local password", /randomUUID/.test(driftScript) && /POSTGRES_PASSWORD=\$\{password\}/.test(driftScript)],
  ["validator sanitizes URLs/passwords", /sanitizeOutput/.test(driftScript) && /<redacted-local-url>/.test(driftScript) && /POSTGRES_PASSWORD=<redacted>/.test(driftScript)],
  ["validator cleans Docker containers in finally", /finally\s*\{[\s\S]*removeDockerDatabase/.test(driftScript)],
  ["validator restores temporarily moved migration", /moveNewMigrationAside/.test(driftScript) && /restoreNewMigration/.test(driftScript)],
  ["upgrade fixture includes data-preservation rows", /OrganizationDomain/.test(driftScript) && /SmsDelivery/.test(driftScript) && /AiMediaAsset/.test(driftScript) && /legacy AiMediaAsset/.test(driftScript)],
  ["legacy enum fixture coverage exists", /DomainStatus normalized/.test(driftScript) && /Image\.access default/.test(driftScript)],
  ["no destructive delete/truncate shortcut", !/TRUNCATE|DELETE FROM/.test(migration) && !/TRUNCATE|DELETE FROM/.test(driftScript)],
  ["feature guard remains Production fail-closed", /environment === "production"[\s\S]*enabled: false/.test(assetGuard)],
  ["normalization doc exists", normalizationDoc.length > 0],
  ["normalization doc classifies ImageAccess and DomainStatus", /ImageAccess/.test(normalizationDoc) && /DomainStatus/.test(normalizationDoc) && /Classification/.test(normalizationDoc)],
  ["normalization doc records original drift and final diff", /Original drift/.test(normalizationDoc) && /Final drift result/.test(normalizationDoc)],
  ["migration recovery doc updated for schema parity", /schema drift normalization|Complete schema parity/i.test(recoveryDoc)],
  ["handoff/roadmap docs mention schema drift normalization", /DATABASE-SCHEMA-DRIFT-NORMALIZATION|schema drift normalization|Complete Prisma migration\/schema parity/i.test(handoffDocs)],
  ["package scripts expose schema drift gates", /test:db:schema-drift/.test(packageJson) && /quality:db:schema-drift/.test(packageJson) && /e2e:db:schema-drift-fresh/.test(packageJson) && /e2e:db:schema-drift-upgrade/.test(packageJson)],
  ["no hosted DB URL embedded", !/postgresql:\/\/[^"'\s]*(neon|amazonaws|render|supabase)/i.test(`${migration}\n${driftScript}\n${normalizationDoc}`)],
  ["no secret-like credential embedded", !/(BLOB_READ_WRITE_TOKEN|SMS_IR_API_KEY|VAPID_PRIVATE_KEY|NEXTAUTH_SECRET=|AI_MEDIA_SERVICE_INTERNAL_KEY=)/.test(`${migration}\n${driftScript}\n${normalizationDoc}`)],
];

const failed = checks.filter(([name, ok]) => !report(name, ok));

if (failed.length > 0) {
  console.error(`\nSchema-drift normalization quality validation failed with ${failed.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log("\nSchema-drift normalization quality validation passed.");
}
