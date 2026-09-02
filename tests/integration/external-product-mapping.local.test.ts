import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import {
  markExternalProductMappingMissing,
  reactivateExternalProductMapping,
  resolveExternalProductMapping,
  upsertExternalProductMapping,
} from "@/lib/external-product-mapping";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const source = "CAFELEO_PUBLIC_CATALOG_V1";
const externalId = "hot-coffee-1";
const organizationIds: string[] = [];
const productIds: string[] = [];
let organizationA = "";
let organizationB = "";
let productA = "";
let alternateProductA = "";
let productB = "";

describe("external Product identity mapping", () => {
  before(async () => {
    const [a, b] = await Promise.all([
      prisma.organization.create({ data: { name: "Mapping A", slug: `mapping-a-${suffix}`, type: "SHOP" } }),
      prisma.organization.create({ data: { name: "Mapping B", slug: `mapping-b-${suffix}`, type: "SHOP" } }),
    ]);
    organizationA = a.id;
    organizationB = b.id;
    organizationIds.push(a.id, b.id);
    const [categoryA, categoryB] = await Promise.all([
      prisma.productCategory.create({ data: { organizationId: a.id, organizationSlug: a.slug, name: "A", slug: `a-${suffix}` } }),
      prisma.productCategory.create({ data: { organizationId: b.id, organizationSlug: b.slug, name: "B", slug: `b-${suffix}` } }),
    ]);
    const [first, alternate, other] = await Promise.all([
      prisma.product.create({ data: { organizationId: a.id, organizationSlug: a.slug, categoryId: categoryA.id, name: "Original", slug: `original-${suffix}`, basePrice: 100 } }),
      prisma.product.create({ data: { organizationId: a.id, organizationSlug: a.slug, categoryId: categoryA.id, name: "Alternate", slug: `alternate-${suffix}`, basePrice: 200 } }),
      prisma.product.create({ data: { organizationId: b.id, organizationSlug: b.slug, categoryId: categoryB.id, name: "Other tenant", slug: `other-${suffix}`, basePrice: 300 } }),
    ]);
    productA = first.id;
    alternateProductA = alternate.id;
    productB = other.id;
    productIds.push(first.id, alternate.id, other.id);
  });

  after(async () => {
    await prisma.externalEntityMapping.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.productCategory.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.$disconnect();
  });

  it("keeps the same Product.id across re-import, price, slug, and name changes", async () => {
    const first = await upsertExternalProductMapping({ organizationId: organizationA, externalSource: source, externalId, productId: productA });
    const repeated = await upsertExternalProductMapping({ organizationId: organizationA, externalSource: source, externalId, productId: productA });
    assert.equal(repeated.id, first.id);
    assert.equal(repeated.internalEntityId, productA);
    await prisma.product.update({ where: { id: productA }, data: { name: "Renamed", slug: `renamed-${suffix}`, basePrice: 999 } });
    assert.equal((await resolveExternalProductMapping({ organizationId: organizationA, externalSource: source, externalId }))?.internalEntityId, productA);
    await assert.rejects(
      upsertExternalProductMapping({ organizationId: organizationA, externalSource: source, externalId, productId: alternateProductA }),
      /already bound/,
    );
  });

  it("retains identity through disappearance and reactivation without REJECTED", async () => {
    const missing = await markExternalProductMappingMissing({ organizationId: organizationA, externalSource: source, externalId });
    assert.equal(missing?.internalEntityId, productA);
    assert.equal(missing?.sourcePresent, false);
    const raw = await prisma.externalEntityMapping.findUniqueOrThrow({ where: { id: missing!.id } });
    assert.equal(raw.status, "APPROVED");
    const active = await reactivateExternalProductMapping({ organizationId: organizationA, externalSource: source, externalId });
    assert.equal(active.id, missing?.id);
    assert.equal(active.internalEntityId, productA);
    assert.equal(active.sourcePresent, true);
  });

  it("isolates the same source key by organization and fails closed for unknown/cross-tenant products", async () => {
    const other = await upsertExternalProductMapping({ organizationId: organizationB, externalSource: source, externalId, productId: productB });
    assert.equal(other.internalEntityId, productB);
    assert.notEqual(other.internalEntityId, productA);
    assert.equal(await resolveExternalProductMapping({ organizationId: organizationA, externalSource: source, externalId: "unknown-key" }), null);
    await assert.rejects(
      upsertExternalProductMapping({ organizationId: organizationA, externalSource: source, externalId: "cross-tenant", productId: productB }),
      /must belong/,
    );
  });
});
