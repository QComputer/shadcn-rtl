import assert from "node:assert/strict";
import { before, beforeEach, mock, test } from "node:test";
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

const input = { temporaryCode: "A-01", category: "suite" };
const params = { id: "org-a", propertyId: "property-a", draftId: "draft-a" };
const scope = { organizationId: params.id, propertyId: params.propertyId };
const admin = { user: { id: "user-a", role: "ADMIN", organizationId: params.id } };

type Draft = Record<string, unknown> & {
  id: string;
  organizationId: string;
  propertyId: string;
  version: number;
  archivedAt: Date | null;
};

let session: typeof admin | null;
let memberActive: boolean;
let capabilityActive: boolean;
let updateConflict: boolean;
let drafts: Draft[];
let writes: number;
let auditRows: Record<string, unknown>[];
let failAudit: boolean;

function matches(record: Record<string, unknown>, where: Record<string, unknown>) {
  return Object.entries(where).every(([key, value]) => record[key] === value);
}

const db = {
  $transaction: async <T>(work: (tx: typeof db) => Promise<T>): Promise<T> => {
    const draftSnapshot = structuredClone(drafts);
    const auditSnapshot = [...auditRows];
    const writeSnapshot = writes;
    try { return await work(db); }
    catch (error) { drafts = draftSnapshot; auditRows = auditSnapshot; writes = writeSnapshot; throw error; }
  },
  auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => {
    if (failAudit) throw new Error("audit insert failed");
    auditRows.push(data);
    return data;
  } },
  user: { findFirst: async () => session?.user ?? null },
  organizationMember: {
    findFirst: async ({ where }: { where: unknown }) => {
      assert.deepEqual(where, {
        userId: admin.user.id, organizationId: scope.organizationId, isActive: true,
        role: { in: ["ADMIN", "MANAGER"] },
      });
      return memberActive ? { id: "membership" } : null;
    },
  },
  organizationCapability: { findFirst: async () => capabilityActive ? { id: "hotel-booking" } : null },
  organization: { findFirst: async () => ({ id: params.id }) },
  hotelProperty: {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => [
      { ...scope, id: params.propertyId, isActive: true, deletedAt: null },
      { ...scope, id: "property-a2", isActive: true, deletedAt: null },
      { organizationId: "org-b", id: "property-b", isActive: true, deletedAt: null },
      { ...scope, id: "property-inactive", isActive: false, deletedAt: null },
    ].find((property) => matches(property, where)) ?? null,
  },
  hotelDraftAccommodation: {
    findMany: async ({ where }: { where: Record<string, unknown> }) => drafts.filter((draft) => matches(draft, where)),
    findFirst: async ({ where }: { where: Record<string, unknown> }) => drafts.find((draft) => matches(draft, where)) ?? null,
    create: async ({ data }: { data: Omit<Draft, "id" | "version" | "archivedAt"> }) => {
      const key = { organizationId: data.organizationId, propertyId: data.propertyId, temporaryCode: data.temporaryCode };
      if (drafts.some((draft) => matches(draft, key))) throw prismaError("P2002");
      const row = {
        ...data, ...key, id: drafts.length === 0 ? params.draftId : `draft-${drafts.length + 1}`, version: 1, archivedAt: null,
        estimatedMinGuests: data.estimatedMinGuests ?? null,
        estimatedMaxGuests: data.estimatedMaxGuests ?? null,
        maxAdults: data.maxAdults ?? null,
        maxChildren: data.maxChildren ?? null,
        maxOccupancy: data.maxOccupancy ?? null,
        beds: data.beds === Prisma.DbNull ? null : data.beds,
      } as Draft;
      drafts.push(row);
      writes++;
      return row;
    },
    update: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const row = drafts.find((draft) => matches(draft, where));
      if (!row || updateConflict) throw prismaError("P2025");
      assert.deepEqual(where, { ...scope, id: params.draftId, version: row.version, archivedAt: null });
      assert.deepEqual(data.version, { increment: 1 });
      for (const [key, value] of Object.entries(data)) {
        if (key !== "version" && value !== undefined) row[key] = value === Prisma.DbNull ? null : value;
      }
      row.version++;
      writes++;
      return row;
    },
  },
};

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("synthetic Prisma error", { code, clientVersion: "test" });
}

mock.module("@/lib/auth", { namedExports: { auth: async () => session } });
mock.module("@/lib/db", { namedExports: { prisma: db } });
mock.module("@/lib/db-runtime", { namedExports: { prisma: db } });

