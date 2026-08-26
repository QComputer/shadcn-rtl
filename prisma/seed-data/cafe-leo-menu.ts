import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Organization, PrismaClient } from "@prisma/client";
import { OrganizationCapabilityStatus } from "@prisma/client";
import type {
  CafeLeoCategory,
  CafeLeoExtractionFixture,
  CafeLeoImportCounts,
  CafeLeoImportResult,
  CafeLeoProduct,
} from "./cafe-leo-types";
import { normalizeCategorySlug } from "@/lib/category-slugs";
import { normalizeDetailSlug } from "@/lib/detail-slugs";

export const CAFE_LEO_SOURCE_URL = "https://iran.cafeleo.vip/";
export const CAFE_LEO_ORGANIZATION_SLUG = "cafe-leo";
export const CAFE_LEO_DOMAIN = "leocafe.ir";
export const CAFE_LEO_SKU_PREFIX = "CAFELEO";
export const CAFE_LEO_FIXTURE_PATH = join(process.cwd(), "prisma", "seed-data", "cafe-leo-extraction.json");

const ALLOWED_IMAGE_HOSTS = new Set(["iran.cafeleo.vip"]);

export function readCafeLeoExtractionFixture(path = CAFE_LEO_FIXTURE_PATH): CafeLeoExtractionFixture {
  return JSON.parse(readFileSync(path, "utf8")) as CafeLeoExtractionFixture;
}

export function buildCafeLeoProductSku(sourceId: string) {
  return `${CAFE_LEO_SKU_PREFIX}-${sourceId}`;
}

export function buildCafeLeoDefaultVariantSku(sourceId: string) {
  return `${buildCafeLeoProductSku(sourceId)}-DEFAULT`;
}

export function normalizeCafeLeoSourceUrl(value: string | null | undefined, base = CAFE_LEO_SOURCE_URL) {
  if (!value) return null;
  const url = new URL(value, base);
  if (url.protocol !== "https:") {
    throw new Error(`Cafe Leo image URL must use https: ${url.href}`);
  }
  if (url.username || url.password) {
    throw new Error("Cafe Leo image URL must not contain credentials");
  }
  if (!ALLOWED_IMAGE_HOSTS.has(url.hostname)) {
    throw new Error(`Cafe Leo image URL host is not allowed: ${url.hostname}`);
  }
  return url.href;
}

export function assertCafeLeoImageUrl(value: string | null | undefined) {
  const url = normalizeCafeLeoSourceUrl(value);
  if (!url) throw new Error("Cafe Leo image URL is missing");
  return url;
}

function categorySlug(category: CafeLeoCategory) {
  return normalizeCategorySlug(category.slug || category.sourceId);
}

function productSlug(product: CafeLeoProduct) {
  return normalizeDetailSlug(product.sourceId);
}

function validateFixture(fixture: CafeLeoExtractionFixture) {
  if (fixture.fixtureName !== "cafe-leo-real-menu") {
    throw new Error("Unexpected Cafe Leo fixture name");
  }
  if (fixture.organization.slug !== CAFE_LEO_ORGANIZATION_SLUG) {
    throw new Error("Cafe Leo fixture targets the wrong organization slug");
  }
  if (fixture.pricePolicy.guessed !== false) {
    throw new Error("Cafe Leo fixture price interpretation must not be guessed");
  }

  const categoryIds = new Set<string>();
  const productIds = new Set<string>();
  for (const category of fixture.categories) {
    if (categoryIds.has(category.sourceId)) {
      throw new Error(`Duplicate Cafe Leo category sourceId: ${category.sourceId}`);
    }
    categoryIds.add(category.sourceId);
    if (!category.name.trim()) throw new Error(`Cafe Leo category ${category.sourceId} is missing a name`);

    for (const product of category.products) {
      if (productIds.has(product.sourceId)) {
        throw new Error(`Duplicate Cafe Leo product sourceId: ${product.sourceId}`);
      }
      productIds.add(product.sourceId);
      if (!product.name.trim()) throw new Error(`Cafe Leo product ${product.sourceId} is missing a name`);
      if (!Number.isInteger(product.priceValue) || product.priceValue <= 0) {
        throw new Error(`Cafe Leo product ${product.sourceId} has invalid priceValue`);
      }
      if (product.imageUrl) normalizeCafeLeoSourceUrl(product.imageUrl);
      for (const candidate of product.imageCandidates) normalizeCafeLeoSourceUrl(candidate);
    }
  }

  if (fixture.counts.categories !== fixture.categories.length) {
    throw new Error("Cafe Leo fixture category count mismatch");
  }
  if (fixture.counts.products !== productIds.size) {
    throw new Error("Cafe Leo fixture product count mismatch");
  }
}

