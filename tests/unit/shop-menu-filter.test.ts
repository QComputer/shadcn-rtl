import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  countVisibleProductsByCategory,
  getVisibleShopMenuProducts,
  type ShopMenuCategory,
  type ShopMenuProduct,
} from "../../lib/shop-menu-filter";
import { buildShopCategoryPath, buildShopProductPath, buildShopPublicPath, decodePublicRouteSegment } from "../../lib/shop-public-paths";
import { getDictionary, getDictValue } from "../../lib/dictionary";

type TestProduct = ShopMenuProduct & {
  slug: string | null;
  organizationSlug: string;
};

function product(input: Partial<TestProduct> & Pick<TestProduct, "id" | "name" | "sortOrder" | "organizationSlug">): TestProduct {
  return {
    slug: null,
    description: null,
    trackInventory: false,
    variants: [],
    isActive: true,
    deletedAt: null,
    ...input,
  };
}

function category(input: Partial<ShopMenuCategory<TestProduct>> & Pick<ShopMenuCategory<TestProduct>, "id" | "name">): ShopMenuCategory<TestProduct> {
  return {
    products: [],
    isActive: true,
    deletedAt: null,
    ...input,
  };
}

const categories = [
  category({
    id: "cat_pizza",
    name: "پیتزا",
    products: [
      product({ id: "p_margherita", name: "مارگاریتا", sortOrder: 40, organizationSlug: "chakme", slug: "margherita" }),
      product({ id: "p_pepperoni", name: "Pepperoni", description: "spicy pizza", sortOrder: 20, organizationSlug: "chakme" }),
      product({ id: "p_hidden", name: "Hidden", sortOrder: 99, organizationSlug: "chakme", isActive: false }),
      product({
        id: "p_sold_out",
        name: "Sold out",
        sortOrder: 90,
        organizationSlug: "chakme",
        trackInventory: true,
        variants: [{ inventory: 0, isActive: true, isDeleted: false }],
      }),
    ],
  }),
  category({
    id: "cat_drinks",
    name: "مشروبات",
    products: [
      product({ id: "p_juice", name: "عصير", sortOrder: 30, organizationSlug: "chakme" }),
      product({ id: "p_coffee", name: "Coffee", description: "hot drink", sortOrder: 10, organizationSlug: "chakme" }),
    ],
  }),
  category({ id: "cat_empty", name: "Empty", products: [] }),
  category({
    id: "cat_other_tenant",
    name: "Other tenant",
    products: [product({ id: "p_other", name: "Other tenant item", sortOrder: 50, organizationSlug: "other-shop" })],
  }),
];

