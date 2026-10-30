import "server-only";
import { randomBytes } from "node:crypto";
import { gallerySettingsInputSchema, readGallerySettings, orderedImages, type GallerySettingsInput } from "@/lib/retail/product-galleries";

import { Prisma, RetailAttributeScope, RetailAttributeValueType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { buildUniqueDetailSlug } from "@/lib/detail-slugs";
import { buildOrganizationPublicPath } from "@/lib/custom-domain-routing";
import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import type { TenantContext } from "@/lib/tenant-context";
import { retailAttributeDefinitionInputSchema, validateRetailAttributeValue } from "@/lib/retail/attribute-validation";
import { canonicalCategoryIds, canonicalTagNames, MAX_PRODUCT_CATEGORIES, MAX_PRODUCT_TAGS, MAX_TAG_NAME_LENGTH } from "@/lib/retail/product-taxonomy-utils";
import { createProductCategorySchema, updateProductCategorySchema } from "@/lib/validators";

const priceSchema = z.number().finite().positive().max(9_999_999_999.99);
const assignmentSchema = z.object({
  definitionId: z.string().min(1).max(64),
  value: z.union([z.string().max(1000), z.number().finite(), z.boolean()]),
}).strict();
const variantCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().max(100).nullable().default(null),
  price: priceSchema.nullable().optional().default(null),
  inventory: z.number().int().min(0).max(1_000_000_000),
  allowBackOrder: z.boolean().default(false),
  manuallyUnavailable: z.boolean().default(false).optional(),
  galleryMode: z.enum(["INHERIT", "OVERRIDE"]).optional(),
  options: z.array(assignmentSchema).max(40).default([]),
  imageIds: z.array(z.string().min(1).max(64)).max(20).default([]),
}).strict().superRefine((variant, context) => {
  const seen = new Set<string>();
  for (const option of variant.options) {
    if (seen.has(option.definitionId)) context.addIssue({ code: "custom", path: ["options"], message: "Each variant option can be set only once." });
    seen.add(option.definitionId);
  }
});

export const retailProductCreateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(5000).nullable().default(null),
  basePrice: priceSchema,
  categoryId: z.string().min(1).max(64),
  brand: z.string().trim().max(120).nullable().optional(),
  categoryIds: z.array(z.string().trim().min(1).max(64)).max(MAX_PRODUCT_CATEGORIES).optional(),
  tagNames: z.array(z.string().max(MAX_TAG_NAME_LENGTH * 3)).max(MAX_PRODUCT_TAGS).optional(),
  imageIds: z.array(z.string().min(1).max(64)).max(20).default([]),
  attributes: z.array(assignmentSchema).max(80).default([]),
  variants: z.array(variantCreateSchema).min(1).max(100),
  trackInventory: z.boolean().optional(),
  gallerySettings: gallerySettingsInputSchema.optional(),
}).strict().superRefine((input, context) => {
  const seen = new Set<string>();
  for (const attribute of input.attributes) {
    if (seen.has(attribute.definitionId)) context.addIssue({ code: "custom", path: ["attributes"], message: "Each product attribute can be set only once." });
    seen.add(attribute.definitionId);
  }
  if (new Set(input.imageIds).size !== input.imageIds.length) context.addIssue({ code: "custom", path: ["imageIds"], message: "Duplicate product images are not allowed." });
  for (const variant of input.variants) if (new Set(variant.imageIds).size !== variant.imageIds.length) context.addIssue({ code: "custom", path: ["variants"], message: "Duplicate variant images are not allowed." });
});

const variantUpdateSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(200).optional(),
  sku: z.string().trim().max(100).nullable().optional(),
  price: priceSchema.nullable().optional(),
  inventory: z.number().int().min(0).max(1_000_000_000).optional(),
  allowBackOrder: z.boolean().optional(),
  manuallyUnavailable: z.boolean().optional(),
  galleryMode: z.enum(["INHERIT", "OVERRIDE"]).optional(),
  options: z.array(assignmentSchema).max(40).optional(),
  imageIds: z.array(z.string().min(1).max(64)).max(20).optional(),
}).strict().superRefine((variant, context) => {
  if (variant.options && new Set(variant.options.map((option) => option.definitionId)).size !== variant.options.length) context.addIssue({ code: "custom", path: ["options"], message: "Each variant option can be set only once." });
});

export const retailProductUpdateSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  slug: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  basePrice: priceSchema.optional(),
  categoryId: z.string().min(1).max(64).optional(),
  brand: z.string().trim().max(120).nullable().optional(),
  categoryIds: z.array(z.string().trim().min(1).max(64)).max(MAX_PRODUCT_CATEGORIES).optional(),
  tagNames: z.array(z.string().max(MAX_TAG_NAME_LENGTH * 3)).max(MAX_PRODUCT_TAGS).optional(),
  imageIds: z.array(z.string().min(1).max(64)).max(20).optional(),
  attributes: z.array(assignmentSchema).max(80).optional(),
  newVariants: z.array(variantCreateSchema).max(100).optional(),
  variantUpdates: z.array(variantUpdateSchema).max(100).optional(),
  isActive: z.boolean().optional(),
  trackInventory: z.boolean().optional(),
  gallerySettings: gallerySettingsInputSchema.optional(),
}).strict().superRefine((input, context) => {
  if (input.imageIds && new Set(input.imageIds).size !== input.imageIds.length) context.addIssue({ code: "custom", path: ["imageIds"], message: "Duplicate product images are not allowed." });
  if (input.variantUpdates) for (const variant of input.variantUpdates) if (variant.imageIds && new Set(variant.imageIds).size !== variant.imageIds.length) context.addIssue({ code: "custom", path: ["variantUpdates"], message: "Duplicate variant images are not allowed." });
  if (input.attributes) {
    const seen = new Set<string>();
    for (const attribute of input.attributes) {
      if (seen.has(attribute.definitionId)) context.addIssue({ code: "custom", path: ["attributes"], message: "Each product attribute can be set only once." });
      seen.add(attribute.definitionId);
    }
  }
  if (input.variantUpdates && new Set(input.variantUpdates.map((variant) => variant.id)).size !== input.variantUpdates.length) context.addIssue({ code: "custom", path: ["variantUpdates"], message: "A variant can be updated only once per request." });
});

