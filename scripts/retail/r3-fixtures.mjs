import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const slugs = ["retail-r3-fashion-preview", "retail-r3-mobile-preview", "retail-r3-restaurant-compat"];
const managerEmails = ["r3-fashion-manager@example.test", "r3-mobile-manager@example.test"];
const staffEmail = "r3-fashion-staff@example.test";
const inactiveManagerEmail = "r3-fashion-inactive-manager@example.test";
const testPassword = process.env.RETAIL_R3_TEST_PASSWORD;
if (!testPassword || testPassword.length < 12) {
  throw new Error("RETAIL_R3_TEST_PASSWORD must be set to a disposable test credential of at least 12 characters.");
}
const prisma = new PrismaClient();

function assertDatabaseTarget() {
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const url = new URL(process.env[key] ?? "");
    if (!/^postgres(ql)?:$/.test(url.protocol) || !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error(`${key} must target a local disposable PostgreSQL database`);
    if (url.port !== "55432" || url.pathname !== "/bazarbaaz_retail_r3") throw new Error(`${key} does not match the verified retail R3 disposable database`);
  }
  if (process.env.LOCAL_PRISMA_EXPECTED_PORT !== "55432" || process.env.RETAIL_R3_EXPECTED_DATABASE !== "bazarbaaz_retail_r3") throw new Error("Missing explicit retail R3 disposable database identity guard");
}

async function verifyDatabase() {
  const rows = await prisma.$queryRaw`SELECT current_database() AS database, current_setting('server_version') AS version, current_setting('server_version_num')::int AS version_num`;
  const identity = rows[0];
  if (identity.database !== "bazarbaaz_retail_r3" || identity.version_num < 170000 || identity.version_num >= 180000) throw new Error("Connected database is not the verified PostgreSQL 17 retail R3 fixture database");
  return identity;
}

async function removeFixtures() {
  const organizations = await prisma.organization.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
  const ids = organizations.map((item) => item.id);
  if (ids.length) await prisma.organizationMember.deleteMany({ where: { organizationId: { in: ids } } });
  await prisma.user.deleteMany({ where: { email: { in: [...managerEmails, staffEmail, inactiveManagerEmail] } } });
  if (!ids.length) return;
  await prisma.product.deleteMany({ where: { organizationId: { in: ids } } });
  await prisma.productCategory.deleteMany({ where: { organizationId: { in: ids } } });
  await prisma.retailAttributeDefinition.deleteMany({ where: { organizationId: { in: ids } } });
  await prisma.image.deleteMany({ where: { organizationId: { in: ids } } });
  await prisma.organizationBranding.deleteMany({ where: { organizationId: { in: ids } } });
  await prisma.organizationCapability.deleteMany({ where: { organizationId: { in: ids } } });
  await prisma.organization.deleteMany({ where: { id: { in: ids } } });
}

async function createTenant(slug, name, type, theme = null) {
  const organization = await prisma.organization.create({ data: { slug, name, type, locale: "fa", isActive: true, capabilitiesInitializedAt: new Date() } });
  if (type === "SHOP") await prisma.organizationCapability.create({ data: { organizationId: organization.id, key: "SHOP", status: "ACTIVE", enabledAt: new Date() } });
  else await prisma.organizationCapability.create({ data: { organizationId: organization.id, key: "APPOINTMENT", status: "ACTIVE", enabledAt: new Date() } });
  if (theme) await prisma.organizationBranding.create({ data: { organizationId: organization.id, displayName: name, retailPresentationTheme: theme, retailPreviewOnly: true } });
  return organization;
}

