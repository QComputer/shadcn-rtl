import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  getPublishedHotelWebsite,
  getPublishedHotelOrganizationSnapshot,
  isEligibleHotelWebsiteImage,
  listPublishedHotelWebsiteRoomCategories,
  resolveHotelWebsiteTenantForHost,
  type HotelWebsitePublicDependencies,
} from "@/lib/hotel/content/hotel-website-public.service";

const content = {
  title: { fa: "عنوان", en: "Title" },
  hero: { heading: { fa: "خوش آمدید", en: "Welcome" } },
  introduction: { body: { fa: "معرفی", en: "Introduction" } },
  sections: [
    { key: "hidden", order: 0, visible: false, kind: "TEXT", heading: { en: "Hidden" }, body: { en: "Hidden body" } },
    { key: "story", order: 2, visible: true, kind: "TEXT", heading: { en: "Story" }, body: { fa: "متن", en: "Body" } },
    { key: "intro", order: 1, visible: true, kind: "TEXT", heading: { en: "Intro" }, body: { en: "First" } },
  ],
  contact: { phone: "+10000000000", address: { fa: "آدرس خصوصی", en: "Private address" } },
};

function txWith(options: { publication?: unknown; rooms?: unknown[]; property?: unknown } = {}) {
  return {
    organizationDomain: { findUnique: async () => ({ status: "ACTIVE", organization: { id: "org-a", isActive: true, deletedAt: null, vertical: "HOTEL", capabilities: [{ id: "website-cap" }] } }) },
    hotelProperty: { findFirst: async () => options.property === undefined ? { id: "property-a", slug: "hotel-a" } : options.property },
    hotelWebsitePublication: { findFirst: async () => options.publication ?? null },
    hotelRoomType: { findMany: async () => options.rooms ?? [] },
  } as unknown as Prisma.TransactionClient;
}

function dbFor(tx: Prisma.TransactionClient) {
  return { $transaction: async (callback: (client: Prisma.TransactionClient) => Promise<unknown>) => callback(tx) } as unknown as PrismaClient;
}

const dependencies: HotelWebsitePublicDependencies = {
  resolveTenant: async () => ({ organizationId: "org-a" }),
  isRoomApproved: async ({ organizationId, propertyId }) => organizationId === "org-a" && propertyId === "property-a",
};

function publication(media: unknown[] = []) {
  return { id: "publication-a", revision: { id: "revision-a", revisionNumber: 4, content, media } };
}

function image(overrides: Record<string, unknown> = {}): Parameters<typeof isEligibleHotelWebsiteImage>[0] {
  return { id: "private-image-id", organizationId: "org-a", access: "PUBLIC", filename: "hotel.jpg", url: "/uploads/hotel.jpg", mimeType: "image/jpeg", ...overrides } as Parameters<typeof isEligibleHotelWebsiteImage>[0];
}

test("website tenant resolution requires active host, Hotel organization and explicitly enabled website capability", async () => {
  let query: unknown;
  const tx = { organizationDomain: { findUnique: async (args: unknown) => { query = args; return { status: "ACTIVE", organization: { id: "org-a", isActive: true, deletedAt: null, vertical: "HOTEL", capabilities: [{ id: "website" }] } }; } } } as unknown as Prisma.TransactionClient;
  assert.deepEqual(await resolveHotelWebsiteTenantForHost("WWW.HOTEL.EXAMPLE:443", tx), { organizationId: "org-a" });
  assert.deepEqual((query as { where: unknown }).where, { normalizedDomain: "hotel.example" });
  assert.deepEqual((query as { select: { organization: { select: { capabilities: { where: unknown } } } } }).select.organization.select.capabilities.where, { key: "HOTEL_WEBSITE", status: "ACTIVE", enabledAt: { not: null }, disabledAt: null });
});

test("tenant resolver fails closed for unknown, inactive, non-Hotel or unenabled website hosts", async () => {
  const unknownTx = { organizationDomain: { findUnique: async () => null } } as unknown as Prisma.TransactionClient;
  for (const host of [null, "", "not a host"]) assert.equal(await resolveHotelWebsiteTenantForHost(host, unknownTx), null);
  const tx = { organizationDomain: { findUnique: async () => ({ status: "ACTIVE", organization: { id: "org-a", isActive: true, deletedAt: null, vertical: "HOTEL", capabilities: [] } }) } } as unknown as Prisma.TransactionClient;
  assert.equal(await resolveHotelWebsiteTenantForHost("hotel.example", tx), null);
});

