export const ALL_PRODUCTS_CATEGORY_ID = "all";

export type ShopMenuProduct = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  trackInventory: boolean;
  variants: Array<{
    inventory: number;
    allowBackOrder?: boolean;
    isActive: boolean;
    isDeleted: boolean;
  }>;
  isActive: boolean;
  deletedAt: boolean | null;
};

export type ShopMenuCategory<TProduct extends ShopMenuProduct = ShopMenuProduct> = {
  id: string;
  name: string;
  sortOrder?: number;
  products: TProduct[];
  isActive: boolean;
  deletedAt: boolean | null;
};

export type VisibleShopProduct<TProduct extends ShopMenuProduct = ShopMenuProduct> = TProduct & {
  categoryId: string;
  categoryName: string;
};

export function sortShopMenuCategories<
  TProduct extends Pick<ShopMenuProduct, "id" | "name" | "sortOrder">,
  TCategory extends { id: string; name: string; sortOrder?: number; products: TProduct[] },
>(categories: readonly TCategory[]): Array<TCategory & { products: TProduct[] }> {
  return categories
    .map((category) => ({
      ...category,
      products: [...category.products].sort((a, b) =>
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id)
      ),
    }))
    .sort((a, b) =>
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id)
    );
}

export function getShopMenuProductInventory(product: ShopMenuProduct): number {
  if (!product.trackInventory) return Infinity;
  return product.variants?.length > 0
    ? product.variants.reduce((sum, variant) => sum + (variant.inventory || 0), 0)
    : 0;
}

export type ShopMenuProductAvailability = {
  tracksInventory: boolean;
  inventory: number;
  isOutOfStock: boolean;
  canPurchase: boolean;
};

export function getShopMenuProductAvailability(
  product: ShopMenuProduct,
): ShopMenuProductAvailability {
  const tracksInventory = product.trackInventory === true;
  const inventory = getShopMenuProductInventory(product);
  const isOutOfStock = tracksInventory && inventory <= 0;

  return {
    tracksInventory,
    inventory,
    isOutOfStock,
    canPurchase: !isOutOfStock,
  };
}

export function getVisibleShopMenuProducts<TProduct extends ShopMenuProduct>(
  categories: Array<ShopMenuCategory<TProduct>>,
  input: {
    selectedCategoryId: string | null;
    searchQuery?: string;
  },
): Array<VisibleShopProduct<TProduct>> {
  const query = input.searchQuery?.trim() || "";
  let products: Array<VisibleShopProduct<TProduct>> = [];

  for (const category of categories) {
    if (!category.isActive || category.deletedAt) continue;

    for (const product of category.products) {
      if (!product.isActive || product.deletedAt) continue;

      products.push({
        ...product,
        categoryId: category.id,
        categoryName: category.name,
      });
    }
  }

  if (input.selectedCategoryId) {
    products = products.filter((product) => product.categoryId === input.selectedCategoryId);
  }

  if (query) {
    products = products.filter((product) =>
      product.name.includes(query) ||
      product.description?.includes(query) ||
      product.categoryName.includes(query)
    );
  }

  return products.sort((a, b) =>
    a.sortOrder - b.sortOrder ||
    a.name.localeCompare(b.name) ||
    a.id.localeCompare(b.id)
  );
}

export function countVisibleProductsByCategory<TProduct extends ShopMenuProduct>(
  category: ShopMenuCategory<TProduct>,
): number {
  if (!category.isActive || category.deletedAt) return 0;
  return category.products.filter((product) => product.isActive && !product.deletedAt).length;
}
