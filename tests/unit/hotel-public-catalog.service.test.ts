import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";
import { getPublishedHotelProperty, listPublishedHotelRoomCategories, listPublishedHotelRoomPolicies, type PublicHotelCatalogDependencies } from "@/lib/hotel/services/public-catalog.service";

const propertyA = {
  id: "property-a-internal",
  organizationId: "org-a-internal",
  slug: "alpha-hotel",
  name: "Alpha Hotel",
  description: "Persisted description",
  localizedContent: { fa: "فارسی", en: "English", ar: "العربية", de: "must-not-leak" },
  timezone: "Asia/Tehran",
  currency: "TOMAN",
  checkInTime: "14:00",
  checkOutTime: "11:00",
  minStayNights: 1,
  maxStayNights: 30,
  addressLine1: "private address",
  latitude: 35.7,
  notes: "internal note",
  isActive: true,
  deletedAt: null,
};

const rooms = [
  { id: "room-published", organizationId: "org-a-internal", propertyId: propertyA.id, slug: "standard", name: "Standard", description: null, localizedContent: { fa: "استاندارد", en: "Standard room" }, maxAdults: 2, maxChildren: 1, maxOccupancy: 3, beds: [{ kind: "queen", count: 1 }], sizeSqm: 28, isActive: true, deletedAt: null, sortOrder: 1, internalNote: "do not leak" },
  { id: "room-draft", organizationId: "org-a-internal", propertyId: propertyA.id, slug: "draft", name: "Draft", description: null, localizedContent: null, maxAdults: 2, maxChildren: 0, maxOccupancy: 2, beds: [], sizeSqm: null, isActive: true, deletedAt: null, sortOrder: 2 },
  { id: "room-archived", organizationId: "org-a-internal", propertyId: propertyA.id, slug: "archived", name: "Archived", description: null, localizedContent: null, maxAdults: 2, maxChildren: 0, maxOccupancy: 2, beds: [], sizeSqm: null, isActive: false, deletedAt: new Date(), sortOrder: 3 },
];

const cancellationPolicy = {
  id: "policy-internal",
  key: "flexible",
  name: "Flexible",
  description: "Persisted terms",
  localizedContent: { en: "English policy" },
  freeCancellationCutoffHours: 24,
  fullCancellationRetention: 3500,
  cancellationTiers: [{ cutoffHours: 12, retentionBasisPoints: 5000, penaltyBasis: "FIRST_NIGHT" }],
  isActive: true,
};

function createHarness(input: { approved?: readonly string[]; property?: (Omit<typeof propertyA, "localizedContent"> & { localizedContent: Prisma.JsonValue | null }) | null; tenant?: (host: string | null) => string | null } = {}) {
  const reads: string[] = [];
  const transactionOptions: unknown[] = [];
  const approvalSet = new Set(input.approved ?? ["PROPERTY:property-a-internal", "ROOM_TYPE:room-published", "RATE_PLAN:plan-published"]);
  const tx = {
    hotelProperty: {
      findFirst: async ({ where }: { where: { organizationId: string; slug: string; isActive: true; deletedAt: null } }) => {
        reads.push("property");
        const row = input.property === undefined ? propertyA : input.property;
        return row && row.organizationId === where.organizationId && row.slug === where.slug && row.isActive && row.deletedAt === null ? row : null;
      },
    },
    hotelRoomType: {
      findFirst: async ({ where }: { where: { organizationId: string; propertyId: string; slug: string; isActive: true; deletedAt: null } }) => rooms.find((row) => row.organizationId === where.organizationId && row.propertyId === where.propertyId && row.slug === where.slug && row.isActive && row.deletedAt === null) ?? null,
      findMany: async ({ where }: { where: { organizationId: string; propertyId: string; isActive: true; deletedAt: null } }) => {
        reads.push("roomTypes");
        return rooms.filter((row) => row.organizationId === where.organizationId && row.propertyId === where.propertyId && row.isActive && row.deletedAt === null);
      },
    },
    hotelRatePlan: {
      findMany: async ({ where }: { where: { organizationId: string; propertyId: string; roomTypeId: string; isActive: true } }) => {
        reads.push("ratePlans");
        return where.roomTypeId === "room-published" ? [{ id: "plan-published", cancellationPolicy }] : [{ id: "plan-draft", cancellationPolicy: null }];
      },
    },
    $transaction: async <T>(callback: (client: Prisma.TransactionClient) => Promise<T>, options: unknown) => {
      transactionOptions.push(options);
      return callback(tx as unknown as Prisma.TransactionClient);
    },
  };
  const dependencies: PublicHotelCatalogDependencies = {
    resolveTenant: async (host) => {
      const organizationId = input.tenant ? input.tenant(host) : host === "alpha.example" ? "org-a-internal" : null;
      return organizationId ? { organizationId } : null;
    },
    isApproved: async ({ resourceType, resourceId }) => approvalSet.has(`${resourceType}:${resourceId}`),
  };
  return { db: tx as unknown as PrismaClient, dependencies, reads, transactionOptions };
}