let routes: {
  list: typeof import("../../app/api/organizations/[id]/hotels/[propertyId]/draft-accommodations/route");
  item: typeof import("../../app/api/organizations/[id]/hotels/[propertyId]/draft-accommodations/[draftId]/route");
  archive: typeof import("../../app/api/organizations/[id]/hotels/[propertyId]/draft-accommodations/[draftId]/archive/route");
};

before(async () => {
  routes = {
    list: await import("../../app/api/organizations/[id]/hotels/[propertyId]/draft-accommodations/route"),
    item: await import("../../app/api/organizations/[id]/hotels/[propertyId]/draft-accommodations/[draftId]/route"),
    archive: await import("../../app/api/organizations/[id]/hotels/[propertyId]/draft-accommodations/[draftId]/archive/route"),
  };
});

beforeEach(() => {
  session = admin;
  memberActive = capabilityActive = true;
  updateConflict = false;
  drafts = [];
  writes = 0;
  auditRows = [];
  failAudit = false;
});

const origin = "https://hotel.example.test";
function request(method: string, body?: unknown, requestOrigin = origin) {
  return new NextRequest(new URL("/api/drafts", origin), {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { origin: requestOrigin, "content-type": "application/json" },
  });
}
function context(overrides: Partial<typeof params> = {}) {
  return { params: Promise.resolve({ ...params, ...overrides }) };
}

test("draft routes reject unauthenticated, cross-origin, cross-tenant and unauthorized requests", async () => {
  session = null;
  assert.equal((await routes.list.GET(request("GET"), context())).status, 401);
  session = admin;
  assert.equal((await routes.list.POST(request("POST", input, "https://other.example.test"), context())).status, 403);
  assert.equal((await routes.list.GET(request("GET"), context({ id: "org-b" }))).status, 403);
  session = { user: { ...admin.user, role: "STAFF" } };
  assert.equal((await routes.list.GET(request("GET"), context())).status, 403);
  session = admin;
  memberActive = false;
  assert.equal((await routes.list.POST(request("POST", input), context())).status, 403);
  memberActive = true;
  capabilityActive = false;
  assert.equal((await routes.list.GET(request("GET"), context())).status, 403);
  assert.equal(writes, 0);
});

test("property and draft scope hide foreign and inactive resources", async () => {
  for (const propertyId of ["property-b", "property-inactive"]) {
    assert.equal((await routes.list.POST(request("POST", input), context({ propertyId }))).status, 404);
  }
  drafts = [
    { ...scope, id: params.draftId, organizationId: "org-b", propertyId: "property-b", version: 1, archivedAt: null },
    { ...scope, id: "draft-a2", propertyId: "property-a2", version: 1, archivedAt: null },
  ];
  assert.deepEqual(await (await routes.list.GET(request("GET"), context())).json(), { drafts: [] });
  assert.equal((await routes.item.PATCH(request("PATCH", { version: 1, description: "change" }), context())).status, 404);
  assert.equal((await routes.archive.POST(request("POST", { version: 1 }), context({ draftId: "draft-a2" }))).status, 404);
  assert.equal(writes, 0);
});

test("unknown occupancy remains null and a numeric zero is preserved for children", async () => {
  const create = await routes.list.POST(request("POST", { ...input, maxChildren: 0 }), context());
  assert.equal(create.status, 201);
  const { draft } = await create.json();
  assert.equal(draft.estimatedMinGuests, null);
  assert.equal(draft.estimatedMaxGuests, null);
  assert.equal(draft.beds, null);
  assert.equal(draft.maxChildren, 0);
  assert.equal(draft.maxAdults, null);
  assert.equal(draft.maxOccupancy, null);
  const update = await routes.item.PATCH(request("PATCH", { version: 1, estimatedMinGuests: 2, estimatedMaxGuests: 4, beds: [{ type: "double", count: 1 }] }), context());
  assert.equal(update.status, 200);
  const clear = await routes.item.PATCH(request("PATCH", { version: 2, estimatedMinGuests: null, estimatedMaxGuests: null, beds: null }), context());
  assert.equal(clear.status, 200);
  const cleared = (await clear.json()).draft;
  assert.equal(cleared.estimatedMinGuests, null);
  assert.equal(cleared.estimatedMaxGuests, null);
  assert.equal(cleared.beds, null);
  assert.equal(cleared.maxChildren, 0);
});

