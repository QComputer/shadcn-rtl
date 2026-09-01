import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

export const ITALIANO_13_SOURCE = "SNAPPFOOD_MENU_31LMW4";

type Db = PrismaClient | Prisma.TransactionClient;

export type Italiano13Snapshot = {
  snapshotVersion: number;
  source: {
    provider: string;
    restaurantCode: string;
    restaurantName: string;
    url: string;
    publicReadEndpoint: string;
    retrievedAt: string;
  };
  organization: { slug: string };
  money: {
    sourceDisplayedUnit: "TOMAN";
    sourceApiUnit: "TOMAN";
    bazarbaazStoredUnit: "TOMAN";
    conversion: "identity";
    floatingPointUsed: false;
  };
  counts: { categories: number; products: number; prices: number; unpricedOrAmbiguous: number; duplicateSourceIdentities: number };
  excludedFields: string[];
  categories: Array<{
    externalId: string;
    name: string;
    order: number;
    products: Array<{
      externalId: string;
      name: string;
      order: number;
      active: boolean;
      variants: Array<{ externalId: string; name: string | null; priceToman: number; active: boolean; order: number }>;
    }>;
  }>;
};

export type Italiano13ImportSummary = {
  organizationId: string;
  connectionId: string;
  categories: number;
  products: number;
  variants: number;
  created: { categories: number; products: number; variants: number };
  updated: { categories: number; products: number; variants: number };
  unchanged: { categories: number; products: number; variants: number };
  deactivated: { categories: number; products: number; variants: number };
  priceChanges: Array<{ externalId: string; fromToman: number; toToman: number }>;
};

