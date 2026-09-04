import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  listPublicProductHandoffs,
  getPublicProductHandoff,
} from "@/lib/public-handoff/service.server";
import {
  productHandoffsHandler,
  productHandoffHandler,
} from "@/lib/public-handoff/route-handlers.server";
import {
  markExternalProductMappingMissing,
  reactivateExternalProductMapping,
  upsertExternalProductMapping,
} from "@/lib/external-product-mapping";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const source = "CAFELEO_PUBLIC_CATALOG_V1";
const organizationIds: string[] = [];
const productIds: string[] = [];
const categoryIds: string[] = [];
const mappingIds: string[] = [];
let orgA = "";
let _orgB = "";
let productA = "";
let _productB = "";
let _categoryAId = "";
let _categoryBId = "";
let _mappingId = "";

describe("Public Product Handoff API", () => {
  before(async () => {
    const [a, b] = await Promise.all([
      prisma.organization.create({ data: { name: "Handoff A", slug: `handoff-a-${suffix}`, type: "SHOP", capabilitiesInitializedAt: new Date() } }),
      prisma.organization.create({ data: { name: "Handoff B", slug: `handoff-b-${suffix}`, type: "SHOP", capabilitiesInitializedAt: new Date() } }),
    ]);
    orgA = a.id;
    _orgB = b.id;
    organizationIds.push(a.id, b.id);
    await Promise.all([
      prisma.organizationCapability.create({ data: { organizationId: a.id, key: "SHOP", status: "ACTIVE", enabledAt: new Date() } }),
      prisma.organizationCapability.create({ data: { organizationId: b.id, key: "SHOP", status: "ACTIVE", enabledAt: new Date() } }),
    ]);
    await Promise.all([
      prisma.organizationSettings.create({ data: { organizationSlug: a.slug, settings: { organizationEndpoints: [{ role: "APP", origin: "https://app.tenant.example" }] } } }),
      prisma.organizationSettings.create({ data: { organizationSlug: b.slug, settings: { organizationEndpoints: [{ role: "APP", origin: "https://app.other.example" }] } } }),
    ]);

    const [catA, catB] = await Promise.all([
      prisma.productCategory.create({ data: { organizationId: a.id, organizationSlug: a.slug, name: "A", slug: `a-${suffix}` } }),
      prisma.productCategory.create({ data: { organizationId: b.id, organizationSlug: b.slug, name: "B", slug: `b-${suffix}` } }),
    ]);
    _categoryAId = catA.id;
    _categoryBId = catB.id;
    categoryIds.push(catA.id, catB.id);

    const [pA, pB] = await Promise.all([
      prisma.product.create({ data: { organizationId: a.id, organizationSlug: a.slug, categoryId: catA.id, name: "Product A", slug: `product-a-${suffix}`, basePrice: 1000 } }),
      prisma.product.create({ data: { organizationId: b.id, organizationSlug: b.slug, categoryId: catB.id, name: "Product B", slug: `product-b-${suffix}`, basePrice: 2000 } }),
    ]);
    productA = pA.id;
    _productB = pB.id;
    productIds.push(pA.id, pB.id);

    await prisma.productVariant.createMany({
      data: [
        { productId: pA.id, name: "In stock", price: 1000, inventory: 5 },
        { productId: pB.id, name: "Backorder", price: 2000, inventory: 0, allowBackOrder: true },
      ],
    });

    const mapping = await upsertExternalProductMapping({ organizationId: a.id, externalSource: source, externalId: "CAFELEO-0001", productId: pA.id });
    _mappingId = mapping.id;
    mappingIds.push(mapping.id);
  });

  after(async () => {
    await prisma.externalEntityMapping.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.productVariant.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.productCategory.deleteMany({ where: { id: { in: categoryIds } } });
    const orgSlugs = await prisma.organization.findMany({ where: { id: { in: organizationIds } }, select: { slug: true } });
    await prisma.organizationSettings.deleteMany({ where: { organizationSlug: { in: orgSlugs.map((o) => o.slug) } } });
    await prisma.organizationCapability.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.$disconnect();
  });

  it("resolves exact external identity and generates purchase href", async () => {
    const result = await getPublicProductHandoff({
      organizationIdentifier: `handoff-a-${suffix}`,
      externalSource: source,
      externalId: "CAFELEO-0001",
    });
    assert.ok(result);
    assert.equal(result.externalId, "CAFELEO-0001");
    assert.equal(result.purchase?.href, `https://app.tenant.example/purchase/product/${productA}`);
  });

  it("returns collection with pagination metadata", async () => {
    const result = await listPublicProductHandoffs({
      organizationIdentifier: `handoff-a-${suffix}`,
      externalSource: source,
      page: 1,
      limit: 10,
    });
    assert.equal(result.organization.slug, `handoff-a-${suffix}`);
    assert.equal(result.externalSource, source);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].externalId, "CAFELEO-0001");
    assert.equal(result.pagination.total, 1);
    assert.equal(result.pagination.page, 1);
    assert.equal(result.pagination.limit, 10);
    assert.equal(result.pagination.totalPages, 1);
  });

  it("returns 404 for unknown externalId", async () => {
    const result = await getPublicProductHandoff({
      organizationIdentifier: `handoff-a-${suffix}`,
      externalSource: source,
      externalId: "UNKNOWN",
    });
    assert.equal(result, null);
  });

  it("returns empty collection for unknown externalSource", async () => {
    const result = await listPublicProductHandoffs({
      organizationIdentifier: `handoff-a-${suffix}`,
      externalSource: "UNKNOWN_SOURCE",
      page: 1,
      limit: 10,
    });
    assert.equal(result.items.length, 0);
    assert.equal(result.pagination.total, 0);
  });

  it("returns 404 for missing SHOP capability", async () => {
    const noShop = await prisma.organization.create({
      data: { name: "NoShop", slug: `no-shop-${suffix}`, type: "APPOINTMENT", capabilitiesInitializedAt: new Date() },
    });
    organizationIds.push(noShop.id);
    await assert.rejects(
      getPublicProductHandoff({
        organizationIdentifier: `no-shop-${suffix}`,
        externalSource: source,
        externalId: "CAFELEO-0001",
      }),
      /Organization not found/,
    );
  });

  it("rejects unapproved mapping", async () => {
    const mapping = await prisma.externalEntityMapping.create({
      data: {
        organizationId: orgA,
        externalSource: source,
        externalEntityType: "PRODUCT",
        externalId: "UNAPPROVED",
        internalEntityType: "PRODUCT",
        internalEntityId: productA,
        status: "SUGGESTED",
      },
    });
    mappingIds.push(mapping.id);
    const result = await getPublicProductHandoff({
      organizationIdentifier: `handoff-a-${suffix}`,
      externalSource: source,
      externalId: "UNAPPROVED",
    });
    assert.equal(result, null);
  });

  it("rejects mapping with sourcePresent=false", async () => {
    const missing = await markExternalProductMappingMissing({ organizationId: orgA, externalSource: source, externalId: "CAFELEO-0001" });
    assert.ok(missing);
    mappingIds.push(missing.id);
    const result = await getPublicProductHandoff({
      organizationIdentifier: `handoff-a-${suffix}`,
      externalSource: source,
      externalId: "CAFELEO-0001",
    });
    assert.equal(result, null);
    await reactivateExternalProductMapping({ organizationId: orgA, externalSource: source, externalId: "CAFELEO-0001" });
  });

  it("rejects non-PRODUCT externalEntityType mapping", async () => {
    const categoryMapping = await prisma.externalEntityMapping.create({
      data: {
        organizationId: orgA,
        externalSource: source,
        externalEntityType: "CATEGORY",
        externalId: "SAME-ID",
        internalEntityType: "PRODUCT",
        internalEntityId: productA,
        status: "APPROVED",
      },
    });
    mappingIds.push(categoryMapping.id);
    const result = await getPublicProductHandoff({
      organizationIdentifier: `handoff-a-${suffix}`,
      externalSource: source,
      externalId: "SAME-ID",
    });
    assert.equal(result, null);
  });

  it("isolates mappings by organization", async () => {
    const result = await getPublicProductHandoff({
      organizationIdentifier: `handoff-b-${suffix}`,
      externalSource: source,
      externalId: "CAFELEO-0001",
    });
    assert.equal(result, null);
  });

  it("exposes no internal IDs or mapping metadata", async () => {
    const response = await productHandoffsHandler(
      new NextRequest(`https://bazarbaaz.ir/api/public/v1/organizations/handoff-a-${suffix}/product-handoffs?externalSource=${source}`),
      { params: Promise.resolve({ organizationIdentifier: `handoff-a-${suffix}` }) },
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.version, "v1");
    assert.ok(!("organizationId" in body.data));
    assert.ok(!("internalEntityId" in body.data));
    assert.ok(!("mappingId" in body.data));
    assert.ok(!("status" in body.data));
    const item = body.data.items[0];
    assert.ok(!("id" in item));
    assert.ok(!("organizationId" in item));
    assert.equal(item.externalId, "CAFELEO-0001");
    assert.ok(item.purchase?.href.startsWith("https://app.tenant.example/purchase/product/"));
    assert.ok(!item.purchase?.href.includes("bazarbaaz-app.vercel.app"));
  });

  it("returns 404 for individual endpoint when not found", async () => {
    const response = await productHandoffHandler(
      new NextRequest(`https://bazarbaaz.ir/api/public/v1/organizations/handoff-a-${suffix}/product-handoffs/UNKNOWN?externalSource=${source}`),
      { params: Promise.resolve({ organizationIdentifier: `handoff-a-${suffix}`, externalId: "UNKNOWN" }) },
    );
    assert.equal(response.status, 404);
  });

  it("emits public cache headers", async () => {
    const response = await productHandoffsHandler(
      new NextRequest(`https://bazarbaaz.ir/api/public/v1/organizations/handoff-a-${suffix}/product-handoffs?externalSource=${source}`),
      { params: Promise.resolve({ organizationIdentifier: `handoff-a-${suffix}` }) },
    );
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("cache-control")?.includes("s-maxage"));
    assert.ok(response.headers.get("etag"));
  });

  it("performs no side effects on GET", async () => {
    const orgASlug = await prisma.organization.findUniqueOrThrow({ where: { id: orgA }, select: { slug: true } });
    const beforeCarts = await prisma.shopCart.count({ where: { organizationSlug: orgASlug.slug } });
    const beforeOrders = await prisma.order.count({ where: { organizationSlug: orgASlug.slug } });
    const beforePayments = await prisma.paymentRequest.count({ where: { organizationId: orgA } });
    await productHandoffsHandler(
      new NextRequest(`https://bazarbaaz.ir/api/public/v1/organizations/handoff-a-${suffix}/product-handoffs?externalSource=${source}`),
      { params: Promise.resolve({ organizationIdentifier: `handoff-a-${suffix}` }) },
    );
    await productHandoffHandler(
      new NextRequest(`https://bazarbaaz.ir/api/public/v1/organizations/handoff-a-${suffix}/product-handoffs/CAFELEO-0001?externalSource=${source}`),
      { params: Promise.resolve({ organizationIdentifier: `handoff-a-${suffix}`, externalId: "CAFELEO-0001" }) },
    );
    const afterCarts = await prisma.shopCart.count({ where: { organizationSlug: orgASlug.slug } });
    const afterOrders = await prisma.order.count({ where: { organizationSlug: orgASlug.slug } });
    const afterPayments = await prisma.paymentRequest.count({ where: { organizationId: orgA } });
    assert.equal(afterCarts, beforeCarts);
    assert.equal(afterOrders, beforeOrders);
    assert.equal(afterPayments, beforePayments);
  });
});
