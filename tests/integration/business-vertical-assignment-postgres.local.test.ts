import assert from "node:assert/strict";
import { after, before, test, mock } from "node:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

let authSession: { user: { id: string; role: string; organizationId?: string | null; name?: string | null; email?: string | null } } | null = null;
mock.module(pathToFileURL(resolve("lib/auth.ts")).href, { namedExports: { auth: async () => authSession } });
mock.module("next/cache", { namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined } });

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
let organizationId: string;
let rollbackOrganizationId: string;
let concurrentOrganizationId: string;
let superAdminId: string;
let adminId: string;
let managerId: string;
let superAdminRoute: typeof import("../../app/api/dashboard/organizations/[organizationId]/vertical/route").PATCH;
let tenantOrganizationRoute: typeof import("../../app/api/organizations/[id]/route").PATCH;
let organizationService: typeof import("@/lib/services/organization.service").organizationService;

function verticalRequest(id: string, vertical: unknown, options: { origin?: string | null; body?: unknown } = {}) {
  const body = options.body ?? { vertical };
  const headers: Record<string, string> = { "content-type": "application/json" };
  const url = `http://localhost:${process.env.LOCAL_PRISMA_EXPECTED_PORT}/api/dashboard/organizations/${id}/vertical`;
  const origin = Object.hasOwn(options, "origin") ? options.origin : new URL(url).origin;
  if (origin) headers.origin = origin;
  const request = new NextRequest(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  return request;
}

function tenantRequest(id: string, body: unknown) {
  return new NextRequest(`http://127.0.0.1:${process.env.LOCAL_PRISMA_EXPECTED_PORT}/api/organizations/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function makeOrganization(label: string) {
  return prisma.organization.create({
    data: { name: `G4 ${label} ${suffix}`, slug: `g4-${label}-${suffix}`.slice(0, 60), type: "SHOP" },
    select: { id: true, slug: true, vertical: true },
  });
}

async function makeUser(label: string, role: "SUPER_ADMIN" | "CUSTOMER") {
  return prisma.user.create({
    data: {
      name: `g4-${label}-${suffix}`,
      email: `g4-${label}-${suffix}@example.invalid`,
      password: "g4-disposable-test-only",
      role,
    },
    select: { id: true, name: true, email: true },
  });
}

async function assignAsPlatformAdmin(id: string, vertical: string) {
  authSession = { user: { id: superAdminId, role: "SUPER_ADMIN", name: "G4 Test Platform Admin" } };
  return superAdminRoute(verticalRequest(id, vertical, { origin: `http://localhost:${process.env.LOCAL_PRISMA_EXPECTED_PORT}` }), {
    params: Promise.resolve({ organizationId: id }),
  });
}

async function waitForConcurrentUpdateStatements() {
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    const rows = await prisma.$queryRaw<Array<{ pid: number }>>`
      SELECT pid::int AS pid
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND query ILIKE '%UPDATE%Organization%'
    `;
    const pids = [...new Set(rows.map((row) => row.pid))];
    if (pids.length >= 2) return pids;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Two overlapping PostgreSQL Organization update statements were not observed");
}

before(async () => {
  ({ PATCH: superAdminRoute } = await import("../../app/api/dashboard/organizations/[organizationId]/vertical/route"));
  ({ PATCH: tenantOrganizationRoute } = await import("../../app/api/organizations/[id]/route"));
  ({ organizationService } = await import("@/lib/services/organization.service"));

  const main = await makeOrganization("main");
  const rollback = await makeOrganization("audit-rollback");
  const concurrent = await makeOrganization("concurrent");
  organizationId = main.id;
  rollbackOrganizationId = rollback.id;
  concurrentOrganizationId = concurrent.id;

  const platform = await makeUser("platform", "SUPER_ADMIN");
  const admin = await makeUser("admin", "CUSTOMER");
  const manager = await makeUser("manager", "CUSTOMER");
  superAdminId = platform.id;
  adminId = admin.id;
  managerId = manager.id;

  await prisma.organizationMember.createMany({ data: [
    { organizationId: main.id, organizationSlug: main.slug, userId: admin.id, role: "ADMIN" },
    { organizationId: main.id, organizationSlug: main.slug, userId: manager.id, role: "MANAGER" },
  ] });
});

