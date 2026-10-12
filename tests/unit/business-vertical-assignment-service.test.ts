import assert from "node:assert/strict";
import { before, beforeEach, mock, test } from "node:test";

type OrganizationRow = { id: string; slug: string; vertical: string | null; type: string };
let organizationRow: OrganizationRow | null;
let auditRows: Array<Record<string, unknown>>;
let transactionCalls: number;
let capabilityMutationCalls: number;

const tx = {
  organization: {
    findUnique: async ({ where }: { where: { id: string } }) => organizationRow?.id === where.id ? { ...organizationRow } : null,
    updateMany: async ({ where, data }: { where: { id: string; vertical: null }; data: { vertical: string } }) => {
      if (!organizationRow || organizationRow.id !== where.id || organizationRow.vertical !== where.vertical) return { count: 0 };
      organizationRow = { ...organizationRow, vertical: data.vertical };
      return { count: 1 };
    },
  },
  auditLog: {
    create: async ({ data }: { data: Record<string, unknown> }) => { auditRows.push(data); return data; },
  },
  organizationCapability: {
    updateMany: async () => { capabilityMutationCalls += 1; return { count: 0 }; },
  },
};

mock.module("@/lib/db", { namedExports: {
  prisma: { $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => { transactionCalls += 1; return callback(tx); } },
} });
mock.module("next/cache", { namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined } });

let OrganizationService: typeof import("@/lib/services/organization.service").OrganizationService;
let BusinessVerticalAssignmentError: typeof import("@/lib/services/organization.service").BusinessVerticalAssignmentError;
before(async () => {
  ({ OrganizationService, BusinessVerticalAssignmentError } = await import("@/lib/services/organization.service"));
});

beforeEach(() => {
  organizationRow = { id: "org_123", slug: "tenant-one", vertical: null, type: "SHOP" };
  auditRows = [];
  transactionCalls = 0;
  capabilityMutationCalls = 0;
});

const assignmentError = async (action: () => Promise<unknown>, code: string) => {
  await assert.rejects(action, (error: unknown) => error instanceof BusinessVerticalAssignmentError && error.code === code);
};

test("service requires the platform role and a canonical vertical", async () => {
  const service = new OrganizationService();
  await assignmentError(() => service.setBusinessVertical("org_123", "HOTEL", "ADMIN", "actor-1"), "FORBIDDEN");
  await assignmentError(() => service.setBusinessVertical("org_123", "NOT_A_VERTICAL", "SUPER_ADMIN", "actor-1"), "INVALID_VERTICAL");
  assert.equal(transactionCalls, 0);
});

test("missing organizations fail without writing an audit record", async () => {
  organizationRow = null;
  await assignmentError(() => new OrganizationService().setBusinessVertical("missing", "HOTEL", "SUPER_ADMIN", "actor-1"), "NOT_FOUND");
  assert.deepEqual(auditRows, []);
});

test("organization scope prevents an assignment from crossing into another tenant", async () => {
  await assignmentError(() => new OrganizationService().setBusinessVertical("tenant-b-id", "HOTEL", "SUPER_ADMIN", "actor-1"), "NOT_FOUND");
  assert.equal(organizationRow?.id, "org_123");
  assert.equal(organizationRow?.vertical, null);
  assert.deepEqual(auditRows, []);
});

test("assignment is audited with actor, organization, previous and new vertical; capabilities stay independent", async () => {
  const result = await new OrganizationService().setBusinessVertical("org_123", "HOTEL", "SUPER_ADMIN", "actor-7");
  assert.deepEqual(result, { organization: { id: "org_123", slug: "tenant-one", vertical: "HOTEL", type: "SHOP" }, changed: true });
  assert.deepEqual(auditRows, [{
    action: "UPDATE",
    entityType: "Organization",
    entityId: "org_123",
    description: "Business vertical assigned by platform administrator",
    previousValue: { vertical: null },
    newValue: { vertical: "HOTEL" },
    userId: "actor-7",
    organizationId: "org_123",
    organizationSlug: "tenant-one",
  }]);
  assert.equal(capabilityMutationCalls, 0);
});

test("same-vertical assignment is idempotent and does not create duplicate audit rows", async () => {
  organizationRow = { ...organizationRow!, vertical: "HOTEL" };
  const result = await new OrganizationService().setBusinessVertical("org_123", "HOTEL", "SUPER_ADMIN", "actor-1");
  assert.equal(result.changed, false);
  assert.deepEqual(auditRows, []);
});

test("different existing vertical conflicts without overwriting it", async () => {
  organizationRow = { ...organizationRow!, vertical: "PHARMACY" };
  await assignmentError(() => new OrganizationService().setBusinessVertical("org_123", "HOTEL", "SUPER_ADMIN", "actor-1"), "CONFLICT");
  assert.equal(organizationRow?.vertical, "PHARMACY");
  assert.deepEqual(auditRows, []);
});

test("concurrent conflicting assignments have one winner and preserve one tenant row", async () => {
  const service = new OrganizationService();
  const results = await Promise.allSettled([
    service.setBusinessVertical("org_123", "HOTEL", "SUPER_ADMIN", "actor-1"),
    service.setBusinessVertical("org_123", "PHARMACY", "SUPER_ADMIN", "actor-2"),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(rejected && rejected.status === "rejected");
  assert.ok(rejected.reason instanceof BusinessVerticalAssignmentError);
  assert.equal(rejected.reason.code, "CONFLICT");
  assert.ok(["HOTEL", "PHARMACY"].includes(organizationRow?.vertical ?? ""));
  assert.equal(auditRows.length, 1);
  assert.equal(auditRows[0].entityId, "org_123");
});
