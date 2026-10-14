import "server-only";

import { Prisma } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import { buildOrganizationPublicPath } from "@/lib/custom-domain-routing";
import { supportedLocales } from "@/lib/i18n";
import {
  canonicalCategoryIds,
  canonicalTagNames,
  MAX_PRODUCT_CATEGORIES,
  MAX_PRODUCT_TAGS,
  MAX_TAG_NAME_LENGTH,
} from "@/lib/retail/product-taxonomy-utils";

/** New optional endpoint; legacy create/edit contracts remain unchanged. */
export const productTaxonomyPatchSchema = z.object({
  categoryIds: z.array(z.string().trim().min(1).max(64)).max(MAX_PRODUCT_CATEGORIES).optional(),
  tagNames: z.array(z.string().max(MAX_TAG_NAME_LENGTH * 3)).max(MAX_PRODUCT_TAGS).optional(),
}).strict().refine(value => value.categoryIds !== undefined || value.tagNames !== undefined, {
  message: "Provide categories or tags",
});

export type ProductTaxonomyPatch = z.infer<typeof productTaxonomyPatchSchema>;

async function withSerializableRetry<T>(operation: () => Promise<T>, maxAttempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try { return await operation(); }
    catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (code !== "P2034" || attempt >= maxAttempts) throw error;
    }
  }
}

async function productIdentity(productId: string, organizationId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId, deletedAt: null },
    select: { id: true, categoryId: true, organizationId: true, organizationSlug: true, slug: true },
  });
  if (!product) throw new ApiError(404, "Product not found");
  return product;
}

export async function readProductTaxonomy(productId: string, organizationId: string) {
  const product = await productIdentity(productId, organizationId);
  const [categories, tags] = await Promise.all([
    prisma.productCategoryAssignment.findMany({
      where: { productId, organizationId, category: { deletedAt: null, isActive: true } },
      select: { categoryId: true },
      orderBy: { categoryId: "asc" },
    }),
    prisma.productTagAssignment.findMany({
      where: { productId, organizationId },
      select: { tag: { select: { id: true, name: true } } },
      orderBy: { tagId: "asc" },
    }),
  ]);
  // Union with the authoritative legacy primary category; handles old writers.
  return {
    productId,
    primaryCategoryId: product.categoryId,
    categoryIds: canonicalCategoryIds(product.categoryId, categories.map(c => c.categoryId)),
    tags: tags.map(t => t.tag),
  };
}

/**
 * Atomic replace for supplied dimensions; omitted dimension is unchanged.
 * DB composite FKs additionally prohibit any cross-organization assignment.
 */
export async function replaceProductTaxonomy(
  productId: string, organizationId: string, input: ProductTaxonomyPatch,
) {
  const categories = input.categoryIds;
  let tags: ReturnType<typeof canonicalTagNames> | undefined;
  try { tags = input.tagNames === undefined ? undefined : canonicalTagNames(input.tagNames); }
  catch { throw new ApiError(400, "Invalid product tags"); }

  const product = await withSerializableRetry(() => prisma.$transaction(async tx => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Product"
      WHERE "id" = ${productId} AND "organizationId" = ${organizationId} AND "deletedAt" IS NULL
      FOR UPDATE`;
    if (locked.length !== 1) throw new ApiError(404, "Product not found");

    // Re-read after lock, so a concurrent primary-category edit is respected.
    const current = await tx.product.findFirstOrThrow({
      where: { id: productId, organizationId, deletedAt: null },
      select: { id: true, categoryId: true, organizationSlug: true, slug: true },
    });

    if (categories !== undefined) {
      let requested: string[];
      try { requested = canonicalCategoryIds(current.categoryId, categories); }
      catch { throw new ApiError(400, "Invalid product categories"); }
      const validCount = await tx.productCategory.count({
        where: { id: { in: requested }, organizationId, deletedAt: null, isActive: true },
      });
      if (validCount !== requested.length) {
        throw new ApiError(400, "Every selected category must belong to this active organization");
      }
      await tx.productCategoryAssignment.deleteMany({
        where: { productId, organizationId, categoryId: { notIn: requested } },
      });
      await tx.productCategoryAssignment.createMany({
        data: requested.map(categoryId => ({ productId, categoryId, organizationId })),
        skipDuplicates: true,
      });
    }

    if (tags !== undefined) {
      const tagIds: string[] = [];
      for (const tag of tags) {
        const saved = await tx.productTag.upsert({
          where: { organizationId_normalizedName: { organizationId, normalizedName: tag.normalizedName } },
          update: {},
          create: { organizationId, name: tag.name, normalizedName: tag.normalizedName },
          select: { id: true },
        });
        tagIds.push(saved.id);
      }
      await tx.productTagAssignment.deleteMany({
        where: { productId, organizationId, tagId: { notIn: tagIds } },
      });
      if (tagIds.length) {
        await tx.productTagAssignment.createMany({
          data: tagIds.map(tagId => ({ productId, tagId, organizationId })),
          skipDuplicates: true,
        });
      }
    }
    return current;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

  revalidatePath("/dashboard/products");
  for (const locale of supportedLocales) {
    revalidatePath(buildOrganizationPublicPath({ locale, organizationSlug: product.organizationSlug, surface: "shop" }));
    revalidatePath(buildOrganizationPublicPath({ locale, organizationSlug: product.organizationSlug, surface: "shop", subPath: `/product/${product.slug ?? product.id}` }));
  }
  revalidateTag("home-page", "max");
  return readProductTaxonomy(productId, organizationId);
}
