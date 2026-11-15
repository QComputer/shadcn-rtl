import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const tenantSlug = "retail-r3-fashion-preview";
const prefix = "perf-sql-profile-";

function assertDisposableDatabaseTarget() {
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const url = new URL(process.env[key] ?? "");
    if (!/^postgres(ql)?:$/.test(url.protocol) || !["127.0.0.1", "localhost"].includes(url.hostname)
      || url.port !== "55432" || url.pathname !== "/bazarbaaz_retail_r3") {
      throw new Error(`${key} must target the disposable loopback PostgreSQL 17 database`);
    }
  }
  if (process.env.LOCAL_PRISMA_EXPECTED_PORT !== "55432" || process.env.RETAIL_R3_EXPECTED_DATABASE !== "bazarbaaz_retail_r3") {
    throw new Error("Disposable database identity guard is missing");
  }
}

function normalizedSql(column) {
  const normalized = `lower(normalize(coalesce(${column}, ''), NFKC))`;
  const digits = "01234567890123456789";
  const letters = "يىكآ۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩";
  const translated = `translate(${normalized}, '${letters}', '${"ییکا" + digits}')`;
  const marks = "ًٌٍَُِّْٰـٕٖٜٟٔٗ٘ٙٚٛٝٞۖۗۘۙۚۛۜ۞";
  return `btrim(regexp_replace(translate(translate(${translated}, '${marks}', ''), '‌‍،؛؟…', '      '), '\\s+', ' ', 'g'))`;
}

function executionSummary(plan) {
  const root = plan?.[0]?.Plan ?? {};
  return {
    planningTimeMs: plan?.[0]?.["Planning Time"] ?? null,
    executionTimeMs: plan?.[0]?.["Execution Time"] ?? null,
    rootNode: root["Node Type"] ?? null,
    actualRows: root["Actual Rows"] ?? null,
    sharedHitBlocks: root["Shared Hit Blocks"] ?? null,
    sharedReadBlocks: root["Shared Read Blocks"] ?? null,
    plan: plan?.[0] ?? null,
  };
}

async function cleanup(organizationId) {
  await prisma.product.deleteMany({ where: { organizationId, slug: { startsWith: prefix } } });
}

async function main() {
  assertDisposableDatabaseTarget();
  const [identity] = await prisma.$queryRaw`SELECT current_database() AS database, inet_server_port() AS port, current_setting('server_version_num')::int AS version_num`;
  if (identity.database !== "bazarbaaz_retail_r3" || identity.port !== 5432 || identity.version_num < 170000 || identity.version_num >= 180000) {
    throw new Error(`Refusing query profile on unexpected database ${JSON.stringify(identity)}`);
  }
  const organization = await prisma.organization.findUnique({ where: { slug: tenantSlug }, select: { id: true, slug: true } });
  const category = organization && await prisma.productCategory.findFirst({ where: { organizationId: organization.id, isActive: true, deletedAt: null }, select: { id: true, name: true, slug: true } });
  if (!organization || !category) throw new Error("Profile tenant/category fixture is absent");
  await cleanup(organization.id);
  const rows = Array.from({ length: 3000 }, (_, index) => ({
    name: `کفش نمونه جستجو ${String(index).padStart(4, "0")}`,
    slug: `${prefix}${String(index).padStart(4, "0")}`,
    description: `کفش فارسی محصول آزمایشی برای جستجو و فیلتر ${index % 5}`,
    basePrice: 100_000 + (index % 70_000),
    brand: `برند نمونه ${index % 12}`,
    organizationId: organization.id,
    organizationSlug: organization.slug,
    categoryId: category.id,
    sortOrder: index,
  }));
  await prisma.product.createMany({ data: rows });

  const search = normalizedSql('p."name"');
  const description = normalizedSql('p."description"');
  const brand = normalizedSql('p."brand"');
  const categoryName = normalizedSql('c."name"');
  const categorySlug = normalizedSql('c."slug"');
  const searchQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT p."id", p."name", p."sortOrder", p."createdAt"
    FROM "Product" p JOIN "ProductCategory" c ON c."id" = p."categoryId"
    WHERE p."organizationId" = $1 AND p."isActive" = true AND p."deletedAt" IS NULL
      AND c."organizationId" = $1 AND c."isActive" = true AND c."deletedAt" IS NULL
      AND (${search} LIKE '%کفش%' OR ${description} LIKE '%کفش%' OR ${brand} LIKE '%کفش%' OR ${categoryName} LIKE '%کفش%' OR ${categorySlug} LIKE '%کفش%')
    ORDER BY p."sortOrder" ASC, p."name" ASC, p."id" ASC LIMIT 20 OFFSET 0`;
  const countQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT COUNT(*)::int FROM "Product" p JOIN "ProductCategory" c ON c."id" = p."categoryId"
    WHERE p."organizationId" = $1 AND p."isActive" = true AND p."deletedAt" IS NULL
      AND c."organizationId" = $1 AND c."isActive" = true AND c."deletedAt" IS NULL
      AND (${search} LIKE '%کفش%' OR ${description} LIKE '%کفش%' OR ${brand} LIKE '%کفش%' OR ${categoryName} LIKE '%کفش%' OR ${categorySlug} LIKE '%کفش%')`;
  const categoryFacetQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT c."id", c."slug", c."name", COUNT(DISTINCT p."id")::int AS "count"
    FROM "ProductCategory" c LEFT JOIN "Product" p
      ON p."organizationId" = $1 AND p."isActive" = true AND p."deletedAt" IS NULL
      AND EXISTS (SELECT 1 FROM "ProductCategory" pc WHERE pc."id" = p."categoryId" AND pc."organizationId" = $1 AND pc."isActive" = true AND pc."deletedAt" IS NULL)
      AND p."categoryId" = c."id"
    WHERE c."organizationId" = $1 AND c."isActive" = true AND c."deletedAt" IS NULL
    GROUP BY c."id", c."slug", c."name", c."sortOrder" ORDER BY c."sortOrder", c."name", c."id"`;
  const brandFacetQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT btrim(p."brand") AS "value", COUNT(DISTINCT p."id")::int AS "count"
    FROM "Product" p JOIN "ProductCategory" c ON c."id" = p."categoryId"
    WHERE p."organizationId" = $1 AND p."isActive" = true AND p."deletedAt" IS NULL
      AND c."organizationId" = $1 AND c."isActive" = true AND c."deletedAt" IS NULL AND NULLIF(btrim(p."brand"), '') IS NOT NULL
    GROUP BY btrim(p."brand") ORDER BY btrim(p."brand")`;
  try {
    const plans = {};
    for (const [name, query] of Object.entries({ searchPage: searchQuery, searchCount: countQuery, categoryFacets: categoryFacetQuery, brandFacets: brandFacetQuery })) {
      const result = await prisma.$queryRawUnsafe(query, organization.id);
      plans[name] = executionSummary(result[0]?.["QUERY PLAN"]);
    }
    const report = { database: identity, organization: organization.slug, syntheticSearchRows: rows.length, category: category.slug, generatedAt: new Date().toISOString(), queryPlans: plans, indexChanges: "none" };
    const output = path.resolve(process.env.RETAIL_PERF_ARTIFACT_DIR ?? "artifacts/retail-performance", "postgres-query-plans.json");
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, JSON.stringify(report, null, 2));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await cleanup(organization.id);
  }
}

try { await main(); }
finally { await prisma.$disconnect(); }
