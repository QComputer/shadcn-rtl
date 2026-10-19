import "server-only";

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
  price: priceSchema,
  inventory: z.number().int().min(0).max(1_000_000_000),
  allowBackOrder: z.boolean().default(false),
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
  categoryId: z.string().min(1).max(64),
  brand: z.string().trim().max(120).nullable().optional(),
  categoryIds: z.array(z.string().trim().min(1).max(64)).max(MAX_PRODUCT_CATEGORIES).optional(),
  tagNames: z.array(z.string().max(MAX_TAG_NAME_LENGTH * 3)).max(MAX_PRODUCT_TAGS).optional(),
  imageIds: z.array(z.string().min(1).max(64)).max(20).default([]),
  attributes: z.array(assignmentSchema).max(80).default([]),
  variants: z.array(variantCreateSchema).min(1).max(100),
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
  price: priceSchema.optional(),
  inventory: z.number().int().min(0).max(1_000_000_000).optional(),
  allowBackOrder: z.boolean().optional(),
  options: z.array(assignmentSchema).max(40).optional(),
  imageIds: z.array(z.string().min(1).max(64)).max(20).optional(),
}).strict().superRefine((variant, context) => {
  if (variant.options && new Set(variant.options.map((option) => option.definitionId)).size !== variant.options.length) context.addIssue({ code: "custom", path: ["options"], message: "Each variant option can be set only once." });
});

export const retailProductUpdateSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  slug: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  categoryId: z.string().min(1).max(64).optional(),
  brand: z.string().trim().max(120).nullable().optional(),
  categoryIds: z.array(z.string().trim().min(1).max(64)).max(MAX_PRODUCT_CATEGORIES).optional(),
  tagNames: z.array(z.string().max(MAX_TAG_NAME_LENGTH * 3)).max(MAX_PRODUCT_TAGS).optional(),
  imageIds: z.array(z.string().min(1).max(64)).max(20).optional(),
  attributes: z.array(assignmentSchema).max(80).optional(),
  newVariants: z.array(variantCreateSchema).max(100).optional(),
  variantUpdates: z.array(variantUpdateSchema).max(100).optional(),
  isActive: z.boolean().optional(),
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