test("platform-hosted Hotel resolution is slug-scoped, capability-gated, and unavailable from other hosts", async () => {
  const calls: unknown[] = [];
  const tx = {
    organization: { findFirst: async (args: unknown) => { calls.push(args); return { id: "org-damoon" }; } },
  } as unknown as Prisma.TransactionClient;
  assert.deepEqual(await resolveHotelWebsiteTenantForHost("bazarbaaz.ir", tx, "damoon-hotel"), { organizationId: "org-damoon" });
  assert.equal(calls.length, 1);
  assert.deepEqual((calls[0] as { where: unknown }).where, {
    slug: "damoon-hotel",
    isActive: true,
    deletedAt: null,
    vertical: "HOTEL",
    capabilities: { some: { key: "HOTEL_WEBSITE", status: "ACTIVE", enabledAt: { not: null }, disabledAt: null } },
  });
  assert.equal(await resolveHotelWebsiteTenantForHost("attacker.example", tx, "damoon-hotel"), null);
  assert.equal(await resolveHotelWebsiteTenantForHost("bazarbaaz.ir", tx, "damoon/other"), null);
  assert.equal(calls.length, 1, "untrusted host and malformed slug do not query an organization");
});

test("published editorial response selects requested locale and omits address without an explicit visibility contract", async () => {
  const result = await getPublishedHotelWebsite({ host: "hotel.example", propertySlug: "hotel-a", locale: "en", db: dbFor(txWith({ publication: publication() })) }, dependencies);
  assert.equal(result?.mode, "PUBLISHED");
  if (!result || result.mode !== "PUBLISHED") return;
  assert.equal((result.content as { title: string | null }).title, "Title");
  assert.equal((result.content as { introduction: { body: string | null } }).introduction.body, "Introduction");
  assert.equal((result.content as { contact: { phone: string } }).contact.phone, "+10000000000");
  assert.equal("address" in (result.content as { contact: object }).contact, false);
  assert.equal(result.revisionNumber, 4);
});

test("an unpublished property returns a stable empty state", async () => {
  const result = await getPublishedHotelWebsite({ host: "hotel.example", propertySlug: "hotel-a", locale: "fa", db: dbFor(txWith()) }, dependencies);
  assert.deepEqual(result, { mode: "UNPUBLISHED", locale: "fa", propertySlug: "hotel-a", content: null, propertyGallery: [], roomGalleries: [] });
});

test("published property gallery uses opaque association routes and never returns image identifiers", async () => {
  const media = [{ id: "association-123", scope: "PROPERTY", roomTypeId: null, slot: "GALLERY", sortOrder: 0, altText: { en: "Exterior" }, image: image() }];
  const result = await getPublishedHotelWebsite({ host: "hotel.example", propertySlug: "hotel-a", locale: "en", db: dbFor(txWith({ publication: publication(media) })) }, dependencies);
  assert.equal(result?.mode, "PUBLISHED");
  if (!result || result.mode !== "PUBLISHED") return;
  assert.deepEqual(result.propertyGallery, [{ src: "/api/hotel/v1/website/media/association-123", altText: "Exterior", sortOrder: 0, slot: "GALLERY" }]);
  assert.deepEqual((result.content as { sections: Array<{ key: string; order: number }> }).sections.map(({ key, order }) => ({ key, order })), [{ key: "intro", order: 1 }, { key: "story", order: 2 }]);
  assert.equal(JSON.stringify(result).includes("private-image-id"), false);
  assert.equal(JSON.stringify(result).includes("hotel.jpg"), false);
});

test("platform-hosted gallery links retain the public organization slug for safe media resolution", async () => {
  const media = [{ id: "association-123", scope: "PROPERTY", roomTypeId: null, slot: "GALLERY", sortOrder: 0, altText: {}, image: image() }];
  const result = await getPublishedHotelWebsite({ host: "bazarbaaz.ir", organizationSlug: "damoon-hotel", propertySlug: "hotel-a", locale: "fa", db: dbFor(txWith({ publication: publication(media) })) }, dependencies);
  assert.equal(result?.mode, "PUBLISHED");
  if (!result || result.mode !== "PUBLISHED") return;
  assert.equal(result.propertyGallery[0]?.src, "/api/hotel/v1/website/media/association-123?organizationSlug=damoon-hotel");
});

test("foreign, private, unsupported and malformed image URLs are excluded from the public gallery", async () => {
  const media = [
    { id: "association-valid", scope: "PROPERTY", roomTypeId: null, slot: "GALLERY", sortOrder: 0, altText: {}, image: image() },
    { id: "association-foreign", scope: "PROPERTY", roomTypeId: null, slot: "GALLERY", sortOrder: 1, altText: {}, image: image({ organizationId: "org-b" }) },
    { id: "association-private", scope: "PROPERTY", roomTypeId: null, slot: "GALLERY", sortOrder: 2, altText: {}, image: image({ access: "PRIVATE" }) },
    { id: "association-mime", scope: "PROPERTY", roomTypeId: null, slot: "GALLERY", sortOrder: 3, altText: {}, image: image({ mimeType: "image/svg+xml" }) },
    { id: "association-url", scope: "PROPERTY", roomTypeId: null, slot: "GALLERY", sortOrder: 4, altText: {}, image: image({ url: "https://attacker.example/hotel.jpg" }) },
  ];
  const result = await getPublishedHotelWebsite({ host: "hotel.example", propertySlug: "hotel-a", locale: "fa", db: dbFor(txWith({ publication: publication(media) })) }, dependencies);
  assert.equal(result?.mode, "PUBLISHED");
  if (!result || result.mode !== "PUBLISHED") return;
  assert.deepEqual(result.propertyGallery.map((item) => item.src), ["/api/hotel/v1/website/media/association-valid"]);
});

