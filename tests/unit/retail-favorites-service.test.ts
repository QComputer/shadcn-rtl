import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "@/lib/api-guards";
import {
  addRetailProductFavorite,
  isMissingRetailFavoritesTable,
  listRetailProductFavorites,
  RETAIL_FAVORITES_MAX,
  removeRetailProductFavorite,
  type RetailFavoritesDatabase,
} from "@/lib/retail/favorites.server";

function fakeDb(options: { initial?: string[]; visible?: boolean } = {}) {
  const favorites = new Set(options.initial ?? []);
  let lastListQuery: unknown;
  const client = {
    productFavorite: {
      findMany: async (args: { where: Record<string, unknown>; take: number }) => {
        lastListQuery = args;
        return [...favorites].slice(0, args.take).map((productId) => ({ productId }));
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => favorites.has(String(where.productId)) ? { productId: String(where.productId) } : null,
      count: async () => favorites.size,
      createMany: async ({ data }: { data: Array<{ productId: string }> }) => {
        const before = favorites.size;
        for (const row of data) favorites.add(row.productId);
        return { count: favorites.size - before };
      },
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => ({ count: Number(favorites.delete(String(where.productId))) }),
    },
    product: { findFirst: async () => options.visible === false ? null : { id: "product" } },
  };
  const db = {
    ...client,
    $transaction: async <T>(operation: (tx: typeof client) => Promise<T>) => operation(client),
  } as unknown as RetailFavoritesDatabase;
  return { db, favorites, get lastListQuery() { return lastListQuery; } };
}

describe("retail product favorites service", () => {
  it("returns only visible-product favorites with a bounded tenant and user query", async () => {
    const state = fakeDb({ initial: ["product-a", "product-b"] });
    assert.deepEqual(await listRetailProductFavorites("org-a", "user-a", state.db), ["product-a", "product-b"]);
    assert.deepEqual(state.lastListQuery, {
      where: { organizationId: "org-a", userId: "user-a", product: {
        organizationId: "org-a", isActive: true, deletedAt: null,
        category: { organizationId: "org-a", isActive: true, deletedAt: null },
      } },
      orderBy: { createdAt: "asc" }, take: RETAIL_FAVORITES_MAX, select: { productId: true },
    });
  });

  it("adds idempotently and removes only the requesting user's tenant record", async () => {
    const state = fakeDb();
    await addRetailProductFavorite("org-a", "user-a", "product-a", state.db);
    await addRetailProductFavorite("org-a", "user-a", "product-a", state.db);
    assert.deepEqual([...state.favorites], ["product-a"]);
    await removeRetailProductFavorite("org-a", "user-a", "product-a", state.db);
    assert.equal(state.favorites.size, 0);
  });

  it("rejects a private, deleted, inactive, or wrong-tenant product through the visibility lookup", async () => {
    const state = fakeDb({ visible: false });
    await assert.rejects(() => addRetailProductFavorite("org-a", "user-a", "private-product", state.db),
      (error: unknown) => error instanceof ApiError && error.status === 404);
    assert.equal(state.favorites.size, 0);
  });

  it("keeps the per-store list capped at 200", async () => {
    const state = fakeDb({ initial: Array.from({ length: RETAIL_FAVORITES_MAX }, (_, index) => `product-${index}`) });
    await assert.rejects(() => addRetailProductFavorite("org-a", "user-a", "product-new", state.db),
      (error: unknown) => error instanceof ApiError && error.status === 409);
    assert.equal(state.favorites.size, RETAIL_FAVORITES_MAX);
  });

  it("recognizes only a missing ProductFavorite table as an unmigrated configuration", () => {
    assert.equal(isMissingRetailFavoritesTable({ code: "P2021", meta: { table: "public.ProductFavorite" } }), true);
    assert.equal(isMissingRetailFavoritesTable({ code: "P2021", meta: { table: "public.Product" } }), false);
    assert.equal(isMissingRetailFavoritesTable({ code: "P1001", meta: { table: "public.ProductFavorite" } }), false);
  });
});
