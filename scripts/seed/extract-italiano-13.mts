import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_URL = "https://snappfood.ir/restaurant/menu/%D9%81%D8%B3%D8%AA_%D9%81%D9%88%D8%AF_%D8%A7%DB%8C%D8%AA%D8%A7%D9%84%DB%8C%D8%A7%DB%8C%DB%8C_%D8%B3%DB%8C%D8%B2%D8%AF%D9%87-r-31lmw4/?is_pickup=0";
const MENU_ENDPOINT = "https://apigw.snappfood.ir/menu-read-model/31lmw4?lat=35.774&long=51.418&optionalClient=PWA&client=PWA&deviceType=PWA&appVersion=6.0.0&Bonyan=true";

type RawVariation = { id: number; title?: string; price: number; active: boolean };
type RawProduct = { id: number | null; alias?: string | null; title: string; variations: RawVariation[] };
type RawCategory = { id: number; title: string; products: RawProduct[] };

const response = await fetch(MENU_ENDPOINT, { headers: { accept: "application/json" } });
assert.equal(response.ok, true, `SnappFood menu endpoint returned ${response.status}`);
const payload = await response.json() as { data?: { menuCategories?: RawCategory[] } };
const rawCategories = payload.data?.menuCategories;
assert.ok(Array.isArray(rawCategories), "SnappFood menu categories are missing");

const sourceIds = new Set<string>();
let duplicateSourceIdentities = 0;
const claim = (id: string) => sourceIds.has(id) ? (duplicateSourceIdentities += 1) : sourceIds.add(id);
const categories = rawCategories.map((category, categoryOrder) => {
  claim(`category:${category.id}`);
  return {
    externalId: `category:${category.id}`,
    name: category.title.trim(),
    order: categoryOrder,
    products: category.products.map((product, productOrder) => {
      const productKey = product.alias?.trim() || (product.id ? `p:${product.id}` : "");
      assert.ok(productKey, `Product ${product.title} has no stable source identity`);
      claim(`product:${productKey}`);
      return {
        externalId: `product:${productKey}`,
        name: product.title.trim(),
        order: productOrder,
        active: product.variations.some((variation) => variation.active === true),
        variants: product.variations.map((variation, variantOrder) => {
          claim(`variation:${productKey}:${variation.id}`);
          assert.ok(Number.isSafeInteger(variation.price) && variation.price > 0, `Invalid Toman price for variation ${variation.id}`);
          return {
            externalId: `variation:${productKey}:${variation.id}`,
            name: variation.title?.trim() || null,
            priceToman: variation.price,
            active: variation.active === true,
            order: variantOrder,
          };
        }),
      };
    }),
  };
});

const products = categories.flatMap((category) => category.products);
const variants = products.flatMap((product) => product.variants);
const snapshot = {
  snapshotVersion: 1,
  source: {
    provider: "SNAPPFOOD_MENU",
    restaurantCode: "31lmw4",
    restaurantName: "فست فود ایتالیایی سیزده",
    url: SOURCE_URL,
    publicReadEndpoint: MENU_ENDPOINT,
    retrievalMethod: "normal-browser-public-menu-read-model",
    retrievedAt: new Date().toISOString(),
  },
  organization: { slug: "italiano-13" },
  money: {
    sourceDisplayedUnit: "TOMAN",
    sourceApiUnit: "TOMAN",
    bazarbaazStoredUnit: "TOMAN",
    conversion: "identity",
    floatingPointUsed: false,
  },
  counts: {
    categories: categories.length,
    products: products.length,
    prices: variants.length,
    unpricedOrAmbiguous: products.filter((product) => product.variants.length === 0).length,
    duplicateSourceIdentities,
  },
  parsingWarnings: [] as string[],
  excludedFields: ["images", "descriptions", "ratings", "reviews", "customer-content"],
  categories,
};

assert.equal(snapshot.counts.categories, 9);
assert.equal(snapshot.counts.products, 55);
assert.equal(snapshot.counts.prices, 71);
assert.equal(snapshot.counts.unpricedOrAmbiguous, 0);
assert.equal(snapshot.counts.duplicateSourceIdentities, 0);

const output = path.join(process.cwd(), "prisma", "seed-data", "italiano-13-snappfood-menu.json");
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output, ...snapshot.counts, retrievedAt: snapshot.source.retrievedAt }, null, 2));
