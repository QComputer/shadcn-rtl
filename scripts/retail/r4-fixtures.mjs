import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const slugs = ["retail-r4-synthetic-fashion", "retail-r4-synthetic-mobile", "retail-r4-synthetic-restaurant-compat"];
const managerEmails = ["r4-synthetic-fashion-manager@example.test", "r4-synthetic-mobile-manager@example.test"];
const customerEmail = "r4-synthetic-customer@example.test";
const testPassword = process.env.RETAIL_R4_TEST_PASSWORD;
if (!testPassword || testPassword.length < 12) {
  throw new Error("RETAIL_R4_TEST_PASSWORD must be set to a disposable test credential of at least 12 characters.");
}
const prisma = new PrismaClient();

function assertDatabaseTarget() {
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const url = new URL(process.env[key] ?? "");
    if (!/^postgres(ql)?:$/.test(url.protocol) || !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error(`${key} must target a local disposable PostgreSQL database`);
    if (url.port !== "55433" || url.pathname !== "/bazarbaaz_retail_r4") throw new Error(`${key} does not match the verified retail R4 disposable database`);
  }
  if (process.env.LOCAL_PRISMA_EXPECTED_PORT !== "55433" || process.env.RETAIL_R4_EXPECTED_DATABASE !== "bazarbaaz_retail_r4") throw new Error("Missing explicit retail R4 disposable database identity guard");
}

async function verifyDatabase() {
  const rows = await prisma.$queryRaw`SELECT current_database() AS database, current_setting('server_version') AS version, current_setting('server_version_num')::int AS version_num`;
  const identity = rows[0];
  if (identity.database !== "bazarbaaz_retail_r4" || identity.version_num < 170000 || identity.version_num >= 180000) throw new Error("Connected database is not the verified PostgreSQL 17 retail R4 fixture database");
  return identity;
}

