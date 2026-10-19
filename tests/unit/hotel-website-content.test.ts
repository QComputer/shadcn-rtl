import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { BUSINESS_CAPABILITIES } from "@/lib/business-capability-registry";
import { createHotelWebsiteDraftSchema, hotelWebsiteContentSchema } from "@/lib/hotel/content/hotel-website-contract";
import { createHotelWebsiteDraftRevision, createHotelWebsiteRevisionHash } from "@/lib/hotel/content/hotel-website-content.service";
import { organizationCapabilityKeys } from "@/lib/validators/tenant-platform";

const content = {
  title: { fa: "هتل نمونه", en: "Example hotel" },
  hero: { heading: { fa: "اقامت آرام", en: "A quiet stay" } },
  introduction: { body: { fa: "توضیحات", en: "Introduction" } },
  sections: [
    { key: "facilities", kind: "FEATURE_LIST" as const, order: 1, visible: true, heading: { en: "Facilities" }, items: [{ key: "wifi", label: { en: "Wi-Fi" } }] },
    { key: "faq", kind: "FAQ" as const, order: 2, visible: true, heading: { en: "FAQ" }, items: [{ question: { en: "Question?" }, answer: { en: "Answer." } }] },
  ],
  contact: { phone: "+9800000000", address: { fa: "نشانی مورد تایید" } },
};

const media = [
  { imageId: "image-a", scope: "PROPERTY" as const, roomTypeId: null, slot: "GALLERY" as const, sortOrder: 1, altText: { fa: "نمای بیرونی" } },
  { imageId: "image-b", scope: "ROOM_CATEGORY" as const, roomTypeId: "room-a", slot: "GALLERY" as const, sortOrder: 0, altText: { en: "Room" } },
];

function harness(options: { capability?: boolean; auditFails?: boolean; organizationId?: string; propertyId?: string; actorUserId?: string } = {}) {
  const organizationId = options.organizationId ?? "org-a";
  const propertyId = options.propertyId ?? "property-a";
  const actorUserId = options.actorUserId ?? "manager-a";
  const state = {
    page: null as null | { id: string },
    revisionCounter: 0,
    revisions: [] as Array<Record<string, unknown>>,
    associations: [] as Array<Record<string, unknown>>,
    publications: [] as Array<Record<string, unknown>>,
    audit: [] as Array<Record<string, unknown>>,
  };
  const imageRows = new Map([
    ["image-a", { id: "image-a", organizationId: "org-a", access: "PUBLIC", filename: "100-asset-a.png", url: "/uploads/100-asset-a.png", mimeType: "image/png" }],
    ["image-b", { id: "image-b", organizationId: "org-a", access: "PUBLIC", filename: "100-asset-b.jpg", url: "https://tenant.public.blob.vercel-storage.com/100-asset-b.jpg", mimeType: "image/jpeg" }],
    ["image-b-owned", { id: "image-b-owned", organizationId: "org-b", access: "PUBLIC", filename: "200-asset-b.png", url: "/uploads/200-asset-b.png", mimeType: "image/png" }],
    ["image-other-tenant", { id: "image-other-tenant", organizationId: "org-b", access: "PUBLIC", filename: "100-other.png", url: "/uploads/100-other.png", mimeType: "image/png" }],
    ["image-private", { id: "image-private", organizationId: "org-a", access: "PRIVATE", filename: "100-private.png", url: "/uploads/100-private.png", mimeType: "image/png" }],
    ["image-arbitrary-url", { id: "image-arbitrary-url", organizationId: "org-a", access: "PUBLIC", filename: "100-external.png", url: "https://images.example/100-external.png", mimeType: "image/png" }],
  ]);
  const db = {
    $transaction: async <T>(callback: (tx: unknown) => Promise<T>) => {
      const snapshot = structuredClone(state);
      try { return await callback(db); }
      catch (error) {
        Object.assign(state, snapshot);
        throw error;
      }
    },
    organization: { findFirst: async ({ where }: { where: { id: string } }) => options.capability === false || where.id !== organizationId ? null : { id: organizationId, slug: organizationId === "org-a" ? "tenant-a" : "tenant-b" } },
    user: { findFirst: async ({ where }: { where: { id: string } }) => ({ id: where.id, role: "MANAGER" }) },
    organizationMember: { findFirst: async ({ where }: { where: { organizationId: string; userId: string } }) => where.organizationId === organizationId && where.userId === actorUserId ? { id: `membership-${organizationId}` } : null },
    hotelProperty: { findFirst: async ({ where }: { where: { id: string; organizationId: string } }) => where.id === propertyId && where.organizationId === organizationId ? { id: propertyId } : null },
    image: { findMany: async ({ where }: { where: { id: { in: string[] }; organizationId: string; access: string } }) => where.id.in.flatMap((id) => { const row = imageRows.get(id); return row?.organizationId === where.organizationId && row.access === where.access ? [row] : []; }) },
    hotelRoomType: { findMany: async ({ where }: { where: { id: { in: string[] }; organizationId: string; propertyId: string } }) => where.organizationId === organizationId && where.propertyId === propertyId ? where.id.in.filter((id) => id === "room-a").map((id) => ({ id })) : [] },
    hotelWebsitePage: {
      upsert: async () => { state.page ??= { id: "page-a" }; return state.page; },
      update: async () => ({ revisionCounter: ++state.revisionCounter }),
    },
    hotelWebsiteContentRevision: { create: async ({ data }: { data: Record<string, unknown> }) => { const row = { ...data, id: `revision-${state.revisions.length + 1}`, createdAt: new Date("2026-10-12T00:00:00.000Z") }; state.revisions.push(row); return row; } },
    hotelWebsiteMediaAssociation: { createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => { state.associations.push(...data); return { count: data.length }; } },
    auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => { if (options.auditFails) throw new Error("audit unavailable"); state.audit.push(data); return data; } },
  };
  return { db: db as unknown as PrismaClient, state };
}