export const retailCategoryCreateSchema = createProductCategorySchema.omit({ image: true }).strict();
export const retailCategoryUpdateSchema = updateProductCategorySchema.omit({ image: true }).strict();
export const retailDefinitionSchema = retailAttributeDefinitionInputSchema;

export const merchantProductSelect = {
  id: true, name: true, brand: true, slug: true, description: true, basePrice: true, image: true, isActive: true, organizationId: true,
  categoryId: true, trackInventory: true, gallerySettings: true, createdAt: true, updatedAt: true,
  category: { select: { id: true, name: true, slug: true, isActive: true } },
  images: { select: { id: true, url: true, access: true, organizationId: true }, orderBy: { createdAt: "asc" } },
  categoryAssignments: { where: { category: { deletedAt: null, isActive: true } }, select: { categoryId: true } },
  tagAssignments: { select: { tag: { select: { id: true, name: true } } }, orderBy: { tagId: "asc" } },
  attributeValues: { select: {
    id: true, definitionId: true, valueText: true, valueNumber: true, valueBoolean: true,
    definition: { select: { organizationId: true, key: true, label: true, localizedLabels: true, scope: true, valueType: true, displayUnit: true, localizedUnits: true, allowedValues: true, isFilterable: true, isActive: true } },
  } },
  variants: { where: { deletedAt: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: {
    id: true, name: true, sku: true, price: true, inventory: true, reservedQuantity: true, allowBackOrder: true, manuallyUnavailable: true,
    optionValues: { select: {
      id: true, definitionId: true, valueText: true, valueNumber: true, valueBoolean: true,
      definition: { select: { organizationId: true, key: true, label: true, localizedLabels: true, scope: true, valueType: true, displayUnit: true, localizedUnits: true, allowedValues: true, isFilterable: true, isActive: true } },
    } },
    galleryImages: { orderBy: { sortOrder: "asc" }, select: { sortOrder: true, image: { select: { id: true, url: true, access: true, organizationId: true } } } },
  } },
} satisfies Prisma.ProductSelect;

type MerchantProduct = Prisma.ProductGetPayload<{ select: typeof merchantProductSelect }>;

function assignmentValue(value: { valueText: string | null; valueNumber: Prisma.Decimal | null; valueBoolean: boolean | null }) {
  if (value.valueText !== null) return value.valueText;
  if (value.valueNumber !== null) return Number(value.valueNumber.toString());
  return value.valueBoolean;
}

export function serializeMerchantProduct(product: MerchantProduct) {
  const gallerySettings = readGallerySettings(product.gallerySettings);
  const productImages = orderedImages(product.images, gallerySettings?.productImageIds ?? []);
  return {
    gallerySettings,
    id: product.id,
    name: product.name,
    brand: product.brand,
    slug: product.slug,
    description: product.description,
    basePrice: Number(product.basePrice.toString()),
    isActive: product.isActive,
    trackInventory: product.trackInventory,
    category: product.category,
    images: productImages.filter((image) => image.access === "PUBLIC" && image.organizationId === product.organizationId).map((image) => ({ id: image.id, url: image.url })),
    imageIds: productImages.filter((image) => image.access === "PUBLIC" && image.organizationId === product.organizationId).map((image) => image.id),
    categoryIds: Array.from(new Set([product.categoryId, ...product.categoryAssignments.map((assignment) => assignment.categoryId)])),
    tags: product.tagAssignments.map((assignment) => assignment.tag),
    attributes: product.attributeValues
      .filter((value) => value.definition.organizationId === product.organizationId && value.definition.isActive)
      .map((value) => ({ definitionId: value.definitionId, key: value.definition.key, label: value.definition.label, valueType: value.definition.valueType, displayUnit: value.definition.displayUnit, value: assignmentValue(value) })),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      price: variant.price === null ? null : Number(variant.price.toString()),
      inventory: variant.inventory,
      galleryMode: gallerySettings ? (gallerySettings.overrides.includes(variant.id) ? "OVERRIDE" : "INHERIT") : null,
      reservedQuantity: variant.reservedQuantity,
      availableQuantity: Math.max(0, variant.inventory - variant.reservedQuantity),
      manuallyUnavailable: variant.manuallyUnavailable,
      allowBackOrder: variant.allowBackOrder,
      options: variant.optionValues
        .filter((value) => value.definition.organizationId === product.organizationId && value.definition.isActive)
        .map((value) => ({ definitionId: value.definitionId, key: value.definition.key, label: value.definition.label, valueType: value.definition.valueType, displayUnit: value.definition.displayUnit, value: assignmentValue(value) })),
      images: variant.galleryImages.filter((entry) => entry.image.access === "PUBLIC" && entry.image.organizationId === product.organizationId).map((entry) => ({ id: entry.image.id, url: entry.image.url })),
      imageIds: variant.galleryImages.filter((entry) => entry.image.access === "PUBLIC" && entry.image.organizationId === product.organizationId).map((entry) => entry.image.id),
    })),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

async function requireOwnedCategory(tx: Prisma.TransactionClient, organizationId: string, categoryId: string) {
  const category = await tx.productCategory.findFirst({
    where: { id: categoryId, organizationId, deletedAt: null, isActive: true },
    select: { id: true, name: true, slug: true, organizationSlug: true },
  });
  if (!category) throw new ApiError(400, "Choose an active category belonging to this store.");
  return category;
}

async function requireOwnedImages(tx: Prisma.TransactionClient, organizationId: string, imageIds: string[]) {
  if (imageIds.length === 0) return [];
  const images = await tx.image.findMany({
    where: { id: { in: imageIds }, organizationId, access: "PUBLIC" },
    select: { id: true, url: true },
  });
  if (images.length !== imageIds.length) throw new ApiError(400, "Only public images uploaded to this store can be attached.");
  return imageIds.map((id) => images.find((image) => image.id === id)!);
}

async function replaceVariantImages(tx: Prisma.TransactionClient, organizationId: string, variantId: string, imageIds: string[]) {
  await requireOwnedImages(tx, organizationId, imageIds);
  await tx.productVariantImage.deleteMany({ where: { variantId } });
  if (imageIds.length) await tx.productVariantImage.createMany({ data: imageIds.map((imageId, sortOrder) => ({ variantId, imageId, sortOrder })) });
}

