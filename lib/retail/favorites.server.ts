import "server-only";

import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db";

export const RETAIL_FAVORITES_MAX = 200;

type FavoriteRow = { productId: string };
type FavoriteWhere = Record<string, unknown>;
type FavoriteClient = {
  productFavorite: {
    findMany(args: { where: FavoriteWhere; orderBy: { createdAt: "asc" }; take: number; select: { productId: true } }): Promise<FavoriteRow[]>;
    findFirst(args: { where: FavoriteWhere; select?: { productId: true } }): Promise<FavoriteRow | null>;
    count(args: { where: FavoriteWhere }): Promise<number>;
    createMany(args: { data: Array<{ organizationId: string; userId: string; productId: string }>; skipDuplicates: boolean }): Promise<{ count: number }>;
    deleteMany(args: { where: FavoriteWhere }): Promise<{ count: number }>;
  };
  product: {
    findFirst(args: { where: FavoriteWhere; select: { id: true } }): Promise<{ id: string } | null>;
  };
};
export type RetailFavoritesDatabase = FavoriteClient & {
  $transaction<T>(
    operation: (tx: FavoriteClient) => Promise<T>,
    options: { isolationLevel: "Serializable" },
  ): Promise<T>;
};

const visibleProductWhere = (organizationId: string, productId?: string): FavoriteWhere => ({
  ...(productId ? { id: productId } : {}),
  organizationId,
  isActive: true,
  deletedAt: null,
  category: { organizationId, isActive: true, deletedAt: null },
});

function isSerializationConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2034";
}

async function serializable<T>(db: RetailFavoritesDatabase, operation: (tx: FavoriteClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt >= 2) throw error;
    }
  }
}

export async function listRetailProductFavorites(
  organizationId: string,
  userId: string,
  db: RetailFavoritesDatabase = prisma as unknown as RetailFavoritesDatabase,
): Promise<string[]> {
  const rows = await db.productFavorite.findMany({
    where: { organizationId, userId, product: visibleProductWhere(organizationId) },
    orderBy: { createdAt: "asc" }, take: RETAIL_FAVORITES_MAX, select: { productId: true },
  });
  return rows.map((row) => row.productId);
}

/** Adds one favorite atomically. Concurrent distinct additions cannot exceed the 200-item cap. */
export async function addRetailProductFavorite(
  organizationId: string,
  userId: string,
  productId: string,
  db: RetailFavoritesDatabase = prisma as unknown as RetailFavoritesDatabase,
): Promise<void> {
  await serializable(db, async (tx) => {
    const product = await tx.product.findFirst({ where: visibleProductWhere(organizationId, productId), select: { id: true } });
    if (!product) throw new ApiError(404, "Product is unavailable.");

    const where = { organizationId, userId, productId };
    if (await tx.productFavorite.findFirst({ where, select: { productId: true } })) return;
    const currentCount = await tx.productFavorite.count({ where: { organizationId, userId } });
    if (currentCount >= RETAIL_FAVORITES_MAX) throw new ApiError(409, "You can save up to 200 products.");
    await tx.productFavorite.createMany({ data: [{ organizationId, userId, productId }], skipDuplicates: true });
  });
}

export async function removeRetailProductFavorite(
  organizationId: string,
  userId: string,
  productId: string,
  db: RetailFavoritesDatabase = prisma as unknown as RetailFavoritesDatabase,
): Promise<void> {
  await db.productFavorite.deleteMany({ where: { organizationId, userId, productId } });
}

export function isMissingRetailFavoritesTable(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error) || (error as { code?: unknown }).code !== "P2021") return false;
  const table = "meta" in error && typeof (error as { meta?: unknown }).meta === "object" && (error as { meta?: { table?: unknown } }).meta
    ? (error as { meta: { table?: unknown } }).meta.table : undefined;
  return typeof table === "string" && table.includes("ProductFavorite");
}
