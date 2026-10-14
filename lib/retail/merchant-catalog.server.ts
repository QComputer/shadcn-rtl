import "server-only";

import { Prisma, RetailAttributeScope, RetailAttributeValueType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { buildUniqueDetailSlug } from "@/lib/detail-slugs";
import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import type { TenantContext } from "@/lib/tenant-context";
import { retailAttributeDefinitionInputSchema, validateRetailAttributeValue } from "@/lib/retail/attribute-validation";
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
});

const variantUpdateSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(200).optional(),
  sku: z.string().trim().max(100).nullable().optional(),
  price: priceSchema.optional(),
  inventory: z.number().int().min(0).max(1_000_000_000).optional(),
  allowBackOrder: z.boolean().optional(),
}).strict();

export const retailProductUpdateSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  slug: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  categoryId: z.string().min(1).max(64).optional(),
  imageIds: z.array(z.string().min(1).max(64)).max(20).optional(),
  attributes: z.array(assignmentSchema).max(80).optional(),
  newVariants: z.array(variantCreateSchema).max(100).optional(),
  variantUpdates: z.array(variantUpdateSchema).max(100).optional(),
  isActive: z.boolean().optional(),
}).strict().superRefine((input, context) => {
  if (input.imageIds && new Set(input.imageIds).size !== input.imageIds.length) context.addIssue({ code: "custom", path: ["imageIds"], message: "Duplicate product images are not allowed." });
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
  id: true, name: true, slug: true, description: true, basePrice: true, image: true, isActive: true, organizationId: true,
  categoryId: true, createdAt: true, updatedAt: true,
  category: { select: { id: true, name: true, slug: true, isActive: true } },
  images: { select: { id: true, url: true, access: true, organizationId: true }, orderBy: { createdAt: "asc" } },
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
    slug: product.slug,
    description: product.description,
    basePrice: Number(product.basePrice.toString()),
    isActive: product.isActive,
    category: product.category,
    images: product.images.filter((image) => image.access === "PUBLIC" && image.organizationId === product.organizationId).map((image) => ({ id: image.id, url: image.url })),
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
}

function revalidateRetailStorefront(organizationSlug: string, productId?: string) {
  for (const locale of ["fa", "en", "ar"] as const) {
    const root = `/${locale}/retail/${organizationSlug}`;
    revalidatePath(root);
    if (productId) revalidatePath(`${root}/product/${productId}`);
  }
}

export async function listMerchantRetailProducts(input: {
  context: TenantContext; page: number; pageSize: number; query?: string; state?: "all" | "published" | "draft";
}) {
  const where: Prisma.ProductWhereInput = {
    organizationId: input.context.organizationId,
    deletedAt: null,
    ...(input.state === "published" ? { isActive: true } : input.state === "draft" ? { isActive: false } : {}),
    ...(input.query ? { OR: [{ name: { contains: input.query, mode: "insensitive" } }, { slug: { contains: input.query, mode: "insensitive" } }] } : {}),
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
  const product = await prisma.$transaction(async (tx) => {
    const category = await requireOwnedCategory(tx, context.organizationId, data.categoryId);
    const images = await requireOwnedImages(tx, context.organizationId, data.imageIds);
    const sourceSlug = data.slug || data.name;
    const slug = await buildUniqueDetailSlug(sourceSlug, async (candidate) => Boolean(await tx.product.findFirst({ where: { organizationId: context.organizationId, deletedAt: null, slug: candidate }, select: { id: true } })));
    const product = await tx.product.create({ data: {
      name: data.name,
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
    for (const variant of data.variants) await createVariant(tx, { organizationId: context.organizationId, productId: product.id, actorUserId, variant });
    return tx.product.findUniqueOrThrow({ where: { id: product.id }, select: merchantProductSelect });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  revalidateRetailStorefront(context.organizationSlug, product.id);
  return serializeMerchantProduct(product);
}

export async function updateMerchantRetailProduct(context: TenantContext, actorUserId: string, productId: string, data: z.infer<typeof retailProductUpdateSchema>) {
  const product = await prisma.$transaction(async (tx) => {
    const existing = await tx.product.findFirst({ where: { id: productId, organizationId: context.organizationId, deletedAt: null }, select: { id: true, name: true } });
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
    const variants = await tx.productVariant.findMany({ where: { productId, deletedAt: null }, select: { price: true } });
    if (data.isActive === true) {
      if (!images && (await tx.product.count({ where: { id: productId, images: { some: { organizationId: context.organizationId, access: "PUBLIC" } } } })) === 0) throw new ApiError(400, "Add at least one public image owned by this store before publishing.");
      if (images && images.length === 0) throw new ApiError(400, "Add at least one public image owned by this store before publishing.");
      if (variants.length === 0 || variants.some((variant) => variant.price === null || variant.price.lessThanOrEqualTo(0))) throw new ApiError(400, "Every published product needs at least one variant with a price greater than zero.");
    }
    const minimumPrice = variants.reduce<Prisma.Decimal | null>((lowest, variant) => variant.price && (!lowest || variant.price.lessThan(lowest) ? variant.price : lowest), null);
    if (!minimumPrice) throw new ApiError(400, "A product must keep at least one priced variant.");
    const updated = await tx.product.update({ where: { id: productId }, data: {
      ...(data.name === undefined ? {} : { name: data.name }),
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
}