async function getCounts(prisma: PrismaClient, organization: Pick<Organization, "id" | "slug">): Promise<CafeLeoImportCounts> {
  const [categories, products, activeProducts, variants, productsWithUsableVariant, imageRecords] = await Promise.all([
    prisma.productCategory.findMany({
      where: { organizationId: organization.id, deletedAt: null },
      select: { slug: true },
    }),
    prisma.product.findMany({
      where: { organizationId: organization.id, deletedAt: null },
      select: { id: true, slug: true, isActive: true, image: true },
    }),
    prisma.product.count({
      where: { organizationId: organization.id, deletedAt: null, isActive: true },
    }),
    prisma.productVariant.findMany({
      where: { product: { organizationId: organization.id }, deletedAt: null },
      select: { sku: true },
    }),
    prisma.product.count({
      where: {
        organizationId: organization.id,
        deletedAt: null,
        isActive: true,
        variants: { some: { deletedAt: null } },
      },
    }),
    prisma.image.count({ where: { organizationId: organization.id } }),
  ]);

  const duplicateCategorySlugs = categories.length - new Set(categories.map((item) => item.slug).filter(Boolean)).size;
  const duplicateProductSlugs = products.length - new Set(products.map((item) => item.slug).filter(Boolean)).size;
  const duplicateVariantSkus = variants.length - new Set(variants.map((item) => item.sku).filter(Boolean)).size;

  return {
    categories: categories.length,
    products: products.length,
    activeProducts,
    inactiveProducts: products.length - activeProducts,
    variants: variants.length,
    productsWithUsableVariant,
    productImages: products.filter((product) => Boolean(product.image)).length,
    imageRecords,
    duplicateCategorySlugs,
    duplicateProductSlugs,
    duplicateVariantSkus,
  };
}

export async function ensureLocalCafeLeoOrganization(prisma: PrismaClient, organizationSlug = CAFE_LEO_ORGANIZATION_SLUG) {
  const organization = await prisma.organization.upsert({
    where: { slug: organizationSlug },
    update: {
      name: "کافه لئو",
      type: "SHOP",
      isActive: true,
      isOpen: true,
      locale: "fa",
      timezone: "Asia/Tehran",
      capabilitiesInitializedAt: new Date(),
    },
    create: {
      slug: organizationSlug,
      name: "کافه لئو",
      type: "SHOP",
      isActive: true,
      isOpen: true,
      locale: "fa",
      timezone: "Asia/Tehran",
      capabilitiesInitializedAt: new Date(),
    },
  });

  await prisma.organizationCapability.upsert({
    where: { organizationId_key: { organizationId: organization.id, key: "SHOP" } },
    update: { status: OrganizationCapabilityStatus.ACTIVE, enabledAt: new Date() },
    create: {
      organizationId: organization.id,
      key: "SHOP",
      status: OrganizationCapabilityStatus.ACTIVE,
      enabledAt: new Date(),
    },
  });
  await prisma.organizationSettings.upsert({
    where: { organizationSlug },
    update: { currency: "IRR", enablePickup: true, enableDelivery: false },
    create: { organizationSlug, currency: "IRR", enablePickup: true, enableDelivery: false },
  });
  await prisma.paymentSettings.upsert({
    where: { organizationSlug },
    update: {},
    create: { organizationSlug },
  });

  return organization;
}