after(async () => {
  await prisma.$disconnect();
});

test("trusted route authorization rejects anonymous, tenant admin, and organization manager sessions", async () => {
  authSession = null;
  assert.equal((await superAdminRoute(verticalRequest(organizationId, "HOTEL"), { params: Promise.resolve({ organizationId }) })).status, 401);

  authSession = { user: { id: adminId, role: "ADMIN", organizationId } };
  assert.equal((await superAdminRoute(verticalRequest(organizationId, "HOTEL"), { params: Promise.resolve({ organizationId }) })).status, 403);

  authSession = { user: { id: managerId, role: "MANAGER", organizationId } };
  assert.equal((await superAdminRoute(verticalRequest(organizationId, "HOTEL"), { params: Promise.resolve({ organizationId }) })).status, 403);
  assert.equal((await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })).vertical, null);
});

test("same-origin, route ID, and canonical vertical validation reject invalid requests", async () => {
  authSession = { user: { id: superAdminId, role: "SUPER_ADMIN" } };
  const baseOrigin = `http://localhost:${process.env.LOCAL_PRISMA_EXPECTED_PORT}`;
  assert.equal((await superAdminRoute(verticalRequest(organizationId, "HOTEL", { origin: "http://evil.invalid" }), { params: Promise.resolve({ organizationId }) })).status, 403);
  assert.equal((await superAdminRoute(verticalRequest(organizationId, "HOTEL", { origin: baseOrigin }), { params: Promise.resolve({ organizationId: "bad-id" }) })).status, 400);
  assert.equal((await superAdminRoute(verticalRequest(organizationId, "NOT_A_VERTICAL", { origin: baseOrigin }), { params: Promise.resolve({ organizationId }) })).status, 400);
  assert.equal((await superAdminRoute(verticalRequest(organizationId, "HOTEL", { origin: null }), { params: Promise.resolve({ organizationId }) })).status, 403);
});

test("platform assignment persists HOTEL, audits the actor and before/after values, and leaves capabilities untouched", async () => {
  const beforeCapabilities = await prisma.organizationCapability.findMany({ where: { organizationId }, orderBy: { key: "asc" } });
  const response = await assignAsPlatformAdmin(organizationId, "HOTEL");
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal((await response.json()).changed, true);
  assert.equal((await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })).vertical, "HOTEL");

  const audit = await prisma.auditLog.findFirstOrThrow({
    where: { entityType: "Organization", entityId: organizationId, action: "UPDATE", userId: superAdminId },
    orderBy: { createdAt: "desc" },
  });
  assert.equal(audit.organizationId, organizationId);
  assert.equal(audit.previousValue && (audit.previousValue as { vertical: string | null }).vertical, null);
  assert.equal(audit.newValue && (audit.newValue as { vertical: string }).vertical, "HOTEL");
  assert.equal(audit.organizationSlug, `g4-main-${suffix}`.slice(0, 60));
  assert.deepEqual(await prisma.organizationCapability.findMany({ where: { organizationId }, orderBy: { key: "asc" } }), beforeCapabilities);
  assert.equal(await prisma.organizationCapability.count({ where: { organizationId, key: "HOTEL_BOOKING" } }), 0);
});

test("same vertical replay is idempotent and a different vertical conflicts without mutation", async () => {
  const auditCountBefore = await prisma.auditLog.count({ where: { entityType: "Organization", entityId: organizationId } });
  const replay = await assignAsPlatformAdmin(organizationId, "HOTEL");
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).changed, false);
  assert.equal(await prisma.auditLog.count({ where: { entityType: "Organization", entityId: organizationId } }), auditCountBefore);

  const conflict = await assignAsPlatformAdmin(organizationId, "PHARMACY");
  assert.equal(conflict.status, 409);
  assert.equal((await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })).vertical, "HOTEL");
  assert.equal(await prisma.auditLog.count({ where: { entityType: "Organization", entityId: organizationId } }), auditCountBefore);
});