async function saveGallerySettings(tx: Prisma.TransactionClient, organizationId: string, productId: string,
  settings: GallerySettingsInput, modes: Map<string, "INHERIT" | "OVERRIDE">) {
  const product = await tx.product.findFirstOrThrow({ where: { id: productId, organizationId },
    select: { gallerySettings: true, images: { select: { id: true } }, variants: { where: { deletedAt: null }, select: {
      id: true, optionValues: { select: { definitionId: true, valueText: true, valueNumber: true, valueBoolean: true } },
      galleryImages: { orderBy: { sortOrder: "asc" }, select: { imageId: true } },
    } } } });
  if (product.images.length !== settings.productImageIds.length || product.images.some(image => !settings.productImageIds.includes(image.id))) {
    throw new ApiError(400, "Gallery order must match the product's assigned images.");
  }
  await requireOwnedImages(tx, organizationId, settings.productImageIds);
  for (const color of settings.colors) {
    const definition = await tx.retailAttributeDefinition.findFirst({ where: { id: color.definitionId, organizationId, scope: "VARIANT_OPTION", isActive: true } });
    if (!definition) throw new ApiError(400, "Color attribute must belong to this store.");
    try {
      const allowedValues = Array.isArray(definition.allowedValues) ? definition.allowedValues.filter((value): value is string => typeof value === "string") : null;
      validateRetailAttributeValue({ valueType: definition.valueType, allowedValues }, definition.valueType === "NUMBER" ? Number(color.value) : definition.valueType === "BOOLEAN" ? color.value === "true" : color.value);
    } catch { throw new ApiError(400, "Color value is not valid for this store attribute."); }
    if (!product.variants.some(variant => variant.optionValues.some(option => option.definitionId === color.definitionId && String(assignmentValue(option)) === color.value))) {
      throw new ApiError(400, "Color gallery must match a current product option.");
    }
    await requireOwnedImages(tx, organizationId, color.imageIds);
  }
  const previous = readGallerySettings(product.gallerySettings);
  const overrides = new Set(previous?.overrides ?? []);
  // A settings-only update on a legacy API must preserve all existing variant
  // images until that variant is explicitly opted into color inheritance.
  if (!previous) for (const variant of product.variants) if (!modes.has(variant.id)) overrides.add(variant.id);
  for (const [id, mode] of modes) { if (mode === "OVERRIDE") overrides.add(id); else overrides.delete(id); }
  for (const variant of product.variants) {
    if (overrides.has(variant.id)) continue;
    const color = settings.colors.find(group => variant.optionValues.some(option => option.definitionId === group.definitionId && String(assignmentValue(option)) === group.value));
    const imageIds = color?.imageIds ?? [];
    if (JSON.stringify(variant.galleryImages.map(image => image.imageId)) !== JSON.stringify(imageIds)) await replaceVariantImages(tx, organizationId, variant.id, imageIds);
  }
  await tx.product.update({ where: { id: productId }, data: { gallerySettings: {
    ...settings, overrides: product.variants.filter(variant => overrides.has(variant.id)).map(variant => variant.id),
  } } });
}

async function replaceProductTaxonomy(tx: Prisma.TransactionClient, input: {
  organizationId: string; productId: string; primaryCategoryId: string; categoryIds?: string[]; tagNames?: string[];
}) {
  if (input.categoryIds !== undefined) {
    let ids: string[];
    try { ids = canonicalCategoryIds(input.primaryCategoryId, input.categoryIds); }
    catch { throw new ApiError(400, "Invalid product categories."); }
    const valid = await tx.productCategory.count({ where: { id: { in: ids }, organizationId: input.organizationId, deletedAt: null, isActive: true } });
    if (valid !== ids.length) throw new ApiError(400, "Every selected category must belong to this active store.");
    await tx.productCategoryAssignment.deleteMany({ where: { productId: input.productId, organizationId: input.organizationId, categoryId: { notIn: ids } } });
    await tx.productCategoryAssignment.createMany({ data: ids.map((categoryId) => ({ productId: input.productId, categoryId, organizationId: input.organizationId })), skipDuplicates: true });
  }
  if (input.tagNames !== undefined) {
    let tags: ReturnType<typeof canonicalTagNames>;
    try { tags = canonicalTagNames(input.tagNames); }
    catch { throw new ApiError(400, "Invalid product tags."); }
    const ids: string[] = [];
    for (const tag of tags) {
      const saved = await tx.productTag.upsert({
        where: { organizationId_normalizedName: { organizationId: input.organizationId, normalizedName: tag.normalizedName } },
        update: {}, create: { organizationId: input.organizationId, ...tag }, select: { id: true },
      });
      ids.push(saved.id);
    }
    await tx.productTagAssignment.deleteMany({ where: { productId: input.productId, organizationId: input.organizationId, tagId: { notIn: ids } } });
    if (ids.length) await tx.productTagAssignment.createMany({ data: ids.map((tagId) => ({ productId: input.productId, tagId, organizationId: input.organizationId })), skipDuplicates: true });
  }
}

async function assertDistinctVariantCombinations(tx: Prisma.TransactionClient, productId: string) {
  const variants = await tx.productVariant.findMany({ where: { productId, deletedAt: null }, select: {
    id: true, optionValues: { orderBy: { definitionId: "asc" }, select: { definitionId: true, valueText: true, valueNumber: true, valueBoolean: true } },
  } });
  const seen = new Set<string>();
  for (const variant of variants) {
    if (variant.optionValues.length === 0) continue;
    const combination = JSON.stringify(variant.optionValues.map((option) => [option.definitionId, option.valueText, option.valueNumber?.toString() ?? null, option.valueBoolean]));
    if (seen.has(combination)) throw new ApiError(409, "Each variant must have a distinct option combination.");
    seen.add(combination);
  }
}

async function requireDefinitions(
  tx: Prisma.TransactionClient,
  organizationId: string,
  assignments: Array<z.infer<typeof assignmentSchema>>,
  scope: RetailAttributeScope,
) {
  if (!assignments.length) return new Map<string, { id: string; valueType: RetailAttributeValueType; allowedValues: Prisma.JsonValue | null }>();
  const definitions = await tx.retailAttributeDefinition.findMany({
    where: { id: { in: assignments.map((value) => value.definitionId) }, organizationId, scope, isActive: true },
    select: { id: true, valueType: true, allowedValues: true },
  });
  if (definitions.length !== assignments.length) throw new ApiError(400, "An attribute is missing, inactive, or belongs to another store.");
  return new Map(definitions.map((definition) => [definition.id, definition]));
}

async function writeAssignments(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; productId?: string; variantId?: string; assignments: Array<z.infer<typeof assignmentSchema>>; scope: RetailAttributeScope },
) {
  const definitions = await requireDefinitions(tx, input.organizationId, input.assignments, input.scope);
  for (const assignment of input.assignments) {
    const definition = definitions.get(assignment.definitionId);
    if (!definition) throw new ApiError(400, "An attribute is missing or belongs to another store.");
    const allowedValues = Array.isArray(definition.allowedValues) ? definition.allowedValues.filter((value): value is string => typeof value === "string") : null;
    const typed = validateRetailAttributeValue({ valueType: definition.valueType, allowedValues }, assignment.value);
    if (input.productId) {
      await tx.productAttributeValue.create({ data: { productId: input.productId, definitionId: definition.id, ...typed } });
    } else if (input.variantId) {
      await tx.productVariantAttributeValue.create({ data: { variantId: input.variantId, definitionId: definition.id, ...typed } });
    }
  }
}

async function createVariants(tx: Prisma.TransactionClient, input: {
  organizationId: string; productId: string; actorUserId: string; variants: Array<z.infer<typeof variantCreateSchema>>;
}) {
  if (!input.variants.length) return [];
  // Validate the same tenant/type rules once per product, then persist bounded
  // sets. Avoid a network round trip for every attribute and stock movement.
  const assignments = [...new Map(input.variants.flatMap(v => v.options).map(a => [a.definitionId, a])).values()];
  const definitions = await requireDefinitions(tx, input.organizationId, assignments, RetailAttributeScope.VARIANT_OPTION);
  await requireOwnedImages(tx, input.organizationId, [...new Set(input.variants.flatMap(v => v.imageIds))]);
  // createMany gives rows the same creation timestamp. Keep the existing
  // createdAt/id projection in input order. Preserve the 25-character CUID
  // contract enforced by the existing cart API; never relax its validation.
  const batchId = "c" + randomBytes(10).toString("hex");
  const variants = input.variants.map((variant, index) => ({ id: `${batchId}${index.toString(36).padStart(4, "0")}`, variant }));
  const options: Prisma.ProductVariantAttributeValueCreateManyInput[] = [];
  for (const { id, variant } of variants) for (const assignment of variant.options) {
    const definition = definitions.get(assignment.definitionId)!;
    const allowedValues = Array.isArray(definition.allowedValues) ? definition.allowedValues.filter((value): value is string => typeof value === "string") : null;
    const typed = validateRetailAttributeValue({ valueType: definition.valueType, allowedValues }, assignment.value);
    options.push({ variantId: id, definitionId: definition.id, ...typed });
  }
  await tx.productVariant.createMany({ data: variants.map(({ id, variant }) => ({ id, productId: input.productId, name: variant.name, sku: variant.sku || null, price: variant.price === null ? null : new Prisma.Decimal(variant.price), inventory: variant.inventory, allowBackOrder: variant.allowBackOrder, manuallyUnavailable: variant.manuallyUnavailable ?? false })) });
  const movements = variants.filter(v => v.variant.inventory > 0).map(({ id, variant }) => ({ variantId: id, quantityDelta: variant.inventory, quantityBefore: 0, quantityAfter: variant.inventory, reason: "INITIAL_STOCK" as const, note: "Initial stock entered by the organization in retail catalog management.", createdById: input.actorUserId }));
  if (movements.length) await tx.inventoryMovement.createMany({ data: movements });
  if (options.length) await tx.productVariantAttributeValue.createMany({ data: options });
  const images = variants.flatMap(({ id, variant }) => variant.imageIds.map((imageId, sortOrder) => ({ variantId: id, imageId, sortOrder })));
  if (images.length) await tx.productVariantImage.createMany({ data: images });
  return variants.map(v => v.id);
}

function revalidateRetailStorefront(organizationSlug: string, productId?: string) {
  for (const locale of ["fa", "en", "ar"] as const) {
    const root = buildOrganizationPublicPath({ locale, organizationSlug, surface: "shop" });
    revalidatePath(root);
    if (productId) revalidatePath(buildOrganizationPublicPath({ locale, organizationSlug, surface: "shop", subPath: `/product/${productId}` }));
  }
}

export async function listMerchantRetailProducts(input: {
  context: TenantContext; page: number; pageSize: number; query?: string; state?: "all" | "published" | "draft";
}) {
  const where: Prisma.ProductWhereInput = {
    organizationId: input.context.organizationId,
    deletedAt: null,
    ...(input.state === "published" ? { isActive: true } : input.state === "draft" ? { isActive: false } : {}),
    ...(input.query ? { OR: [
      { name: { contains: input.query, mode: "insensitive" } },
      { slug: { contains: input.query, mode: "insensitive" } },
      { brand: { contains: input.query, mode: "insensitive" } },
    ] } : {}),
  };
  const [products, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize, select: merchantProductSelect }),
    prisma.product.count({ where }),
  ]);
  return { products: products.map(serializeMerchantProduct), pagination: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.ceil(total / input.pageSize) } };
}

export async function listMerchantRetailCategories(context: TenantContext) {
  return prisma.productCategory.findMany({
    where: { organizationId: context.organizationId, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, slug: true, description: true, isActive: true, sortOrder: true },
  });
}

