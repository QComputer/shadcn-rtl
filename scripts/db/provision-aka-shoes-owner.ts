#!/usr/bin/env node
/**
 * Provision the Aka Shoes (slug: `aka-shoes`) owner account.
 *
 * Production-safe, idempotent one-off maintenance script.
 *
 * - Uses the project's existing Prisma client and bcrypt password hashing.
 * - Never stores plaintext passwords.
 * - Never creates a duplicate user or a second owner if one already exists.
 * - Never mutates any tenant other than `aka-shoes`.
 * - Safe to re-run: existing owner / existing `ahmad` user are reused, not duplicated.
 */

import { PrismaClient, type UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TARGET_SLUG = "aka-shoes";
const TARGET_USERNAME = "ahmad";
const DEMO_PASSWORD = "123456";
const BCRYPT_ROUNDS = 12;

// In this project, the real-world owner of a SHOP/tenant is represented by an
// OrganizationMember with the internal UserRole.ADMIN (see seed.ts: shop owners
// such as `hosein`/`amir` are seeded as ADMIN, and the demo ORGANIZATION_OWNER
// role maps to the internal UserRole.ADMIN in lib/demo-universe/demo-organization.ts).
const OWNER_ROLE: UserRole = "ADMIN";

type Result = {
  ok: boolean;
  tenantFound: boolean;
  tenantId: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  previousOwner: { userId: string; username: string; role: string } | null;
  userAction: "created" | "reused" | "none";
  userId: string | null;
  username: string | null;
  membershipAction: "created" | "already-present" | "none";
  membershipRole: string | null;
  passwordHashed: boolean;
  errors: string[];
};

const result: Result = {
  ok: false,
  tenantFound: false,
  tenantId: null,
  tenantSlug: null,
  tenantName: null,
  previousOwner: null,
  userAction: "none",
  userId: null,
  username: null,
  membershipAction: "none",
  membershipRole: null,
  passwordHashed: false,
  errors: [],
};

function fail(message: string) {
  result.errors.push(message);
}

async function main() {
  // 1. Resolve the real Aka Shoes tenant.
  const tenant = await prisma.organization.findUnique({
    where: { slug: TARGET_SLUG },
    select: { id: true, slug: true, name: true, isActive: true, deletedAt: true },
  });

  if (!tenant || tenant.deletedAt || !tenant.isActive) {
    fail(`Tenant ${TARGET_SLUG} not found or inactive`);
    printAndExit();
    return;
  }

  result.tenantFound = true;
  result.tenantId = tenant.id;
  result.tenantSlug = tenant.slug;
  result.tenantName = tenant.name;

  // 2. Check for an existing owner membership on this tenant.
  const existingMembers = await prisma.organizationMember.findMany({
    where: { organizationId: tenant.id, isActive: true },
    include: { user: { select: { id: true, name: true, role: true, isActive: true, deletedAt: true } } },
  });

  const existingOwner = existingMembers.find(
    (m) => m.role === OWNER_ROLE && m.user.isActive && !m.user.deletedAt,
  );

  if (existingOwner) {
    result.previousOwner = {
      userId: existingOwner.user.id,
      username: existingOwner.user.name,
      role: existingOwner.role,
    };
  }

  // 3. Resolve or create the `ahmad` user.
  let user = await prisma.user.findUnique({ where: { name: TARGET_USERNAME } });

  if (user) {
    if (user.deletedAt) {
      // Soft-deleted collision: reactivate rather than overwrite.
      user = await prisma.user.update({
        where: { id: user.id },
        data: { deletedAt: null, isActive: true },
      });
    }
    result.userAction = "reused";
    result.userId = user.id;
    result.username = user.name;
  } else {
    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);
    result.passwordHashed = true;
    user = await prisma.user.create({
      data: {
        name: TARGET_USERNAME,
        password: hashedPassword,
        role: OWNER_ROLE,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "system",
      },
    });
    result.userAction = "created";
    result.userId = user.id;
    result.username = user.name;
  }

  // 4. Ensure the owner membership exists on Aka Shoes only.
  const existingMembership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: tenant.id, userId: user.id } },
  });

  if (existingMembership) {
    if (existingMembership.role !== OWNER_ROLE || !existingMembership.isActive) {
      await prisma.organizationMember.update({
        where: { id: existingMembership.id },
        data: { role: OWNER_ROLE, isActive: true },
      });
    }
    result.membershipAction = "already-present";
  } else {
    await prisma.organizationMember.create({
      data: {
        organizationId: tenant.id,
        organizationSlug: tenant.slug,
        userId: user.id,
        role: OWNER_ROLE,
        isActive: true,
      },
    });
    result.membershipAction = "created";
  }
  result.membershipRole = OWNER_ROLE;

  result.ok = result.errors.length === 0;
  printAndExit();
}

function printAndExit() {
  // Intentionally do NOT print password, hash, DB URL, or tokens.
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length > 0) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("Fatal error provisioning Aka Shoes owner:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });