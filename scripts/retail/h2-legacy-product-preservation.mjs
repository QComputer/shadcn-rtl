import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const databaseName = "bazarbaaz_retail_r4";
const port = "55433";
for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
  const url = new URL(process.env[key] ?? "");
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol), `${key} must use PostgreSQL`);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), `${key} must be loopback-only`);
  assert.equal(url.port, port, `${key} must use the isolated CI port`);
  assert.equal(url.pathname, `/${databaseName}`, `${key} must use the isolated CI database`);
  assert.equal(url.username, "retail_r4", `${key} must use the synthetic CI role`);
}
if (process.env.RETAIL_R4_EXPECTED_DATABASE !== databaseName || process.env.LOCAL_PRISMA_EXPECTED_PORT !== port) {
  throw new Error("Missing explicit H2 disposable PostgreSQL identity guards");
}

const prisma = new PrismaClient();
const organizationSlug = "retail-h2-legacy-preservation";
const productSlugs = ["retail-h2-legacy-shoe-01", "retail-h2-legacy-shoe-02", "retail-h2-legacy-shoe-03"];
const snapshotPath = path.join(process.env.RUNNER_TEMP ?? "", "retail-h2-legacy-products-before.json");
const mode = process.argv[2];

async function identity() {
  const rows = await prisma.$queryRaw`SELECT current_database() AS database, current_user AS role, current_schema() AS schema, current_setting('server_version_num')::int AS version_num`;
  assert.deepEqual(rows[0], { database: databaseName, role: "retail_r4", schema: "public", version_num: rows[0].version_num });
  assert.ok(rows[0].version_num >= 170000 && rows[0].version_num < 180000, "must be PostgreSQL 17");
}

try {
  await identity();
  if (mode === "seed") {
    if (!process.env.RUNNER_TEMP || !path.isAbsolute(process.env.RUNNER_TEMP)) throw new Error("RUNNER_TEMP must be an absolute ephemeral path");
    assert.equal(await prisma.organization.count({ where: { slug: organizationSlug } }), 0, "fresh DB must not already contain the preservation fixture");
    const organization = await prisma.organization.create({ data: { type: "SHOP", name: "[H2 SYNTHETIC] Legacy product preservation", slug: organizationSlug } });
    const category = await prisma.productCategory.create({ data: { name: "[H2 SYNTHETIC] Legacy category", slug: "legacy-category", organizationId: organization.id, organizationSlug } });
    const expected = { organizationId: organization.id, categoryId: category.id, products: [] };
    for (let index = 0; index < productSlugs.length; index += 1) {
      const imageUrl = `/retail-h2-synthetic/legacy-${index + 1}.png`;
      const image = await prisma.image.create({ data: { url: imageUrl, filename: `legacy-${index + 1}.png`, mimeType: "image/png", organizationId: organization.id, access: "PUBLIC", purpose: "retail-h2-synthetic" } });
      const product = await prisma.product.create({ data: {
        name: `[H2 SYNTHETIC] Legacy shoe ${index + 1}`, slug: productSlugs[index], description: `legacy description ${index + 1}`,
        basePrice: 123000 + index, image: imageUrl, images: { connect: [{ id: image.id }] },
        organizationId: organization.id, organizationSlug, categoryId: category.id, isActive: index !== 2,
        trackInventory: true, lowStockThreshold: 3 + index, sortOrder: index + 1,
        variants: { create: [{ name: `legacy size ${index + 1}`, sku: `H2-LEGACY-${index + 1}`, inventory: 7 + index, reservedQuantity: 1 }] },
      },
      include: {
        images: { select: { id: true } },
        variants: { select: { id: true, sku: true, inventory: true, reservedQuantity: true } },
      },
    });
      expected.products.push({
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        basePrice: String(product.basePrice),
        image: product.image,
        isActive: product.isActive,
        categoryId: product.categoryId,
        organizationId: product.organizationId,
        organizationSlug: product.organizationSlug,
        lowStockThreshold: product.lowStockThreshold,
        sortOrder: product.sortOrder,
        imageAsset: { id: product.images[0].id, url: imageUrl, filename: `legacy-${index + 1}.png` },
        variant: {
          id: product.variants[0].id,
          sku: product.variants[0].sku,
          inventory: product.variants[0].inventory,
          reservedQuantity: product.variants[0].reservedQuantity,
        },
      });
    }
    fs.writeFileSync(snapshotPath, JSON.stringify(expected, null, 2), { flag: "wx" });
    console.log("H2 legacy fixture seeded after R4 migrations and before H2 migration: 3 products, 3 images, 3 variants.");
  } else if (mode === "verify") {
    if (!fs.existsSync(snapshotPath)) throw new Error("Pre-migration legacy product snapshot is missing");
    const expected = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
    const ledger = await prisma.$queryRaw`SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL)::int AS applied,
      COUNT(*) FILTER (WHERE "rolled_back_at" IS NOT NULL)::int AS rolled_back
      FROM "_prisma_migrations"`;
    assert.deepEqual(ledger[0], { total: 100, applied: 100, rolled_back: 0 }, "complete R4+H2 migration ledger must be successful");
    const organization = await prisma.organization.findUniqueOrThrow({ where: { slug: organizationSlug }, select: { id: true } });
    assert.equal(organization.id, expected.organizationId, "legacy organization identity must not change");
    const products = await prisma.product.findMany({ where: { organizationId: organization.id, slug: { in: productSlugs } }, orderBy: { slug: "asc" }, select: {
      id: true, slug: true, name: true, description: true, basePrice: true, image: true, isActive: true,
      categoryId: true, organizationId: true, organizationSlug: true, lowStockThreshold: true, sortOrder: true,
      images: { select: { id: true, url: true, filename: true } }, variants: { select: { id: true, sku: true, inventory: true, reservedQuantity: true } },
      categoryAssignments: { select: { categoryId: true, organizationId: true } },
    } });
    assert.equal(products.length, 3, "all legacy synthetic products must remain");
    for (let index = 0; index < 3; index += 1) {
      const product = products[index];
      const before = expected.products[index];
      assert.equal(product.slug, productSlugs[index]);
      assert.equal(product.id, before.id, "legacy product identifier must not change");
      assert.equal(product.name, before.name);
      assert.equal(product.description, before.description);
      assert.equal(String(product.basePrice), before.basePrice);
      assert.equal(product.image, before.image);
      assert.equal(product.isActive, before.isActive);
      assert.equal(product.organizationId, before.organizationId);
      assert.equal(product.organizationSlug, before.organizationSlug);
      assert.equal(product.lowStockThreshold, before.lowStockThreshold);
      assert.equal(product.sortOrder, before.sortOrder);
      assert.equal(product.categoryAssignments.length, 1, "primary category must be backfilled exactly once");
      assert.equal(product.categoryAssignments[0].categoryId, product.categoryId);
      assert.equal(product.categoryId, before.categoryId, "legacy primary category must not change");
      assert.equal(product.categoryAssignments[0].organizationId, organization.id);
      assert.equal(product.images.length, 1);
      assert.deepEqual(product.images[0], before.imageAsset, "legacy image association must not change");
      assert.equal(product.variants.length, 1);
      assert.deepEqual(product.variants[0], before.variant, "legacy variant and stock state must not change");
    }
    console.log("H2 legacy preservation PASS: identifiers, categories, status, image links, prices, and variant stock remain intact; primary assignments backfilled 3/3.");
  } else throw new Error("Mode must be seed or verify");
} finally {
  await prisma.$disconnect();
}