function createInput(overrides: Partial<{ organizationId: string; propertyId: string; actorUserId: string; content: unknown; media: unknown }> = {}) {
  return { organizationId: "org-a", propertyId: "property-a", actorUserId: "manager-a", content, media, ...overrides };
}

test("strict localized content schema accepts fa/en/ar and rejects markup, unknown fields, and duplicate ordering", () => {
  assert.equal(hotelWebsiteContentSchema.safeParse(content).success, true);
  assert.equal(hotelWebsiteContentSchema.safeParse({ ...content, unexpected: true }).success, false);
  assert.equal(hotelWebsiteContentSchema.safeParse({ ...content, introduction: { body: { en: "<script>alert(1)</script>" } } }).success, false);
  assert.equal(createHotelWebsiteDraftSchema.safeParse({ content, media: [...media, { ...media[0], imageId: "image-c" }] }).success, false);
});

test("HOTEL_WEBSITE is a distinct opt-in capability, not a booking or legacy public-surface default", () => {
  assert.equal(organizationCapabilityKeys.includes("HOTEL_WEBSITE"), true);
  assert.equal((BUSINESS_CAPABILITIES as readonly string[]).includes("HOTEL_WEBSITE"), false);
  assert.equal((BUSINESS_CAPABILITIES as readonly string[]).includes("HOTEL_BOOKING"), false);
});

test("revision hash is deterministic and covers content plus tenant-owned media ordering", () => {
  const first = createHotelWebsiteDraftSchema.parse({ content, media });
  const second = createHotelWebsiteDraftSchema.parse({ content, media: [...media].reverse() });
  assert.equal(createHotelWebsiteRevisionHash(first.content, first.media), createHotelWebsiteRevisionHash(second.content, second.media));
  assert.notEqual(createHotelWebsiteRevisionHash(first.content, first.media), createHotelWebsiteRevisionHash({ ...first.content, title: { en: "Changed" } }, first.media));
  assert.notEqual(createHotelWebsiteRevisionHash(first.content, first.media), createHotelWebsiteRevisionHash(first.content, [{ ...first.media[0], sortOrder: 9 }, first.media[1]]));
});

test("two independent Hotel tenants can create isolated drafts", async () => {
  const tenantA = harness();
  const tenantB = harness({ organizationId: "org-b", propertyId: "property-b", actorUserId: "manager-b" });
  const [createdA, createdB] = await Promise.all([
    createHotelWebsiteDraftRevision(createInput(), tenantA.db),
    createHotelWebsiteDraftRevision(createInput({ organizationId: "org-b", propertyId: "property-b", actorUserId: "manager-b", media: [] }), tenantB.db),
  ]);
  assert.equal(createdA.revisionNumber, 1);
  assert.equal(createdB.revisionNumber, 1);
  assert.equal(tenantA.state.revisions.length, 1);
  assert.equal(tenantB.state.revisions.length, 1);
});

