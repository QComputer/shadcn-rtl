import "dotenv/config"
import { neon } from "@neondatabase/serverless"

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DIRECT_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL is not set")
  process.exit(1)
}

const sql = neon(databaseUrl)

async function runMigration() {
  try {
    console.log("Applying RequestDemoLead migration...")

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RequestDemoLeadStatus') THEN
          CREATE TYPE "RequestDemoLeadStatus" AS ENUM (
            'NEW',
            'REVIEWED',
            'CONTACTED',
            'QUALIFIED',
            'REJECTED',
            'ARCHIVED'
          );
        END IF;
      END
      $$;
    `
    console.log("OK: RequestDemoLeadStatus type ensured")

    await sql`
      CREATE TABLE IF NOT EXISTS "RequestDemoLead" (
        "id" TEXT NOT NULL,
        "status" "RequestDemoLeadStatus" NOT NULL DEFAULT 'NEW',
        "source" TEXT DEFAULT 'request-demo',
        "locale" TEXT NOT NULL DEFAULT 'fa',

        "fullName" TEXT NOT NULL,
        "businessName" TEXT NOT NULL,
        "businessType" TEXT NOT NULL,
        "phone" TEXT NOT NULL,
        "city" TEXT,
        "preferredContactTime" TEXT,
        "needSummary" TEXT,

        "consentAccepted" BOOLEAN NOT NULL DEFAULT false,

        "ipHash" TEXT,
        "userAgentHash" TEXT,

        "reviewedAt" TIMESTAMP(3),
        "reviewedById" TEXT,
        "adminNote" TEXT,

        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,

        CONSTRAINT "RequestDemoLead_pkey" PRIMARY KEY ("id")
      );
    `
    console.log("OK: RequestDemoLead table ensured")

    await sql`
      CREATE INDEX IF NOT EXISTS "RequestDemoLead_status_createdAt_idx"
        ON "RequestDemoLead"("status", "createdAt");
    `
    await sql`
      CREATE INDEX IF NOT EXISTS "RequestDemoLead_source_idx"
        ON "RequestDemoLead"("source");
    `
    await sql`
      CREATE INDEX IF NOT EXISTS "RequestDemoLead_createdAt_idx"
        ON "RequestDemoLead"("createdAt");
    `
    await sql`
      CREATE INDEX IF NOT EXISTS "RequestDemoLead_reviewedById_idx"
        ON "RequestDemoLead"("reviewedById");
    `
    console.log("OK: RequestDemoLead indexes ensured")

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'RequestDemoLead_reviewedById_fkey'
        ) THEN
          ALTER TABLE "RequestDemoLead"
            ADD CONSTRAINT "RequestDemoLead_reviewedById_fkey"
            FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `
    console.log("OK: RequestDemoLead foreign key ensured")

    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'RequestDemoLead'
    `
    if (tables.length > 0) {
      console.log("VERIFIED: RequestDemoLead table exists")
    } else {
      console.error("FAIL: RequestDemoLead table not found after migration")
      process.exit(1)
    }
  } catch (err) {
    console.error("RequestDemoLead migration failed:", err)
    process.exit(1)
  }
}

async function runExportDataTypeMigration() {
  try {
    console.log("Applying ExportDataType extension migration...")

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'ExportDataType' AND e.enumlabel = 'CUSTOMERS'
        ) THEN
          ALTER TYPE "ExportDataType" ADD VALUE 'CUSTOMERS';
        END IF;
      END
      $$;
    `
    console.log("OK: ExportDataType CUSTOMERS ensured")

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'ExportDataType' AND e.enumlabel = 'FANPAGE_POSTS'
        ) THEN
          ALTER TYPE "ExportDataType" ADD VALUE 'FANPAGE_POSTS';
        END IF;
      END
      $$;
    `
    console.log("OK: ExportDataType FANPAGE_POSTS ensured")

    const enumValues = await sql`
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'ExportDataType'
      ORDER BY e.enumsortorder
    `
    const labels = enumValues.map((row) => row.enumlabel)
    console.log("VERIFIED: ExportDataType values:", labels.join(", "))

    if (!labels.includes("CUSTOMERS")) {
      console.error("FAIL: ExportDataType missing CUSTOMERS")
      process.exit(1)
    }
    if (!labels.includes("FANPAGE_POSTS")) {
      console.error("FAIL: ExportDataType missing FANPAGE_POSTS")
      process.exit(1)
    }
  } catch (err) {
    console.error("ExportDataType migration failed:", err)
    process.exit(1)
  }
}

async function verifyPrismaMigrations() {
  try {
    console.log("Verifying Prisma migration history...")
    const rows = await sql`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      WHERE migration_name IN (
        '20260707000100_request_demo_lead_storage',
        '20260707000200_export_hub_extend_data_types'
      )
      ORDER BY migration_name
    `
    console.log("Prisma migration records:", JSON.stringify(rows, null, 2))

    if (rows.length < 2) {
      console.error("FAIL: Not all migrations recorded in _prisma_migrations")
      process.exit(1)
    }

    for (const row of rows) {
      if (!row.finished_at) {
        console.error(`FAIL: Migration ${row.migration_name} not finished`)
        process.exit(1)
      }
      if (row.rolled_back_at) {
        console.error(`FAIL: Migration ${row.migration_name} was rolled back`)
        process.exit(1)
      }
    }
    console.log("OK: All migrations recorded and finished")
  } catch (err) {
    console.error("Prisma migration verification failed:", err)
    process.exit(1)
  }
}

async function recordPrismaMigrations() {
  try {
    console.log("Recording migrations in _prisma_migrations...")

    const now = new Date().toISOString()

    const existing1 = await sql`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE migration_name = '20260707000100_request_demo_lead_storage'
    `
    if (existing1.length === 0) {
      await sql`
        INSERT INTO "_prisma_migrations" (
          "id", "checksum", "finished_at", "migration_name", "logs",
          "rolled_back_at", "started_at", "applied_steps_count"
        )
        VALUES (
          gen_random_uuid(),
          '7366c532379e4af6833326a69754904579db9a91819fc796ffb12d7e91a0ee97',
          ${now},
          '20260707000100_request_demo_lead_storage',
          '',
          NULL,
          ${now},
          1
        )
      `
      console.log("OK: Recorded 20260707000100_request_demo_lead_storage")
    } else {
      console.log("OK: 20260707000100_request_demo_lead_storage already recorded")
    }

    const existing2 = await sql`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE migration_name = '20260707000200_export_hub_extend_data_types'
    `
    if (existing2.length === 0) {
      await sql`
        INSERT INTO "_prisma_migrations" (
          "id", "checksum", "finished_at", "migration_name", "logs",
          "rolled_back_at", "started_at", "applied_steps_count"
        )
        VALUES (
          gen_random_uuid(),
          'a024000331ef7d5383ac8043e618619470487911bb35d0662169a38c13465b68',
          ${now},
          '20260707000200_export_hub_extend_data_types',
          '',
          NULL,
          ${now},
          1
        )
      `
      console.log("OK: Recorded 20260707000200_export_hub_extend_data_types")
    } else {
      console.log("OK: 20260707000200_export_hub_extend_data_types already recorded")
    }
  } catch (err) {
    console.error("Recording Prisma migrations failed:", err)
    process.exit(1)
  }
}

async function main() {
  await runMigration()
  await runExportDataTypeMigration()
  await recordPrismaMigrations()
  await verifyPrismaMigrations()
  console.log("\nAll production migrations applied and verified.")
}

main()
