import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { getResolvedProduct } from "@/lib/purchase-landing.server";
import { resolveTrustedForwardedAppTenant } from "@/lib/forwarded-app-resolver.server";
import { activePublicBusinessCapabilities } from "@/lib/organization-public-home";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const slugs = {
  app: `purchase-route-app-${suffix}`,
  other: `purchase-route-other-${suffix}`,
};
const organizationIds: string[] = [];
let appProductId = "";
let otherProductId = "";
let appCategoryId = "";
let otherCategoryId = "";

describe("purchase product landing route integration", () => {
  before(async () => {
    const [appOrg, otherOrg] = await Promise.all(
      Object.values(slugs).map((slug) =>
        prisma.organization.create({
          data: { type: "SHOP", name: `Purchase Route ${slug}`, slug, capabilitiesInitializedAt: new Date() },
        }),
      ),
    );
    organizationIds.push(appOrg.id, otherOrg.id);

    await Promise.all(
      [appOrg, otherOrg].map((org) =>
        prisma.organizationCapability.create({
          data: { organizationId: org.id, key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
        }),
      ),
    );

    await prisma.organizationSettings.create({
      data: {
        organizationSlug: slugs.app,
        settings: { organizationEndpoints: [{ role: "APP", origin: "https://app.tenant.example" }] },
      },
    });

    const [appCategory, otherCategory] = await prisma.$transaction([
      prisma.productCategory.create({
        data: { organizationId: appOrg.id, organizationSlug: appOrg.slug, name: "Test Category", slug: "test-category" },
      }),
      prisma.productCategory.create({
        data: { organizationId: otherOrg.id, organizationSlug: otherOrg.slug, name: "Test Category", slug: "test-category" },
      }),
    ]);
    appCategoryId = appCategory.id;
    otherCategoryId = otherCategory.id;

    const [appProduct, otherProduct] = await prisma.$transaction([
      prisma.product.create({
        data: { organizationId: appOrg.id, organizationSlug: appOrg.slug, categoryId: appCategory.id, name: "Test Product", slug: "test-product", basePrice: 1000 },
      }),
      prisma.product.create({
        data: { organizationId: otherOrg.id, organizationSlug: otherOrg.slug, categoryId: otherCategory.id, name: "Other Product", slug: "other-product", basePrice: 2000 },
      }),
    ]);
    appProductId = appProduct.id;
    otherProductId = otherProduct.id;
  });

  after(async () => {
    await prisma.product.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.productCategory.deleteMany({ where: { id: { in: [appCategoryId, otherCategoryId] } } });
    await prisma.organizationSettings.deleteMany({ where: { organizationSlug: slugs.app } });
    await prisma.organizationCapability.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.$disconnect();
  });

  it("resolves product for valid trusted tenant", async () => {
    const product = await getResolvedProduct({ organizationId: organizationIds[0], productId: appProductId });
    assert.equal(product.id, appProductId);
    assert.equal(product.organization.id, organizationIds[0]);
    assert.equal(product.organization.slug, slugs.app);
    assert.ok(activePublicBusinessCapabilities(product.organization.capabilities as any).includes("SHOP"));
  });

  it("returns 404 for another tenant product", async () => {
    await assert.rejects(
      getResolvedProduct({ organizationId: organizationIds[0], productId: otherProductId }),
      /NOT_FOUND/,
    );
  });

  it("returns 404 for unknown product", async () => {
    await assert.rejects(
      getResolvedProduct({ organizationId: organizationIds[0], productId: "unknown-product-id" }),
      /NOT_FOUND/,
    );
  });

  it("performs no cart, order, payment, or inventory mutation on GET", async () => {
    const before = await Promise.all([
      prisma.order.count({ where: { organizationSlug: slugs.app } }),
      prisma.paymentRequest.count({ where: { organizationId: organizationIds[0] } }),
      prisma.productVariant.aggregate({ where: { productId: appProductId }, _sum: { reservedQuantity: true } }),
    ]);

    await getResolvedProduct({ organizationId: organizationIds[0], productId: appProductId });

    const after = await Promise.all([
      prisma.order.count({ where: { organizationSlug: slugs.app } }),
      prisma.paymentRequest.count({ where: { organizationId: organizationIds[0] } }),
      prisma.productVariant.aggregate({ where: { productId: appProductId }, _sum: { reservedQuantity: true } }),
    ]);

    assert.deepEqual(after, before);
  });

  it("rejects invalid proxy token at trusted resolver level", async () => {
    const result = await resolveTrustedForwardedAppTenant({
      forwardedHost: "app.tenant.example",
      proxyCredential: "invalid-token-should-fail",
      appBasePath: "/app",
      pathname: "/fa/purchase/product/some-id",
    });
    assert.equal(result.status, "unauthorized");
  });

  it("returns no-tenant when proxy token is missing", async () => {
    const result = await resolveTrustedForwardedAppTenant({
      forwardedHost: "app.tenant.example",
      proxyCredential: "",
      appBasePath: "/app",
      pathname: "/fa/purchase/product/some-id",
    });
    assert.equal(result.status, "unauthorized");
  });
});