async function removeFixtures() {
  const organizations = await prisma.organization.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
  if (organizations.length && organizations.some((item) => !item.slug.startsWith("retail-r4-synthetic-"))) throw new Error("Refusing cleanup outside exact R4 synthetic slugs");
  const ids = organizations.map((item) => item.id);
  if (ids.length) await prisma.organizationMember.deleteMany({ where: { organizationId: { in: ids } } });
  await prisma.customerIdentity.deleteMany({ where: { organizationId: { in: ids } } });
  await prisma.paymentSettings.deleteMany({ where: { organizationSlug: { in: slugs } } });
  await prisma.coupon.deleteMany({ where: { organizationId: { in: ids }, code: { startsWith: "R4SYN-" } } });
  await prisma.user.deleteMany({ where: { email: { in: [...managerEmails, customerEmail] } } });
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
  if (theme) await prisma.organizationBranding.create({ data: { organizationId: organization.id, displayName: name, retailPresentationTheme: theme, retailPreviewOnly: false } });
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
  const images = await Promise.all(media.map((item) => prisma.image.create({ data: { url: item.url, organizationId: item.organizationId ?? organization.id, access: item.access ?? "PUBLIC", purpose: "retail-r4-synthetic-fixture" } })));
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
  const fashion = await createTenant(slugs[0], "[R4-SYNTHETIC] نمونه فروشگاه کفش", "SHOP", "FASHION");
  const mobile = await createTenant(slugs[1], "[R4-SYNTHETIC] نمونه فروشگاه موبایل", "SHOP", "ELECTRONICS");
  const restaurant = await createTenant(slugs[2], "[R4-SYNTHETIC] رستوران سازگاری", "APPOINTMENT");
  const password = await bcrypt.hash(testPassword, 10);
  for (const [index, organization] of [[0, fashion], [1, mobile]]) {
    const user = await prisma.user.create({ data: { name: managerEmails[index], email: managerEmails[index], password, role: "STAFF", isTeamMember: true, locale: "fa" } });
    await prisma.organizationMember.create({ data: { organizationId: organization.id, organizationSlug: organization.slug, userId: user.id, role: "MANAGER", isActive: true } });
  }
  const customer = await prisma.user.create({ data: { name: customerEmail, email: customerEmail, password, role: "CUSTOMER", isTeamMember: false, locale: "fa" } });
  await prisma.customerIdentity.create({ data: { organizationId: fashion.id, userId: customer.id, email: customerEmail, metadata: { syntheticFixture: "retail-r4" } } });
  await prisma.customerIdentity.create({ data: { organizationId: mobile.id, userId: customer.id, email: customerEmail, metadata: { syntheticFixture: "retail-r4" } } });
  for (const organization of [fashion, mobile]) await prisma.paymentSettings.create({ data: { organizationSlug: organization.slug, settings: { retailR4: { bankTransferEnabled: true, cashEnabled: true, inotiUssdEnabled: false, bankCardNumber: "6037990000000000", bankAccountOwner: "Synthetic R4 Test", cashModes: organization.id === fashion.id ? ["COUNTER"] : ["COUNTER", "PICKUP", "COURIER"], cashBeforeConfirmation: organization.id === fashion.id } } } });
  for (const organization of [fashion, mobile]) await prisma.coupon.create({ data: { organizationId: organization.id, code: `R4SYN-${organization.slug.endsWith("fashion") ? "FASHION" : "MOBILE"}`, name: "[R4-SYNTHETIC] Test discount", discountType: "PERCENTAGE", discountValue: 10, minOrderTotal: 100000, maxDiscountAmount: 500000, usageLimit: 100, perCustomerLimit: 2, isActive: true } });
  const fashionCategory = await prisma.productCategory.create({ data: { name: "کتانی", slug: "sneakers", organizationId: fashion.id, organizationSlug: fashion.slug } });
  await prisma.productCategory.create({ data: { name: "کلاه", slug: "caps", organizationId: fashion.id, organizationSlug: fashion.slug } });
  const phoneCategory = await prisma.productCategory.create({ data: { name: "گوشی هوشمند", slug: "smartphones", organizationId: mobile.id, organizationSlug: mobile.slug } });
  const restaurantCategory = await prisma.productCategory.create({ data: { name: "غذای روز", slug: "daily-menu", organizationId: restaurant.id, organizationSlug: restaurant.slug } });
  await Promise.all([
    { organization: fashion, url: "/retail-preview/preview-fashion-campaign.png" },
    { organization: mobile, url: "/retail-preview/preview-mobile-campaign.png" },
  ].map(({ organization, url }) => prisma.image.create({ data: {
    url, filename: "PREVIEW-R4-synthetic-test-asset.png", organizationId: organization.id,
    access: "PUBLIC", purpose: "retail-product",
  } })));
  const foreignImage = await prisma.image.create({ data: { url: "/retail-preview/preview-mobile-campaign.png", organizationId: mobile.id, access: "PUBLIC", purpose: "retail-r4-synthetic-foreign-media" } });
  await createProduct({ organization: fashion, category: fashionCategory, name: "[R4-SYNTHETIC] کتانی نمونه آوید", slug: "r4-synthetic-avid", price: 500000, media: [{ url: "/retail-preview/preview-fashion-campaign.png" }, { url: foreignImage.url, organizationId: mobile.id }, { url: "/retail-preview/preview-fashion-campaign.png", access: "PRIVATE" }, { url: "javascript:alert(1)" }],
    attrs: [{ key: "material", label: "جنس", valueType: "ENUM", value: "چرم طبیعی", allowedValues: ["چرم طبیعی", "پارچه"] }, { key: "style", label: "سبک", valueType: "TEXT", value: "روزمره" }],
    variants: [{ name: "[R4-SYNTHETIC] مشکی · ۴۲", sku: "R4-SYN-SHOE-42-BK", price: 600000, inventory: 5, reservedQuantity: 0, options: [{ key: "color", label: "رنگ", valueType: "ENUM", value: "مشکی", allowedValues: ["مشکی", "سفید"] }, { key: "size", label: "سایز", valueType: "NUMBER", value: 42, displayUnit: "EU" }] }] });
  await createProduct({ organization: mobile, category: phoneCategory, name: "[R4-SYNTHETIC] موبایل نمونه Nova X", slug: "r4-synthetic-nova-x", price: 42000000, media: [{ url: "/retail-preview/preview-mobile-campaign.png" }],
    attrs: [{ key: "ram", label: "حافظه RAM", valueType: "NUMBER", value: 12, displayUnit: "GB" }, { key: "processor", label: "پردازنده", valueType: "TEXT", value: "Octa-core" }, { key: "display", label: "نمایشگر", valueType: "ENUM", value: "AMOLED", allowedValues: ["AMOLED", "OLED"] }, { key: "warranty", label: "گارانتی", valueType: "TEXT", value: "۱۸ ماه" }],
    variants: [{ name: "[R4-SYNTHETIC] آبی · ۲۵۶ گیگابایت", sku: "R4-SYN-NOVA-256-BL", price: 43900000, inventory: 4, reservedQuantity: 0, options: [{ key: "color", label: "رنگ", valueType: "ENUM", value: "آبی" }, { key: "storage", label: "حافظه داخلی", valueType: "NUMBER", value: 256, displayUnit: "GB" }] }] });
  await prisma.product.create({ data: { name: "[R4-SYNTHETIC] غذای آزمایشی", slug: "r4-synthetic-restaurant-compat", basePrice: 120000, organizationId: restaurant.id, organizationSlug: restaurant.slug, categoryId: restaurantCategory.id, isActive: false } });
}

