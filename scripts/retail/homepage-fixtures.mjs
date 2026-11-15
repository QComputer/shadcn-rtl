import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const slug = "retail-r3-fashion-preview";
const prefix = "home-perf-";
function guard() {
  const u = new URL(process.env.DATABASE_URL ?? "");
  if (u.protocol !== "postgresql:" || !["127.0.0.1", "localhost"].includes(u.hostname) || u.port !== "55432" || u.pathname !== "/bazarbaaz_retail_r3" || process.env.RETAIL_R3_EXPECTED_DATABASE !== "bazarbaaz_retail_r3") throw new Error("Refusing homepage fixture operation outside disposable R3 PostgreSQL");
}
async function tenant() {
  const org = await prisma.organization.findUnique({ where: { slug }, select: { id: true, slug: true } });
  if (!org) throw new Error("R3 fashion tenant must be seeded first");
  const category = await prisma.productCategory.findFirst({ where: { organizationId: org.id, slug: "sneakers" }, select: { id: true } });
  if (!category) throw new Error("R3 fashion category missing");
  return { org, category };
}
try {
  guard();
  const mode = process.argv[2] ?? "seed";
  const { org, category } = await tenant();
  if (mode === "cleanup") {
    await prisma.product.deleteMany({ where: { organizationId: org.id, slug: { startsWith: prefix } } });
    process.stdout.write("Homepage synthetic fixture cleanup PASS (24 rows)\n");
  } else if (mode === "seed") {
    await prisma.product.deleteMany({ where: { organizationId: org.id, slug: { startsWith: prefix } } });
    await prisma.product.createMany({ data: Array.from({ length: 24 }, (_, i) => ({
      name: `Homepage Acceptance Product ${String(i + 2).padStart(2, "0")}`,
      slug: `${prefix}${String(i + 2).padStart(2, "0")}`,
      basePrice: 100000 + i,
      organizationId: org.id,
      organizationSlug: org.slug,
      categoryId: category.id,
      isActive: true,
      sortOrder: i + 1,
    })) });
    const count = await prisma.product.count({ where: { organizationId: org.id, slug: { startsWith: prefix }, isActive: true, deletedAt: null } });
    if (count !== 24) throw new Error(`Expected 24 additional products, got ${count}`);
    process.stdout.write(`Homepage fixture PASS: tenant=${slug}, total=25 (1 R3 base + ${count} deterministic products)\n`);
  } else throw new Error("Mode must be seed or cleanup");
} finally { await prisma.$disconnect(); }