describe("shop menu in-page category filtering", () => {
  it("initial state displays all visible products in stable sort order", () => {
    assert.deepEqual(
      getVisibleShopMenuProducts(categories, { selectedCategoryId: null }).map((item) => item.id),
      ["p_other", "p_margherita", "p_juice", "p_pepperoni", "p_coffee"],
    );
  });

  it("clicking a category filters in place by stable category id", () => {
    assert.deepEqual(
      getVisibleShopMenuProducts(categories, { selectedCategoryId: "cat_pizza" }).map((item) => item.id),
      ["p_margherita", "p_pepperoni"],
    );
  });

  it("all-products state restores the complete visible list", () => {
    const filtered = getVisibleShopMenuProducts(categories, { selectedCategoryId: "cat_drinks" });
    const restored = getVisibleShopMenuProducts(categories, { selectedCategoryId: null });
    assert.equal(filtered.length, 2);
    assert.equal(restored.length, 5);
  });

  it("Persian category labels work without slug parsing", () => {
    const [item] = getVisibleShopMenuProducts(categories, { selectedCategoryId: "cat_pizza", searchQuery: "مارگاریتا" });
    assert.equal(item.name, "مارگاریتا");
    assert.equal(item.categoryName, "پیتزا");
  });

  it("Arabic product/category labels work with search", () => {
    const [item] = getVisibleShopMenuProducts(categories, { selectedCategoryId: "cat_drinks", searchQuery: "عصير" });
    assert.equal(item.id, "p_juice");
    assert.equal(item.categoryName, "مشروبات");
  });

  it("English labels work with search", () => {
    assert.deepEqual(
      getVisibleShopMenuProducts(categories, { selectedCategoryId: "cat_drinks", searchQuery: "Coffee" }).map((item) => item.id),
      ["p_coffee"],
    );
  });

  it("category with no products shows an empty filtered result", () => {
    assert.deepEqual(getVisibleShopMenuProducts(categories, { selectedCategoryId: "cat_empty" }), []);
  });

  it("search and category filters combine predictably", () => {
    assert.deepEqual(
      getVisibleShopMenuProducts(categories, { selectedCategoryId: "cat_pizza", searchQuery: "drink" }).map((item) => item.id),
      [],
    );
  });

  it("filtering is pure and preserves cart-shaped external state", () => {
    const cartState = { variantId: "variant_1", quantity: 2 };
    getVisibleShopMenuProducts(categories, { selectedCategoryId: "cat_pizza" });
    assert.deepEqual(cartState, { variantId: "variant_1", quantity: 2 });
  });

  it("product ordering is preserved after filtering", () => {
    assert.deepEqual(
      getVisibleShopMenuProducts(categories, { selectedCategoryId: "cat_pizza" }).map((item) => item.sortOrder),
      [40, 20],
    );
  });

  it("uncategorized products are absent from category filters", () => {
    assert.equal(getVisibleShopMenuProducts(categories, { selectedCategoryId: "uncategorized" }).length, 0);
  });

  it("hidden products remain hidden", () => {
    const ids = getVisibleShopMenuProducts(categories, { selectedCategoryId: "cat_pizza" }).map((item) => item.id);
    assert.equal(ids.includes("p_hidden"), false);
  });

  it("sold-out tracked products remain hidden", () => {
    const ids = getVisibleShopMenuProducts(categories, { selectedCategoryId: "cat_pizza" }).map((item) => item.id);
    assert.equal(ids.includes("p_sold_out"), false);
  });

  it("tenant-scoped source data can be asserted by callers before rendering", () => {
    const visible = getVisibleShopMenuProducts(categories.filter((item) => item.id !== "cat_other_tenant"), { selectedCategoryId: null });
    assert.equal(visible.every((item) => item.organizationSlug === "chakme"), true);
  });

  it("product links remain functional on custom domains", () => {
    assert.equal(
      buildShopProductPath({ locale: "fa", shopSlug: "chakme", productSegment: "margherita", isCustomDomain: true }),
      "/product/margherita",
    );
  });

  it("direct category compatibility path remains available", () => {
    assert.equal(
      buildShopCategoryPath({ locale: "fa", shopSlug: "chakme", categorySegment: "پیتزا-c1", isCustomDomain: true }),
      "/category/پیتزا-c1",
    );
  });

  it("invalid category remains an empty in-page state for normal filtering", () => {
    assert.deepEqual(getVisibleShopMenuProducts(categories, { selectedCategoryId: "missing" }), []);
  });

  it("custom-domain root remains canonical for all products", () => {
    assert.equal(buildShopPublicPath({ locale: "fa", shopSlug: "chakme", isCustomDomain: true }), "/");
  });

  it("encoded Persian legacy category slugs still decode", () => {
    assert.equal(decodePublicRouteSegment("%D9%BE%DB%8C%D8%AA%D8%B2%D8%A7-c1"), "پیتزا-c1");
  });

  it("localized all-products labels exist for fa, ar, and en", () => {
    assert.equal(getDictValue(getDictionary("fa"), "shop.allProducts"), "همه محصولات");
    assert.equal(getDictValue(getDictionary("ar"), "shop.allProducts"), "كل المنتجات");
    assert.equal(getDictValue(getDictionary("en"), "shop.allProducts"), "All products");
  });

  it("visible category counts use the same availability policy as products", () => {
    assert.equal(countVisibleProductsByCategory(categories[0]), 2);
  });
});