test("invalid input and merged occupancy constraints reject writes", async () => {
  for (const patch of [
    { organizationId: "org-b" },
    { estimatedMinGuests: 2 },
    { estimatedMinGuests: 4, estimatedMaxGuests: 2 },
    { maxChildren: -1 },
    { beds: [{ type: "double", count: 1, roomId: "physical-room" }] },
  ]) {
    assert.equal((await routes.list.POST(request("POST", { ...input, ...patch }), context())).status, 422);
  }
  assert.equal(writes, 0);
  assert.equal((await routes.list.POST(request("POST", { ...input, maxAdults: 4 }), context())).status, 201);
  assert.equal((await routes.item.PATCH(request("PATCH", { version: 1, maxOccupancy: 3 }), context())).status, 422);
  assert.equal((await routes.item.PATCH(request("PATCH", { version: 1 }), context())).status, 422);
  assert.equal(writes, 1);
});

test("duplicate codes, stale versions and a concurrent update produce sanitized conflicts", async () => {
  assert.equal((await routes.list.POST(request("POST", input), context())).status, 201);
  const duplicate = await routes.list.POST(request("POST", input), context());
  assert.equal(duplicate.status, 409);
  assert.deepEqual(await duplicate.json(), { error: "Resource conflict" });
  const stale = await routes.item.PATCH(request("PATCH", { version: 2, description: "stale" }), context());
  assert.equal(stale.status, 409);
  updateConflict = true;
  const raced = await routes.item.PATCH(request("PATCH", { version: 1, description: "raced" }), context());
  assert.equal(raced.status, 409);
  assert.deepEqual(await raced.json(), { error: "Request conflict" });
  assert.equal(writes, 1);
  const otherProperty = await routes.list.POST(request("POST", input), context({ propertyId: "property-a2" }));
  assert.equal(otherProperty.status, 201);
  assert.equal((await otherProperty.json()).draft.propertyId, "property-a2");
});

test("archive increments the version and hides the draft using only management and draft delegates", async () => {
  assert.equal((await routes.list.POST(request("POST", input), context())).status, 201);
  assert.equal((await routes.archive.POST(request("POST", { version: 2 }), context())).status, 409);
  const response = await routes.archive.POST(request("POST", { version: 1 }), context());
  assert.equal(response.status, 200);
  const { draft } = await response.json();
  assert.equal(draft.version, 2);
  assert.ok(Number.isFinite(Date.parse(draft.archivedAt)));
  assert.deepEqual(await (await routes.list.GET(request("GET"), context())).json(), { drafts: [] });
  assert.equal((await routes.item.PATCH(request("PATCH", { version: 2, description: "archived" }), context())).status, 404);
  assert.equal((await routes.archive.POST(request("POST", { version: 2 }), context())).status, 404);
  assert.equal(writes, 2);
});

test("create, update and archive write actor and tenant-scoped audit entries", async () => {
  const created = await routes.list.POST(request("POST", input), context());
  assert.equal(created.status, 201);
  assert.deepEqual(auditRows[0], {
    action: "CREATE", entityType: "HotelDraftAccommodation", entityId: params.draftId,
    userId: admin.user.id, organizationId: scope.organizationId,
    description: "Created draft hotel accommodation",
    newValue: { propertyId: params.propertyId, temporaryCode: input.temporaryCode, category: input.category, version: 1 },
  });
  const updated = await routes.item.PATCH(request("PATCH", { version: 1, description: "updated" }), context());
  assert.equal(updated.status, 200);
  assert.deepEqual(auditRows[1].previousValue, { propertyId: params.propertyId, version: 1 });
  assert.deepEqual(auditRows[1].newValue, { propertyId: params.propertyId, version: 2, changedFields: ["description"] });
  assert.equal(auditRows[1].userId, admin.user.id);
  const archived = await routes.archive.POST(request("POST", { version: 2 }), context());
  assert.equal(archived.status, 200);
  assert.deepEqual(auditRows[2].newValue, { propertyId: params.propertyId, version: 3, archived: true });
  assert.equal(auditRows.length, 3);
});

test("conflicting mutations and failed audit insertion leave no committed audit or draft mutation", async () => {
  failAudit = true;
  assert.equal((await routes.list.POST(request("POST", input), context())).status, 500);
  assert.equal(drafts.length, 0);
  assert.equal(auditRows.length, 0);
  failAudit = false;
  assert.equal((await routes.list.POST(request("POST", input), context())).status, 201);
  assert.equal(auditRows.length, 1);
  updateConflict = true;
  assert.equal((await routes.item.PATCH(request("PATCH", { version: 1, description: "raced" }), context())).status, 409);
  assert.equal(auditRows.length, 1);
  assert.equal((await routes.archive.POST(request("POST", { version: 2 }), context())).status, 409);
  assert.equal(auditRows.length, 1);
});