test("published property is host scoped, locale constrained, and omits internal fields", async () => {
  const harness = createHarness();
  const result = await getPublishedHotelProperty({ host: "alpha.example", propertySlug: "alpha-hotel", locale: "en", db: harness.db }, harness.dependencies);
  assert.deepEqual(result, {
    source: "PUBLISHED",
    locale: "en",
    property: { slug: "alpha-hotel", name: "Alpha Hotel", description: "Persisted description", localizedText: "English", timezone: "Asia/Tehran", currency: "TOMAN", checkInTime: "14:00", checkOutTime: "11:00", minStayNights: 1, maxStayNights: 30 },
  });
  assert.equal(JSON.stringify(result).includes("private address"), false);
  assert.equal(JSON.stringify(result).includes("internal note"), false);
  assert.equal(JSON.stringify(result).includes("org-a-internal"), false);
  assert.deepEqual(harness.transactionOptions, [{ isolationLevel: "RepeatableRead" }]);
});

test("unknown host, another tenant host, and unapproved property all fail closed", async () => {
  const harness = createHarness();
  assert.equal(await getPublishedHotelProperty({ host: "unknown.example", propertySlug: "alpha-hotel", locale: "fa", db: harness.db }, harness.dependencies), null);
  assert.equal(await getPublishedHotelProperty({ host: "beta.example", propertySlug: "alpha-hotel", locale: "fa", db: harness.db }, {
    ...harness.dependencies,
    resolveTenant: async () => ({ organizationId: "org-b" }),
  }), null);
  const noApproval = createHarness({ approved: [] });
  assert.equal(await getPublishedHotelProperty({ host: "alpha.example", propertySlug: "alpha-hotel", locale: "fa", db: noApproval.db }, noApproval.dependencies), null);
});

test("missing requested locale text is null and does not fall back to another language", async () => {
  const propertyWithoutEnglish = { ...propertyA, localizedContent: { fa: "فارسی", ar: "العربية" } };
  const harness = createHarness({ property: propertyWithoutEnglish });
  const result = await getPublishedHotelProperty({ host: "alpha.example", propertySlug: "alpha-hotel", locale: "en", db: harness.db }, harness.dependencies);
  assert.equal(result?.property.localizedText, null);
});

test("room categories require current room and rate approvals and exclude archived or draft rows", async () => {
  const harness = createHarness({ approved: ["PROPERTY:property-a-internal", "ROOM_TYPE:room-published", "RATE_PLAN:plan-published", "RATE_PLAN:plan-draft"] });
  const result = await listPublishedHotelRoomCategories({ host: "alpha.example", propertySlug: "alpha-hotel", locale: "fa", db: harness.db }, harness.dependencies);
  assert.deepEqual(result, {
    source: "PUBLISHED",
    locale: "fa",
    property: { slug: "alpha-hotel" },
    roomCategories: [{ slug: "standard", name: "Standard", description: null, localizedText: "استاندارد", maxAdults: 2, maxChildren: 1, maxOccupancy: 3, beds: [{ kind: "queen", count: 1 }], sizeSqm: 28 }],
  });
  assert.equal(JSON.stringify(result).includes("room-published"), false);
  assert.equal(JSON.stringify(result).includes("internalNote"), false);
  assert.equal(harness.reads.includes("ratePlans"), true);
});

