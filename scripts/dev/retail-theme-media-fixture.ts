import "server-only";

import { createRequire } from "node:module";
import path from "node:path";
import { tmpdir } from "node:os";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createStoredImageFilename, writeStoredImage } from "@/lib/media-storage";
import { createRetailImageDerivatives } from "@/lib/retail/image-derivatives.server";
import { createMerchantRetailProduct, getMerchantRetailProduct, updateMerchantRetailProduct } from "@/lib/retail/merchant-catalog.server";

const EXPECTED_DATABASE = "retail_hero_test";
const EXPECTED_PORT = "55439";
const ORGANIZATION_SLUG = "codex-local-retail-theme-demo";
const ORGANIZATION_NAME = "[CODEX LOCAL TEST] Retail theme media demo";
const ADMIN_EMAIL = "retail-theme-demo@example.test";
const ADMIN_NAME = "retail-theme-demo@example.test";
const ADMIN_PASSWORD = "RetailThemeDemo!2026";
const PRODUCT_SLUG = "theme-card-synthetic-demo";

type Sharp = (input: Buffer | string) => {
  png(): { toBuffer(): Promise<Buffer> };
  webp(options: { quality: number; effort: number }): { toBuffer(): Promise<Buffer> };
};

function assertLocalDatabaseTarget() {
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    let url: URL;
    try { url = new URL(process.env[key] ?? ""); }
    catch { throw new Error(`${key} must be set to the isolated local fixture database.`); }
    if (!/^postgres(ql)?:$/.test(url.protocol) || url.hostname !== "127.0.0.1" || url.port !== EXPECTED_PORT || url.pathname !== `/${EXPECTED_DATABASE}`) {
      throw new Error(`${key} must target 127.0.0.1:${EXPECTED_PORT}/${EXPECTED_DATABASE}.`);
    }
  }
  if (process.env.LOCAL_PRISMA_EXPECTED_PORT !== EXPECTED_PORT || process.env.RETAIL_HERO_EXPECTED_DATABASE !== EXPECTED_DATABASE) {
    throw new Error("Set the explicit Retail hero local database identity guard before running this fixture.");
  }
  if (process.env.DATABASE_RUNTIME_ADAPTER !== "postgresql") throw new Error("Set DATABASE_RUNTIME_ADAPTER=postgresql for the isolated local PostgreSQL fixture.");
}

function loadSharp(): Sharp {
  const localRequire = createRequire(import.meta.url);
  const nextPackage = localRequire.resolve("next/package.json");
  return createRequire(nextPackage)("sharp") as Sharp;
}

