import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { PrismaClient, type UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TARGET_SLUG = "aka-shoes";
const TARGET_USERNAME = "ahmad";
const DEMO_PASSWORD = "123456";
const OWNER_ROLE: UserRole = "ADMIN";

let tenantId = "";
let userId = "";

describe("Aka Shoes owner provisioning regression", () => {
  before(async () => {
    const tenant = await prisma.organization.findUniqueOrThrow({ where: { slug: TARGET_SLUG } });
    tenantId = tenant.id;
    const user = await prisma.user.findUniqueOrThrow({ where: { name: TARGET_USERNAME } });
    userId = user.id;
  });

  after(async () => {
    // Intentionally no destructive cleanup: this validates the production account.
    await prisma.$disconnect();
  });

  it("tenant isolation: owner can only see aka-shoes membership", async () => {
    const memberships = await prisma.organizationMember.findMany({ where: { userId } });
    assert.equal(memberships.length, 1, "owner must have exactly one membership");
    assert.equal(memberships[0].organizationId, tenantId);
    assert.equal(memberships[0].role, OWNER_ROLE);
    assert.equal(memberships[0].isActive, true);
  });

  it("password is a bcrypt hash and verifies correctly", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    assert.ok(user.password.startsWith("$2b$") || user.password.startsWith("$2a$"), "password must be bcrypt hash");
    assert.equal(await bcrypt.compare(DEMO_PASSWORD, user.password), true);
    assert.equal(await bcrypt.compare("wrong", user.password), false);
  });

  it("plaintext password is never stored", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    assert.notEqual(user.password, DEMO_PASSWORD);
    assert.ok(!/^123456$/.test(user.password), "password must not be plaintext");
  });

  it("login with wrong password fails", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    assert.equal(await bcrypt.compare("not-123456", user.password), false);
  });

  it("duplicate-safe provisioning: exactly one user and one owner membership exist", async () => {
    const users = await prisma.user.count({ where: { name: TARGET_USERNAME } });
    assert.equal(users, 1, "no duplicate user");
    const members = await prisma.organizationMember.count({ where: { organizationId: tenantId, user: { name: TARGET_USERNAME } } });
    assert.equal(members, 1, "no duplicate owner membership");
  });

  it("idempotent: re-provisioning leaves exactly one owner", async () => {
    const hashed = await bcrypt.hash(DEMO_PASSWORD, 12);
    await prisma.user.upsert({
      where: { name: TARGET_USERNAME },
      update: {},
      create: { name: TARGET_USERNAME, password: hashed, role: OWNER_ROLE, isActive: true, isTeamMember: true, locale: "fa", theme: "system" },
    });
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: tenantId, userId } },
      update: { role: OWNER_ROLE, isActive: true },
      create: { organizationId: tenantId, organizationSlug: TARGET_SLUG, userId, role: OWNER_ROLE, isActive: true },
    });

    const users = await prisma.user.count({ where: { name: TARGET_USERNAME } });
    const members = await prisma.organizationMember.count({ where: { organizationId: tenantId, user: { name: TARGET_USERNAME } } });
    assert.equal(users, 1, "no duplicate user after re-provision");
    assert.equal(members, 1, "no duplicate owner membership after re-provision");
  });

  it("other tenants are untouched and ahmad does not leak", async () => {
    const sicily = await prisma.organization.findUniqueOrThrow({ where: { slug: "sicily" } });
    const leaked = await prisma.organizationMember.findMany({ where: { organizationId: sicily.id, user: { name: TARGET_USERNAME } } });
    assert.equal(leaked.length, 0, "ahmad must not leak into other tenants");
  });

  it("role is the project's real owner role (ADMIN)", async () => {
    const member = await prisma.organizationMember.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: tenantId, userId } },
    });
    assert.equal(member.role, OWNER_ROLE);
  });
});