const merchantProductSelect = {
  id: true, name: true, brand: true, slug: true, description: true, basePrice: true, image: true, isActive: true, organizationId: true,
  categoryId: true, createdAt: true, updatedAt: true,
  category: { select: { id: true, name: true, slug: true, isActive: true } },
  images: { select: { id: true, url: true, access: true, organizationId: true }, orderBy: { createdAt: "asc" } },
  categoryAssignments: { where: { category: { deletedAt: null, isActive: true } }, select: { categoryId: true } },
  tagAssignments: { select: { tag: { select: { id: true, name: true } } }, orderBy: { tagId: "asc" } },
  attributeValues: { select: {
    id: true, definitionId: true, valueText: true, valueNumber: true, valueBoolean: true,
    definition: { select: { organizationId: true, key: true, label: true, localizedLabels: true, scope: true, valueType: true, displayUnit: true, localizedUnits: true, allowedValues: true, isFilterable: true, isActive: true } },
  } },
  variants: { where: { deletedAt: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: {
    id: true, name: true, sku: true, price: true, inventory: true, reservedQuantity: true, allowBackOrder: true,
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

function serializeMerchantProduct(product: MerchantProduct) {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    slug: product.slug,
    description: product.description,
    basePrice: Number(product.basePrice.toString()),
    isActive: product.isActive,
    category: product.category,
    images: product.images.filter((image) => image.access === "PUBLIC" && image.organizationId === product.organizationId).map((image) => ({ id: image.id, url: image.url })),
    imageIds: product.images.filter((image) => image.access === "PUBLIC" && image.organizationId === product.organizationId).map((image) => image.id),
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
      reservedQuantity: variant.reservedQuantity,
      availableQuantity: Math.max(0, variant.inventory - variant.reservedQuantity),
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

async function createVariant(tx: Prisma.TransactionClient, input: {
  organizationId: string; productId: string; actorUserId: string; variant: z.infer<typeof variantCreateSchema>;
}) {
  const variant = await tx.productVariant.create({
    data: {
      productId: input.productId,
      name: input.variant.name,
      sku: input.variant.sku || null,
      price: new Prisma.Decimal(input.variant.price),
      inventory: input.variant.inventory,
      allowBackOrder: input.variant.allowBackOrder,
    },
    select: { id: true },
  });
  if (input.variant.inventory > 0) {
    await tx.inventoryMovement.create({ data: {
      variantId: variant.id,
      quantityDelta: input.variant.inventory,
      quantityBefore: 0,
      quantityAfter: input.variant.inventory,
      reason: "INITIAL_STOCK",
      note: "Initial stock entered by the organization in retail catalog management.",
      createdById: input.actorUserId,
    } });
  }
  await writeAssignments(tx, {
    organizationId: input.organizationId,
    variantId: variant.id,
    assignments: input.variant.options,
    scope: RetailAttributeScope.VARIANT_OPTION,
  });
  await replaceVariantImages(tx, input.organizationId, variant.id, input.variant.imageIds);
  return variant.id;
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
  return serializeMerchantProduct(product);
}

export async function createMerchantRetailProduct(context: TenantContext, actorUserId: string, data: z.infer<typeof retailProductCreateSchema>) {
  try {
  const product = await prisma.$transaction(async (tx) => {
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
      basePrice: new Prisma.Decimal(Math.min(...data.variants.map((variant) => variant.price))),
      image: images[0]?.url ?? null,
      images: { connect: data.imageIds.map((id) => ({ id })) },
      isActive: false,
      trackInventory: true,
      lowStockThreshold: 0,
      discountType: "none",
      discountValue: 0,
      organizationId: context.organizationId,
      organizationSlug: context.organizationSlug,
      categoryId: category.id,
    }, select: { id: true } });
    await writeAssignments(tx, { organizationId: context.organizationId, productId: product.id, assignments: data.attributes, scope: RetailAttributeScope.PRODUCT });
    await replaceProductTaxonomy(tx, { organizationId: context.organizationId, productId: product.id, primaryCategoryId: category.id, categoryIds: categories, tagNames: data.tagNames });
    for (const variant of data.variants) await createVariant(tx, { organizationId: context.organizationId, productId: product.id, actorUserId, variant });
    await assertDistinctVariantCombinations(tx, product.id);
    return tx.product.findUniqueOrThrow({ where: { id: product.id }, select: merchantProductSelect });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  revalidateRetailStorefront(context.organizationSlug, product.id);
  return serializeMerchantProduct(product);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiError(409, "A SKU or product identifier is already in use.");
    throw error;
  }
}

export async function updateMerchantRetailProduct(context: TenantContext, actorUserId: string, productId: string, data: z.infer<typeof retailProductUpdateSchema>) {
  try {
  const product = await prisma.$transaction(async (tx) => {
    const existing = await tx.product.findFirst({ where: { id: productId, organizationId: context.organizationId, deletedAt: null }, select: { id: true, name: true, isActive: true, categoryId: true } });
    if (!existing) throw new ApiError(404, "Product not found.");
    if (data.categoryId) await requireOwnedCategory(tx, context.organizationId, data.categoryId);
    const images = data.imageIds === undefined ? undefined : await requireOwnedImages(tx, context.organizationId, data.imageIds);
    if (data.attributes) {
      await tx.productAttributeValue.deleteMany({ where: { productId } });
      await writeAssignments(tx, { organizationId: context.organizationId, productId, assignments: data.attributes, scope: RetailAttributeScope.PRODUCT });
    }
    if (data.variantUpdates) {
      for (const update of data.variantUpdates) {
        const current = await tx.productVariant.findFirst({ where: { id: update.id, productId, deletedAt: null }, select: { id: true, inventory: true, reservedQuantity: true } });
        if (!current) throw new ApiError(400, "A variant does not belong to this product.");
        if (update.inventory !== undefined && update.inventory < current.reservedQuantity) throw new ApiError(409, "Stock cannot be set below the quantity already reserved by customer carts or orders.");
        const changes = {
          ...(update.name === undefined ? {} : { name: update.name }),
          ...(update.sku === undefined ? {} : { sku: update.sku }),
          ...(update.price === undefined ? {} : { price: update.price }),
          ...(update.inventory === undefined ? {} : { inventory: update.inventory }),
          ...(update.allowBackOrder === undefined ? {} : { allowBackOrder: update.allowBackOrder }),
        };
        const next = await tx.productVariant.update({ where: { id: current.id }, data: { ...changes, ...(changes.price === undefined ? {} : { price: new Prisma.Decimal(changes.price) }) }, select: { id: true, inventory: true } });
        if (update.options !== undefined) {
          await tx.productVariantAttributeValue.deleteMany({ where: { variantId: current.id } });
          await writeAssignments(tx, { organizationId: context.organizationId, variantId: current.id, assignments: update.options, scope: RetailAttributeScope.VARIANT_OPTION });
        }
        if (update.imageIds !== undefined) await replaceVariantImages(tx, context.organizationId, current.id, update.imageIds);
        if (update.inventory !== undefined && update.inventory !== current.inventory) {
          await tx.inventoryMovement.create({ data: {
            variantId: next.id,
            quantityDelta: update.inventory - current.inventory,
            quantityBefore: current.inventory,
            quantityAfter: update.inventory,
            reason: "MANUAL_ADJUSTMENT",
            note: "Inventory adjusted by the organization in retail catalog management.",
            createdById: actorUserId,
          } });
        }
      }
    }
    if (data.newVariants) {
      for (const variant of data.newVariants) await createVariant(tx, { organizationId: context.organizationId, productId, actorUserId, variant });
    }
    await assertDistinctVariantCombinations(tx, productId);
    const nextCategoryId = data.categoryId ?? existing.categoryId;
    const categoryIdsToSave = data.categoryIds ?? (data.categoryId ? (await tx.productCategoryAssignment.findMany({ where: { productId, organizationId: context.organizationId }, select: { categoryId: true } })).map((assignment) => assignment.categoryId) : undefined);
    if (data.categoryIds !== undefined || data.categoryId !== undefined || data.tagNames !== undefined) {
      await replaceProductTaxonomy(tx, { organizationId: context.organizationId, productId, primaryCategoryId: nextCategoryId, ...(categoryIdsToSave === undefined ? {} : { categoryIds: categoryIdsToSave }), ...(data.tagNames === undefined ? {} : { tagNames: data.tagNames }) });
    }
    const variants = await tx.productVariant.findMany({ where: { productId, deletedAt: null }, select: { price: true, sku: true } });
    const shouldBePublished = data.isActive ?? existing.isActive;
    if (shouldBePublished) {
      if (!images && (await tx.product.count({ where: { id: productId, images: { some: { organizationId: context.organizationId, access: "PUBLIC" } } } })) === 0) throw new ApiError(400, "Add at least one public image owned by this store before publishing.");
      if (images && images.length === 0) throw new ApiError(400, "Add at least one public image owned by this store before publishing.");
      if (variants.length === 0 || variants.some((variant) => variant.price === null || variant.price.lessThanOrEqualTo(0))) throw new ApiError(400, "Every published product needs at least one variant with a price greater than zero.");
      if (variants.some((variant) => !variant.sku?.trim())) throw new ApiError(400, "Every published variant needs a SKU.");
      await requireOwnedCategory(tx, context.organizationId, nextCategoryId);
    }
    const minimumPrice = variants.reduce<Prisma.Decimal | null>((lowest, variant) => variant.price && (!lowest || variant.price.lessThan(lowest) ? variant.price : lowest), null);
    if (!minimumPrice) throw new ApiError(400, "A product must keep at least one priced variant.");
    const updated = await tx.product.update({ where: { id: productId }, data: {
      ...(data.name === undefined ? {} : { name: data.name }),
      ...(data.brand === undefined ? {} : { brand: data.brand }),
      ...(data.slug === undefined ? {} : { slug: await buildUniqueDetailSlug(data.slug || data.name || existing.name, async (candidate) => Boolean(await tx.product.findFirst({ where: { organizationId: context.organizationId, deletedAt: null, id: { not: productId }, slug: candidate }, select: { id: true } }))) }),
      ...(data.description === undefined ? {} : { description: data.description }),
      ...(data.categoryId === undefined ? {} : { categoryId: data.categoryId }),
      ...(images === undefined ? {} : { image: images[0]?.url ?? null, images: { set: data.imageIds?.map((id) => ({ id })) ?? [] } }),
      ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
      basePrice: minimumPrice,
    }, select: merchantProductSelect });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  revalidateRetailStorefront(context.organizationSlug, product.id);
  return serializeMerchantProduct(product);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiError(409, "A SKU or product identifier is already in use.");
    throw error;
  }
}