test("draft creation is scoped, atomic, ordered, and does not mutate booking data or publication pointers", async () => {
  const fixture = harness();
  fixture.state.publications.push({ revisionId: "published-before-edit" });
  const created = await createHotelWebsiteDraftRevision(createInput(), fixture.db);
  assert.equal(created.status, "DRAFT");
  assert.equal(created.revisionNumber, 1);
  assert.equal(created.mediaCount, 2);
  assert.deepEqual(fixture.state.associations.map((row) => row.sortOrder), [1, 0]);
  assert.deepEqual(fixture.state.publications, [{ revisionId: "published-before-edit" }]);
  assert.equal(fixture.state.audit.length, 1);
  assert.equal("hotelInventory" in (fixture.db as unknown as object), false);
  assert.equal("hotelBookingHold" in (fixture.db as unknown as object), false);
});

test("cross-tenant property and image references, private images, and missing/deleted images are rejected", async () => {
  const wrongProperty = harness();
  await assert.rejects(() => createHotelWebsiteDraftRevision(createInput({ propertyId: "property-b" }), wrongProperty.db));
  const wrongImage = harness();
  await assert.rejects(() => createHotelWebsiteDraftRevision(createInput({ media: [{ ...media[0], imageId: "image-other-tenant" }] }), wrongImage.db));
  const privateImage = harness();
  await assert.rejects(() => createHotelWebsiteDraftRevision(createInput({ media: [{ ...media[0], imageId: "image-private" }] }), privateImage.db));
  const arbitraryUrl = harness();
  await assert.rejects(() => createHotelWebsiteDraftRevision(createInput({ media: [{ ...media[0], imageId: "image-arbitrary-url" }] }), arbitraryUrl.db));
  const deletedOrMissing = harness();
  await assert.rejects(() => createHotelWebsiteDraftRevision(createInput({ media: [{ ...media[0], imageId: "deleted-image" }] }), deletedOrMissing.db));
  assert.equal(wrongImage.state.revisions.length, 0);
});

test("room-category associations require an active room in the same organization and property", async () => {
  const fixture = harness();
  const invalidRoom = [{ ...media[1], roomTypeId: "room-from-another-property" }];
  await assert.rejects(() => createHotelWebsiteDraftRevision(createInput({ media: invalidRoom }), fixture.db));
  assert.equal(fixture.state.revisions.length, 0);
});

test("disabled HOTEL_WEBSITE blocks writes without deleting earlier revisions", async () => {
  const fixture = harness();
  await createHotelWebsiteDraftRevision(createInput(), fixture.db);
  const before = structuredClone(fixture.state.revisions);
  await assert.rejects(() => createHotelWebsiteDraftRevision(createInput(), harness({ capability: false }).db));
  assert.deepEqual(fixture.state.revisions, before);
});

test("editing creates an appended revision; existing revision snapshot and published pointer remain unchanged", async () => {
  const fixture = harness();
  fixture.state.publications.push({ revisionId: "published-before-edit" });
  const first = await createHotelWebsiteDraftRevision(createInput(), fixture.db);
  const originalSnapshot = structuredClone(fixture.state.revisions[0]);
  const second = await createHotelWebsiteDraftRevision(createInput({ content: { ...content, title: { fa: "نسخه جدید" } } }), fixture.db);
  assert.equal(first.revisionNumber, 1);
  assert.equal(second.revisionNumber, 2);
  assert.notEqual(first.contentSha256, second.contentSha256);
  assert.deepEqual(fixture.state.revisions[0], originalSnapshot);
  assert.deepEqual(fixture.state.publications, [{ revisionId: "published-before-edit" }]);
});

test("audit write failure rolls back revision and association writes", async () => {
  const fixture = harness({ auditFails: true });
  await assert.rejects(() => createHotelWebsiteDraftRevision(createInput(), fixture.db));
  assert.equal(fixture.state.revisions.length, 0);
  assert.equal(fixture.state.associations.length, 0);
  assert.equal(fixture.state.revisionCounter, 0);
});