async function assertCatalog() {
  const { getPublicCatalogProduct, listPublicCatalogProducts, listPublicCatalogCategories, getPublicCatalogSnapshot } = await import("../../lib/public-catalog/service.server.ts");
  const { replaceProductTaxonomy } = await import("../../lib/retail/product-taxonomy.server.ts");
  const fashionOrg = await prisma.organization.findUniqueOrThrow({ where: { slug: slugs[0] }, select: { id: true } });
  const fashionProduct = await prisma.product.findFirstOrThrow({ where: { slug: "r4-synthetic-avid", organizationId: fashionOrg.id }, select: { id: true, categoryId: true } });
  const secondaryCategory = await prisma.productCategory.findFirstOrThrow({ where: { organizationId: fashionOrg.id, slug: "caps" }, select: { id: true } });
  await replaceProductTaxonomy(fashionProduct.id, fashionOrg.id, { categoryIds: [secondaryCategory.id], tagNames: ["روزمره", "کفش"] });
  const secondaryFilter = await listPublicCatalogProducts({ organizationIdentifier: slugs[0], page: 1, limit: 20, category: "caps" });
  if (!secondaryFilter.products.some(product => product.slug === "r4-synthetic-avid")) throw new Error("Public catalog did not include a product in its additional category");
  const tagFilter = await listPublicCatalogProducts({ organizationIdentifier: slugs[0], page: 1, limit: 20, tag: "روزمره" });
  if (!tagFilter.products.some(product => product.slug === "r4-synthetic-avid")) throw new Error("Public catalog tag filter failed");
  const foreignTagFilter = await listPublicCatalogProducts({ organizationIdentifier: slugs[1], page: 1, limit: 20, tag: "روزمره" });
  if (foreignTagFilter.products.length) throw new Error("Cross-tenant tag filtering leaked a product");
  const otherOrg = await prisma.organization.findUniqueOrThrow({ where: { slug: slugs[1] }, select: { id: true } });
  const otherCategory = await prisma.productCategory.findFirstOrThrow({ where: { organizationId: otherOrg.id }, select: { id: true } });
  let crossTenantRejected = false;
  try { await prisma.productCategoryAssignment.create({ data: { productId: fashionProduct.id, categoryId: otherCategory.id, organizationId: fashionOrg.id } }); }
  catch (error) { crossTenantRejected = error?.code === "P2003"; }
  if (!crossTenantRejected) throw new Error("PostgreSQL composite foreign key did not reject a cross-tenant category assignment");
  const fashion = await getPublicCatalogProduct(slugs[0], "r4-synthetic-avid");
  const availableVariant = fashion.variants.find((variant) => variant.sku === "R4-SYN-SHOE-42-BK");
  if (availableVariant?.price.amount !== 600000 || availableVariant.orderable !== true) throw new Error("Fashion variant price/available stock mismatch");
  if (!availableVariant.options.some(option => option.key === "color" && option.valueText === "مشکی") || !availableVariant.options.some(option => option.key === "size" && option.valueNumber === 42)) throw new Error("Size/color variant attributes were not preserved in the public catalog");
  if (fashion.media.gallery.length !== 0 || !fashion.media.card?.includes("preview-fashion")) throw new Error("Tenant media eligibility was not applied");
  if ("organizationId" in fashion || "inventory" in availableVariant) throw new Error("Private catalog fields leaked");
  const filtered = await listPublicCatalogProducts({ organizationIdentifier: slugs[1], page: 1, limit: 50, filter: ["ram:12"] });
  if (filtered.products.length !== 1 || filtered.products[0].slug !== "r4-synthetic-nova-x") throw new Error("Structured attribute filtering failed");
  const priced = await listPublicCatalogProducts({ organizationIdentifier: slugs[1], page: 1, limit: 1, minPrice: 43000000, maxPrice: 50000000, sort: "price-desc" });
  if (priced.pagination.total !== 1 || priced.products[0]?.slug !== "r4-synthetic-nova-x") throw new Error("Price filter/sort/count did not apply to the full eligible tenant catalog");
  const laterPage = await listPublicCatalogProducts({ organizationIdentifier: slugs[1], page: 2, limit: 1 });
  if (laterPage.pagination.total !== 1 || laterPage.products.length !== 0) throw new Error("Pagination totals were not stable across pages");
  const categories = await listPublicCatalogCategories(slugs[0]);
  if (!categories.categories.some(category => category.slug === "sneakers")) throw new Error("Tenant category listing failed");
  if (categories.categories.find(category => category.slug === "caps")?.productCount !== 1) throw new Error("Public multi-category count did not include assigned products");
  const snapshot = await getPublicCatalogSnapshot(slugs[0]);
  if (snapshot.organization.theme !== "FASHION" || snapshot.organization.previewOnly !== false) throw new Error("Organization-scoped theme/preview config failed");
  let foreignProductHidden = false;
  try { await getPublicCatalogProduct(slugs[1], "r4-synthetic-avid"); } catch (error) { foreignProductHidden = error?.status === 404; }
  if (!foreignProductHidden) throw new Error("Cross-tenant product isolation failed");
  let restaurantRetailHidden = false;
  try { await getPublicCatalogProduct(slugs[2], "r4-synthetic-restaurant-compat"); } catch (error) { restaurantRetailHidden = error?.status === 404; }
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
  process.stdout.write(`Retail R4 ${mode} PASS on ${identity.database}, PostgreSQL ${identity.version}\n`);
} finally {
  await prisma.$disconnect();
}
