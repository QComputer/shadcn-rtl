import type { PrismaClient, Organization } from "@prisma/client";
import { readExtractionFixture } from "./load-extraction";
import {
  SICILY_DOMAIN,
  SICILY_ORG_EMAIL,
  SICILY_ORG_PHONE,
  SICILY_DISPLAY_NAME,
  SKU_PREFIX,
  EXPECTED_COUNTS,
} from "./constants";
import type {
  CategoryMappingEntry,
  ExtractionItem,
  CategoryValidationResult,
  ItemValidationResult,
} from "./types";

function buildSku(blockId: number, itemId: number): string {
  return `${SKU_PREFIX}-${blockId}-${itemId}`;
}

function validateCategories(
  fixture: ReturnType<typeof readExtractionFixture>,
): CategoryValidationResult[] {
  const results: CategoryValidationResult[] = [];

  for (const cat of Object.values(fixture.categoryMapping)) {
    const entry: CategoryValidationResult = {
      blockId: cat.blockId,
      displayLabelFa: cat.displayLabelFa,
      isValid: true,
      errors: [],
    };

    if (typeof cat.blockId !== "number" || Number.isNaN(cat.blockId)) {
      entry.isValid = false;
      entry.errors.push("blockId is not a valid number");
    }

    if (typeof cat.displayLabelFa !== "string") {
      entry.isValid = false;
      entry.errors.push(
        `displayLabelFa is ${typeof cat.displayLabelFa}, expected string`,
      );
    }

    if (
      typeof cat.displayLabelFa === "string" &&
      cat.displayLabelFa.trim().length === 0
    ) {
      entry.isValid = false;
      entry.errors.push("displayLabelFa is empty after trim");
    }

    if (
      typeof cat.slug !== "string" ||
      cat.slug.trim().length === 0
    ) {
      entry.isValid = false;
      entry.errors.push("slug is missing or empty");
    }

    if (
      typeof cat.sourceImageUrl !== "string" ||
      cat.sourceImageUrl.trim().length === 0
    ) {
      entry.isValid = false;
      entry.errors.push("sourceImageUrl is missing or empty");
    }

    results.push(entry);
  }

  return results;
}

function validateItems(
  items: ExtractionItem[],
): ItemValidationResult[] {
  const results: ItemValidationResult[] = [];

  for (const item of items) {
    const entry: ItemValidationResult = {
      itemId: item.itemId,
      blockId: item.blockId,
      title: item.sourceName,
      isValid: true,
      errors: [],
    };

    if (typeof item.itemId !== "number" || Number.isNaN(item.itemId)) {
      entry.isValid = false;
      entry.errors.push("itemId is not a valid number");
    }

    if (typeof item.blockId !== "number" || Number.isNaN(item.blockId)) {
      entry.isValid = false;
      entry.errors.push("blockId is not a valid number");
    }

    const isFullyEmpty =
      (!item.sourceName || item.sourceName.trim().length === 0) &&
      (item.normalizedPrice === null || item.normalizedPrice === "");

    if (!isFullyEmpty) {
      if (
        typeof item.sourceName !== "string" ||
        item.sourceName.trim().length === 0
      ) {
        entry.isValid = false;
        entry.errors.push("sourceName is missing for a titled row");
      }

      const isPriced =
        item.normalizedPrice !== null &&
        item.normalizedPrice !== "" &&
        !Number.isNaN(Number(item.normalizedPrice));

      if (isPriced) {
        if (!/^\d+$/.test(item.normalizedPrice!)) {
          entry.isValid = false;
          entry.errors.push(
            `normalizedPrice '${item.normalizedPrice}' is not a valid integer`,
          );
        }
      }
    }

    results.push(entry);
  }

  return results;
}