test("valid but missing organization returns 404", async () => {
  const missingId = "c000000000000000000000000";
  const response = await assignAsPlatformAdmin(missingId, "HOTEL");
  assert.equal(response.status, 404);
});

test("ordinary organization PATCH cannot assign a vertical for admins or managers", async () => {
  authSession = { user: { id: adminId, role: "ADMIN", organizationId } };
  const adminResponse = await tenantOrganizationRoute(tenantRequest(organizationId, { vertical: "HOTEL" }), { params: Promise.resolve({ id: organizationId }) });
  assert.equal(adminResponse.status, 400);

  authSession = { user: { id: managerId, role: "MANAGER", organizationId } };
  const managerResponse = await tenantOrganizationRoute(tenantRequest(organizationId, { vertical: "PHARMACY" }), { params: Promise.resolve({ id: organizationId }) });
  assert.equal(managerResponse.status, 400);
  assert.equal((await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })).vertical, "HOTEL");
});

test("invalid audit actor causes the real transaction to roll back assignment and audit", async () => {
  await assert.rejects(() => organizationService.setBusinessVertical(rollbackOrganizationId, "HOTEL", "SUPER_ADMIN", "c000000000000000000000000"));
  assert.equal((await prisma.organization.findUniqueOrThrow({ where: { id: rollbackOrganizationId } })).vertical, null);
  assert.equal(await prisma.auditLog.count({ where: { entityType: "Organization", entityId: rollbackOrganizationId } }), 0);
  assert.equal(await prisma.organizationCapability.count({ where: { organizationId: rollbackOrganizationId } }), 0);
});

test("concurrent conflicting assignments overlap on two PostgreSQL connections and have one audited winner", async () => {
  const sequence = `g4_vertical_overlap_${suffix.replace(/\W/g, "")}`;
  const functionName = `g4_vertical_overlap_wait_${suffix.replace(/\W/g, "")}`;
  const triggerName = `g4_vertical_overlap_trigger_${suffix.replace(/\W/g, "")}`;
  await prisma.$executeRawUnsafe(`CREATE SEQUENCE "${sequence}"`);
  await prisma.$executeRawUnsafe(`CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM nextval('"${sequence}"'); FOR attempt IN 1..400 LOOP IF (SELECT last_value FROM "${sequence}") >= 2 THEN EXIT; END IF; PERFORM pg_sleep(0.01); END LOOP; IF (SELECT last_value FROM "${sequence}") < 2 THEN RAISE EXCEPTION 'G4 overlap barrier timed out'; END IF; PERFORM pg_sleep(0.75); RETURN NULL; END; $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER "${triggerName}" BEFORE UPDATE OF "vertical" ON "Organization" FOR EACH STATEMENT EXECUTE FUNCTION "${functionName}"()`);
  try {
    const first = organizationService.setBusinessVertical(concurrentOrganizationId, "HOTEL", "SUPER_ADMIN", superAdminId);
    const second = organizationService.setBusinessVertical(concurrentOrganizationId, "PHARMACY", "SUPER_ADMIN", superAdminId);
    const overlappingBackendPids = await waitForConcurrentUpdateStatements();
    assert.ok(overlappingBackendPids.length >= 2, `expected two backends, observed ${overlappingBackendPids.join(",")}`);
    const results = await Promise.allSettled([first, second]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected && rejected.status === "rejected");
    assert.equal(rejected.reason?.code, "CONFLICT");

    const organization = await prisma.organization.findUniqueOrThrow({ where: { id: concurrentOrganizationId } });
    assert.ok(["HOTEL", "PHARMACY"].includes(organization.vertical ?? ""));
    const audits = await prisma.auditLog.findMany({ where: { entityType: "Organization", entityId: concurrentOrganizationId, action: "UPDATE" } });
    assert.equal(audits.length, 1);
    assert.equal((audits[0].newValue as { vertical: string }).vertical, organization.vertical);
    assert.equal((audits[0].previousValue as { vertical: string | null }).vertical, null);
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "Organization"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
    await prisma.$executeRawUnsafe(`DROP SEQUENCE IF EXISTS "${sequence}"`);
  }
});