export async function createMerchantRetailCategory(context: TenantContext, data: z.infer<typeof retailCategoryCreateSchema>) {
  const category = await prisma.$transaction(async (tx) => {
    const duplicate = await tx.productCategory.findFirst({ where: { organizationId: context.organizationId, deletedAt: null, name: { equals: data.name, mode: "insensitive" } }, select: { id: true } });
    if (duplicate) throw new ApiError(409, "A category with this name already exists in this store.");
    const slug = await buildUniqueDetailSlug(data.slug || data.name, async (candidate) => Boolean(await tx.productCategory.findFirst({ where: { organizationId: context.organizationId, deletedAt: null, slug: candidate }, select: { id: true } })));
    return tx.productCategory.create({ data: { ...data, slug, organizationId: context.organizationId, organizationSlug: context.organizationSlug, isActive: true }, select: { id: true, name: true, slug: true, description: true, isActive: true, sortOrder: true } });
  });
  revalidateRetailStorefront(context.organizationSlug);
  return category;
}

export async function updateMerchantRetailCategory(context: TenantContext, categoryId: string, data: z.infer<typeof retailCategoryUpdateSchema>) {
  const category = await prisma.$transaction(async (tx) => {
    const existing = await tx.productCategory.findFirst({ where: { id: categoryId, organizationId: context.organizationId, deletedAt: null }, select: { id: true, name: true } });
    if (!existing) throw new ApiError(404, "Category not found.");
    const slug = data.slug || data.name ? await buildUniqueDetailSlug(data.slug || data.name || existing.name, async (candidate) => Boolean(await tx.productCategory.findFirst({ where: { organizationId: context.organizationId, deletedAt: null, id: { not: categoryId }, slug: candidate }, select: { id: true } }))) : undefined;
    return tx.productCategory.update({ where: { id: categoryId }, data: { ...data, ...(slug ? { slug } : {}) }, select: { id: true, name: true, slug: true, description: true, isActive: true, sortOrder: true } });
  });
  revalidateRetailStorefront(context.organizationSlug);
  return category;
}

export async function listMerchantRetailDefinitions(context: TenantContext) {
  return prisma.retailAttributeDefinition.findMany({
    where: { organizationId: context.organizationId, isActive: true },
    orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    select: { id: true, key: true, label: true, localizedLabels: true, scope: true, valueType: true, displayUnit: true, localizedUnits: true, allowedValues: true, isFilterable: true },
  });
}

export async function createMerchantRetailDefinition(context: TenantContext, data: z.infer<typeof retailDefinitionSchema>) {
  try {
    return await prisma.retailAttributeDefinition.create({ data: { ...data, organizationId: context.organizationId, sortOrder: 0 } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiError(409, "An attribute with this key already exists in this store.");
    throw error;
  }
}

export async function getMerchantRetailProduct(context: TenantContext, productId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, organizationId: context.organizationId, deletedAt: null }, select: merchantProductSelect });
  if (!product) throw new ApiError(404, "Product not found.");
  const result = serializeMerchantProduct(product);
  const ids = [...new Set(result.gallerySettings?.colors.flatMap(color => color.imageIds) ?? [])];
  const galleryMedia = ids.length ? await prisma.image.findMany({ where: { id: { in: ids }, organizationId: context.organizationId, access: "PUBLIC" }, select: { id: true, url: true, filename: true } }) : [];
  return { ...result, galleryMedia };
}

export async function createMerchantRetailProduct(context: TenantContext, actorUserId: string, data: z.infer<typeof retailProductCreateSchema>, transaction?: Prisma.TransactionClient) {
  try {
  const write = async (tx: Prisma.TransactionClient) => {
    const category = await requireOwnedCategory(tx, context.organizationId, data.categoryId);
    const images = await requireOwnedImages(tx, context.organizationId, data.imageIds);
    let categories: string[];
    try { categories = canonicalCategoryIds(category.id, data.categoryIds ?? []); }
    catch { throw new ApiError(400, "Invalid product categories."); }
    const validCategories = await tx.productCategory.count({ where: { id: { in: categories }, organizationId: context.organizationId, deletedAt: null, isActive: true } });
    if (validCategories !== categories.length) throw new ApiError(400, "Every selected category must belong to this active store.");
    const sourceSlug = data.slug || data.name;
    const slug = await buildUniqueDetailSlug(sourceSlug, async (candidate) => Boolean(await tx.product.findFirst({ where: { organizationId: context.organizationId, deletedAt: null, slug: candidate }, select: { id: true } })));
    const product = await tx.product.create({ data: {
      name: data.name,
      brand: data.brand ?? null,
      slug,
      description: data.description,
      basePrice: new Prisma.Decimal(data.basePrice),
      image: images[0]?.url ?? null,
      images: { connect: data.imageIds.map((id) => ({ id })) },
      isActive: false,
      trackInventory: data.trackInventory ?? true,
      lowStockThreshold: 0,
      discountType: "none",
      discountValue: 0,
      organizationId: context.organizationId,
      organizationSlug: context.organizationSlug,
      categoryId: category.id,
    }, select: { id: true } });
    await writeAssignments(tx, { organizationId: context.organizationId, productId: product.id, assignments: data.attributes, scope: RetailAttributeScope.PRODUCT });
    await replaceProductTaxonomy(tx, { organizationId: context.organizationId, productId: product.id, primaryCategoryId: category.id, categoryIds: categories, tagNames: data.tagNames });
    const galleryModes = new Map<string, "INHERIT" | "OVERRIDE">();
    const variantIds = await createVariants(tx, { organizationId: context.organizationId, productId: product.id, actorUserId, variants: data.variants.map((variant) => ({ ...variant, price: variant.price ?? null })) });
    data.variants.forEach((variant, index) => { if (variant.galleryMode) galleryModes.set(variantIds[index], variant.galleryMode); });
    if (data.gallerySettings) await saveGallerySettings(tx, context.organizationId, product.id, data.gallerySettings, galleryModes);
    await assertDistinctVariantCombinations(tx, product.id);
    return tx.product.findUniqueOrThrow({ where: { id: product.id }, select: merchantProductSelect });
  };
  const product = transaction ? await write(transaction) : await prisma.$transaction(write, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (!transaction) revalidateRetailStorefront(context.organizationSlug, product.id);
  return serializeMerchantProduct(product);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiError(409, "A SKU or product identifier is already in use.");
    throw error;
  }
}

export async function updateMerchantRetailProduct(context: TenantContext, actorUserId: string, productId: string, data: z.infer<typeof retailProductUpdateSchema>, transaction?: Prisma.TransactionClient) {
  try {
  const write = async (tx: Prisma.TransactionClient) => {
     const existing = await tx.product.findFirst({ where: { id: productId, organizationId: context.organizationId, deletedAt: null }, select: { id: true, name: true, isActive: true, categoryId: true, basePrice: true, gallerySettings: true } });
    if (!existing) throw new ApiError(404, "Product not found.");
    if (data.categoryId) await requireOwnedCategory(tx, context.organizationId, data.categoryId);
    const images = data.imageIds === undefined ? undefined : await requireOwnedImages(tx, context.organizationId, data.imageIds);
    if (data.attributes) {
      await tx.productAttributeValue.deleteMany({ where: { productId } });
      await writeAssignments(tx, { organizationId: context.organizationId, productId, assignments: data.attributes, scope: RetailAttributeScope.PRODUCT });
    }
    const galleryModes = new Map<string, "INHERIT" | "OVERRIDE">();
    if (data.variantUpdates) {
      const currentVariants = await tx.productVariant.findMany({ where: { id: { in: data.variantUpdates.map(v => v.id) }, productId, deletedAt: null }, select: { id: true, inventory: true, reservedQuantity: true } });
      const inventoryMovements: Prisma.InventoryMovementCreateManyInput[] = [];
      for (const update of data.variantUpdates) {
        const current = currentVariants.find(v => v.id === update.id);
        if (!current) throw new ApiError(400, "A variant does not belong to this product.");
        if (update.galleryMode || update.imageIds !== undefined) galleryModes.set(current.id, update.galleryMode ?? "OVERRIDE");
        if (update.inventory !== undefined && update.inventory < current.reservedQuantity) throw new ApiError(409, "Stock cannot be set below the quantity already reserved by customer carts or orders.");
        const changes = {
          ...(update.name === undefined ? {} : { name: update.name }),
          ...(update.sku === undefined ? {} : { sku: update.sku }),
          ...(update.price === undefined ? {} : { price: update.price === null ? null : new Prisma.Decimal(update.price) }),
          ...(update.inventory === undefined ? {} : { inventory: update.inventory }),
          ...(update.allowBackOrder === undefined ? {} : { allowBackOrder: update.allowBackOrder }),
          ...(update.manuallyUnavailable === undefined ? {} : { manuallyUnavailable: update.manuallyUnavailable }),
        };
        const next = await tx.productVariant.update({ where: { id: current.id }, data: { ...changes }, select: { id: true, inventory: true } });
        if (update.options !== undefined) {
          await tx.productVariantAttributeValue.deleteMany({ where: { variantId: current.id } });
          await writeAssignments(tx, { organizationId: context.organizationId, variantId: current.id, assignments: update.options, scope: RetailAttributeScope.VARIANT_OPTION });
        }
        if (update.imageIds !== undefined) await replaceVariantImages(tx, context.organizationId, current.id, update.imageIds);
        if (update.inventory !== undefined && update.inventory !== current.inventory) {
          inventoryMovements.push({
            variantId: next.id,
            quantityDelta: update.inventory - current.inventory,
            quantityBefore: current.inventory,
            quantityAfter: update.inventory,
            reason: "MANUAL_ADJUSTMENT",
            note: "Inventory adjusted by the organization in retail catalog management.",
            createdById: actorUserId,
          });
        }
      }
      if (inventoryMovements.length) await tx.inventoryMovement.createMany({ data: inventoryMovements });
    }
    if (data.newVariants) {
      const ids = await createVariants(tx, { organizationId: context.organizationId, productId, actorUserId, variants: data.newVariants });
      data.newVariants.forEach((variant, index) => galleryModes.set(ids[index], variant.galleryMode ?? "OVERRIDE"));
    }
    await assertDistinctVariantCombinations(tx, productId);
    const nextCategoryId = data.categoryId ?? existing.categoryId;
    const categoryIdsToSave = data.categoryIds ?? (data.categoryId ? (await tx.productCategoryAssignment.findMany({ where: { productId, organizationId: context.organizationId }, select: { categoryId: true } })).map((assignment) => assignment.categoryId) : undefined);
    if (data.categoryIds !== undefined || data.categoryId !== undefined || data.tagNames !== undefined) {
      await replaceProductTaxonomy(tx, { organizationId: context.organizationId, productId, primaryCategoryId: nextCategoryId, ...(categoryIdsToSave === undefined ? {} : { categoryIds: categoryIdsToSave }), ...(data.tagNames === undefined ? {} : { tagNames: data.tagNames }) });
    }
     const variants = await tx.productVariant.findMany({ where: { productId, deletedAt: null }, select: { price: true, sku: true } });
     const basePrice = new Prisma.Decimal(data.basePrice ?? existing.basePrice ?? 0);
     const shouldBePublished = data.isActive ?? existing.isActive;
     // Legacy published products may have no structured inventory yet. Keep
     // metadata editable, but require complete inventory for an explicit publish.
     if (shouldBePublished && (data.isActive === true || variants.length > 0)) {
       if (!images && (await tx.product.count({ where: { id: productId, images: { some: { organizationId: context.organizationId, access: "PUBLIC" } } } })) === 0) throw new ApiError(400, "Add at least one public image owned by this store before publishing.");
       if (images && images.length === 0) throw new ApiError(400, "Add at least one public image owned by this store before publishing.");
       if (variants.length === 0 || variants.some((variant) => (variant.price ?? basePrice).lessThanOrEqualTo(0))) throw new ApiError(400, "Every published product needs at least one variant with a price greater than zero.");
       if (variants.some((variant) => !variant.sku?.trim())) throw new ApiError(400, "Every published variant needs a SKU.");
       await requireOwnedCategory(tx, context.organizationId, nextCategoryId);
     }
    await tx.product.update({ where: { id: productId }, data: {
      ...(data.name === undefined ? {} : { name: data.name }),
      ...(data.brand === undefined ? {} : { brand: data.brand }),
      ...(data.slug === undefined ? {} : { slug: await buildUniqueDetailSlug(data.slug || data.name || existing.name, async (candidate) => Boolean(await tx.product.findFirst({ where: { organizationId: context.organizationId, deletedAt: null, id: { not: productId }, slug: candidate }, select: { id: true } }))) }),
      ...(data.description === undefined ? {} : { description: data.description }),
      ...(data.categoryId === undefined ? {} : { categoryId: data.categoryId }),
      ...(images === undefined ? {} : { image: images[0]?.url ?? null, images: { set: data.imageIds?.map((id) => ({ id })) ?? [] } }),
      ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
      ...(data.trackInventory === undefined ? {} : { trackInventory: data.trackInventory }),
      ...(data.basePrice !== undefined ? { basePrice: new Prisma.Decimal(data.basePrice) } : {}),
    }, select: merchantProductSelect });
    if (data.gallerySettings) await saveGallerySettings(tx, context.organizationId, productId, data.gallerySettings, galleryModes);
    else if (galleryModes.size) {
      const previous = readGallerySettings(existing.gallerySettings);
      // Older clients can still edit individual galleries without sending new
      // metadata. Preserve those explicit choices on the next editor reload.
      if (previous) {
        if ([...galleryModes.values()].includes("INHERIT")) throw new ApiError(400, "Color inheritance requires gallery settings.");
        await tx.product.update({ where: { id: productId }, data: { gallerySettings: {
          ...previous, overrides: [...new Set([...previous.overrides, ...galleryModes.keys()])],
        } } });
      }
    }
    return tx.product.findUniqueOrThrow({ where: { id: productId }, select: merchantProductSelect });
  };
  const product = transaction ? await write(transaction) : await prisma.$transaction(write, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (!transaction) revalidateRetailStorefront(context.organizationSlug, product.id);
  return serializeMerchantProduct(product);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiError(409, "A SKU or product identifier is already in use.");
    throw error;
  }
}

export const variantGenerationSchema = z.object({
  colorDefinitionId: z.string().min(1).max(64).optional(),
  sizeDefinitionId: z.string().min(1).max(64).optional(),
  sizeMode: z.enum(["RANGE", "STANDARD"]).optional(),
  sizeStart: z.number().int().min(1).max(999).optional(),
  sizeEnd: z.number().int().min(1).max(999).optional(),
  sizeStep: z.number().refine(
    (v) => [0.5, 1, 2, 3].includes(v),
    { message: "sizeStep must be one of 0.5, 1, 2, or 3." },
  ).refine(
    (v) => Number.isInteger(v * 2),
    { message: "sizeStep must be a multiple of 0.5." },
  ).optional(),
  standardSizes: z.array(z.string().trim().min(1).max(50)).max(50).optional(),
  colorValues: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  inventory: z.number().int().min(0).max(1_000_000_000).optional(),
  allowBackOrder: z.boolean().optional(),
  price: priceSchema.nullable().optional(),
}).strict().superRefine((input, ctx) => {
  if (input.sizeMode === "RANGE" && (!input.sizeDefinitionId || input.sizeStart === undefined || input.sizeEnd === undefined)) {
    ctx.addIssue({ code: "custom", path: ["sizeDefinitionId", "sizeStart", "sizeEnd"], message: "sizeDefinitionId, sizeStart, and sizeEnd are required for RANGE size mode." });
  }
  if (input.sizeMode === "RANGE" && input.sizeStart !== undefined && input.sizeEnd !== undefined && input.sizeStart > input.sizeEnd) {
    ctx.addIssue({ code: "custom", path: ["sizeStart"], message: "Start size must not exceed end size." });
  }
  if (input.sizeMode === "STANDARD" && (!input.sizeDefinitionId || !input.standardSizes?.length)) {
    ctx.addIssue({ code: "custom", path: ["sizeDefinitionId", "standardSizes"], message: "sizeDefinitionId and standardSizes are required for STANDARD size mode." });
  }
  if (input.sizeDefinitionId && !input.sizeMode) {
    ctx.addIssue({ code: "custom", path: ["sizeMode"], message: "sizeMode is required when sizeDefinitionId is provided." });
  }
});

function generateSizeRange(start: number, end: number, step: number): number[] {
  const result: number[] = [];
  if (step <= 0) throw new Error("Step must be greater than zero.");
  const count = Math.floor((end - start) / step) + 1;
  if (count < 1) return result;
  if (count > 500) throw new Error("Size range exceeds the maximum of 500 values.");
  for (let i = 0; i < count; i++) {
    result.push(Number((start + i * step).toFixed(2)));
  }
  return result;
}

function formatOptionValue(definitionId: string, valueType: string, value: string | number | boolean): { definitionId: string; value: string | number | boolean } {
  let typed: string | number | boolean;
  if (valueType === "NUMBER") {
    typed = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(typed)) throw new Error(`Numeric value for definition ${definitionId} is invalid.`);
  } else if (valueType === "BOOLEAN") {
    typed = typeof value === "boolean" ? value : value === "true";
  } else {
    typed = String(value);
  }
  return { definitionId, value: typed };
}

function buildVariantName(variant: { options: Array<{ key: string; label: string; value: string | number | boolean }> }): string | null {
  const parts = variant.options.map((opt) => opt.value !== null && opt.value !== undefined ? String(opt.value) : opt.label).filter(Boolean);
  return parts.length ? parts.join(" / ") : null;
}

export async function previewRetailVariantGeneration(
  context: TenantContext,
  productId: string,
  input: z.infer<typeof variantGenerationSchema>,
): Promise<{ canCreate: Array<{ name: string | null; sku: string | null; price: number | null; options: Array<{ definitionId: string; key: string; label: string; value: string | number | boolean }> }>; existing: number; toAdd: number; errors: string[] }> {
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId: context.organizationId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!product) throw new ApiError(404, "Product not found.");

  const errors: string[] = [];

  const colorDef = input.colorDefinitionId
    ? await prisma.retailAttributeDefinition.findFirst({
        where: { id: input.colorDefinitionId, organizationId: context.organizationId, isActive: true, scope: RetailAttributeScope.VARIANT_OPTION },
        select: { id: true, key: true, label: true, valueType: true, allowedValues: true },
      })
    : null;
  if (!colorDef && input.colorDefinitionId) errors.push("Color attribute not found or belongs to another store.");

  const sizeDef = input.sizeDefinitionId
    ? await prisma.retailAttributeDefinition.findFirst({
        where: { id: input.sizeDefinitionId, organizationId: context.organizationId, isActive: true, scope: RetailAttributeScope.VARIANT_OPTION },
        select: { id: true, key: true, label: true, valueType: true, allowedValues: true },
      })
    : null;
  if (!sizeDef && input.sizeDefinitionId) errors.push("Size attribute not found or belongs to another store.");

  let sizes: (string | number | boolean)[] = [];
  if (input.sizeMode === "RANGE" && sizeDef && input.sizeStart !== undefined && input.sizeEnd !== undefined) {
    const step = input.sizeStep ?? 1;
    try {
      sizes = generateSizeRange(input.sizeStart, input.sizeEnd, step);
    } catch (e) {
      errors.push((e as Error).message);
    }
  } else if (input.sizeMode === "STANDARD" && sizeDef && input.standardSizes?.length) {
    sizes = input.standardSizes;
  }

  let colors: (string | number | boolean)[] = [];
  if (input.colorValues?.length && colorDef) {
    colors = input.colorValues;
  }

  const existingVariants = await prisma.productVariant.findMany({
    where: { productId, deletedAt: null },
    select: {
       id: true, optionValues: { select: { definitionId: true, valueText: true, valueNumber: true, valueBoolean: true } },
    },
  });

  const existingVariantCombos = new Set<string>();
  for (const v of existingVariants) {
    const combo = v.optionValues.map((opt) => {
      const val = opt.valueText ?? (opt.valueNumber ? Number(opt.valueNumber.toString()) : opt.valueBoolean);
      return `${opt.definitionId}:${String(val)}`;
    }).sort().join("|");
    existingVariantCombos.add(combo);
  }

  const canCreate: Array<{ name: string | null; sku: string | null; price: number | null; options: Array<{ definitionId: string; key: string; label: string; value: string | number | boolean }> }> = [];
  const newCombos = new Set<string>();

  function processOptions(options: Array<{ definitionId: string; key: string; label: string; value: string | number | boolean }>): void {
    const comboKey = options.map((o) => `${o.definitionId}:${String(o.value)}`).sort().join("|");
    if (existingVariantCombos.has(comboKey) || newCombos.has(comboKey)) return;
    newCombos.add(comboKey);
    canCreate.push({
      name: buildVariantName({ options: options.map((o) => ({ key: o.key, label: o.label, value: o.value })) }),
      sku: null,
      price: input.price ?? null,
      options: options.map((o) => ({ definitionId: o.definitionId, key: o.key, label: o.label, value: o.value })),
    });
  }

  if (colorDef && sizeDef && colors.length && sizes.length) {
    for (const color of colors) {
      for (const size of sizes) {
        const colorOption = formatOptionValue(colorDef.id, colorDef.valueType, color);
        const sizeOption = formatOptionValue(sizeDef.id, sizeDef.valueType, size);
        processOptions([
          { definitionId: colorDef.id, key: colorDef.key, label: colorDef.label, value: colorOption.value },
          { definitionId: sizeDef.id, key: sizeDef.key, label: sizeDef.label, value: sizeOption.value },
        ]);
      }
    }
  } else if (sizeDef && sizes.length) {
    for (const size of sizes) {
      const sizeOption = formatOptionValue(sizeDef.id, sizeDef.valueType, size);
      processOptions([{ definitionId: sizeDef.id, key: sizeDef.key, label: sizeDef.label, value: sizeOption.value }]);
    }
  } else if (colorDef && colors.length) {
    for (const color of colors) {
      const colorOption = formatOptionValue(colorDef.id, colorDef.valueType, color);
      processOptions([{ definitionId: colorDef.id, key: colorDef.key, label: colorDef.label, value: colorOption.value }]);
    }
  } else {
    errors.push("Either a size or color definition must be provided.");
  }

  return {
    canCreate,
    existing: existingVariants.length,
    toAdd: canCreate.length,
    errors,
  };
}

