import { readdir } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const expectedDatabase = "hotel_f5_rehearsal";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const parsed = new URL(databaseUrl);
if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || decodeURIComponent(parsed.pathname.slice(1)) !== expectedDatabase) {
  throw new Error("F5 rehearsal guard: only the local hotel_f5_rehearsal database is allowed");
}

const prisma = new PrismaClient();
const before = process.argv.includes("--before");
try {
  const [identity] = await prisma.$queryRaw`SELECT current_database() AS db, current_user AS role, current_setting('transaction_read_only') AS read_only`;
  if (identity.db !== expectedDatabase || identity.role !== "hotel_f5_ci" || identity.read_only !== "off") {
    throw new Error("F5 rehearsal guard: database identity/read-write mode mismatch");
  }
  const [relations] = await prisma.$queryRaw`SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m')`;
  if (before) {
    if (relations.count !== 0) throw new Error("Expected an empty public schema before migration");
    console.log("PG17 rehearsal target identity verified; public schema is empty.");
  } else {
    const migrations = await readdir(new URL("../../prisma/migrations/", import.meta.url), { withFileTypes: true });
    const expectedCount = migrations.filter((item) => item.isDirectory()).length;
    const [ledger] = await prisma.$queryRaw`SELECT count(*)::int AS rows, count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::int AS finished, count(*) FILTER (WHERE rolled_back_at IS NOT NULL)::int AS rolled_back, count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int AS unfinished FROM public."_prisma_migrations"`;
    if (ledger.rows !== expectedCount || ledger.finished !== expectedCount || ledger.rolled_back !== 0 || ledger.unfinished !== 0) {
      throw new Error(`Migration ledger mismatch: expected ${expectedCount} cleanly applied rows`);
    }
    const expectedBranding = ["pwaMaskable192Url", "pwaMaskable512Url", "monochromeIconUrl", "markUrl", "logoInverseUrl", "themeColor", "backgroundColor"];
    if (!process.argv.includes("--after-migrate")) expectedBranding.push("applicationName", "deletedAt");
    const columns = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='OrganizationBranding'`;
    const columnNames = new Set(columns.map((row) => row.column_name));
    if (expectedBranding.some((name) => !columnNames.has(name))) throw new Error("Legacy OrganizationBranding compatibility columns are missing");
    const tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
    const tableNames = new Set(tables.map((row) => row.table_name));
    for (const table of ["Organization", "Product", "Order", "HotelProperty", "HotelRoomType"]) {
      if (!tableNames.has(table)) throw new Error(`Expected baseline table missing: ${table}`);
    }
    console.log(`PG17 rehearsal verified: ${ledger.finished}/${expectedCount} migrations, legacy branding columns, and platform plus Hotel tables.`);
  }

  if (!before) {
    const probe = `__f5_rollback_probe_${process.pid}`;
    let failedAsExpected = false;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`CREATE TABLE public."${probe}" (id integer)`);
        await tx.$queryRawUnsafe("SELECT 1 / 0");
      });
    } catch {
      failedAsExpected = true;
    }
    const [rollback] = await prisma.$queryRaw`SELECT to_regclass(${`public.${probe}`}) IS NULL AS rolled_back`;
    if (!failedAsExpected || !rollback.rolled_back) throw new Error("Forced PostgreSQL transaction failure did not roll back its DDL");
    console.log("Forced transaction failure rolled back its DDL probe.");
  }
} finally {
  await prisma.$disconnect();
}