test("room categories without approved room or rate revisions are omitted; missing property is null", async () => {
  const noRoomApproval = createHarness({ approved: ["PROPERTY:property-a-internal", "RATE_PLAN:plan-published"] });
  const noRoom = await listPublishedHotelRoomCategories({ host: "alpha.example", propertySlug: "alpha-hotel", locale: "ar", db: noRoomApproval.db }, noRoomApproval.dependencies);
  assert.deepEqual(noRoom?.roomCategories, []);

  const noRateApproval = createHarness({ approved: ["PROPERTY:property-a-internal", "ROOM_TYPE:room-published"] });
  const noRate = await listPublishedHotelRoomCategories({ host: "alpha.example", propertySlug: "alpha-hotel", locale: "ar", db: noRateApproval.db }, noRateApproval.dependencies);
  assert.deepEqual(noRate?.roomCategories, []);

  const missing = createHarness({ property: null });
  assert.equal(await listPublishedHotelRoomCategories({ host: "alpha.example", propertySlug: "missing", locale: "ar", db: missing.db }, missing.dependencies), null);
});

test("catalog reads do not call any inventory or booking mutation surface", async () => {
  const harness = createHarness();
  const result = await listPublishedHotelRoomCategories({ host: "alpha.example", propertySlug: "alpha-hotel", locale: "en", db: harness.db }, harness.dependencies);
  assert.ok(result);
  assert.deepEqual(harness.reads, ["property", "roomTypes", "ratePlans"]);
});

test("published room policies require approved room, rate plan, and policy and whitelist persisted terms", async () => {
  const harness = createHarness({ approved: ["PROPERTY:property-a-internal", "ROOM_TYPE:room-published", "RATE_PLAN:plan-published", "CANCELLATION_POLICY:policy-internal"] });
  const result = await listPublishedHotelRoomPolicies({ host: "alpha.example", propertySlug: "alpha-hotel", roomTypeSlug: "standard", locale: "en", db: harness.db }, harness.dependencies);
  assert.deepEqual(result, {
    source: "PUBLISHED",
    locale: "en",
    property: { slug: "alpha-hotel" },
    roomCategory: { slug: "standard" },
    cancellationPolicies: [{ key: "flexible", name: "Flexible", description: "Persisted terms", localizedText: "English policy", freeCancellationCutoffHours: 24, fullCancellationRetention: 0.35, cancellationTiers: [{ cutoffHours: 12, retentionBasisPoints: 5000, penaltyBasis: "FIRST_NIGHT" }] }],
  });
  assert.equal(JSON.stringify(result).includes("policy-internal"), false);
  assert.equal(JSON.stringify(result).includes("plan-published"), false);

  const unpublished = createHarness({ approved: ["PROPERTY:property-a-internal", "ROOM_TYPE:room-published", "RATE_PLAN:plan-published"] });
  const noPolicy = await listPublishedHotelRoomPolicies({ host: "alpha.example", propertySlug: "alpha-hotel", roomTypeSlug: "standard", locale: "fa", db: unpublished.db }, unpublished.dependencies);
  assert.deepEqual(noPolicy?.cancellationPolicies, []);
});

test("room policy lookup does not cross property or tenant ownership", async () => {
  const harness = createHarness();
  const wrongTenant = await listPublishedHotelRoomPolicies({ host: "beta.example", propertySlug: "alpha-hotel", roomTypeSlug: "standard", locale: "fa", db: harness.db }, harness.dependencies);
  const wrongProperty = await listPublishedHotelRoomPolicies({ host: "alpha.example", propertySlug: "other-property", roomTypeSlug: "standard", locale: "fa", db: harness.db }, harness.dependencies);
  assert.equal(wrongTenant, null);
  assert.equal(wrongProperty, null);
});
