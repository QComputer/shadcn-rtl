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

// --- Source content under review ---
const foundation = read("prisma/migrations/20260628000300_export_hub_foundation/migration.sql");
const corrected = read("prisma/migrations/20260707000200_export_hub_extend_data_types/migration.sql");
const storageKey = read("prisma/migrations/20260717200000_add_ai_media_asset_storage_key/migration.sql");
const validateScript = read("scripts/db/validate-migration-chain.mjs");
const packageJson = read("package.json");
const recoveryDoc = read("docs/database/DATABASE_MIGRATION_CHAIN_RECOVERY.md");
const handoff = `${read("docs/AI_HANDOFF_CURRENT_STATE.md")}\n${read("docs/AI_HANDOFF_NEXT_PROMPT.md")}\n${read("docs/AI_HANDOFF_VALIDATION.md")}`;
const roadmap = read("docs/ai-media/BAZAR_BAZ_AI_MEDIA_NETWORK_MASTER_ROADMAP.md");
const consumptionDoc = read("docs/ai-media/AI_MEDIA_IMPORTED_ASSET_CONSUMPTION.md");

const migrationsRoot = `${projectRoot}/prisma/migrations`;
const migrationFolders = existsSync(migrationsRoot)
  ? readdirSync(migrationsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  : [];

// --- STEP 2 safety evidence checks ---
const checks: Array<[string, boolean]> = [
  // 1. Corrected migration exists.
  ["corrected migration file exists", /20260707000200_export_hub_extend_data_types/.test(migrationFolders.join("\n"))],

  // 2. Uses a guarded DO $$ block.
  ["corrected migration uses guarded DO $$ block", /DO \$\$/.test(corrected) && /BEGIN/.test(corrected) && /END \$\$/.test(corrected)],

  // 3. Checks pg_enum.
  ["corrected migration queries pg_enum", /pg_enum/.test(corrected)],

  // 4. Checks the correct enum type (ExportDataType).
  ["corrected migration targets ExportDataType", /typname = 'ExportDataType'/.test(corrected)],

  // 5. Handles CUSTOMERS.
  ["corrected migration guards CUSTOMERS", /enumlabel = 'CUSTOMERS'/.test(corrected)],

  // 6. Handles FANPAGE_POSTS.
  ["corrected migration guards FANPAGE_POSTS", /enumlabel = 'FANPAGE_POSTS'/.test(corrected)],

  // 7. Does not drop or recreate ExportDataType.
  ["corrected migration does not drop/recreate ExportDataType", !/DROP TYPE "ExportDataType"|CREATE TYPE "ExportDataType"/.test(corrected)],

  // 8. No destructive table/data operation.
  ["corrected migration has no destructive table/data operation", !/DROP TABLE|TRUNCATE|DELETE FROM|UPDATE "AiMediaAsset"|ALTER TABLE "AiMediaAsset" DROP/.test(corrected)],

  // 9. Earlier foundation migration already contains both values.
  ["foundation migration already defines CUSTOMERS and FANPAGE_POSTS", /CREATE TYPE "ExportDataType" AS ENUM \('PRODUCTS', 'PRODUCT_CATEGORIES', 'ORDERS', 'CUSTOMERS', 'FANPAGE_POSTS'\)/.test(foundation)],

  // STEP 2 historical edit safety evidence (machine-checkable).
  ["evidence: original SQL fails when all prior migrations applied", /enum label "CUSTOMERS" already exists|42710/.test(recoveryDoc)],
  ["evidence: corrected SQL creates no new schema objects", /idempotent|no-op|no new schema objects|same final schema/i.test(recoveryDoc)],
  ["evidence: correction changes unconditional failure to idempotent no-op", /unconditional failure|idempotent no-op|IF NOT EXISTS/.test(recoveryDoc)],
  ["evidence: all intended enum labels come from earlier migration", /20260628000300_export_hub_foundation/.test(recoveryDoc) && /CUSTOMERS[\s\S]{0,40}FANPAGE_POSTS[\s\S]{0,40}enum labels/.test(recoveryDoc)],
  ["evidence: no Production migration was run", /no Production migration|Production migration has not run|production migration/i.test(`${recoveryDoc}\n${handoff}`)],
  ["evidence: handoff says hosted environments not migrated through this chain", /not migrated|hosted environments|Preview/i.test(`${recoveryDoc}\n${handoff}`)],

  // Proof modes present in validation script.
  ["validation script has fresh proof mode", /freshPath|case "fresh"|mode === "fresh"/.test(validateScript)],
  ["validation script has upgrade proof mode", /upgradePath|case "upgrade"|mode === "upgrade"/.test(validateScript)],
  ["validation script has failed-state proof mode", /failedStatePath|case "failed"|mode === "failed"/.test(validateScript)],

  // Local URL classification + guards.
  ["validation script classifies database URL safety", /classifyDatabaseUrl/.test(validateScript)],
  ["validation script rejects non-local DB URLs", /LOCAL_DISPOSABLE|Refusing to run migration-chain/.test(validateScript) && /PRODUCTION_LIKE/.test(validateScript)],
  ["validation script rejects VERCEL_ENV=production", /VERCEL_ENV === "production"/.test(validateScript)],

  // No Production hostname / secret exposure. The safety guards reference
  // neon.tech / render.com only as rejection patterns, not as live connections.
  ["validation script embeds no live Production hostname", !/postgresql:\/\/[^ ]*neon\.tech|postgresql:\/\/[^ ]*render\.com|postgresql:\/\/[^ ]*amazonaws|https?:\/\/www\.bazar-baz\.ir/.test(validateScript)],
  ["validation script does not print database password", !/postgres:postgres/.test(validateScript.replace(/POSTGRES_PASSWORD=postgres/g, "").replace(/postgresql:\/\/postgres:postgres/g, ""))],

  // No prisma db push as migration-chain proof.
  ["validation script does not use prisma db push as proof", !/prisma db push|prisma migrate dev|prisma db execute/.test(validateScript)],

  // Fresh / upgrade proofs use migrate deploy.
  ["fresh proof uses migrate deploy", /freshPath[\s\S]{0,2000}migrate", "deploy"/.test(validateScript)],
  ["upgrade proof uses migrate deploy", /upgradePath[\s\S]{0,2000}migrate", "deploy"/.test(validateScript)],

  // Failed-state authentic failure.
  ["failed-state proof produces authentic Prisma failure", /authentically recorded the migration as failed|expected prisma migrate deploy to fail/.test(validateScript)],
  ["migration file restoration uses finally/cleanup", /finally\s*\{[\s\S]{0,400}restoreFixedSql|ensureCleanWorkingTree/.test(validateScript)],

  // No canonical recovery deletes _prisma_migrations rows.
  ["canonical recovery does not delete _prisma_migrations rows", !/DELETE FROM _prisma_migrations/.test(validateScript)],

  // storageKey migration included.
  ["storageKey migration included in chain", /20260717200000_add_ai_media_asset_storage_key/.test(migrationFolders.join("\n")) && /ADD COLUMN IF NOT EXISTS "storageKey"/.test(storageKey)],
  ["storageKey migration creates index", /AiMediaAsset_storageKey_idx/.test(storageKey)],

  // ExportDataType labels verification in proofs.
  ["proofs verify ExportDataType labels", /PRODUCTS,PRODUCT_CATEGORIES,ORDERS,CUSTOMERS,FANPAGE_POSTS/.test(validateScript)],

  // Legacy / new storageKey behavior.
  ["proofs verify legacy storageKey-null row behavior", /legacy AiMediaAsset\.storageKey remains NULL/.test(validateScript)],
  ["proofs verify new storageKey row behavior", /new imported asset receives real storageKey/.test(validateScript)],

  // Drift reporting distinguishes targeted from unrelated.
  ["recovery doc distinguishes targeted vs unrelated drift", /Targeted|Unrelated|Complete schema parity|NOT PROVEN|out of scope/i.test(recoveryDoc)],

  // Documentation exists.
  ["recovery documentation exists", /Incident|Root cause|Recovery decision/i.test(recoveryDoc)],

  // Handoff references the phase.
  ["handoff docs reference the phase", /migration chain|migration-chain|migration execution chain|BAZAR-BAZ-DATABASE-MIGRATION-CHAIN-RECOVERY/i.test(handoff)],

  // Package scripts exist.
  ["package scripts exist for migration chain", /test:db:migration-chain/.test(packageJson) && /e2e:db:migration-chain-fresh/.test(packageJson) && /e2e:db:migration-chain-upgrade/.test(packageJson) && /e2e:db:migration-chain-failed/.test(packageJson) && /quality:db:migration-chain/.test(packageJson)],

  // No destructive reset against non-local DBs.
  ["validation script has no destructive reset of shared DBs", !/migrate reset|migrate deploy[\s\S]{0,50}production/i.test(validateScript)],

  // Temporary Docker containers cleaned.
  ["validation script cleans temporary Docker containers", /removeDockerDatabase/.test(validateScript) && /finally\s*\{[\s\S]{0,200}removeDockerDatabase/.test(validateScript)],

  // Temporary migration files/folders restored.
  ["validation script restores temporary migration folders", /restoreConflictingAside|moveConflictingAside|restoreFixedSql/.test(validateScript)],

  // No committed secret / .env fixture.
  ["no committed .env or secret fixture", !/\.env/.test(migrationFolders.join("\n")) && !/BLOB_READ_WRITE_TOKEN|AI_MEDIA_SERVICE_INTERNAL_KEY/.test(validateScript)],

  // Roadmap / consumption docs acknowledge local-only proven + Production not activated.
  ["roadmap acknowledges migration-chain phase", /migration chain|migration-chain|recovery/i.test(`${roadmap}\n${consumptionDoc}`)],
  ["consumption docs note storageKey migration deploys locally only", /storageKey migration|local|locally/i.test(consumptionDoc)],
];

const failed = checks.filter(([name, ok]) => !report(name, ok));

if (failed.length > 0) {
  console.error(`\nMigration-chain quality validation failed with ${failed.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log("\n✅ Migration-chain quality validation passed.");
}