export async function seedSicilyMenu(
  prisma: PrismaClient,
  sicilyOrg: Organization,
): Promise<void> {
  console.log("🍕 Seeding Sicily menu (EZY fastfoodsicily)...");

  // ── Update the base Sicily organization with source details ──
  await prisma.organization.update({
    where: { id: sicilyOrg.id },
    data: {
      name: SICILY_DISPLAY_NAME,
      description: "فست فود سیسیلی — منوی استخراج‌شده از EZY API",
      email: SICILY_ORG_EMAIL,
      phone: SICILY_ORG_PHONE,
    },
  });

  // ── Upsert the custom domain ──
  await prisma.organizationDomain.upsert({
    where: { domain: SICILY_DOMAIN },
    update: {
      organizationId: sicilyOrg.id,
      status: "ACTIVE" as const,
      isPrimary: true,
      sslReady: true,
      dnsConfigured: true,
      providerVerified: true,
      verifiedAt: new Date(),
      activatedAt: new Date(),
    },
    create: {
      organizationId: sicilyOrg.id,
      domain: SICILY_DOMAIN,
      normalizedDomain: SICILY_DOMAIN,
      kind: "APEX" as const,
      provider: "VERCEL" as const,
      type: "CUSTOM" as const,
      status: "ACTIVE" as const,
      isPrimary: true,
      sslReady: true,
      dnsConfigured: true,
      providerVerified: true,
      verifiedAt: new Date(),
      activatedAt: new Date(),
    },
  });

  // ── Read the clean extraction fixture ──
  const fixture = readExtractionFixture();

  // ── Source accounting assertions ──
  const c = fixture.counts;
  if (c.totalMenuRows !== EXPECTED_COUNTS.totalMenuRows) {
    throw new Error(
      `Fixture assertion failed: totalMenuRows expected ${EXPECTED_COUNTS.totalMenuRows}, got ${c.totalMenuRows}`,
    );
  }
  if (c.titledRows !== EXPECTED_COUNTS.titledRows) {
    throw new Error(
      `Fixture assertion failed: titledRows expected ${EXPECTED_COUNTS.titledRows}, got ${c.titledRows}`,
    );
  }
  if (c.pricedItems !== EXPECTED_COUNTS.pricedItems) {
    throw new Error(
      `Fixture assertion failed: pricedItems expected ${EXPECTED_COUNTS.pricedItems}, got ${c.pricedItems}`,
    );
  }
  if (c.titledUnpricedItems !== EXPECTED_COUNTS.titledUnpricedItems) {
    throw new Error(
      `Fixture assertion failed: titledUnpricedItems expected ${EXPECTED_COUNTS.titledUnpricedItems}, got ${c.titledUnpricedItems}`,
    );
  }
  if (c.fullyEmptyItems !== EXPECTED_COUNTS.fullyEmptyItems) {
    throw new Error(
      `Fixture assertion failed: fullyEmptyItems expected ${EXPECTED_COUNTS.fullyEmptyItems}, got ${c.fullyEmptyItems}`,
    );
  }

  // ── Validate all category data BEFORE any Prisma operation ──
  const categoryValidations = validateCategories(fixture);
  const invalidCategories = categoryValidations.filter((v) => !v.isValid);
  if (invalidCategories.length > 0) {
    for (const v of invalidCategories) {
      console.error(
        `Category validation failed for blockId=${v.blockId} ` +
          `displayLabelFa=${JSON.stringify(v.displayLabelFa)}: ${v.errors.join("; ")}`,
      );
    }
    throw new Error(
      `Category fixture validation failed for ${invalidCategories.length} categories. ` +
        `Refusing to proceed with Prisma.`,
    );
  }

  // ── Validate all item data BEFORE any Prisma operation ──
  const itemValidations = validateItems(fixture.items);
  const invalidItems = itemValidations.filter((v) => !v.isValid);
  if (invalidItems.length > 0) {
    for (const v of invalidItems) {
      console.error(
        `Item validation failed for itemId=${v.itemId} ` +
          `blockId=${v.blockId} title=${JSON.stringify(v.title)}: ` +
          `${v.errors.join("; ")}`,
      );
    }
    throw new Error(
      `Item fixture validation failed for ${invalidItems.length} items. ` +
        `Refusing to proceed with Prisma.`,
    );
  }

  // ── Build categories ──
  const categoryByBlockId = new Map<number, string>();

  for (const cat of Object.values(fixture.categoryMapping)) {
    const category = cat as CategoryMappingEntry;

    // Use findFirst + create/update for idempotency (no composite unique constraint)
    const existing = await prisma.productCategory.findFirst({
      where: {
        organizationId: sicilyOrg.id,
        slug: category.slug,
      },
    });

    let pc;
    if (existing) {
      pc = await prisma.productCategory.update({
        where: { id: existing.id },
        data: {
          name: category.displayLabelFa,
          image: category.sourceImageUrl,
          description: null,
          sortOrder: category.blockSort,
          isActive: true,
        },
      });
    } else {
      pc = await prisma.productCategory.create({
        data: {
          organizationId: sicilyOrg.id,
          organizationSlug: sicilyOrg.slug,
          name: category.displayLabelFa,
          slug: category.slug,
          image: category.sourceImageUrl,
          description: null,
          sortOrder: category.blockSort,
          isActive: true,
        },
      });
    }

    categoryByBlockId.set(category.blockId, pc.id);
    console.log(
      `  Category: ${category.displayLabelFa} (block ${category.blockId}, sort ${category.blockSort})`,
    );
  }

  // ── Build products ──
  let pricedActiveCount = 0;
  let inactiveUnpricedCount = 0;
  let omittedCount = 0;

  for (const item of fixture.items) {
    // Omit fully empty items (block 8731, item 41976)
    if (!item.sourceName || item.sourceName.trim().length === 0) {
      omittedCount++;
      console.log(
        `  Omitted fully-empty item (block ${item.blockId}, itemId ${item.itemId})`,
      );
      continue;
    }

    const categoryId = categoryByBlockId.get(item.blockId);
    if (!categoryId) {
      omittedCount++;
      console.log(
        `  Omitted item ${item.itemId}: no category for block ${item.blockId}`,
      );
      continue;
    }

    const sku = buildSku(item.blockId, item.itemId);
    const isPriced =
      item.normalizedPrice !== null &&
      item.normalizedPrice !== "" &&
      !Number.isNaN(Number(item.normalizedPrice));

    const basePrice = isPriced ? Number(item.normalizedPrice) : 0;
    const isActive = isPriced;

    // Use findFirst + create/update for idempotency
    const existing = await prisma.product.findFirst({
      where: {
        organizationId: sicilyOrg.id,
        sku,
      },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: item.sourceName,
          description: item.description,
          basePrice,
          image: item.imageUrl,
          isActive,
          sortOrder: item.itemOrder,
          categoryId,
          sku,
          trackInventory: false,
          lowStockThreshold: 0,
        },
      });
    } else {
      await prisma.product.create({
        data: {
          organizationId: sicilyOrg.id,
          organizationSlug: sicilyOrg.slug,
          categoryId,
          name: item.sourceName,
          description: item.description,
          basePrice,
          image: item.imageUrl,
          isActive,
          sortOrder: item.itemOrder,
          sku,
          trackInventory: false,
          lowStockThreshold: 0,
        },
      });
    }

    if (isPriced) {
      pricedActiveCount++;
    } else {
      inactiveUnpricedCount++;
      console.log(
        `  Inactive unpriced product: ${item.sourceName} ` +
          `(block ${item.blockId}, itemId ${item.itemId}, sku ${sku})`,
      );
    }
  }

  // ── Summary ──
  console.log(`\n  Sicily menu summary:`);
  console.log(`     Categories created: ${categoryByBlockId.size}`);
  console.log(`     Active priced products: ${pricedActiveCount}`);
  console.log(
    `     Inactive non-orderable products: ${inactiveUnpricedCount} ` +
      `(1 from block 8630, 5 from block 8943)`,
  );
  console.log(`     Omitted (fully empty): ${omittedCount}`);

  if (pricedActiveCount !== EXPECTED_COUNTS.pricedItems) {
    throw new Error(
      `Priced product count mismatch: expected ${EXPECTED_COUNTS.pricedItems}, got ${pricedActiveCount}`,
    );
  }
  if (inactiveUnpricedCount !== EXPECTED_COUNTS.titledUnpricedItems) {
    throw new Error(
      `Inactive product count mismatch: expected ${EXPECTED_COUNTS.titledUnpricedItems}, got ${inactiveUnpricedCount}`,
    );
  }
  if (omittedCount !== EXPECTED_COUNTS.fullyEmptyItems) {
    throw new Error(
      `Omitted count mismatch: expected ${EXPECTED_COUNTS.fullyEmptyItems}, got ${omittedCount}`,
    );
  }
}