async function createProduct({ organization, category, name, slug, price, attrs, variants, media }) {
  const definitions = new Map();
  for (const attribute of attrs) {
    definitions.set(attribute.key, await prisma.retailAttributeDefinition.create({ data: {
      organizationId: organization.id, key: attribute.key, label: attribute.label, localizedLabels: { fa: attribute.label },
      scope: "PRODUCT", valueType: attribute.valueType, displayUnit: attribute.displayUnit ?? null,
      allowedValues: attribute.allowedValues ?? undefined, isFilterable: attribute.filterable ?? true,
    } }));
  }
  for (const option of variants.flatMap((variant) => variant.options)) {
    if (!definitions.has(option.key)) definitions.set(option.key, await prisma.retailAttributeDefinition.create({ data: {
      organizationId: organization.id, key: option.key, label: option.label, localizedLabels: { fa: option.label },
      scope: "VARIANT_OPTION", valueType: option.valueType, displayUnit: option.displayUnit ?? null,
      allowedValues: option.allowedValues ?? undefined, isFilterable: option.filterable ?? true,
    } }));
  }
  const images = await Promise.all(media.map((item) => prisma.image.create({ data: { url: item.url, organizationId: item.organizationId ?? organization.id, access: item.access ?? "PUBLIC", purpose: "retail-r3-synthetic-fixture" } })));
  return prisma.product.create({ data: {
    name, slug, description: `اطلاعات نمونه برای آزمون فروشگاه ${name}`, basePrice: price, organizationId: organization.id, organizationSlug: organization.slug, categoryId: category.id, image: images[0]?.url,
    images: { connect: images.map((image) => ({ id: image.id })) },
    attributeValues: { create: attrs.map((attribute) => ({ definitionId: definitions.get(attribute.key).id, valueText: attribute.valueType === "TEXT" || attribute.valueType === "ENUM" ? String(attribute.value) : null,
      valueNumber: attribute.valueType === "NUMBER" ? Number(attribute.value) : null, valueBoolean: attribute.valueType === "BOOLEAN" ? Boolean(attribute.value) : null })) },
    variants: { create: variants.map((variant) => ({ name: variant.name, sku: variant.sku, price: variant.price, inventory: variant.inventory, reservedQuantity: variant.reservedQuantity ?? 0,
      optionValues: { create: variant.options.map((option) => ({ definitionId: definitions.get(option.key).id, valueText: option.valueType === "TEXT" || option.valueType === "ENUM" ? String(option.value) : null,
        valueNumber: option.valueType === "NUMBER" ? Number(option.value) : null, valueBoolean: option.valueType === "BOOLEAN" ? Boolean(option.value) : null })) } })) },
  } });
}