test("room category website read does not require HOTEL_BOOKING and excludes unapproved rooms and private operational data", async () => {
  const tx = txWith({
    publication: publication(),
    rooms: [
      { id: "room-approved", slug: "suite", name: "Suite", description: "Public description", localizedContent: { fa: "سوئیت", en: "Suite" }, maxAdults: 2, maxChildren: 1, maxOccupancy: 3, beds: [{ kind: "queen", count: 1 }], sizeSqm: 30, totalAllotment: 4 },
      { id: "room-hidden", slug: "hidden", name: "Hidden", description: null, localizedContent: null, maxAdults: 2, maxChildren: 0, maxOccupancy: 2, beds: [], sizeSqm: null, totalAllotment: 20 },
    ],
  });
  const deps = { ...dependencies, isRoomApproved: async ({ resourceId }: { resourceId: string }) => resourceId === "room-approved" };
  const result = await listPublishedHotelWebsiteRoomCategories({ host: "hotel.example", propertySlug: "hotel-a", locale: "en", db: dbFor(tx) }, deps);
  assert.equal(result?.mode, "PUBLISHED");
  if (!result || result.mode !== "PUBLISHED") return;
  assert.equal(result.roomCategories.length, 1);
  assert.equal(result.roomCategories[0]?.localizedText, "Suite");
  assert.equal("totalAllotment" in (result.roomCategories[0] as object), false);
  assert.equal(JSON.stringify(result).includes("availability"), false);
});

test("current image eligibility rejects wrong ownership, access, MIME and untrusted serving URLs", () => {
  assert.equal(isEligibleHotelWebsiteImage(image(), "org-a"), true);
  assert.equal(isEligibleHotelWebsiteImage(image({ organizationId: "org-b" }), "org-a"), false);
  assert.equal(isEligibleHotelWebsiteImage(image({ access: "PRIVATE" }), "org-a"), false);
  assert.equal(isEligibleHotelWebsiteImage(image({ mimeType: "image/svg+xml" }), "org-a"), false);
  assert.equal(isEligibleHotelWebsiteImage(image({ url: "https://attacker.example/hotel.jpg" }), "org-a"), false);
});


test("organization server snapshot enforces trusted organization ID and one repeatable-read transaction", async () => {
  let transactions = 0;
  const tx = txWith({ publication: publication() });
  const db = { $transaction: async (callback: (client: Prisma.TransactionClient) => Promise<unknown>, options: unknown) => {
    transactions++;
    assert.deepEqual(options, { isolationLevel: "RepeatableRead" });
    return callback(tx);
  } } as unknown as PrismaClient;
  const input = { host: "bazarbaaz.ir", organizationSlug: "hotel-a", expectedOrganizationId: "org-a", propertySlug: "hotel-a", locale: "en" as const, db };
  const result = await getPublishedHotelOrganizationSnapshot(input, dependencies);
  assert.equal(transactions, 1);
  assert.equal(result?.website.mode, "PUBLISHED");
  assert.equal(result?.rooms.mode, "PUBLISHED");
  assert.equal(await getPublishedHotelOrganizationSnapshot({ ...input, expectedOrganizationId: "org-b" }, dependencies), null);
});


test("empty optional translations produce null fields rather than hiding an otherwise published page", async () => {
  const raw = publication();
  const tx = txWith({ publication: { ...raw, revision: { ...raw.revision, content: { ...content, hero: { ...content.hero, eyebrow: {} }, introduction: { ...content.introduction, heading: {} }, sections: [{ key: "text", order: 1, visible: true, kind: "TEXT", heading: {}, body: { en: "Visible" } }] } } } });
  const result = await getPublishedHotelWebsite({ host: "hotel.example", propertySlug: "hotel-a", locale: "en", db: dbFor(tx) }, dependencies);
  assert.equal(result?.mode, "PUBLISHED");
  if (result?.mode !== "PUBLISHED") return;
  assert.equal(result.content.hero.eyebrow, null);
  assert.equal(result.content.introduction.heading, null);
  assert.equal(result.content.sections[0].heading, null);
});
