import { PrismaClient, RetailAttributeScope, RetailAttributeValueType, OrganizationType, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import assert from "node:assert/strict";
import { assertRetailRecoveryEnvironment } from "./safety.mjs";
import { fixtureId } from "./fixture-ids.mjs";

const target = assertRetailRecoveryEnvironment();

const prisma = new PrismaClient();
const stamp = process.env.E2E_STAMP || "20261109";
const slug = `retail-e2e-${stamp}`;
const orgId = fixtureId("organization", stamp);
const catId = fixtureId("category", stamp);
const colorDefId = fixtureId("color", stamp);
const sizeDefId = fixtureId("size", stamp);
const adminId = fixtureId("admin", stamp);
const customerId = fixtureId("customer", stamp);
const memberId = fixtureId("member", stamp);
const img1 = fixtureId("image1", stamp);
const img2 = fixtureId("image2", stamp);
const pubProductId = fixtureId("product", stamp);
const existProductId = fixtureId("existingProduct", stamp);
const pubVar1 = fixtureId("pub1", stamp);
const pubVar2 = fixtureId("pub2", stamp);
const existVar1 = fixtureId("existing", stamp);

async function main() {
  const identity = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database()::text AS db`;
  assert.equal(identity[0]?.db, target.databaseName, "Connected test database identity mismatch.");
  assert.equal(await prisma.organization.count(), 0, "Retail recovery requires an empty disposable database.");
  assert.equal(await prisma.user.count(), 0, "Retail recovery requires an empty user table; existing credentials must never be overwritten.");
  const password = await bcrypt.hash("E2ePass!23456", 10);
  await prisma.organization.upsert({
    where: { id: orgId },
    update: {},
    create: {
      id: orgId, type: OrganizationType.SHOP, locale: "fa", timezone: "Asia/Tehran",
      name: "فروشگاه تست E2E", slug, description: "Disposable retail UI E2E", isActive: true, isOpen: true,
      capabilitiesInitializedAt: new Date(),
    },
  });
  await prisma.organizationSettings.upsert({
    where: { organizationSlug: slug },
    update: { settings: { retailCatalog: { productExperience: "VARIANTS_V1" } } },
    create: {
      organizationSlug: slug, currency: "IRR", enablePickup: true, enableDelivery: true,
      settings: { retailCatalog: { productExperience: "VARIANTS_V1" } },
    },
  });
  await prisma.organizationCapability.upsert({
    where: { organizationId_key: { organizationId: orgId, key: "SHOP" } },
    update: { status: "ACTIVE" },
    create: { organizationId: orgId, key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
  });
  await prisma.user.upsert({
    where: { id: adminId },
    update: { password, isActive: true },
    create: { id: adminId, name: `admin-e2e-${stamp}`, password, role: UserRole.ADMIN, isActive: true, isTeamMember: true, locale: "fa" },
  });
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: orgId, userId: adminId } },
    update: { role: UserRole.ADMIN, isActive: true },
    create: { id: memberId, organizationId: orgId, organizationSlug: slug, userId: adminId, role: UserRole.ADMIN, isActive: true },
  });
  await prisma.user.upsert({
    where: { id: customerId },
    update: { password, isActive: true },
    create: { id: customerId, name: `customer-e2e-${stamp}`, password, role: UserRole.CUSTOMER, isActive: true, locale: "fa" },
  });
  await prisma.productCategory.upsert({
    where: { id: catId },
    update: { isActive: true },
    create: { id: catId, organizationId: orgId, organizationSlug: slug, name: "کفش ورزشی", slug: `shoes-${stamp}`, sortOrder: 1, isActive: true },
  });
  for (const [id, url] of [[img1, "/retail-preview/preview-fashion-campaign.png"], [img2, "/retail-preview/preview-mobile-campaign.png"]]) {
    await prisma.image.upsert({
      where: { id },
      update: {},
      create: { id, url, filename: id, mimeType: "image/png", purpose: "upload", access: "PUBLIC", organizationId: orgId, uploadedByUserId: adminId },
    });
  }
  await prisma.retailAttributeDefinition.upsert({
    where: { id: colorDefId },
    update: {},
    create: {
      id: colorDefId, organizationId: orgId, key: "color", label: "رنگ", scope: RetailAttributeScope.VARIANT_OPTION,
      valueType: RetailAttributeValueType.ENUM, allowedValues: ["مشکی", "سفید"], isFilterable: true, sortOrder: 1, isActive: true,
    },
  });
  await prisma.retailAttributeDefinition.upsert({
    where: { id: sizeDefId },
    update: {},
    create: {
      id: sizeDefId, organizationId: orgId, key: "size", label: "سایز", scope: RetailAttributeScope.VARIANT_OPTION,
      valueType: RetailAttributeValueType.ENUM, allowedValues: ["38", "39", "40", "41", "42", "43"], isFilterable: true, sortOrder: 2, isActive: true,
    },
  });
  // Published product for storefront/cart
  await prisma.product.upsert({
    where: { id: pubProductId },
    update: { isActive: true },
    create: {
      id: pubProductId, name: "کفش منتشرشده E2E", slug: `pub-shoe-${stamp}`, description: "test", basePrice: 500000,
      image: "/retail-preview/preview-fashion-campaign.png", trackInventory: true, lowStockThreshold: 0, discountType: "none", discountValue: 0,
      sortOrder: 1, isActive: true, organizationId: orgId, organizationSlug: slug, categoryId: catId,
    },
  });
  await prisma.product.update({ where: { id: pubProductId }, data: { images: { connect: { id: img1 } } } });
  for (const [vid, color, size, sku, inv] of [[pubVar1,"مشکی","40",`PUB-BLK-40-${stamp}`,5],[pubVar2,"آبی نفتی","41",`PUB-NAVY-41-${stamp}`,3]]) {
    await prisma.productVariant.upsert({
      where: { id: vid as string },
      update: { inventory: inv as number },
      create: { id: vid as string, productId: pubProductId, name: `${color} / ${size}`, sku: sku as string, price: 500000, inventory: inv as number, allowBackOrder: false, manuallyUnavailable: false },
    });
    await prisma.productVariantAttributeValue.deleteMany({ where: { variantId: vid as string } });
    await prisma.productVariantAttributeValue.createMany({ data: [
      { variantId: vid as string, definitionId: colorDefId, valueText: color as string },
      { variantId: vid as string, definitionId: sizeDefId, valueText: size as string },
    ]});
  }
  // Existing draft product for preservation test
  await prisma.product.upsert({
    where: { id: existProductId },
    update: {},
    create: {
      id: existProductId, name: "محصول موجود E2E", slug: `exist-${stamp}`, description: "preserve", basePrice: 300000,
      image: "/leo-logo.png", trackInventory: true, lowStockThreshold: 0, discountType: "none", discountValue: 0,
      sortOrder: 2, isActive: false, organizationId: orgId, organizationSlug: slug, categoryId: catId,
    },
  });
  await prisma.productVariant.upsert({
    where: { id: existVar1 },
    update: {},
    create: { id: existVar1, productId: existProductId, name: "مشکی / 39", sku: `EXIST-BLK-39-${stamp}`, price: 320000, inventory: 7, allowBackOrder: false, manuallyUnavailable: false },
  });
  await prisma.productVariantAttributeValue.deleteMany({ where: { variantId: existVar1 } });
  await prisma.productVariantAttributeValue.createMany({ data: [
    { variantId: existVar1, definitionId: colorDefId, valueText: "مشکی" },
    { variantId: existVar1, definitionId: sizeDefId, valueText: "39" },
  ]});
  const other = await prisma.organization.create({ data: {
    id: fixtureId("otherOrganization", stamp), slug: `retail-e2e-other-${stamp}`,
    name: "فروشگاه دوم آزمایشی", type: OrganizationType.SHOP, isActive: true,
    capabilitiesInitializedAt: new Date(),
  } });
  await prisma.organizationCapability.create({ data: { organizationId: other.id, key: "SHOP", status: "ACTIVE", enabledAt: new Date() } });
  await prisma.organizationSettings.create({ data: { organizationSlug: other.slug, currency: "IRR", settings: { retailCatalog: { productExperience: "VARIANTS_V1" } } } });
  const otherCategory = await prisma.productCategory.create({ data: { name: "دسته آزمایشی فروشگاه دوم", slug: `foreign-${stamp}`, organizationId: other.id, organizationSlug: other.slug } });
  await prisma.product.create({ data: { id: fixtureId("foreignProduct", stamp), name: "محصول خصوصی فروشگاه دوم", slug: `foreign-${stamp}`, basePrice: 900000, categoryId: otherCategory.id, organizationId: other.id, organizationSlug: other.slug, isActive: false } });
  console.log(JSON.stringify({ ok: true, slug, orgId, admin: `admin-e2e-${stamp}`, customer: `customer-e2e-${stamp}`, pubProductId, existProductId, colorDefId, sizeDefId, catId }));
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