function stableSuffix(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function variantSku(organizationId: string, externalId: string) {
  return `I13-${stableSuffix(`${organizationId}:${externalId}`).toUpperCase()}`;
}

function decimalEquals(value: Prisma.Decimal | null, expected: number) {
  return value !== null && value.equals(expected);
}

async function upsertExternalItem(input: {
  db: Db;
  connectionId: string;
  organizationId: string;
  externalId: string;
  externalType: "CATEGORY" | "PRODUCT" | "OPTION";
  name: string;
  rawPayload: Prisma.InputJsonValue;
  importedEntityType: "PRODUCT_CATEGORY" | "PRODUCT";
  importedEntityId: string;
  internalVariantId?: string;
}) {
  const item = await input.db.externalCatalogItem.upsert({
    where: {
      connectionId_externalId_externalType: {
        connectionId: input.connectionId,
        externalId: input.externalId,
        externalType: input.externalType,
      },
    },
    create: {
      connectionId: input.connectionId,
      organizationId: input.organizationId,
      externalId: input.externalId,
      externalType: input.externalType,
      rawName: input.name,
      normalizedName: input.name,
      status: "IMPORTED",
      mappingStatus: "IMPORTED",
      approvedAt: new Date(),
      importedAt: new Date(),
      importedEntityType: input.importedEntityType,
      importedEntityId: input.importedEntityId,
      rawPayload: input.rawPayload,
    },
    update: {
      rawName: input.name,
      normalizedName: input.name,
      status: "IMPORTED",
      mappingStatus: "IMPORTED",
      importedAt: new Date(),
      importedEntityType: input.importedEntityType,
      importedEntityId: input.importedEntityId,
      rawPayload: input.rawPayload,
    },
  });

  await input.db.externalEntityMapping.upsert({
    where: {
      organizationId_externalSource_externalEntityType_externalId_internalEntityType: {
        organizationId: input.organizationId,
        externalSource: ITALIANO_13_SOURCE,
        externalEntityType: input.externalType === "CATEGORY" ? "CATEGORY" : "PRODUCT",
        externalId: input.externalId,
        internalEntityType: input.importedEntityType,
      },
    },
    create: {
      organizationId: input.organizationId,
      connectionId: input.connectionId,
      externalItemId: item.id,
      externalSource: ITALIANO_13_SOURCE,
      externalEntityType: input.externalType === "CATEGORY" ? "CATEGORY" : "PRODUCT",
      externalId: input.externalId,
      internalEntityType: input.importedEntityType,
      internalEntityId: input.importedEntityId,
      confidenceScore: 1,
      status: "APPROVED",
      metadata: input.internalVariantId ? { productVariantId: input.internalVariantId } : undefined,
    },
    update: {
      connectionId: input.connectionId,
      externalItemId: item.id,
      internalEntityId: input.importedEntityId,
      confidenceScore: 1,
      status: "APPROVED",
      metadata: input.internalVariantId ? { productVariantId: input.internalVariantId } : undefined,
    },
  });
}

export async function importItaliano13Snapshot(input: {
  prisma: PrismaClient;
  organizationId: string;
  snapshot: Italiano13Snapshot;
}): Promise<Italiano13ImportSummary> {
  if (input.snapshot.organization.slug !== "italiano-13") throw new Error("Snapshot organization slug must be italiano-13");
  if (input.snapshot.money.conversion !== "identity" || input.snapshot.money.bazarbaazStoredUnit !== "TOMAN") {
    throw new Error("Italiano 13 import requires exact integer Toman prices");
  }
  if (input.snapshot.counts.duplicateSourceIdentities !== 0 || input.snapshot.counts.unpricedOrAmbiguous !== 0) {
    throw new Error("Italiano 13 snapshot contains ambiguous identities or prices");
  }
  const snapshotProducts = input.snapshot.categories.flatMap((category) => category.products);
  const snapshotVariants = snapshotProducts.flatMap((product) => product.variants);
  const identities = input.snapshot.categories.flatMap((category) => [
    category.externalId,
    ...category.products.flatMap((product) => [product.externalId, ...product.variants.map((variant) => variant.externalId)]),
  ]);
  if (
    input.snapshot.counts.categories !== input.snapshot.categories.length ||
    input.snapshot.counts.products !== snapshotProducts.length ||
    input.snapshot.counts.prices !== snapshotVariants.length ||
    new Set(identities).size !== identities.length ||
    snapshotVariants.some((variant) => !Number.isSafeInteger(variant.priceToman) || variant.priceToman <= 0)
  ) {
    throw new Error("Italiano 13 snapshot counts, identities, or integer Toman prices are invalid");
  }

  return input.prisma.$transaction(async (tx) => {
    const organization = await tx.organization.findFirst({
      where: { id: input.organizationId, slug: "italiano-13", isActive: true, deletedAt: null },
      select: { id: true, slug: true },
    });
    if (!organization) throw new Error("Active italiano-13 organization was not found");
    const shopCapability = await tx.organizationCapability.findFirst({
      where: { organizationId: organization.id, key: "SHOP", status: "ACTIVE" },
      select: { id: true },
    });
    if (!shopCapability) throw new Error("Italiano 13 organization requires the SHOP capability");

    const connection = await tx.externalCatalogConnection.upsert({
      where: {
        organizationId_provider_externalUrl: {
          organizationId: organization.id,
          provider: "SNAPPFOOD",
          externalUrl: input.snapshot.source.url,
        },
      },
      create: {
        organizationId: organization.id,
        provider: "SNAPPFOOD",
        externalUrl: input.snapshot.source.url,
        status: "ACTIVE",
        syncMode: "MANUAL_APPROVAL",
        lastSyncAt: new Date(input.snapshot.source.retrievedAt),
        metadata: { source: ITALIANO_13_SOURCE, restaurantCode: input.snapshot.source.restaurantCode, readOnlySource: true },
      },
      update: {
        status: "ACTIVE",
        syncMode: "MANUAL_APPROVAL",
        lastSyncAt: new Date(input.snapshot.source.retrievedAt),
        metadata: { source: ITALIANO_13_SOURCE, restaurantCode: input.snapshot.source.restaurantCode, readOnlySource: true },
      },
    });

    const summary: Italiano13ImportSummary = {
      organizationId: organization.id,
      connectionId: connection.id,
      categories: 0,
      products: 0,
      variants: 0,
      created: { categories: 0, products: 0, variants: 0 },
      updated: { categories: 0, products: 0, variants: 0 },
      unchanged: { categories: 0, products: 0, variants: 0 },
      deactivated: { categories: 0, products: 0, variants: 0 },
      priceChanges: [],
    };
    const seenCategoryIds = new Set<string>();
    const seenProductIds = new Set<string>();
    const seenVariantIds = new Set<string>();

    for (const categoryInput of input.snapshot.categories) {
      seenCategoryIds.add(categoryInput.externalId);
      const mapping = await tx.externalEntityMapping.findFirst({
        where: { organizationId: organization.id, externalSource: ITALIANO_13_SOURCE, externalId: categoryInput.externalId, externalEntityType: "CATEGORY", internalEntityType: "PRODUCT_CATEGORY" },
      });
      const existing = mapping?.internalEntityId
        ? await tx.productCategory.findFirst({ where: { id: mapping.internalEntityId, organizationId: organization.id } })
        : null;
      const changed = existing && (existing.name !== categoryInput.name || existing.sortOrder !== categoryInput.order || !existing.isActive || existing.deletedAt !== null);
      const category = existing
        ? changed
          ? await tx.productCategory.update({ where: { id: existing.id }, data: { name: categoryInput.name, sortOrder: categoryInput.order, isActive: true, deletedAt: null } })
          : existing
        : await tx.productCategory.create({
            data: {
              organizationId: organization.id,
              organizationSlug: organization.slug,
              name: categoryInput.name,
              slug: `italiano-${stableSuffix(categoryInput.externalId)}`,
              sortOrder: categoryInput.order,
              isActive: true,
            },
          });
      summary.categories += 1;
      summary[existing ? (changed ? "updated" : "unchanged") : "created"].categories += 1;
      await upsertExternalItem({
        db: tx,
        connectionId: connection.id,
        organizationId: organization.id,
        externalId: categoryInput.externalId,
        externalType: "CATEGORY",
        name: categoryInput.name,
        rawPayload: { externalId: categoryInput.externalId, order: categoryInput.order },
        importedEntityType: "PRODUCT_CATEGORY",
        importedEntityId: category.id,
      });

      for (const productInput of categoryInput.products) {
        seenProductIds.add(productInput.externalId);
        const activeVariants = productInput.variants.filter((variant) => variant.active);
        if (activeVariants.length === 0) throw new Error(`Product ${productInput.externalId} has no active price`);
        const basePrice = Math.min(...activeVariants.map((variant) => variant.priceToman));
        const productMapping = await tx.externalEntityMapping.findFirst({
          where: { organizationId: organization.id, externalSource: ITALIANO_13_SOURCE, externalId: productInput.externalId, externalEntityType: "PRODUCT", internalEntityType: "PRODUCT" },
        });
        const existingProduct = productMapping?.internalEntityId
          ? await tx.product.findFirst({ where: { id: productMapping.internalEntityId, organizationId: organization.id } })
          : null;
        const productChanged = existingProduct && (
          existingProduct.name !== productInput.name || existingProduct.categoryId !== category.id ||
          existingProduct.sortOrder !== productInput.order || existingProduct.isActive !== productInput.active ||
          existingProduct.deletedAt !== null || !decimalEquals(existingProduct.basePrice, basePrice) ||
          existingProduct.description !== null || existingProduct.image !== null
        );
        const product = existingProduct
          ? productChanged
            ? await tx.product.update({
                where: { id: existingProduct.id },
                data: {
                  name: productInput.name,
                  categoryId: category.id,
                  basePrice,
                  sortOrder: productInput.order,
                  isActive: productInput.active,
                  deletedAt: null,
                  description: null,
                  image: null,
                  trackInventory: false,
                },
              })
            : existingProduct
          : await tx.product.create({
              data: {
                organizationId: organization.id,
                organizationSlug: organization.slug,
                categoryId: category.id,
                name: productInput.name,
                slug: `italiano-${stableSuffix(productInput.externalId)}`,
                basePrice,
                sortOrder: productInput.order,
                isActive: productInput.active,
                description: null,
                image: null,
                trackInventory: false,
              },
            });
        summary.products += 1;
        summary[existingProduct ? (productChanged ? "updated" : "unchanged") : "created"].products += 1;
        await upsertExternalItem({
          db: tx,
          connectionId: connection.id,
          organizationId: organization.id,
          externalId: productInput.externalId,
          externalType: "PRODUCT",
          name: productInput.name,
          rawPayload: { externalId: productInput.externalId, categoryExternalId: categoryInput.externalId, order: productInput.order, active: productInput.active },
          importedEntityType: "PRODUCT",
          importedEntityId: product.id,
        });

        for (const variantInput of productInput.variants) {
          seenVariantIds.add(variantInput.externalId);
          const sku = variantSku(organization.id, variantInput.externalId);
          const existingVariant = await tx.productVariant.findUnique({ where: { sku } });
          if (existingVariant && existingVariant.productId !== product.id) throw new Error(`Variant SKU collision for ${variantInput.externalId}`);
          const variantChanged = existingVariant && (
            existingVariant.name !== variantInput.name || !decimalEquals(existingVariant.price, variantInput.priceToman) ||
            (variantInput.active ? existingVariant.deletedAt !== null : existingVariant.deletedAt === null) ||
            existingVariant.allowBackOrder !== true || existingVariant.inventory !== 1000
          );
          if (existingVariant?.price && !decimalEquals(existingVariant.price, variantInput.priceToman)) {
            summary.priceChanges.push({ externalId: variantInput.externalId, fromToman: existingVariant.price.toNumber(), toToman: variantInput.priceToman });
          }
          const variant = existingVariant
            ? variantChanged
              ? await tx.productVariant.update({
                  where: { id: existingVariant.id },
                  data: { name: variantInput.name, price: variantInput.priceToman, deletedAt: variantInput.active ? null : new Date(), allowBackOrder: true, inventory: 1000 },
                })
              : existingVariant
            : await tx.productVariant.create({
                data: { productId: product.id, sku, name: variantInput.name, price: variantInput.priceToman, inventory: 1000, allowBackOrder: true, deletedAt: variantInput.active ? null : new Date() },
              });
          summary.variants += 1;
          summary[existingVariant ? (variantChanged ? "updated" : "unchanged") : "created"].variants += 1;
          await upsertExternalItem({
            db: tx,
            connectionId: connection.id,
            organizationId: organization.id,
            externalId: variantInput.externalId,
            externalType: "OPTION",
            name: variantInput.name || productInput.name,
            rawPayload: { externalId: variant.id, sourceExternalId: variantInput.externalId, priceToman: variantInput.priceToman, active: variantInput.active, order: variantInput.order },
            importedEntityType: "PRODUCT",
            importedEntityId: product.id,
            internalVariantId: variant.id,
          });
        }
      }
    }

    const sourceMappings = await tx.externalEntityMapping.findMany({
      where: { organizationId: organization.id, externalSource: ITALIANO_13_SOURCE },
      select: { externalId: true, externalEntityType: true, internalEntityType: true, internalEntityId: true, metadata: true },
    });
    for (const mapping of sourceMappings) {
      if (!mapping.internalEntityId) continue;
      if (mapping.externalEntityType === "CATEGORY" && !seenCategoryIds.has(mapping.externalId)) {
        const result = await tx.productCategory.updateMany({ where: { id: mapping.internalEntityId, organizationId: organization.id, isActive: true }, data: { isActive: false } });
        summary.deactivated.categories += result.count;
      } else if (mapping.externalEntityType === "PRODUCT" && mapping.externalId.startsWith("product:") && !seenProductIds.has(mapping.externalId)) {
        const result = await tx.product.updateMany({ where: { id: mapping.internalEntityId, organizationId: organization.id, isActive: true }, data: { isActive: false } });
        summary.deactivated.products += result.count;
      } else if (mapping.externalEntityType === "PRODUCT" && mapping.externalId.startsWith("variation:") && !seenVariantIds.has(mapping.externalId)) {
        const metadata = mapping.metadata as { productVariantId?: string } | null;
        if (metadata?.productVariantId) {
          const result = await tx.productVariant.updateMany({ where: { id: metadata.productVariantId, product: { organizationId: organization.id }, deletedAt: null }, data: { deletedAt: new Date() } });
          summary.deactivated.variants += result.count;
        }
      }
    }

    await tx.externalImportRun.create({
      data: {
        organizationId: organization.id,
        connectionId: connection.id,
        status: "COMPLETED",
        summary: summary as unknown as Prisma.InputJsonValue,
        finishedAt: new Date(),
        approvedAt: new Date(),
        importedAt: new Date(),
      },
    });
    return summary;
  }, {
    maxWait: 30_000,
    timeout: 180_000,
  });
}
