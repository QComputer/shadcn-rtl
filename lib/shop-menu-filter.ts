export const ALL_PRODUCTS_CATEGORY_ID = "all";

export type ShopMenuProduct = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  trackInventory: boolean;
  variants: Array<{
    inventory: number;
    isActive: boolean;
    isDeleted: boolean;
  }>;
  isActive: boolean;
  deletedAt: boolean | null;
};

export type ShopMenuCategory<TProduct extends ShopMenuProduct = ShopMenuProduct> = {
  id: string;
  name: string;
  products: TProduct[];
  isActive: boolean;
  deletedAt: boolean | null;
};

export type VisibleShopProduct<TProduct extends ShopMenuProduct = ShopMenuProduct> = TProduct & {
  categoryId: string;
  categoryName: string;
};

export function getShopMenuProductInventory(product: ShopMenuProduct): number {
  if (!product.trackInventory) return Infinity;
  return product.variants?.length > 0
    ? product.variants.reduce((sum, variant) => sum + (variant.inventory || 0), 0)
    : 0;
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
      if (product.trackInventory && getShopMenuProductInventory(product) === 0) continue;

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

  return products.sort((a, b) => b.sortOrder - a.sortOrder);
}

export function countVisibleProductsByCategory<TProduct extends ShopMenuProduct>(
  category: ShopMenuCategory<TProduct>,
): number {
  if (!category.isActive || category.deletedAt) return 0;
  return category.products.filter((product) =>
    product.isActive &&
    !product.deletedAt &&
    (!product.trackInventory || getShopMenuProductInventory(product) > 0)
  ).length;
}