async function seedFixtures() {
  await removeFixtures();
  const fashion = await createTenant(slugs[0], "نمونه فروشگاه کفش R3", "SHOP", "FASHION");
  const mobile = await createTenant(slugs[1], "نمونه فروشگاه موبایل R3", "SHOP", "ELECTRONICS");
  const restaurant = await createTenant(slugs[2], "رستوران سازگاری R3", "APPOINTMENT");
  const password = await bcrypt.hash(testPassword, 10);
  for (const [index, organization] of [[0, fashion], [1, mobile]]) {
    const user = await prisma.user.create({ data: { name: managerEmails[index], email: managerEmails[index], password, role: "STAFF", isTeamMember: true, locale: "fa" } });
    await prisma.organizationMember.create({ data: { organizationId: organization.id, organizationSlug: organization.slug, userId: user.id, role: "MANAGER", isActive: true } });
  }
  const staff = await prisma.user.create({ data: { name: staffEmail, email: staffEmail, password, role: "STAFF", isTeamMember: true, locale: "fa" } });
  await prisma.organizationMember.create({ data: { organizationId: fashion.id, organizationSlug: fashion.slug, userId: staff.id, role: "STAFF", isActive: true } });
  const inactiveManager = await prisma.user.create({ data: { name: inactiveManagerEmail, email: inactiveManagerEmail, password, role: "STAFF", isTeamMember: true, locale: "fa" } });
  await prisma.organizationMember.create({ data: { organizationId: fashion.id, organizationSlug: fashion.slug, userId: inactiveManager.id, role: "MANAGER", isActive: false } });
  const fashionCategory = await prisma.productCategory.create({ data: { name: "کتانی", slug: "sneakers", organizationId: fashion.id, organizationSlug: fashion.slug } });
  const phoneCategory = await prisma.productCategory.create({ data: { name: "گوشی هوشمند", slug: "smartphones", organizationId: mobile.id, organizationSlug: mobile.slug } });
  const restaurantCategory = await prisma.productCategory.create({ data: { name: "غذای روز", slug: "daily-menu", organizationId: restaurant.id, organizationSlug: restaurant.slug } });
  await Promise.all([
    { organization: fashion, url: "/retail-preview/preview-fashion-campaign.png" },
    { organization: mobile, url: "/retail-preview/preview-mobile-campaign.png" },
  ].map(({ organization, url }) => prisma.image.create({ data: {
    url, filename: "PREVIEW-R3-synthetic-test-asset.png", organizationId: organization.id,
    access: "PUBLIC", purpose: "retail-product",
  } })));
  const foreignImage = await prisma.image.create({ data: { url: "/retail-preview/preview-mobile-campaign.png", organizationId: mobile.id, access: "PUBLIC", purpose: "retail-r3-synthetic-foreign-media" } });
  await createProduct({ organization: fashion, category: fashionCategory, name: "کتانی نمونه آوید", slug: "avid-preview", price: 500000, media: [{ url: "/retail-preview/preview-fashion-campaign.png" }, { url: foreignImage.url, organizationId: mobile.id }, { url: "/retail-preview/preview-fashion-campaign.png", access: "PRIVATE" }, { url: "javascript:alert(1)" }],
    attrs: [{ key: "material", label: "جنس", valueType: "ENUM", value: "چرم طبیعی", allowedValues: ["چرم طبیعی", "پارچه"] }, { key: "style", label: "سبک", valueType: "TEXT", value: "روزمره" }],
    variants: [{ name: "مشکی · ۴۲", sku: "R3-SHOE-42-BK", price: 600000, inventory: 5, reservedQuantity: 2, options: [{ key: "color", label: "رنگ", valueType: "ENUM", value: "مشکی", allowedValues: ["مشکی", "سفید"] }, { key: "size", label: "سایز", valueType: "NUMBER", value: 42, displayUnit: "EU" }] },
      { name: "سفید · ۴۳", sku: "R3-SHOE-43-WH", price: 700000, inventory: 2, reservedQuantity: 2, options: [{ key: "color", label: "رنگ", valueType: "ENUM", value: "سفید", allowedValues: ["مشکی", "سفید"] }, { key: "size", label: "سایز", valueType: "NUMBER", value: 43, displayUnit: "EU" }] }] });
  await createProduct({ organization: mobile, category: phoneCategory, name: "موبایل نمونه Nova X", slug: "nova-x-preview", price: 42000000, media: [{ url: "/retail-preview/preview-mobile-campaign.png" }],
    attrs: [{ key: "ram", label: "حافظه RAM", valueType: "NUMBER", value: 12, displayUnit: "GB" }, { key: "processor", label: "پردازنده", valueType: "TEXT", value: "Octa-core" }, { key: "display", label: "نمایشگر", valueType: "ENUM", value: "AMOLED", allowedValues: ["AMOLED", "OLED"] }, { key: "warranty", label: "گارانتی", valueType: "TEXT", value: "۱۸ ماه" }],
    variants: [{ name: "آبی · ۲۵۶ گیگابایت", sku: "R3-NOVA-256-BL", price: 43900000, inventory: 4, reservedQuantity: 1, options: [{ key: "color", label: "رنگ", valueType: "ENUM", value: "آبی" }, { key: "storage", label: "حافظه داخلی", valueType: "NUMBER", value: 256, displayUnit: "GB" }] },
      { name: "مشکی · ۵۱۲ گیگابایت", sku: "R3-NOVA-512-BK", price: 48900000, inventory: 0, options: [{ key: "color", label: "رنگ", valueType: "ENUM", value: "مشکی" }, { key: "storage", label: "حافظه داخلی", valueType: "NUMBER", value: 512, displayUnit: "GB" }] }] });
  await prisma.product.create({ data: { name: "غذای آزمایشی", slug: "restaurant-compat-r2", basePrice: 120000, organizationId: restaurant.id, organizationSlug: restaurant.slug, categoryId: restaurantCategory.id } });
}

