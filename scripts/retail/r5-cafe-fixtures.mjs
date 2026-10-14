import { PrismaClient } from "@prisma/client";

const expectedDatabase = "bazarbaaz_retail_r5";
const cafeSlug = "cafe-leo";
const customerEmail = "r4-synthetic-customer@example.test";
const prisma = new PrismaClient();

async function verifyDatabase() {
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const url = new URL(process.env[key] ?? "");
    if (!/^postgres(ql)?:$/.test(url.protocol) || !["127.0.0.1", "localhost"].includes(url.hostname) ||
        url.port !== "55433" || url.pathname !== `/${expectedDatabase}`) {
      throw new Error(`${key} must target the guarded disposable R5 PostgreSQL database`);
    }
  }
  if (process.env.LOCAL_PRISMA_EXPECTED_PORT !== "55433" || process.env.RETAIL_R5_EXPECTED_DATABASE !== expectedDatabase) {
    throw new Error("Missing explicit R5 disposable database identity guard");
  }
  const [identity] = await prisma.$queryRaw`SELECT current_database() AS database, current_setting('server_version_num')::int AS version_num`;
  if (identity.database !== expectedDatabase || identity.version_num < 170000 || identity.version_num >= 180000) {
    throw new Error("Connected database is not the guarded PostgreSQL 17 R5 fixture database");
  }
}