export async function importCafeLeoCatalog(
  prisma: PrismaClient,
  input: {
    fixture: CafeLeoExtractionFixture;
    organizationSlug?: string;
    updateBusinessProfile?: boolean;
  },
): Promise<CafeLeoImportResult> {
  const fixture = input.fixture;
  validateFixture(fixture);
  const organizationSlug = input.organizationSlug ?? CAFE_LEO_ORGANIZATION_SLUG;
  const organization = await prisma.organization.findUnique({
    where: { slug: organizationSlug },
    select: { id: true, slug: true },
  });
  if (!organization) {
    throw new Error(`Organization not found: ${organizationSlug}`);
  }

  const before = await getCounts(prisma, organization);
  let organizationUpdated = false;

  if (input.updateBusinessProfile) {
    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        name: fixture.business.name,
        description: fixture.business.description,
        logo: fixture.business.logoUrl,
        coverImage: fixture.business.coverImageUrl,
        address: fixture.business.address,
        phone: fixture.business.phone,
        email: fixture.business.email,
      },
    });
    organizationUpdated = true;
  }

  const categoryIdBySource = new Map<string, string>();
  let createdCategories = 0;
  let updatedCategories = 0;
  let createdProducts = 0;
  let updatedProducts = 0;
  let createdVariants = 0;
  let updatedVariants = 0;

  for (const category of fixture.categories) {
    const slug = categorySlug(category);
    const existing = await prisma.productCategory.findFirst({
      where: { organizationId: organization.id, slug },
      select: { id: true },
    });
    const data = {
      name: category.name,
      slug,
      description: null,
      image: null,
      sortOrder: category.order,
      isActive: true,
      deletedAt: null,
    };
    const record = existing
      ? await prisma.productCategory.update({ where: { id: existing.id }, data })
      : await prisma.productCategory.create({
        data: {
          ...data,
          organizationId: organization.id,
          organizationSlug: organization.slug,
        },
      });
    if (existing) updatedCategories += 1;
    else createdCategories += 1;
    categoryIdBySource.set(category.sourceId, record.id);
  }

  const sourceProductIds = new Set<string>();

  for (const category of fixture.categories) {
    const categoryId = categoryIdBySource.get(category.sourceId);
    if (!categoryId) throw new Error(`Missing category mapping for ${category.sourceId}`);

    for (const product of category.products) {
      sourceProductIds.add(product.sourceId);
      const sku = buildCafeLeoProductSku(product.sourceId);
      const imageUrl = product.imageUrl ? normalizeCafeLeoSourceUrl(product.imageUrl) : null;
      const existing = await prisma.product.findFirst({
        where: { organizationId: organization.id, sku },
        select: { id: true },
      });
      const data = {
        categoryId,
        name: product.name,
        slug: productSlug(product),
        description: product.description,
        basePrice: product.priceValue,
        image: imageUrl,
        isActive: true,
        sortOrder: product.order,
        sku,
        trackInventory: false,
        lowStockThreshold: 0,
        discountType: "none",
        discountValue: 0,
        deletedAt: null,
      };
      const productRecord = existing
        ? await prisma.product.update({ where: { id: existing.id }, data })
        : await prisma.product.create({
          data: {
            ...data,
            organizationId: organization.id,
            organizationSlug: organization.slug,
          },
        });
      if (existing) updatedProducts += 1;
      else createdProducts += 1;

      const variantSku = buildCafeLeoDefaultVariantSku(product.sourceId);
      const existingVariant = await prisma.productVariant.findUnique({
        where: { sku: variantSku },
        select: { id: true },
      });
      await prisma.productVariant.upsert({
        where: { sku: variantSku },
        update: {
          productId: productRecord.id,
          name: null,
          image: imageUrl,
          price: product.priceValue,
          inventory: 0,
          allowBackOrder: true,
          deletedAt: null,
        },
        create: {
          productId: productRecord.id,
          sku: variantSku,
          name: null,
          image: imageUrl,
          price: product.priceValue,
          inventory: 0,
          allowBackOrder: true,
        },
      });
      if (existingVariant) updatedVariants += 1;
      else createdVariants += 1;
    }
  }

  const importedProducts = await prisma.product.findMany({
    where: {
      organizationId: organization.id,
      sku: { startsWith: `${CAFE_LEO_SKU_PREFIX}-` },
      deletedAt: null,
    },
    select: { id: true, sku: true, isActive: true },
  });
  const staleProductIds = importedProducts
    .filter((product) => {
      const sourceId = product.sku?.slice(`${CAFE_LEO_SKU_PREFIX}-`.length);
      return sourceId ? !sourceProductIds.has(sourceId) : false;
    })
    .map((product) => product.id);

  let deactivatedProducts = 0;
  if (staleProductIds.length > 0) {
    const result = await prisma.product.updateMany({
      where: { id: { in: staleProductIds }, isActive: true },
      data: { isActive: false },
    });
    deactivatedProducts = result.count;
  }

  const after = await getCounts(prisma, organization);

  return {
    organizationSlug,
    created: {
      categories: Math.max(0, after.categories - before.categories),
      products: Math.max(0, after.products - before.products),
      variants: Math.max(0, after.variants - before.variants),
      imageRecords: Math.max(0, after.imageRecords - before.imageRecords),
    },
    updated: {
      organization: organizationUpdated,
      categories: updatedCategories,
      products: updatedProducts,
      variants: updatedVariants,
    },
    deactivated: {
      products: deactivatedProducts,
    },
    deleted: 0,
    counts: after,
  };
}
