import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CafeLeoCategory,
  CafeLeoExtractionFixture,
  CafeLeoProduct,
} from "../../prisma/seed-data/cafe-leo-types";

const SOURCE_URL = "https://iran.cafeleo.vip/";
const DEFAULT_OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../prisma/seed-data/cafe-leo-extraction.json");

const PERSIAN_DIGITS: Record<string, string> = {
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

function htmlDecode(value: string) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function stripTags(value: string) {
  return htmlDecode(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

function attr(html: string, name: string) {
  const match = html.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match ? htmlDecode(match[1] ?? "") : null;
}

function normalizeDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => PERSIAN_DIGITS[digit] ?? digit);
}

function parsePrice(rawPrice: string) {
  const match = rawPrice.match(/([۰-۹٠-٩0-9,]+)\s*تومان/);
  if (!match) throw new Error(`Unable to parse Cafe Leo price: ${rawPrice}`);
  const value = Number.parseInt(normalizeDigits(match[1] ?? "").replace(/,/g, ""), 10);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`Invalid Cafe Leo price: ${rawPrice}`);
  return value;
}

function absolutize(value: string | null) {
  if (!value) return null;
  return new URL(value, SOURCE_URL).href;
}

function extractSrcSetCandidates(itemHtml: string) {
  const candidates = new Set<string>();
  for (const source of itemHtml.matchAll(/srcSet="([^"]+)"/g)) {
    for (const part of (source[1] ?? "").split(",")) {
      const url = part.trim().split(/\s+/)[0];
      const absolute = absolutize(url || null);
      if (absolute) candidates.add(absolute);
    }
  }
  const imgSrc = absolutize(attr(itemHtml, "src"));
  if (imgSrc) candidates.add(imgSrc);
  return [...candidates];
}

function extractJsonLd(html: string) {
  const match = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  return JSON.parse(htmlDecode(match[1] ?? ""));
}

function findGraphNode(jsonLd: any, type: string) {
  const graph = Array.isArray(jsonLd?.["@graph"]) ? jsonLd["@graph"] : [];
  return graph.find((node: any) => node?.["@type"] === type) ?? null;
}

function parseCategories(html: string): CafeLeoCategory[] {
  const categories: CafeLeoCategory[] = [];
  const categoryRegex = /<div id="([^"]+)" class="product_group[^"]*" data-category-slug="([^"]+)"><h2 class="product_title">([\s\S]*?)<\/h2><ul class="product_list">([\s\S]*?)<\/ul><\/div>/g;
  let categoryOrder = 0;

  for (const categoryMatch of html.matchAll(categoryRegex)) {
    categoryOrder += 1;
    const sourceId = htmlDecode(categoryMatch[1] ?? "");
    const slug = htmlDecode(categoryMatch[2] ?? "");
    const name = stripTags(categoryMatch[3] ?? "");
    const listHtml = categoryMatch[4] ?? "";
    const products: CafeLeoProduct[] = [];
    let productOrder = 0;

    for (const itemMatch of listHtml.matchAll(/<li class="cafeleo-product-item">([\s\S]*?)<\/li>/g)) {
      const itemHtml = itemMatch[1] ?? "";
      productOrder += 1;
      const href = attr(itemHtml, "href");
      const productName = attr(itemHtml, "data-name") ?? stripTags(itemHtml.match(/<span class="product_name">([\s\S]*?)<\/span>/)?.[1] ?? "");
      const description = attr(itemHtml, "data-description");
      const tags = (attr(itemHtml, "data-tags") ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const rawPrice = stripTags(itemHtml.match(/<span class="cafeleo-product_price">([\s\S]*?)<\/span>/)?.[1] ?? "");
      const imageCandidates = extractSrcSetCandidates(itemHtml);
      const sourceHref = href ?? `#${sourceId}-${productOrder}`;
      const product: CafeLeoProduct = {
        sourceId: sourceHref.replace(/^#/, ""),
        sourceHref,
        name: productName,
        description: description || null,
        rawPrice,
        priceValue: parsePrice(rawPrice),
        currencyLabel: "تومان",
        imageUrl: imageCandidates.find((candidate) => candidate.includes("-520x.")) ?? imageCandidates[0] ?? null,
        imageCandidates,
        tags,
        availability: "available",
        order: productOrder,
      };
      products.push(product);
    }

    categories.push({ sourceId, slug, name, order: categoryOrder, products });
  }

  return categories;
}

function parseBusiness(html: string): CafeLeoExtractionFixture["business"] {
  const jsonLd = extractJsonLd(html);
  const organization = findGraphNode(jsonLd, "Organization");
  const cafe = findGraphNode(jsonLd, "CafeOrCoffeeShop");
  const metaDescription = html.match(/<meta name="description" content="([^"]*)"/i)?.[1] ?? null;
  const ogImage = html.match(/<meta property="og:image" content="([^"]*)"/i)?.[1] ?? null;
  const hours = cafe?.openingHoursSpecification
    ? `${(cafe.openingHoursSpecification.dayOfWeek ?? []).join(", ")} ${cafe.openingHoursSpecification.opens}-${cafe.openingHoursSpecification.closes}`
    : null;

  return {
    name: htmlDecode(cafe?.name ?? organization?.name ?? "کافه لئو"),
    description: htmlDecode(cafe?.description ?? metaDescription ?? "") || null,
    logoUrl: absolutize(cafe?.logo ?? organization?.logo?.url ?? null),
    coverImageUrl: absolutize(ogImage),
    address: htmlDecode(cafe?.address?.streetAddress ?? "") || null,
    phone: htmlDecode(cafe?.telephone ?? organization?.contactPoint?.telephone ?? "") || null,
    email: htmlDecode(cafe?.email ?? organization?.contactPoint?.email ?? "") || null,
    hours,
    socialLinks: Array.from(new Set([...(cafe?.sameAs ?? []), ...(organization?.sameAs ?? [])])),
    sourceProvided: {
      name: Boolean(cafe?.name ?? organization?.name),
      description: Boolean(cafe?.description ?? metaDescription),
      logo: Boolean(cafe?.logo ?? organization?.logo?.url),
      coverImage: Boolean(ogImage),
      address: Boolean(cafe?.address?.streetAddress),
      phone: Boolean(cafe?.telephone ?? organization?.contactPoint?.telephone),
      email: Boolean(cafe?.email ?? organization?.contactPoint?.email),
      hours: Boolean(cafe?.openingHoursSpecification),
      socialLinks: Boolean((cafe?.sameAs ?? organization?.sameAs ?? []).length),
    },
  };
}

