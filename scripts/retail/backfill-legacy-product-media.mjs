import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

function requiredText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} is required.`);
  }
  return value;
}

function sqlText(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

/**
 * Build a tenant-scoped preview or association backfill statement.
 * The expected database is enforced by the CLI connection identity check.
 * @param {{ organizationId?: string, expectedDatabase?: string, apply?: boolean }} options
 */
export function buildLegacyProductMediaBackfillSql({ organizationId, expectedDatabase, apply = false } = {}) {
  const organization = sqlText(requiredText(organizationId, "organizationId"));
  const database = sqlText(requiredText(expectedDatabase, "expectedDatabase"));
  if (typeof apply !== "boolean") throw new TypeError("apply must be a boolean.");

  const candidates = `eligible_matches AS (
  SELECT p."id" AS "productId", i."id" AS "imageId", p."slug"
  FROM "Product" p
  JOIN "Image" i
    ON i."url" = p."image"
   AND i."organizationId" = p."organizationId"
   AND i."access" = 'PUBLIC'
  WHERE p."organizationId" = ${organization}
    AND current_database() = ${database}
    AND p."deletedAt" IS NULL
    AND p."image" IS NOT NULL
    AND btrim(p."image") <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM "_ImageToProduct" relation
      WHERE relation."B" = p."id"
    )
  GROUP BY p."id", i."id", p."slug"
), candidates AS (
  SELECT "productId", min("imageId") AS "imageId", min("slug") AS "slug"
  FROM eligible_matches
  GROUP BY "productId"
  HAVING count(*) = 1
)`;

  if (!apply) {
    return `WITH ${candidates}
SELECT "productId", "imageId", "slug"
FROM candidates
ORDER BY "productId", "imageId";`;
  }

  return `WITH ${candidates}, inserted AS (
  INSERT INTO "_ImageToProduct" ("A", "B")
  SELECT "imageId", "productId"
  FROM candidates
  ON CONFLICT DO NOTHING
  RETURNING "A" AS "imageId", "B" AS "productId"
)
SELECT inserted."productId", inserted."imageId", candidates."slug"
FROM inserted
JOIN candidates
  ON candidates."productId" = inserted."productId"
 AND candidates."imageId" = inserted."imageId"
ORDER BY inserted."productId", inserted."imageId";`;
}

function parseArgs(argv) {
  const options = { apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (argument === "--apply") {
      options.apply = true;
      continue;
    }
    if (argument === "--organization-id" || argument === "--expected-database") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new TypeError(`${argument} requires a value.`);
      if (argument === "--organization-id") options.organizationId = value;
      else options.expectedDatabase = value;
      index += 1;
      continue;
    }
    throw new TypeError(`Unknown argument: ${argument}`);
  }
  requiredText(options.organizationId, "--organization-id");
  requiredText(options.expectedDatabase, "--expected-database");
  return options;
}

export async function runCli(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log("Usage: node scripts/retail/backfill-legacy-product-media.mjs --organization-id <id> --expected-database <name> [--apply]");
    console.log("Default mode previews candidates. --apply inserts only unambiguous tenant-owned public Image associations.");
    return;
  }
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required; no database operation was started.");

  const require = createRequire(import.meta.url);
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const sql = buildLegacyProductMediaBackfillSql(options);
    const rows = await prisma.$transaction(async (tx) => {
      const identity = await tx.$queryRawUnsafe('SELECT current_database() AS "database"');
      if (identity[0]?.database !== options.expectedDatabase) {
        throw new Error("Connected database does not match --expected-database; no backfill statement was run.");
      }
      return tx.$queryRawUnsafe(sql);
    }, { isolationLevel: "Serializable" });
    console.log(JSON.stringify({ mode: options.apply ? "apply" : "dry-run", count: rows.length, rows }, null, 2));
  } catch (error) {
    if (error instanceof TypeError) throw error;
    if (error instanceof Error && error.message.startsWith("Connected database does not match")) throw error;
    throw new Error("Legacy product media backfill failed. Database error details were suppressed.");
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : "Legacy product media backfill failed.");
    process.exitCode = 1;
  });
}