async function assertCatalog() {
  const { getPublicCatalogProduct, listPublicCatalogProducts, listPublicCatalogCategories, getPublicCatalogSnapshot } = await import("../../lib/public-catalog/service.server.ts");
  const fashion = await getPublicCatalogProduct(slugs[0], "avid-preview");
  const availableVariant = fashion.variants.find((variant) => variant.sku === "R3-SHOE-42-BK");
  const soldOutVariant = fashion.variants.find((variant) => variant.sku === "R3-SHOE-43-WH");
  if (availableVariant?.price.amount !== 600000 || availableVariant.orderable !== true) throw new Error("Fashion variant price/available stock mismatch");
  if (soldOutVariant?.orderable !== false) throw new Error("Reserved stock was exposed as available");
  if (fashion.media.gallery.length !== 0 || !fashion.media.card?.includes("preview-fashion")) throw new Error("Tenant media eligibility was not applied");
  if ("organizationId" in fashion || "inventory" in availableVariant) throw new Error("Private catalog fields leaked");
  const filtered = await listPublicCatalogProducts({ organizationIdentifier: slugs[1], page: 1, limit: 50, filter: ["ram:12"] });
  if (filtered.products.length !== 1 || filtered.products[0].slug !== "nova-x-preview") throw new Error("Structured attribute filtering failed");
  const priced = await listPublicCatalogProducts({ organizationIdentifier: slugs[1], page: 1, limit: 1, minPrice: 43000000, maxPrice: 50000000, sort: "price-desc" });
  if (priced.pagination.total !== 1 || priced.products[0]?.slug !== "nova-x-preview") throw new Error("Price filter/sort/count did not apply to the full eligible tenant catalog");
  const laterPage = await listPublicCatalogProducts({ organizationIdentifier: slugs[1], page: 2, limit: 1 });
  if (laterPage.pagination.total !== 1 || laterPage.products.length !== 0) throw new Error("Pagination totals were not stable across pages");
  const categories = await listPublicCatalogCategories(slugs[0]);
  if (categories.categories[0]?.slug !== "sneakers") throw new Error("Tenant category listing failed");
  const snapshot = await getPublicCatalogSnapshot(slugs[0]);
  if (snapshot.organization.theme !== "FASHION" || snapshot.organization.previewOnly !== true) throw new Error("Organization-scoped theme/preview config failed");
  let foreignProductHidden = false;
  try { await getPublicCatalogProduct(slugs[1], "avid-preview"); } catch (error) { foreignProductHidden = error?.status === 404; }
  if (!foreignProductHidden) throw new Error("Cross-tenant product isolation failed");
  let restaurantRetailHidden = false;
  try { await getPublicCatalogProduct(slugs[2], "restaurant-compat-r2"); } catch (error) { restaurantRetailHidden = error?.status === 404; }
  if (!restaurantRetailHidden) throw new Error("Restaurant-only tenant exposed a retail catalog");
}

try {
  assertDatabaseTarget();
  const identity = await verifyDatabase();
  const mode = process.argv[2] ?? "verify";
  if (mode === "seed") await seedFixtures();
  else if (mode === "cleanup") await removeFixtures();
  else if (mode !== "verify") throw new Error("Mode must be seed, verify, or cleanup");
  else await assertCatalog();
  process.stdout.write(`Retail R3 ${mode} PASS on ${identity.database}, PostgreSQL ${identity.version}\n`);
} finally {
  await prisma.$disconnect();
}