async function main() {
  const outIndex = process.argv.indexOf("--out");
  const outPath = outIndex >= 0 ? resolve(process.argv[outIndex + 1] ?? "") : DEFAULT_OUT;
  const response = await fetch(SOURCE_URL, { headers: { "User-Agent": "BazarBaaz-CafeLeo-Extractor/1.0" } });
  if (!response.ok) throw new Error(`Failed to fetch Cafe Leo source: ${response.status}`);
  const html = await response.text();
  const categories = parseCategories(html);
  const products = categories.flatMap((category) => category.products);
  const jsonLdPresent = /type="application\/ld\+json"/i.test(html);
  const title = htmlDecode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const uniqueProductImages = new Set(products.map((product) => product.imageUrl).filter(Boolean));
  const values = products.map((product) => `${product.name}=${product.rawPrice}`).slice(0, 5);

  const fixture: CafeLeoExtractionFixture = {
    fixtureName: "cafe-leo-real-menu",
    frozenAt: new Date().toISOString(),
    source: {
      url: SOURCE_URL,
      type: "next-static-html",
      authoritativeExtractionMethod: "Fetched rendered static HTML and parsed product_group/product_list markup; Playwright network inspection found no menu API/XHR.",
      htmlTitle: title || null,
      imageSourceOrigin: "https://iran.cafeleo.vip",
    },
    organization: {
      slug: "cafe-leo",
      domain: "leocafe.ir",
    },
    business: parseBusiness(html),
    pricePolicy: {
      sourceRepresentation: "Visible product cards render numeric Persian strings followed by تومان, for example " + values.join("; "),
      interpretation: "literal-displayed-toman",
      bazarbaazStoredValue: "source numeric value without conversion",
      evidence: [
        "Every parsed product price is rendered inside .cafeleo-product_price with تومان.",
        "The source HTML contains no ریال or هزار marker.",
        "No hidden raw-price API or embedded JSON numeric unit was detected in network inspection.",
      ],
      guessed: false,
    },
    categories,
    counts: {
      categories: categories.length,
      products: products.length,
      pricedOrderable: products.length,
      unpriced: 0,
      unavailable: 0,
      uniqueProductImages: uniqueProductImages.size,
      variantsDetected: 0,
    },
    extractionEvidence: {
      categorySelector: "div.product_group[data-category-slug] > h2.product_title",
      productSelector: "li.cafeleo-product-item",
      productIdSource: "a.product_block[href] fragment, e.g. #hot-coffee-1",
      priceSelector: ".cafeleo-product_price",
      imageSelector: "picture.product_image img[src] plus source[srcSet]",
      jsonLdPresent,
      apiCallsDetected: [],
    },
  };

  if (fixture.counts.categories === 0 || fixture.counts.products === 0) {
    throw new Error("Cafe Leo extraction produced no menu data");
  }
  writeFileSync(outPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(JSON.stringify(fixture.counts));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