export async function generateRetailVariants(
  context: TenantContext,
  actorUserId: string,
  productId: string,
  input: z.infer<typeof variantGenerationSchema>,
  transaction?: Prisma.TransactionClient,
): Promise<{ added: number; skipped: number }> {
  const preview = await previewRetailVariantGeneration(context, productId, input);
  if (preview.errors.length) throw new ApiError(400, preview.errors.join(" "));

  const write = async (tx: Prisma.TransactionClient) => {
    if (!preview.canCreate.length) {
      return { added: 0, skipped: preview.existing };
    }

    const product = await tx.product.findFirst({
      where: { id: productId, organizationId: context.organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new ApiError(404, "Product not found.");

    const existingSkus = await tx.productVariant.findMany({
      where: { sku: { not: null } },
      select: { sku: true },
    });
    const existingSkuSet = new Set(existingSkus.map((v) => v.sku!.toLowerCase()));

    const variantsToCreate: Array<z.infer<typeof variantCreateSchema>> = [];
    for (const item of preview.canCreate) {
      const variantName = item.name ?? "Unknown";
      const baseSku = `${product.id.slice(-6)}-${variantName.replace(/\s+/g, "").toLowerCase()}`;
      let finalSku = baseSku;
      let suffix = 1;
      while (existingSkuSet.has(finalSku.toLowerCase())) {
        finalSku = `${baseSku}-${suffix}`;
        suffix++;
      }
      variantsToCreate.push({
        name: variantName,
        sku: finalSku,
        price: item.price ?? null,
        inventory: input.inventory ?? 0,
        allowBackOrder: input.allowBackOrder ?? false,
        manuallyUnavailable: false,
        options: item.options,
        imageIds: [],
      });
      existingSkuSet.add(finalSku.toLowerCase());
    }

    await createVariants(tx, { organizationId: context.organizationId, productId: product.id, actorUserId, variants: variantsToCreate });
    await assertDistinctVariantCombinations(tx, product.id);
    return { added: variantsToCreate.length, skipped: preview.existing };
  };

  const result = transaction
    ? await write(transaction)
    : await prisma.$transaction(write, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (!transaction) revalidateRetailStorefront(context.organizationSlug, productId);
  return result;
}
