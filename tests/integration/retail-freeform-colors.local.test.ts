import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { revalidatePath } from "next/cache";
import type { TenantContext } from "@/lib/tenant-context";
import {
  generateRetailVariants,
  getMerchantRetailProduct,
  updateMerchantRetailProduct,
  variantGenerationSchema,
} from "@/lib/retail/merchant-catalog.server";

function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL is required for integration test.");
  assert.ok(/127\.0\.0\.1|localhost/i.test(url), "DATABASE_URL must point to local isolated test DB.");
  assert.ok(!/neon|production|supabase\.co/i.test(url), "DATABASE_URL must not target a remote/production DB.");
  return url;
}

const url = databaseUrl();
assert.equal(process.env.DATABASE_RUNTIME_ADAPTER, "postgresql", "DATABASE_RUNTIME_ADAPTER=postgresql required.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }), log: ["error"] });

after(async () => {
  await db.$disconnect();
});

function slug(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

async function seedTenant(prefix: string) {
  const s = slug(prefix);
  const org = await db.organization.create({
    data: { name: `Org ${s}`, slug: s, isActive: true, type: "SHOP" },
    select: { id: true, slug: true },
  });
  const user = await db.user.create({
    data: { email: `${s}@test.local`, name: `User ${s}`, role: "MANAGER", emailVerified: new Date(), password: "test-password-not-used" },
    select: { id: true },
  });
  await db.organizationMember.create({ data: { organizationId: org.id, organizationSlug: org.slug, userId: user.id, role: "ADMIN" } });
  const category = await db.productCategory.create({
    data: { name: `Category ${s}`, slug: `cat-${s}`, organizationId: org.id, organizationSlug: org.slug, isActive: true },
    select: { id: true },
  });
  const image = await db.image.create({
    data: { filename: `img-${s}.png`, url: `https://example.test/${s}.png`, access: "PUBLIC", organization: { connect: { id: org.id } }, uploadedBy: { connect: { id: user.id } } },
    select: { id: true, url: true },
  });
  const colorDef = await db.retailAttributeDefinition.create({
    data: { organizationId: org.id, key: "shoe_color", label: "رنگ کفش", scope: "VARIANT_OPTION", valueType: "ENUM", allowedValues: ["مشکی"], isActive: true },
    select: { id: true, key: true, label: true },
  });
  const sizeDef = await db.retailAttributeDefinition.create({
    data: { organizationId: org.id, key: "size", label: "سایز", scope: "VARIANT_OPTION", valueType: "TEXT", isActive: true },
    select: { id: true, key: true, label: true },
  });
  const context: TenantContext = { organizationId: org.id, organizationSlug: org.slug, actorUserId: user.id, role: "MANAGER" as TenantContext["role"] };
  return { org, user, category, image, colorDef, sizeDef, context };
}

async function seedProduct(tenant: Awaited<ReturnType<typeof seedTenant>>, name: string) {
  const product = await db.product.create({
    data: {
      name, slug: slug("prod"), basePrice: 100000, image: tenant.image.url, isActive: false,
      organizationId: tenant.org.id, organizationSlug: tenant.org.slug, categoryId: tenant.category.id,
      images: { connect: [{ id: tenant.image.id }] },
    },
    select: { id: true },
  });
  return product;
}

async function cleanupTenant(tenant: Awaited<ReturnType<typeof seedTenant>>) {
  const orgId = tenant.org.id;
  const variants = await db.productVariant.findMany({ where: { product: { organizationId: orgId } }, select: { id: true } });
  const variantIds = variants.map((v) => v.id);
  if (variantIds.length) {
    await db.productVariantAttributeValue.deleteMany({ where: { variantId: { in: variantIds } } });
    await db.productVariantImage.deleteMany({ where: { variantId: { in: variantIds } } });
    await db.inventoryMovement.deleteMany({ where: { variantId: { in: variantIds } } });
  }
  await db.productVariant.deleteMany({ where: { product: { organizationId: orgId } } });
  await db.productAttributeValue.deleteMany({ where: { product: { organizationId: orgId } } });
  await db.productCategoryAssignment.deleteMany({ where: { product: { organizationId: orgId } } });
  await db.productTagAssignment.deleteMany({ where: { product: { organizationId: orgId } } });
  await db.product.deleteMany({ where: { organizationId: orgId } });
  await db.retailAttributeDefinition.deleteMany({ where: { organizationId: orgId } });
  await db.image.deleteMany({ where: { organizationId: orgId } });
  await db.productCategory.deleteMany({ where: { organizationId: orgId } });
  await db.organizationMember.deleteMany({ where: { organizationId: orgId } });
  await db.organization.deleteMany({ where: { id: orgId } });
  await db.user.deleteMany({ where: { id: tenant.user.id } });
}


test("retail freeform colors: real persistence, isolation, and storefront selection data", { timeout: 120000 }, async (t) => {
  const originalRevalidate = revalidatePath as unknown as (...args: unknown[]) => unknown;
  (revalidatePath as unknown as (...args: unknown[]) => void) = () => undefined;
  t.after(() => {
    (revalidatePath as unknown as (...args: unknown[]) => unknown) = originalRevalidate;
  });

  const tenantA = await seedTenant("rfc-a");
  const tenantB = await seedTenant("rfc-b");
  t.after(async () => {
    await cleanupTenant(tenantA).catch(() => undefined);
    await cleanupTenant(tenantB).catch(() => undefined);
  });

  await t.test("DB isolation evidence", async () => {
    const parsed = new URL(url);
    assert.equal(parsed.hostname, "127.0.0.1");
    assert.match(parsed.pathname, /retail_test/);
    // Disposable container created for this run; no Damoon/shared merchant data touched.
    const orgCount = await db.organization.count({ where: { slug: { in: [tenantA.org.slug, tenantB.org.slug] } } });
    assert.equal(orgCount, 2);
  });

  const persianColors = ["مشکی", "زیتونی", "کرم استخوانی", "آبی نفتی"];
  const product = await seedProduct(tenantA, "Shoe A");

  await t.test("1/3/6: generate Persian custom colors, persist, reload with storefront selection data", async () => {
    const input = variantGenerationSchema.parse({
      colorDefinitionId: tenantA.colorDef.id,
      sizeDefinitionId: tenantA.sizeDef.id,
      sizeMode: "STANDARD",
      standardSizes: ["38"],
      colorValues: persianColors,
      inventory: 7,
      price: 250000,
    });
    const result = await generateRetailVariants(tenantA.context, tenantA.user.id, product.id, input);
    assert.equal(result.added, 4);

    const loaded = await getMerchantRetailProduct(tenantA.context, product.id);
    assert.equal(loaded.variants.length, 4);
    const gotColors = loaded.variants.map((v) => String(v.options.find((o) => o.definitionId === tenantA.colorDef.id)?.value ?? "")).sort();
    assert.deepEqual(gotColors, [...persianColors].sort());
    for (const v of loaded.variants) {
      assert.equal(v.inventory, 7);
      assert.equal(v.price, 250000);
      assert.ok(v.sku && v.sku.length > 0);
      assert.equal(v.availableQuantity, 7);
      assert.ok(v.options.some((o) => o.definitionId === tenantA.sizeDef.id && String(o.value) === "38"));
    }
  });

  await t.test("2/7: mix predefined+custom, duplicate custom deduped, SKU uniqueness preserved", async () => {
    const before = await getMerchantRetailProduct(tenantA.context, product.id);
    const input = variantGenerationSchema.parse({
      colorDefinitionId: tenantA.colorDef.id,
      sizeDefinitionId: tenantA.sizeDef.id,
      sizeMode: "STANDARD",
      standardSizes: ["39"],
      colorValues: ["مشکی", "قرمز سفارشی", "قرمز سفارشی", " آبی نفتی "],
      inventory: 5,
    });
    const result = await generateRetailVariants(tenantA.context, tenantA.user.id, product.id, input);
    assert.equal(result.added, 3); // requested duplicates trimmed/deduped; مشکی/آبی نفتی are new combos at size 39

    const loaded = await getMerchantRetailProduct(tenantA.context, product.id);
    assert.equal(loaded.variants.length, before.variants.length + 3);
    const skus = loaded.variants.map((v) => v.sku).filter(Boolean);
    assert.equal(new Set(skus).size, skus.length);
    const combo39 = loaded.variants.filter((v) => v.options.some((o) => o.definitionId === tenantA.sizeDef.id && String(o.value) === "39"))
      .map((v) => String(v.options.find((o) => o.definitionId === tenantA.colorDef.id)?.value)).sort();
    assert.deepEqual(combo39, ["آبی نفتی", "قرمز سفارشی", "مشکی"].sort());
  });

  await t.test("4: add custom colors to existing product without changing original variants/prices/inventory/images/SKUs", async () => {
    const before = await getMerchantRetailProduct(tenantA.context, product.id);
    const snapshot = new Map(before.variants.map((v) => [v.id, { sku: v.sku, price: v.price, inventory: v.inventory, imageIds: v.imageIds.join(","), options: JSON.stringify(v.options.map(o => [o.definitionId, String(o.value)]).sort()) }]));
    const originalCount = before.variants.length;

    const result = await generateRetailVariants(tenantA.context, tenantA.user.id, product.id, variantGenerationSchema.parse({
      colorDefinitionId: tenantA.colorDef.id,
      sizeDefinitionId: tenantA.sizeDef.id,
      sizeMode: "STANDARD",
      standardSizes: ["40"],
      colorValues: ["سبز یشمی"],
      inventory: 3,
      price: 310000,
    }));
    assert.equal(result.added, 1);

    const afterLoad = await getMerchantRetailProduct(tenantA.context, product.id);
    assert.equal(afterLoad.variants.length, originalCount + 1);
    for (const [id, snap] of snapshot) {
      const v = afterLoad.variants.find((x) => x.id === id);
      assert.ok(v, `original variant ${id} missing`);
      assert.equal(v.sku, snap.sku);
      assert.equal(v.price, snap.price);
      assert.equal(v.inventory, snap.inventory);
      assert.equal(v.imageIds.join(","), snap.imageIds);
      assert.equal(JSON.stringify(v.options.map(o => [o.definitionId, String(o.value)]).sort()), snap.options);
    }
    const added = afterLoad.variants.find((v) => !snapshot.has(v.id));
    assert.ok(added);
    assert.equal(String(added.options.find((o) => o.definitionId === tenantA.colorDef.id)?.value), "سبز یشمی");
  });

  await t.test("5: save and reload custom-color gallery/appearance settings", async () => {
    const loaded = await getMerchantRetailProduct(tenantA.context, product.id);
    const customColor = loaded.variants.find((v) => String(v.options.find((o) => o.definitionId === tenantA.colorDef.id)?.value) === "سبز یشمی");
    assert.ok(customColor);
    const updated = await updateMerchantRetailProduct(tenantA.context, tenantA.user.id, product.id, {
      gallerySettings: {
        version: 1,
        productImageIds: loaded.imageIds,
        colors: [{ definitionId: tenantA.colorDef.id, value: "سبز یشمی", imageIds: [] }],
        appearanceGroups: [{ definitionId: tenantA.colorDef.id, value: "سبز یشمی", lightImageId: null, darkImageId: null }],
      },
    });
    assert.equal(updated.gallerySettings?.colors[0]?.value, "سبز یشمی");
    const reloaded = await getMerchantRetailProduct(tenantA.context, product.id);
    assert.deepEqual(reloaded.gallerySettings?.colors.map((c) => [c.definitionId, c.value]), [[tenantA.colorDef.id, "سبز یشمی"]]);
    assert.equal(reloaded.gallerySettings?.appearanceGroups?.[0]?.value, "سبز یشمی");
  });

  await t.test("8: enforce 100-variant product cap", async () => {
    const capProduct = await seedProduct(tenantA, "Cap");
    // 10 sizes * 11 custom colors = 110
    await assert.rejects(
      () => generateRetailVariants(tenantA.context, tenantA.user.id, capProduct.id, variantGenerationSchema.parse({
        colorDefinitionId: tenantA.colorDef.id,
        sizeDefinitionId: tenantA.sizeDef.id,
        sizeMode: "STANDARD",
        standardSizes: Array.from({ length: 10 }, (_, i) => `S${i}`),
        colorValues: Array.from({ length: 11 }, (_, i) => `رنگ-${i}`),
      })),
      (error: unknown) => error instanceof Error && /100/.test(error.message),
    );
    const after = await db.productVariant.count({ where: { productId: capProduct.id, deletedAt: null } });
    assert.equal(after, 0);
  });

  await t.test("9: unrelated ENUM still rejects disallowed values (tenant-scoped, not treated as color)", async () => {
    const fabric = await db.retailAttributeDefinition.create({
      data: { organizationId: tenantA.org.id, key: "fabric", label: "جنس", scope: "VARIANT_OPTION", valueType: "ENUM", allowedValues: ["Cotton"], isActive: true },
      select: { id: true },
    });
    const p = await seedProduct(tenantA, "Fabric");
    await assert.rejects(
      () => generateRetailVariants(tenantA.context, tenantA.user.id, p.id, variantGenerationSchema.parse({
        colorDefinitionId: fabric.id, // passed as color slot in current API shape; must be strictly validated, not freeform
        colorValues: ["Linen"],
      })),
      (error: unknown) => error instanceof Error && /allowed choices/i.test(error.message),
    );
    assert.equal(await db.productVariant.count({ where: { productId: p.id, deletedAt: null } }), 0);
  });

  await t.test("10: cross-tenant isolation and custom values do not mutate other-tenant presets", async () => {
    const pB = await seedProduct(tenantB, "Tenant B");
    const result = await generateRetailVariants(tenantB.context, tenantB.user.id, pB.id, variantGenerationSchema.parse({
      colorDefinitionId: tenantB.colorDef.id,
      colorValues: ["سبز یشمی", "بنفش خاص"],
      inventory: 1,
    }));
    assert.equal(result.added, 2);

    // Tenant A cannot read/modify tenant B product
    await assert.rejects(() => getMerchantRetailProduct(tenantA.context, pB.id));
    // Tenant B preset allowedValues unchanged (customs not auto-registered)
    const defB = await db.retailAttributeDefinition.findUniqueOrThrow({ where: { id: tenantB.colorDef.id }, select: { allowedValues: true } });
    assert.deepEqual(defB.allowedValues, ["مشکی"]);
    // Tenant A custom values not created as tenant B definitions/options state pollution
    const aVariants = await db.productVariant.count({ where: { product: { organizationId: tenantA.org.id }, optionValues: { some: { valueText: "بنفش خاص" } } } });
    assert.equal(aVariants, 0);
  });
});
