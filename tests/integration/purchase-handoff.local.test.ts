import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { getPublicCatalogProduct } from "@/lib/public-catalog/service.server";
import { resolveOperationalProductHandoff } from "@/lib/purchase-intent.server";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const slugs = { app: `handoff-app-${suffix}`, none: `handoff-none-${suffix}`, disabled: `handoff-disabled-${suffix}`, other: `handoff-other-${suffix}` };
const organizationIds: string[] = [];
let productId = "";
let otherProductId = "";
let categoryId = "";

describe("public to operational purchase handoff", () => {
  before(async () => {
    for (const [key, slug] of Object.entries(slugs)) {
      const organization = await prisma.organization.create({
        data: { type: key === "none" ? "APPOINTMENT" : "SHOP", name: `Handoff ${key}`, slug, capabilitiesInitializedAt: new Date() },
      });
      organizationIds.push(organization.id);
      if (key !== "none") await prisma.organizationCapability.create({
        data: key === "disabled"
          ? { organizationId: organization.id, key: "SHOP", status: "INACTIVE", disabledAt: new Date() }
          : { organizationId: organization.id, key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
      });
      if (key === "app") await prisma.organizationSettings.create({
        data: { organizationSlug: slug, settings: { organizationEndpoints: [{ role: "APP", origin: "https://app.tenant.example" }] } },
      });
    }
    const [app, other] = await Promise.all([slugs.app, slugs.other].map((slug) => prisma.organization.findUniqueOrThrow({ where: { slug } })));
    const [category, otherCategory] = await prisma.$transaction([
      prisma.productCategory.create({ data: { organizationId: app.id, organizationSlug: app.slug, name: "Products", slug: "shared" } }),
      prisma.productCategory.create({ data: { organizationId: other.id, organizationSlug: other.slug, name: "Products", slug: "shared" } }),
    ]);
    categoryId = category.id;
    const [product, otherProduct] = await prisma.$transaction([
      prisma.product.create({ data: { organizationId: app.id, organizationSlug: app.slug, categoryId: category.id, name: "Product", slug: "mutable-slug", basePrice: 1000 } }),
      prisma.product.create({ data: { organizationId: other.id, organizationSlug: other.slug, categoryId: otherCategory.id, name: "Product", slug: "mutable-slug", basePrice: 2000 } }),
    ]);
    productId = product.id;
    otherProductId = otherProduct.id;
  });

  after(async () => {
    await prisma.product.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.productCategory.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.organizationSettings.deleteMany({ where: { organizationSlug: { in: Object.values(slugs) } } });
    await prisma.organizationCapability.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.$disconnect();
  });

  it("adds a host-independent APP purchase URL to public catalog data", async () => {
    const product = await getPublicCatalogProduct(slugs.app, productId);
    assert.equal(product.purchase?.productId, productId);
    assert.equal(product.purchase?.href, `https://app.tenant.example/fa/${slugs.app}/purchase/product/${productId}`);
    assert.doesNotMatch(product.purchase!.href, /bazarbaaz\.ir|evil\.example/);
    assert.equal((await getPublicCatalogProduct(slugs.none, productId).catch(() => null)), null);
  });

  it("keeps catalog visible with a null handoff when APP is absent", async () => {
    const product = await getPublicCatalogProduct(slugs.other, otherProductId);
    assert.equal(product.purchase, null);
    await assert.rejects(resolveOperationalProductHandoff({ organizationIdentifier: slugs.other, productId: otherProductId, locale: "fa" }), /Product not found/);
  });

  it("binds immutable product ID to organization and survives slug changes", async () => {
    assert.equal(await resolveOperationalProductHandoff({ organizationIdentifier: slugs.app, productId, locale: "fa" }), `/fa/${slugs.app}/shop/product/mutable-slug`);
    await prisma.product.update({ where: { id: productId }, data: { slug: "renamed-slug" } });
    assert.equal(await resolveOperationalProductHandoff({ organizationIdentifier: slugs.app, productId, locale: "fa" }), `/fa/${slugs.app}/shop/product/renamed-slug`);
    await assert.rejects(resolveOperationalProductHandoff({ organizationIdentifier: slugs.app, productId: otherProductId, locale: "fa" }), /Product not found/);
  });

  it("fails closed for absent/disabled SHOP and deleted or hidden product state", async () => {
    await assert.rejects(resolveOperationalProductHandoff({ organizationIdentifier: slugs.none, productId, locale: "fa" }), /Product not found/);
    await assert.rejects(resolveOperationalProductHandoff({ organizationIdentifier: slugs.disabled, productId, locale: "fa" }), /Product not found/);
    await prisma.product.update({ where: { id: productId }, data: { deletedAt: new Date() } });
    await assert.rejects(resolveOperationalProductHandoff({ organizationIdentifier: slugs.app, productId, locale: "fa" }), /Product not found/);
    await prisma.product.update({ where: { id: productId }, data: { deletedAt: null } });
    await prisma.productCategory.update({ where: { id: categoryId }, data: { isActive: false } });
    await assert.rejects(resolveOperationalProductHandoff({ organizationIdentifier: slugs.app, productId, locale: "fa" }), /Product not found/);
    await prisma.productCategory.update({ where: { id: categoryId }, data: { isActive: true } });
  });

  it("preserves only safe attribution and ignores price, quantity, redirect, and host input", async () => {
    const target = await resolveOperationalProductHandoff({
      organizationIdentifier: slugs.app,
      productId,
      locale: "fa",
      query: { source: "website", campaign: "summer", price: "1", quantity: "10", redirectUrl: "https://evil.example", host: "evil.example" },
    });
    assert.equal(target, `/fa/${slugs.app}/shop/product/renamed-slug?source=website&campaign=summer`);
  });

  it("performs navigation resolution without cart, order, payment, or inventory mutation", async () => {
    const before = await Promise.all([
      prisma.order.count({ where: { organizationSlug: slugs.app } }),
      prisma.paymentRequest.count({ where: { organizationId: organizationIds[0] } }),
      prisma.productVariant.aggregate({ where: { productId }, _sum: { reservedQuantity: true } }),
    ]);
    await resolveOperationalProductHandoff({ organizationIdentifier: slugs.app, productId, locale: "fa", query: { quantity: "99", price: "1" } });
    const after = await Promise.all([
      prisma.order.count({ where: { organizationSlug: slugs.app } }),
      prisma.paymentRequest.count({ where: { organizationId: organizationIds[0] } }),
      prisma.productVariant.aggregate({ where: { productId }, _sum: { reservedQuantity: true } }),
    ]);
    assert.deepEqual(after, before);
  });
});
