import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const databaseName = process.env.BUTTON_VARIANTS_EXPECTED_DATABASE || "bb_button_variants_rsc";
const port = process.env.LOCAL_PRISMA_EXPECTED_PORT || "55439";
const expectedPort = process.env.LOCAL_PRISMA_EXPECTED_PORT;
const expectedDatabase = process.env.BUTTON_VARIANTS_EXPECTED_DATABASE;
const slugs = ["bb-rsc-shop-synthetic", "bb-rsc-appointment-synthetic"];
const prisma = new PrismaClient();

function assertDisposableTarget() {
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const url = new URL(process.env[key] ?? "");
    assert.match(url.protocol, /^postgres(ql)?:$/);
    assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), `${key} must use loopback PostgreSQL`);
    assert.equal(url.port, port, `${key} must use the isolated test port`);
    assert.equal(url.pathname, `/${databaseName}`, `${key} must use the exact synthetic database`);
  }
  assert.equal(expectedPort, port);
  assert.equal(expectedDatabase, databaseName);
}

async function verifyDatabase() {
  const [identity] = await prisma.$queryRaw`SELECT current_database() AS database, current_setting('server_version_num')::int AS version_num`;
  assert.equal(identity.database, databaseName);
  assert.ok(identity.version_num >= 170000 && identity.version_num < 180000, "PostgreSQL 17 fixture required");
}

async function cleanup() {
  const orgs = await prisma.organization.findMany({ where: { slug: { in: slugs } }, select: { id: true } });
  const ids = orgs.map(({ id }) => id);
  if (ids.length === 0) return;
  await prisma.service.deleteMany({ where: { organizationId: { in: ids } } });
  await prisma.product.deleteMany({ where: { organizationId: { in: ids } } });
  await prisma.serviceCategory.deleteMany({ where: { organizationId: { in: ids } } });
  await prisma.productCategory.deleteMany({ where: { organizationId: { in: ids } } });
  await prisma.organizationCapability.deleteMany({ where: { organizationId: { in: ids } } });
  await prisma.paymentSettings.deleteMany({ where: { organizationSlug: { in: slugs } } });
  await prisma.organization.deleteMany({ where: { id: { in: ids } } });
}

async function seed() {
  await cleanup();
  const [shop, appointment] = await Promise.all([
    prisma.organization.create({ data: { slug: slugs[0], name: "[SYNTHETIC] Button variant shop", type: "SHOP", locale: "fa", isActive: true, capabilitiesInitializedAt: new Date() } }),
    prisma.organization.create({ data: { slug: slugs[1], name: "[SYNTHETIC] Button variant appointments", type: "APPOINTMENT", locale: "fa", isActive: true, capabilitiesInitializedAt: new Date() } }),
  ]);
  await prisma.organizationCapability.createMany({ data: [
    { organizationId: shop.id, key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
    { organizationId: appointment.id, key: "APPOINTMENT", status: "ACTIVE", enabledAt: new Date() },
  ] });
  const productCategory = await prisma.productCategory.create({ data: { organizationId: shop.id, organizationSlug: shop.slug, name: "Synthetic products", slug: "rsc-products" } });
  const serviceCategory = await prisma.serviceCategory.create({ data: { organizationId: appointment.id, name: "Synthetic services", slug: "rsc-services" } });
  await prisma.product.createMany({ data: Array.from({ length: 25 }, (_, index) => ({
    organizationId: shop.id,
    organizationSlug: shop.slug,
    categoryId: productCategory.id,
    name: `[SYNTHETIC] Pagination product ${index + 1}`,
    slug: `bb-rsc-product-${index + 1}`,
    basePrice: 1000 + index,
    isActive: true,
    trackInventory: false,
  })) });
  await prisma.paymentSettings.upsert({
    where: { organizationSlug: shop.slug },
    create: { organizationSlug: shop.slug, settings: { retailR4: {
      bankTransferEnabled: true,
      cashEnabled: true,
      inotiUssdEnabled: false,
      bankCardNumber: "1234567890123456",
      bankAccountOwner: "Synthetic Test Store",
      cashModes: ["COUNTER"],
      cashBeforeConfirmation: true,
      paymentDeadlinesMinutes: { bankTransfer: 1440, cash: 2880, inotiUssd: 15 },
    } } },
    update: { settings: { retailR4: {
      bankTransferEnabled: true,
      cashEnabled: true,
      inotiUssdEnabled: false,
      bankCardNumber: "1234567890123456",
      bankAccountOwner: "Synthetic Test Store",
      cashModes: ["COUNTER"],
      cashBeforeConfirmation: true,
      paymentDeadlinesMinutes: { bankTransfer: 1440, cash: 2880, inotiUssd: 15 },
    } } },
  });
  await prisma.service.createMany({ data: Array.from({ length: 25 }, (_, index) => ({
    organizationId: appointment.id,
    categoryId: serviceCategory.id,
    name: `[SYNTHETIC] Pagination service ${index + 1}`,
    slug: `bb-rsc-service-${index + 1}`,
    price: 1000 + index,
    duration: 30,
    isActive: true,
  })) });
}

try {
  assertDisposableTarget();
  await verifyDatabase();
  const action = process.argv[2];
  if (action === "seed") await seed();
  else if (action === "cleanup") await cleanup();
  else throw new Error("Expected seed or cleanup");
  process.stdout.write(`RSC button fixture ${action} passed in disposable ${databaseName}\n`);
} finally {
  await prisma.$disconnect();
}
