import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TENANT_A = "retail-r3-fashion-preview";
const TENANT_B = "retail-r3-mobile-preview";
const TENANT_C = "retail-home-empty-preview";
const PRODUCT_PREFIX = "perf-home-";

function assertDisposableDatabaseTarget() {
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const url = new URL(process.env[key] ?? "");
    if (!/^postgres(ql)?:$/.test(url.protocol) || !["127.0.0.1", "localhost"].includes(url.hostname)) {
      throw new Error(`${key} must use loopback PostgreSQL for homepage fixtures`);
    }
    if (url.port !== "55432" || url.pathname !== "/bazarbaaz_retail_r3") {
      throw new Error(`${key} must target bazarbaaz_retail_r3 on port 55432`);
    }
  }
  if (process.env.LOCAL_PRISMA_EXPECTED_PORT !== "55432" || process.env.RETAIL_R3_EXPECTED_DATABASE !== "bazarbaaz_retail_r3") {
    throw new Error("Disposable PostgreSQL identity guard is missing");
  }
}

async function assertLiveDatabaseIdentity() {
  const [identity] = await prisma.$queryRaw`SELECT current_database() AS database, inet_server_addr()::text AS address, inet_server_port() AS port`;
  // The GitHub Actions PostgreSQL service is reached through the runner's loopback
  // port mapping, while inet_server_addr() reports its private Docker bridge IP.
  const localServiceAddress = ["127.0.0.1", "::1"].includes(identity.address) || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(identity.address);
  if (identity.database !== "bazarbaaz_retail_r3" || identity.port !== 5432 || !localServiceAddress) {
    throw new Error(`Refusing homepage fixture mutation against ${JSON.stringify(identity)}`);
  }
  return identity;
}

async function findTenant(slug) {
  const tenant = await prisma.organization.findFirst({ where: { slug, isActive: true, deletedAt: null }, select: { id: true, slug: true } });
  if (!tenant) throw new Error(`Expected R3 tenant ${slug} to exist; seed R3 fixtures first`);
  return tenant;
}

async function cleanupFixtures() {
  const tenantA = await prisma.organization.findFirst({ where: { slug: TENANT_A }, select: { id: true } });
  if (tenantA) {
    await prisma.product.deleteMany({ where: { organizationId: tenantA.id, slug: { startsWith: PRODUCT_PREFIX } } });
    await prisma.productCategory.deleteMany({ where: { organizationId: tenantA.id, slug: "perf-home-accessories" } });
  }
  const tenantB = await prisma.organization.findFirst({ where: { slug: TENANT_B }, select: { id: true } });
  if (tenantB) await prisma.product.deleteMany({ where: { organizationId: tenantB.id, slug: { startsWith: PRODUCT_PREFIX } } });
  const tenantC = await prisma.organization.findFirst({ where: { slug: TENANT_C }, select: { id: true } });
  if (tenantC) {
    await prisma.product.deleteMany({ where: { organizationId: tenantC.id } });
    await prisma.productCategory.deleteMany({ where: { organizationId: tenantC.id } });
    await prisma.organizationCapability.deleteMany({ where: { organizationId: tenantC.id } });
    await prisma.organizationBranding.deleteMany({ where: { organizationId: tenantC.id } });
    await prisma.organization.delete({ where: { id: tenantC.id } });
  }
}

async function addProduct(tenant, category, index, suffix = "a") {
  const slug = `${PRODUCT_PREFIX}${suffix}-${String(index).padStart(2, "0")}`;
  return prisma.product.create({ data: {
    name: `Perf ${suffix.toUpperCase()} ${String(index).padStart(2, "0")}`,
    slug,
    description: `Synthetic public catalog item ${slug}`,
    basePrice: 1000 + index,
    organizationId: tenant.id,
    organizationSlug: tenant.slug,
    categoryId: category.id,
    sortOrder: index,
    variants: { create: [{ name: "Default", sku: `${slug}-sku`, price: 1000 + index, inventory: 20 }] },
  }, select: { id: true, slug: true, name: true, sortOrder: true } });
}

async function seed() {
  await cleanupFixtures();
  const tenantA = await findTenant(TENANT_A);
  const tenantB = await findTenant(TENANT_B);
  const categoryOne = await prisma.productCategory.findFirst({ where: { organizationId: tenantA.id, slug: "sneakers", isActive: true, deletedAt: null }, select: { id: true } });
  if (!categoryOne) throw new Error("R3 Tenant A sneakers category is missing");
  const categoryTwo = await prisma.productCategory.create({ data: { name: "لوازم نمونه", slug: "perf-home-accessories", organizationId: tenantA.id, organizationSlug: tenantA.slug, sortOrder: 2 } });
  const categoryB = await prisma.productCategory.findFirst({ where: { organizationId: tenantB.id, slug: "smartphones", isActive: true, deletedAt: null }, select: { id: true } });
  if (!categoryB) throw new Error("R3 Tenant B smartphones category is missing");
  const createdA = [];
  for (let i = 1; i <= 24; i += 1) createdA.push(await addProduct(tenantA, i % 2 ? categoryOne : categoryTwo, i));
  const createdB = [];
  for (let i = 1; i <= 4; i += 1) createdB.push(await addProduct(tenantB, categoryB, i, "b"));
  const tenantC = await prisma.organization.create({ data: { slug: TENANT_C, name: "فروشگاه خالی آزمایشی", type: "SHOP", locale: "fa", isActive: true, capabilitiesInitializedAt: new Date() } });
  await prisma.organizationCapability.create({ data: { organizationId: tenantC.id, key: "SHOP", status: "ACTIVE", enabledAt: new Date() } });
  await prisma.organizationBranding.create({ data: { organizationId: tenantC.id, displayName: tenantC.name, retailPresentationTheme: "FASHION", retailPreviewOnly: true } });
  await prisma.productCategory.create({ data: { name: "دسته خالی", slug: "empty-category", organizationId: tenantC.id, organizationSlug: tenantC.slug } });
  const result = { tenants: { A: tenantA.slug, B: tenantB.slug, C: tenantC.slug }, extraProducts: { A: createdA, B: createdB }, expectedTotalA: createdA.length + 1 };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  assertDisposableDatabaseTarget();
  const identity = await assertLiveDatabaseIdentity();
  const command = process.argv[2] ?? "seed";
  if (command === "seed") await seed();
  else if (command === "cleanup") await cleanupFixtures();
  else throw new Error("Command must be seed or cleanup");
  process.stdout.write(`Homepage fixtures ${command} complete on ${identity.database}@${identity.address}:${identity.port}\n`);
} finally {
  await prisma.$disconnect();
}