async function seedCafeShop() {
  const customer = await prisma.user.findUnique({ where: { email: customerEmail }, select: { id: true } });
  if (!customer) throw new Error("The R4 synthetic customer fixture must be seeded first");

  const organization = await prisma.organization.upsert({
    where: { slug: cafeSlug },
    create: { slug: cafeSlug, name: "کافه لئو", type: "SHOP", locale: "fa", isActive: true, capabilitiesInitializedAt: new Date() },
    update: {},
  });
  await prisma.organizationCapability.upsert({
    where: { organizationId_key: { organizationId: organization.id, key: "SHOP" } },
    create: { organizationId: organization.id, key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
    update: { status: "ACTIVE", enabledAt: new Date() },
  });
  await prisma.organizationBranding.upsert({
    where: { organizationId: organization.id },
    create: { organizationId: organization.id, displayName: "کافه لئو", logoUrl: null, faviconUrl: null, appleTouchIconUrl: null, pwaIcon192Url: null, pwaIcon512Url: null, ogImageUrl: null, source: "BAZARBAAZ_MANAGED", externalSourceUrl: null, retailPresentationTheme: "GENERAL", retailPreviewOnly: false },
    update: { logoUrl: null, faviconUrl: null, appleTouchIconUrl: null, pwaIcon192Url: null, pwaIcon512Url: null, ogImageUrl: null, source: "BAZARBAAZ_MANAGED", externalSourceUrl: null, retailPresentationTheme: "GENERAL", retailPreviewOnly: false },
  });
  await prisma.customerIdentity.upsert({
    where: { organizationId_email: { organizationId: organization.id, email: customerEmail } },
    create: { organizationId: organization.id, userId: customer.id, email: customerEmail, metadata: { syntheticFixture: "retail-r5-cafe-native-shop" } },
    update: { userId: customer.id, metadata: { syntheticFixture: "retail-r5-cafe-native-shop" } },
  });
  const category = await prisma.productCategory.findFirst({ where: { organizationId: organization.id, slug: "r5-synthetic-drinks" } }) ??
    await prisma.productCategory.create({ data: { name: "[R5-SYNTHETIC] نوشیدنی", slug: "r5-synthetic-drinks", organizationId: organization.id, organizationSlug: organization.slug } });
  const existingProduct = await prisma.product.findFirst({ where: { organizationId: organization.id, slug: "r5-synthetic-cafe-coffee" }, select: { id: true } });
  if (!existingProduct) await prisma.product.create({ data: {
    name: "[R5-SYNTHETIC] قهوه آزمایشی",
    slug: "r5-synthetic-cafe-coffee",
    description: "کالای ساختگی برای آزمون مسیر فروشگاه بومی بازارباز.",
    basePrice: 125000,
    organizationId: organization.id,
    organizationSlug: organization.slug,
    categoryId: category.id,
    variants: { create: [{ name: "[R5-SYNTHETIC] یک فنجان", sku: "R5-SYN-CAFE-COFFEE-01", price: 125000, inventory: 5, allowBackOrder: false }] },
  } });
  await prisma.organizationIntegration.upsert({
    where: { organizationId_provider: { organizationId: organization.id, provider: "INOTI_USSD" } },
    create: { organizationId: organization.id, provider: "INOTI_USSD", status: "ACTIVE", healthStatus: "CONNECTED", codeName: "R5CAFE", credentialProfileKey: "local-env:inoti:cafe-leo", configuration: { paymentEnabled: true, orderStatusEnabled: true } },
    update: { status: "ACTIVE", healthStatus: "CONNECTED", codeName: "R5CAFE", credentialProfileKey: "local-env:inoti:cafe-leo", configuration: { paymentEnabled: true, orderStatusEnabled: true }, disabledAt: null, revokedAt: null },
  });
  await prisma.paymentSettings.upsert({
    where: { organizationSlug: organization.slug },
    create: { organizationSlug: organization.slug, settings: { retailR4: {
      bankTransferEnabled: false,
      cashEnabled: false,
      inotiUssdEnabled: true,
      bankCardNumber: null,
      bankAccountOwner: null,
      cashModes: ["COUNTER"],
      cashBeforeConfirmation: true,
    } } },
    update: { settings: { retailR4: {
      bankTransferEnabled: false,
      cashEnabled: false,
      inotiUssdEnabled: true,
      bankCardNumber: null,
      bankAccountOwner: null,
      cashModes: ["COUNTER"],
      cashBeforeConfirmation: true,
    } } },
  });
  await prisma.organizationInotiPaymentRouting.upsert({
    where: { organizationId: organization.id },
    create: { organizationId: organization.id, merchantAccountKey: "CAFE_LEO" },
    update: { merchantAccountKey: "CAFE_LEO" },
  });
  const routing = await prisma.organizationInotiPaymentRouting.findUniqueOrThrow({ where: { organizationId: organization.id } });
  if (routing.merchantAccountKey !== "CAFE_LEO") throw new Error("Cafe Leo fixture must use the dedicated test account policy");
  const [externalConnections, externalImports, externalSyncJobs] = await Promise.all([
    prisma.externalCatalogConnection.count({ where: { organizationId: organization.id } }),
    prisma.externalImportRun.count({ where: { organizationId: organization.id } }),
    prisma.externalCatalogSyncJob.count({ where: { organizationId: organization.id } }),
  ]);
  if (externalConnections || externalImports || externalSyncJobs) {
    throw new Error("Cafe Leo native Shop fixture must not create external catalog connections, imports, or sync jobs");
  }
  process.stdout.write(`${JSON.stringify({ event: "R5_CAFE_EXTERNAL_SYNC_ASSERTION", connections: 0, imports: 0, syncJobs: 0 })}\n`);
  const paymentSettings = await prisma.paymentSettings.findUniqueOrThrow({ where: { organizationSlug: organization.slug }, select: { settings: true } });
  const retailPolicy = paymentSettings.settings?.retailR4;
  if (!retailPolicy || typeof retailPolicy !== "object" || retailPolicy.inotiUssdEnabled !== true) {
    throw new Error("Cafe Leo fixture must persist the enabled R5 synthetic USSD policy");
  }
  const { diagnoseRetailInotiReadiness } = await import("../../lib/retail/inoti-readiness.server.ts");
  const readiness = await diagnoseRetailInotiReadiness(organization.id);
  process.stdout.write(`${JSON.stringify({ event: "R5_CAFE_INOTI_READINESS", ready: readiness.ready,
    mode: readiness.ready ? readiness.mode : null, reason: readiness.ready ? null : readiness.reason })}\n`);
  if (!readiness.ready || readiness.mode !== "SIMULATED") {
    throw new Error("Cafe Leo fixture requires the explicitly simulated loopback provider; readiness diagnostics are sanitized");
  }
  process.stdout.write(`R5 synthetic Cafe Leo Shop fixture created for ${organization.id}; no external provider or Cafe host used.\n`);
}

try {
  await verifyDatabase();
  if (process.argv[2] !== "seed") throw new Error("Mode must be seed");
  await seedCafeShop();
} finally {
  await prisma.$disconnect();
}