function syntheticArtwork(background: string, accent: string, mark: string) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${background}"/><stop offset="1" stop-color="${accent}" stop-opacity=".34"/></linearGradient></defs>
    <rect width="1200" height="900" rx="64" fill="url(#bg)"/>
    <circle cx="870" cy="295" r="210" fill="${accent}" fill-opacity=".38"/>
    <circle cx="870" cy="295" r="135" fill="${background}" fill-opacity=".88"/>
    <path d="M220 625 445 360l165 170 100-112 235 207H220Z" fill="${accent}" fill-opacity=".76"/>
    <path d="M260 710h680" stroke="${mark}" stroke-width="16" stroke-linecap="round" stroke-opacity=".48"/>
    <text x="95" y="140" fill="${mark}" font-family="sans-serif" font-size="44" font-weight="700">LOCAL SYNTHETIC DEMO</text>
  </svg>`, "utf8");
}

async function createOwnedImage(organizationId: string, purpose: string, theme: { background: string; accent: string; mark: string }, format: "png" | "webp") {
  const suffix = `-${purpose}.${format}`;
  const existing = await prisma.image.findFirst({ where: { organizationId, filename: { endsWith: suffix } }, select: { id: true, url: true, filename: true, derivatives: true, purpose: true } });
  if (existing) {
    if (existing.purpose !== "retail-product") return prisma.image.update({ where: { id: existing.id }, data: { purpose: "retail-product" }, select: { id: true, url: true, filename: true, derivatives: true } });
    return existing;
  }
  const sharp = loadSharp();
  const svg = syntheticArtwork(theme.background, theme.accent, theme.mark);
  const original = format === "png" ? await sharp(svg).png().toBuffer() : await sharp(svg).webp({ quality: 90, effort: 4 }).toBuffer();
  const mimeType = format === "png" ? "image/png" : "image/webp";
  const filename = createStoredImageFilename(mimeType, purpose);
  const stored = await writeStoredImage(filename, original, "PUBLIC", organizationId);
  const derivatives = await createRetailImageDerivatives(original, organizationId);
  return prisma.image.create({ data: {
    url: stored.url,
    filename: stored.pathname,
    mimeType,
    sizeBytes: original.byteLength,
    derivatives: derivatives as unknown as Prisma.InputJsonValue,
    organizationId,
    access: "PUBLIC",
    purpose: "retail-product",
  }, select: { id: true, url: true, filename: true, derivatives: true } });
}

function assertFixtureOrganization(name: string) {
  if (!name.startsWith("[CODEX LOCAL TEST]")) throw new Error("The fixture organization slug already belongs to another record; refusing to modify it.");
}

async function verifyLocalDatabase() {
  assertLocalDatabaseTarget();
  const [identity] = await prisma.$queryRaw<Array<{ database: string; version: number }>>`SELECT current_database()::text AS database, current_setting('server_version_num')::int AS version`;
  if (identity.database !== EXPECTED_DATABASE || identity.version < 170000 || identity.version >= 180000) throw new Error("Connected database identity is not the guarded PostgreSQL 17 fixture target.");
  return identity;
}

/** Restore only the category's distinct synthetic theme images after acceptance tests. */
async function restoreCategoryThemeImages() {
  process.env.APPLICATION_STORAGE_ADAPTER = "persistent-disk";
  process.env.MEDIA_STORAGE_ROOT = path.join(tmpdir(), "codex-retail-theme-demo-media");
  const identity = await verifyLocalDatabase();
  const organization = await prisma.organization.findUnique({ where: { slug: ORGANIZATION_SLUG }, select: { id: true, slug: true, name: true } });
  if (!organization) throw new Error("The local Retail theme fixture organization is missing; refusing to create or alter fixture data.");
  assertFixtureOrganization(organization.name);
  const category = await prisma.productCategory.findFirst({
    where: { organizationId: organization.id, slug: "synthetic-theme-gallery", deletedAt: null },
    select: { id: true, name: true, image: true, darkImage: true },
  });
  if (!category || !category.name.startsWith("[LOCAL TEST]")) throw new Error("The marked local demo category is missing; refusing to create or alter fixture data.");

  const [lightMatches, darkMatches] = await Promise.all([
    prisma.image.findMany({ where: { organizationId: organization.id, access: "PUBLIC", filename: { endsWith: "-retail-theme-demo-category-light.png" } }, select: { id: true, url: true } }),
    prisma.image.findMany({ where: { organizationId: organization.id, access: "PUBLIC", filename: { endsWith: "-retail-theme-demo-category-dark.webp" } }, select: { id: true, url: true } }),
  ]);
  const [light] = lightMatches;
  const [dark] = darkMatches;
  if (lightMatches.length !== 1 || darkMatches.length !== 1 || !light || !dark || light.id === dark.id || light.url === dark.url) {
    throw new Error("Exactly one distinct owned PUBLIC light and dark category fixture image is required; refusing to alter the category.");
  }

  await prisma.productCategory.update({ where: { id: category.id }, data: { image: light.url, darkImage: dark.url } });
  const restored = await prisma.productCategory.findUniqueOrThrow({ where: { id: category.id }, select: { image: true, darkImage: true } });
  if (restored.image !== light.url || restored.darkImage !== dark.url) throw new Error("Category theme image restoration did not persist exactly.");
  process.stdout.write(`${JSON.stringify({ event: "RETAIL_THEME_CATEGORY_FIXTURE_RESTORED", database: identity.database, postgresMajor: Math.floor(identity.version / 10000), organization: organization.slug, categoryId: category.id, distinctOwnedPublicSources: true, productStateChanged: false, localOnly: true })}\n`);
}

async function seedFixture() {
  process.env.APPLICATION_STORAGE_ADAPTER = "persistent-disk";
  process.env.MEDIA_STORAGE_ROOT = path.join(tmpdir(), "codex-retail-theme-demo-media");
  const identity = await verifyLocalDatabase();
  let organization = await prisma.organization.findUnique({ where: { slug: ORGANIZATION_SLUG }, select: { id: true, slug: true, name: true } });
  if (organization) assertFixtureOrganization(organization.name);
  else organization = await prisma.organization.create({ data: {
    slug: ORGANIZATION_SLUG,
    name: ORGANIZATION_NAME,
    type: "SHOP",
    locale: "fa",
    isActive: true,
    capabilitiesInitializedAt: new Date(),
  }, select: { id: true, slug: true, name: true } });

  await prisma.organizationCapability.upsert({
    where: { organizationId_key: { organizationId: organization.id, key: "SHOP" } },
    create: { organizationId: organization.id, key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
    update: { status: "ACTIVE", enabledAt: new Date(), disabledAt: null },
  });
  await prisma.organizationBranding.upsert({
    where: { organizationId: organization.id },
    create: { organizationId: organization.id, displayName: ORGANIZATION_NAME, retailPresentationTheme: "FASHION", retailPreviewOnly: false },
    update: { displayName: ORGANIZATION_NAME, retailPresentationTheme: "FASHION", retailPreviewOnly: false },
  });

  let admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL }, select: { id: true, name: true, role: true, isTeamMember: true } });
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  if (admin) {
    if (admin.name !== ADMIN_NAME || admin.role !== "ADMIN") throw new Error("The synthetic test email already belongs to a different user; refusing to modify it.");
    admin = await prisma.user.update({ where: { id: admin.id }, data: { password: passwordHash, isActive: true, isTeamMember: true, locale: "fa", failedLoginAttempts: 0, lockedUntil: null }, select: { id: true, name: true, role: true, isTeamMember: true } });
  } else {
    admin = await prisma.user.create({ data: { name: ADMIN_NAME, email: ADMIN_EMAIL, password: passwordHash, role: "ADMIN", isActive: true, isTeamMember: true, locale: "fa" }, select: { id: true, name: true, role: true, isTeamMember: true } });
  }
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: organization.id, userId: admin.id } },
    create: { organizationId: organization.id, organizationSlug: organization.slug, userId: admin.id, role: "ADMIN", isActive: true },
    update: { organizationSlug: organization.slug, role: "ADMIN", isActive: true },
  });
  if (!admin.isTeamMember || admin.role !== "ADMIN" || !(await bcrypt.compare(ADMIN_PASSWORD, (await prisma.user.findUniqueOrThrow({ where: { id: admin.id }, select: { password: true } })).password))) {
    throw new Error("The local synthetic admin failed the normal bcrypt credential check.");
  }

  const image = async (purpose: string, colors: { background: string; accent: string; mark: string }, format: "png" | "webp") => createOwnedImage(organization.id, purpose, colors, format);
  const assets = {
    productLight: await image("retail-theme-demo-product-light", { background: "#fff8ee", accent: "#df9c64", mark: "#594033" }, "png"),
    productDark: await image("retail-theme-demo-product-dark", { background: "#202329", accent: "#e3aa78", mark: "#f6eadb" }, "webp"),
    ivoryLight: await image("retail-theme-demo-ivory-light", { background: "#fffaf0", accent: "#e7c783", mark: "#65513b" }, "png"),
    ivoryDark: await image("retail-theme-demo-ivory-dark", { background: "#262930", accent: "#d9b879", mark: "#f3e6cc" }, "webp"),
    blueLight: await image("retail-theme-demo-blue-light", { background: "#f0f7ff", accent: "#6c9ecb", mark: "#274560" }, "png"),
    blueDark: await image("retail-theme-demo-blue-dark", { background: "#202630", accent: "#85b1db", mark: "#e9f4ff" }, "webp"),
    cottonLight: await image("retail-theme-demo-cotton-light", { background: "#fff7f3", accent: "#c88484", mark: "#5b3c3c" }, "png"),
    cottonDark: await image("retail-theme-demo-cotton-dark", { background: "#292326", accent: "#d79898", mark: "#faeeee" }, "webp"),
    linenLight: await image("retail-theme-demo-linen-light", { background: "#f7f5ed", accent: "#92a081", mark: "#404a39" }, "png"),
    linenDark: await image("retail-theme-demo-linen-dark", { background: "#252924", accent: "#a4b18f", mark: "#eef2e8" }, "webp"),
    categoryLight: await image("retail-theme-demo-category-light", { background: "#fff6ec", accent: "#d39d70", mark: "#573c28" }, "png"),
    categoryDark: await image("retail-theme-demo-category-dark", { background: "#25252a", accent: "#dbb185", mark: "#fff1df" }, "webp"),
  };

  const categorySlug = "synthetic-theme-gallery";
  let category = await prisma.productCategory.findFirst({ where: { organizationId: organization.id, slug: categorySlug }, select: { id: true, name: true } });
  if (!category) category = await prisma.productCategory.create({ data: {
    name: "[LOCAL TEST] تصاویر روشن و تاریک",
    slug: categorySlug,
    description: "دسته‌بندی مصنوعی برای آزمون تصویر کارت در حالت روشن و تاریک.",
    image: assets.categoryLight.url,
    darkImage: assets.categoryDark.url,
    organizationId: organization.id,
    organizationSlug: organization.slug,
    isActive: true,
  }, select: { id: true, name: true } });
  else if (!category.name.startsWith("[LOCAL TEST]")) throw new Error("The demo category slug exists without the local fixture marker; refusing to modify it.");
  else category = await prisma.productCategory.update({ where: { id: category.id }, data: { image: assets.categoryLight.url, darkImage: assets.categoryDark.url, isActive: true }, select: { id: true, name: true } });

  const definitions = await Promise.all([
    prisma.retailAttributeDefinition.upsert({ where: { organizationId_key: { organizationId: organization.id, key: "color" } }, create: { organizationId: organization.id, key: "color", label: "رنگ", localizedLabels: { fa: "رنگ" }, scope: "VARIANT_OPTION", valueType: "ENUM", allowedValues: ["عاجی", "آبی"], isFilterable: true }, update: { label: "رنگ", allowedValues: ["عاجی", "آبی"], isActive: true } }),
    prisma.retailAttributeDefinition.upsert({ where: { organizationId_key: { organizationId: organization.id, key: "size" } }, create: { organizationId: organization.id, key: "size", label: "سایز", localizedLabels: { fa: "سایز" }, scope: "VARIANT_OPTION", valueType: "ENUM", allowedValues: ["S", "M"], isFilterable: true }, update: { label: "سایز", allowedValues: ["S", "M"], isActive: true } }),
    prisma.retailAttributeDefinition.upsert({ where: { organizationId_key: { organizationId: organization.id, key: "material" } }, create: { organizationId: organization.id, key: "material", label: "جنس", localizedLabels: { fa: "جنس" }, scope: "VARIANT_OPTION", valueType: "ENUM", allowedValues: ["کتان", "لینن"], isFilterable: true }, update: { label: "جنس", allowedValues: ["کتان", "لینن"], isActive: true } }),
  ]);
  const [colorDef, sizeDef, materialDef] = definitions;

  const existingProduct = await prisma.product.findFirst({ where: { organizationId: organization.id, slug: PRODUCT_SLUG }, select: { id: true, name: true, isActive: true } });
  if (existingProduct) {
    if (!existingProduct.name.startsWith("[LOCAL TEST]")) throw new Error("The demo product slug exists without the local fixture marker; refusing to modify it.");
    const context = { organizationId: organization.id, organizationSlug: organization.slug, actorUserId: admin.id, role: "ADMIN" as const };
    if (!existingProduct.isActive) await prisma.$transaction(tx => updateMerchantRetailProduct(context, admin.id, existingProduct.id, { isActive: true }, tx));
    const loaded = await getMerchantRetailProduct(context, existingProduct.id);
    process.stdout.write(`${JSON.stringify({ event: "RETAIL_THEME_FIXTURE_ALREADY_PRESENT", database: identity.database, postgresMajor: Math.floor(identity.version / 10000), organization: organization.slug, productId: loaded.id, variants: loaded.variants.length, appearanceGroups: loaded.gallerySettings?.appearanceGroups?.length ?? 0, localOnly: true })}\n`);
    printAccessDetails();
    return;
  }

  const context = { organizationId: organization.id, organizationSlug: organization.slug, actorUserId: admin.id, role: "ADMIN" as const };
  const created = await prisma.$transaction(tx => createMerchantRetailProduct(context, admin.id, {
    name: "[LOCAL TEST] کارت نمایشی پارچه‌ای",
    slug: PRODUCT_SLUG,
    description: "محصول کاملاً ساختگی با تصاویر برداری PNG/WebP برای آزمون کارت روشن و تاریک.",
    basePrice: 890000,
    categoryId: category.id,
    brand: "نمونه محلی",
    imageIds: [assets.productLight.id],
    attributes: [],
    variants: ["عاجی", "آبی"].flatMap(color => ["S", "M"].flatMap(size => ["کتان", "لینن"].map(material => ({
      name: `${color} · ${size} · ${material}`,
      sku: `LOCAL-THEME-${color === "عاجی" ? "IV" : "BL"}-${size}-${material === "کتان" ? "CT" : "LN"}`,
      price: 890000,
      inventory: 4,
      allowBackOrder: false,
      options: [
        { definitionId: colorDef.id, value: color },
        { definitionId: sizeDef.id, value: size },
        { definitionId: materialDef.id, value: material },
      ],
      imageIds: [],
    })))),
    trackInventory: true,
    gallerySettings: { version: 1, productImageIds: [assets.productLight.id], colors: [] },
  }, tx));
  const productId = created.id;
  const firstVariant = created.variants[0];
  const appearanceSettings = {
    version: 1 as const,
    productImageIds: [assets.productLight.id],
    colors: [],
    appearance: { lightImageId: assets.productLight.id, darkImageId: assets.productDark.id },
    appearanceGroups: [
      { definitionId: colorDef.id, value: "عاجی", lightImageId: assets.ivoryLight.id, darkImageId: assets.ivoryDark.id },
      { definitionId: colorDef.id, value: "آبی", lightImageId: assets.blueLight.id, darkImageId: assets.blueDark.id },
      { definitionId: materialDef.id, value: "کتان", lightImageId: assets.cottonLight.id, darkImageId: assets.cottonDark.id },
      { definitionId: materialDef.id, value: "لینن", lightImageId: assets.linenLight.id, darkImageId: assets.linenDark.id },
    ],
    variantAppearances: firstVariant ? [{ variantId: firstVariant.id, lightImageId: assets.ivoryLight.id, darkImageId: assets.ivoryDark.id }] : [],
  };
  await prisma.$transaction(tx => updateMerchantRetailProduct(context, admin.id, productId, { gallerySettings: appearanceSettings, isActive: true }, tx));
  const loaded = await getMerchantRetailProduct(context, productId);
  const refs = [loaded.gallerySettings?.appearance?.lightImageId, loaded.gallerySettings?.appearance?.darkImageId,
    ...(loaded.gallerySettings?.appearanceGroups ?? []).flatMap(group => [group.lightImageId, group.darkImageId]),
    ...(loaded.gallerySettings?.variantAppearances ?? []).flatMap(pair => [pair.lightImageId, pair.darkImageId])].filter((id): id is string => Boolean(id));
  const expectedIds = [assets.productLight.id, assets.productDark.id, assets.ivoryLight.id, assets.ivoryDark.id, assets.blueLight.id, assets.blueDark.id,
    assets.cottonLight.id, assets.cottonDark.id, assets.linenLight.id, assets.linenDark.id];
  if (loaded.gallerySettings?.appearanceGroups?.length !== 4 || loaded.gallerySettings.variantAppearances?.length !== 1 || new Set(refs).size !== 10 || expectedIds.some(id => !refs.includes(id))) {
    throw new Error("Merchant service appearance save/read roundtrip did not preserve every expected owned media reference.");
  }
  const mediaCount = await prisma.image.count({ where: { organizationId: organization.id, filename: { contains: "retail-theme-demo-" }, purpose: "retail-product", access: "PUBLIC" } });
  process.stdout.write(`${JSON.stringify({ event: "RETAIL_THEME_FIXTURE_READY", database: identity.database, postgresMajor: Math.floor(identity.version / 10000), organization: organization.slug, productId: loaded.id, variants: loaded.variants.length, appearanceGroups: loaded.gallerySettings.appearanceGroups.length, variantOverrides: loaded.gallerySettings.variantAppearances.length, ownedPublicMedia: mediaCount, productAppearanceRefs: refs.length, saveReadRoundtrip: "PASSED", localOnly: true, externalMedia: false })}\n`);
  printAccessDetails();
}

function printAccessDetails() {
  process.stdout.write(`LOCAL_TEST_URL=http://127.0.0.1:3027/fa/retail/${ORGANIZATION_SLUG}\n`);
  process.stdout.write(`LOCAL_TEST_EMAIL=${ADMIN_EMAIL}\n`);
  process.stdout.write(`LOCAL_TEST_PASSWORD=${ADMIN_PASSWORD}\n`);
}

async function main() {
  try {
    const command = process.argv[2];
    if (command === "seed") await seedFixture();
    else if (command === "restore-category") await restoreCategoryThemeImages();
    else throw new Error("Usage: pnpm exec tsx --require=./scripts/e2e/register-server-only.cjs scripts/dev/retail-theme-media-fixture.ts <seed|restore-category>");
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : "Local Retail theme fixture failed.");
  process.exitCode = 1;
});
