import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  const orgCount = await prisma.organization.count();
  const sicily = await prisma.organization.findUnique({
    where: { slug: "sicily" },
  });

  if (!sicily) {
    console.error("Sicily organization not found!");
    return;
  }

  const catCount = await prisma.productCategory.count({
    where: { organizationId: sicily.id },
  });

  const prodCount = await prisma.product.count({
    where: { organizationId: sicily.id },
  });

  const activeProdCount = await prisma.product.count({
    where: { organizationId: sicily.id, isActive: true },
  });

  const inactiveProdCount = await prisma.product.count({
    where: { organizationId: sicily.id, isActive: false },
  });

  const activeZeroPrice = await prisma.product.count({
    where: {
      organizationId: sicily.id,
      isActive: true,
      basePrice: { lte: 0 },
    },
  });

  const paymentSettings = await prisma.paymentSettings.findMany({
    where: { organizationSlug: sicily.slug },
  });

  const domains = await prisma.organizationDomain.findMany({
    where: { organizationId: sicily.id },
  });

  const categories = await prisma.productCategory.findMany({
    where: { organizationId: sicily.id },
    select: { slug: true, name: true, sortOrder: true, image: true },
    orderBy: { sortOrder: "asc" },
  });

  const products = await prisma.product.findMany({
    where: { organizationId: sicily.id },
    select: { sku: true, name: true, isActive: true, basePrice: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });

  const snapshot = {
    orgCount,
    sicilyName: sicily.name,
    sicilySlug: sicily.slug,
    sicilyEmail: sicily.email,
    catCount,
    prodCount,
    activeProdCount,
    inactiveProdCount,
    activeZeroPrice,
    paymentSettingsCount: paymentSettings.length,
    domainCount: domains.length,
    categorySlugs: categories.map((c) => c.slug),
    categoryNames: categories.map((c) => c.name),
    productSkus: products.map((p) => p.sku),
    productActiveMap: products.map((p) => ({
      sku: p.sku,
      isActive: p.isActive,
    })),
  };

  const runLabel = process.argv[2] || "run";
  const outPath = path.join(
    ".tmp",
    `seed-state-${runLabel}.json`,
  );
  fs.mkdirSync(".tmp", { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.log(`=== ${runLabel.toUpperCase()} ===`);
  console.log("organizationCount:", orgCount);
  console.log("sicily.name:", sicily.name);
  console.log("sicily.slug:", sicily.slug);
  console.log("categoryCount:", catCount);
  console.log("productCount:", prodCount);
  console.log("activeProducts:", activeProdCount);
  console.log("inactiveProducts:", inactiveProdCount);
  console.log("activeZeroPrice:", activeZeroPrice);
  console.log("paymentSettingsCount:", paymentSettings.length);
  console.log("domains:", domains.map((d) => `${d.domain} (${d.status})`));
  console.log("categorySlugs:", snapshot.categorySlugs);
  console.log("inactive products:", snapshot.productActiveMap.filter((p) => !p.isActive).map((p) => p.sku));
  console.log(`Snapshot written to ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
