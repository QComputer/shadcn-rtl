import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { productsHandler } from "@/lib/public-catalog/route-handlers.server";
import {
  getPublicCatalogCategory,
  getPublicCatalogProduct,
  getPublicCatalogFacets,
  getPublicCatalogSnapshot,
  listPublicCatalogCategories,
  listPublicCatalogProducts,
} from "@/lib/public-catalog/service.server";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const slugs = { a: `catalog-a-${suffix}`, b: `catalog-b-${suffix}`, none: `catalog-none-${suffix}`, disabled: `catalog-disabled-${suffix}` };
const organizationIds: string[] = [];
let categoryAId = "";
let categoryBId = "";
let productAId = "";
let productBId = "";
let draftProductId = "";
let bulkProductId = "";

describe("Public Catalog API v1 local integration", () => {
  before(async () => {
    for (const [key, slug] of Object.entries(slugs)) {
      const organization = await prisma.organization.create({
        data: { type: key === "none" ? "APPOINTMENT" : "SHOP", name: `Catalog ${key}`, slug, capabilitiesInitializedAt: new Date() },
      });
      organizationIds.push(organization.id);
      if (key !== "none") await prisma.organizationCapability.create({
        data: key === "disabled"
          ? { organizationId: organization.id, key: "SHOP", status: "INACTIVE", disabledAt: new Date() }
          : { organizationId: organization.id, key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
      });
    }
    const [orgA, orgB] = await Promise.all(slugsToOrganizations([slugs.a, slugs.b]));
    const [categoryA, categoryB] = await prisma.$transaction([
      prisma.productCategory.create({ data: { organizationId: orgA.id, organizationSlug: orgA.slug, name: "Shared category", slug: "shared", sortOrder: 2 } }),
      prisma.productCategory.create({ data: { organizationId: orgB.id, organizationSlug: orgB.slug, name: "Shared category", slug: "shared", sortOrder: 1 } }),
    ]);
    categoryAId = categoryA.id;
    categoryBId = categoryB.id;
    const [productA, productB] = await prisma.$transaction([
      prisma.product.create({ data: { organizationId: orgA.id, organizationSlug: orgA.slug, categoryId: categoryA.id, name: "Zulu", slug: "shared-product", basePrice: 220000, image: "https://cdn.example/legacy.webp", sortOrder: 2 } }),
      prisma.product.create({ data: { organizationId: orgB.id, organizationSlug: orgB.slug, categoryId: categoryB.id, name: "Alpha", slug: "shared-product", basePrice: 330000, sortOrder: 1 } }),
    ]);
    productAId = productA.id;
    productBId = productB.id;
    const [tagSharedA, tagWinter, tagDraft, tagSharedB] = await prisma.$transaction([
      prisma.productTag.create({ data: { organizationId: orgA.id, name: "کفش روزمره", normalizedName: "کفش روزمره" } }),
      prisma.productTag.create({ data: { organizationId: orgA.id, name: "زمستان", normalizedName: "زمستان" } }),
      prisma.productTag.create({ data: { organizationId: orgA.id, name: "فقط پیش‌نویس", normalizedName: "فقط پیش‌نویس" } }),
      prisma.productTag.create({ data: { organizationId: orgB.id, name: "کفش روزمره", normalizedName: "کفش روزمره" } }),
    ]);
    await prisma.productVariant.createMany({ data: [
      { productId: productA.id, name: "In stock", price: 220000, inventory: 3 },
      { productId: productA.id, name: "Out", price: 230000, inventory: 0 },
      { productId: productB.id, name: "Backorder", price: 330000, inventory: 0, allowBackOrder: true },
    ] });
    await prisma.product.createMany({
      data: Array.from({ length: 54 }, (_, index) => ({
        organizationId: orgA.id,
        organizationSlug: orgA.slug,
        categoryId: categoryA.id,
        name: `Bulk ${String(index + 1).padStart(2, "0")}`,
        slug: `bulk-${index + 1}`,
        basePrice: 1000 + index,
        sortOrder: 10 + index,
      })),
    });
    await prisma.productCategory.create({ data: { organizationId: orgA.id, organizationSlug: orgA.slug, name: "Hidden", slug: "hidden", isActive: false } });
    const [bulkOne, draftProduct] = await Promise.all([
      prisma.product.findFirstOrThrow({ where: { organizationId: orgA.id, slug: "bulk-1" }, select: { id: true } }),
      prisma.product.create({ data: { organizationId: orgA.id, organizationSlug: orgA.slug, categoryId: categoryA.id, name: "Hidden product", slug: "hidden-product", basePrice: 1, isActive: false } }),
    ]);
    bulkProductId = bulkOne.id;
    draftProductId = draftProduct.id;
    await prisma.productTagAssignment.createMany({ data: [
      { organizationId: orgA.id, productId: productA.id, tagId: tagSharedA.id },
      { organizationId: orgA.id, productId: bulkOne.id, tagId: tagSharedA.id },
      { organizationId: orgA.id, productId: bulkOne.id, tagId: tagWinter.id },
      { organizationId: orgA.id, productId: draftProduct.id, tagId: tagDraft.id },
      { organizationId: orgB.id, productId: productB.id, tagId: tagSharedB.id },
    ] });
  });

  after(async () => {
    await prisma.productVariant.deleteMany({ where: { product: { organizationId: { in: organizationIds } } } });
    await prisma.product.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.productCategory.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.organizationCapability.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.$disconnect();
  });

  it("returns a compact SHOP catalog without private organization state", async () => {
    const catalog = await getPublicCatalogSnapshot(slugs.a);
    assert.equal(catalog.organization.identifier, slugs.a);
    assert.equal(catalog.priceUnit, "TOMAN");
    assert.equal(catalog.categories.length, 1);
    assert.equal(catalog.products.length, 20);
    assert.doesNotMatch(JSON.stringify(catalog), /capabilities|settings|integration|inventory/);
  });

  it("fails closed for missing and disabled SHOP capability", async () => {
    await assert.rejects(getPublicCatalogSnapshot(slugs.none), /Catalog not found/);
    await assert.rejects(getPublicCatalogSnapshot(slugs.disabled), /Catalog not found/);
  });

  it("lists and resolves only same-tenant visible categories", async () => {
    const categories = await listPublicCatalogCategories(slugs.a);
    assert.deepEqual(categories.categories.map((category) => category.id), [categoryAId]);
    assert.equal((await getPublicCatalogCategory(slugs.a, "shared")).id, categoryAId);
    await assert.rejects(getPublicCatalogCategory(slugs.a, categoryBId), /Category not found/);
    await assert.rejects(getPublicCatalogCategory(slugs.a, "hidden"), /Category not found/);
  });

  it("scopes identical product slugs and immutable IDs to the organization", async () => {
    assert.equal((await getPublicCatalogProduct(slugs.a, "shared-product")).id, productAId);
    assert.equal((await getPublicCatalogProduct(slugs.b, "shared-product")).id, productBId);
    await assert.rejects(getPublicCatalogProduct(slugs.a, productBId), /Product not found/);
    await assert.rejects(getPublicCatalogProduct(slugs.a, "hidden-product"), /Product not found/);
  });

  it("returns safe variants and coarse orderability without inventory quantities", async () => {
    const product = await getPublicCatalogProduct(slugs.a, productAId);
    assert.equal(product.orderable, true);
    assert.deepEqual(product.variants.map((variant) => [variant.name, variant.orderable]), [["In stock", true], ["Out", false]]);
    assert.doesNotMatch(JSON.stringify(product), /inventory|allowBackOrder|trackInventory/);
  });

  it("uses bounded deterministic pagination and rejects invalid route queries", async () => {
    const page = await listPublicCatalogProducts({ organizationIdentifier: slugs.a, page: 1, limit: 1 });
    assert.equal(page.pagination.limit, 1);
    assert.deepEqual(page.products.map((product) => product.name), ["Zulu"]);
    const response = await productsHandler(
      new NextRequest(`https://bazarbaaz.ir/api/public/v1/organizations/${slugs.a}/products?limit=51`),
      { params: Promise.resolve({ organizationIdentifier: slugs.a }) },
    );
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "no-store");
  });

  it("filters repeated public tag facets with OR semantics, scoped counts, stable paging, and tenant isolation", async () => {
    const facets = await getPublicCatalogFacets(slugs.a);
    assert.equal(facets.tags.find(tag => tag.value === "کفش روزمره")?.count, 2);
    assert.equal(facets.tags.find(tag => tag.value === "زمستان")?.count, 1);
    assert.equal(facets.tags.some(tag => tag.value === "فقط پیش‌نویس"), false, "draft-only tags are not exposed");

    const first = await listPublicCatalogProducts({ organizationIdentifier: slugs.a, page: 1, limit: 1, tag: ["کفش روزمره", "زمستان"], sort: "name-asc" });
    const second = await listPublicCatalogProducts({ organizationIdentifier: slugs.a, page: 2, limit: 1, tag: ["کفش روزمره", "زمستان"], sort: "name-asc" });
    assert.equal(first.pagination.total, 2);
    assert.equal(second.pagination.total, 2);
    assert.deepEqual(new Set([...first.products, ...second.products].map(product => product.id)), new Set([productAId, bulkProductId]));
    assert.ok(![...first.products, ...second.products].some(product => product.id === productBId || product.id === draftProductId));

    const params = new URLSearchParams();
    params.append("tag", "کفش روزمره");
    params.append("tag", "زمستان");
    params.set("limit", "10");
    const response = await productsHandler(
      new NextRequest(`https://bazarbaaz.ir/api/public/v1/organizations/${slugs.a}/products?${params}`),
      { params: Promise.resolve({ organizationIdentifier: slugs.a }) },
    );
    assert.equal(response.status, 200);
    const payload = await response.json() as { data: { products: Array<{ id: string }>; pagination: { total: number } } };
    assert.equal(payload.data.pagination.total, 2);
    assert.equal(payload.data.products.some(product => product.id === productBId), false);

    const unknown = await listPublicCatalogProducts({ organizationIdentifier: slugs.a, page: 1, limit: 10, tag: "missing-tag" });
    assert.equal(unknown.pagination.total, 0);
  });

  it("keeps representative responses compact", async () => {
    const ten = await listPublicCatalogProducts({ organizationIdentifier: slugs.a, page: 1, limit: 10 });
    const fifty = await listPublicCatalogProducts({ organizationIdentifier: slugs.a, page: 1, limit: 50 });
    const maximum = await listPublicCatalogProducts({ organizationIdentifier: slugs.a, page: 1, limit: 50 });
    const sizes = [ten, fifty, maximum].map((response) => Buffer.byteLength(JSON.stringify(response)));
    assert.deepEqual([ten.products.length, fifty.products.length, maximum.products.length], [10, 50, 50]);
    assert.ok(sizes[0] < 15_000);
    assert.ok(sizes[1] < 75_000);
    assert.ok(sizes[2] < 75_000);
    process.stdout.write(`PUBLIC_CATALOG_RESPONSE_BYTES 10=${sizes[0]} 50=${sizes[1]} max=${sizes[2]}\n`);
  });
});

function slugsToOrganizations(input: string[]) {
  return input.map((slug) => prisma.organization.findUniqueOrThrow({ where: { slug }, select: { id: true, slug: true } }));
}
