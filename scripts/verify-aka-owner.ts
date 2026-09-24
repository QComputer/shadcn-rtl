import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUniqueOrThrow({ where: { name: "ahmad" } });
  console.log("User id:", user.id);
  console.log("User name:", user.name);
  console.log("User role:", user.role);
  console.log("isActive:", user.isActive, "isTeamMember:", user.isTeamMember);
  console.log("password prefix:", user.password.slice(0, 7));
  console.log("password length:", user.password.length);

  const ok = await bcrypt.compare("123456", user.password);
  console.log("verify('123456'):", ok);
  const bad = await bcrypt.compare("wrong", user.password);
  console.log("verify('wrong'):", bad);

  const members = await prisma.organizationMember.findMany({ where: { userId: user.id }, include: { organization: { select: { slug: true, name: true, isActive: true } } } });
  console.log("\nMemberships:");
  for (const m of members) {
    console.log(JSON.stringify({ org: m.organization?.slug, role: m.role, isActive: m.isActive }));
  }

  // tenant isolation check: ahmad should only see aka-shoes
  const aka = await prisma.organization.findUnique({ where: { slug: "aka-shoes" } });
  const akaMembers = await prisma.organizationMember.findMany({ where: { organizationId: aka!.id } });
  console.log("\naka-shoes members count:", akaMembers.length);
  for (const m of akaMembers) {
    const u = await prisma.user.findUnique({ where: { id: m.userId }, select: { name: true, role: true } });
    console.log(JSON.stringify({ username: u?.name, role: m.role }));
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });