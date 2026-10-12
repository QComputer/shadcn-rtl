import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

const enabled = process.env.HOTEL_PUBLIC_READ_R1_PG_ACCEPTANCE === "1";

function assertDisposableLoopbackDatabase(databaseUrl: string | undefined) {
  assert.ok(databaseUrl, "DATABASE_URL must be supplied for the explicitly opted-in PostgreSQL suite");
  const url = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname), "database host must be loopback");
  assert.match(decodeURIComponent(url.pathname.slice(1)), /^bazarbaaz_hotel_r1_[a-z0-9]{8,20}$/i, "database name must be a unique disposable R1 database");
  assert.doesNotMatch(url.hostname, /neon|vercel|production|staging/i);
  return decodeURIComponent(url.pathname.slice(1));
}

test("public Hotel catalog routes enforce tenant, publication, projection, and read-only contracts on PostgreSQL", { skip: !enabled, concurrency: false }, async (t) => {
  const expectedDatabase = assertDisposableLoopbackDatabase(process.env.DATABASE_URL);
  assert.equal(process.env.AI_MEDIA_LOCAL_DOCKER_E2E, "1", "local Prisma runtime must use the direct PostgreSQL adapter");
  assert.equal(process.env.DIRECT_URL, process.env.DATABASE_URL, "migration and runtime URLs must target the same disposable database");

  const [{ PrismaClient }, publication, catalog, propertyRoute, categoriesRoute, policiesRoute, runtime] = await Promise.all([
    import("@prisma/client"),
    import("@/lib/hotel/services/hotel-publication.service"),
    import("@/lib/hotel/services/public-catalog.service"),
    import("@/app/api/hotel/v1/properties/[propertySlug]/route"),
    import("@/app/api/hotel/v1/properties/[propertySlug]/room-types/route"),
    import("@/app/api/hotel/v1/properties/[propertySlug]/room-types/[roomTypeSlug]/policies/route"),
    import("@/lib/db-runtime"),
  ]);
  const db = new PrismaClient({ log: ["error"] });
  const organizationIds: string[] = [];
  const priorGate = process.env.HOTEL_PUBLICATION_OPERATIONAL_ENABLED;
  const testPrefix = `r1-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const alphaHost = `${testPrefix}-alpha.hotel.test`;
  const betaHost = `${testPrefix}-beta.hotel.test`;

  async function createOrganization(key: string, host: string, capabilityActive = true) {
    const organization = await db.organization.create({ data: { name: `${testPrefix} ${key}`, slug: `${testPrefix}-${key}`, type: "SHOP", vertical: "HOTEL" } });
    organizationIds.push(organization.id);
    await db.organizationCapability.create({ data: {
      organizationId: organization.id,
      key: "HOTEL_BOOKING",
      status: capabilityActive ? "ACTIVE" : "INACTIVE",
      enabledAt: capabilityActive ? new Date() : null,
      disabledAt: capabilityActive ? null : new Date(),
    } });
    await db.organizationDomain.create({ data: { organizationId: organization.id, domain: host, normalizedDomain: host, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true } });
    return organization;
  }

  async function createProperty(organizationId: string, organizationSlug: string, slug: string, options: { active?: boolean; localizedContent?: object | null; addressLine1?: string } = {}) {
    return db.hotelProperty.create({ data: {
      organizationId, organizationSlug, slug, name: `${organizationSlug} ${slug}`, description: "Public description",
      localizedContent: options.localizedContent ?? { fa: "متن فارسی" }, addressLine1: options.addressLine1 ?? "private address",
      isActive: options.active ?? true,
    } });
  }

  async function approve(organizationId: string, propertyId: string, resourceType: "PROPERTY" | "ROOM_TYPE" | "RATE_PLAN" | "CANCELLATION_POLICY", resourceId: string, scope: { availability: boolean; quote: boolean; policies: boolean }) {
    return publication.approveHotelPublication({ organizationId, propertyId, resourceType, resourceId, scope, userId: `synthetic-${testPrefix}`, role: "SUPER_ADMIN" }, db);
  }

  async function createRoom(organizationId: string, propertyId: string, slug: string, options: { active?: boolean; localizedContent?: object | null; sizeSqm?: number | null } = {}) {
    return db.hotelRoomType.create({ data: {
      organizationId, propertyId, slug, name: `${testPrefix} ${slug}`, description: "Room description",
      localizedContent: options.localizedContent ?? { fa: "اتاق فارسی" }, maxAdults: 2, maxChildren: 1, maxOccupancy: 3,
      beds: [{ kind: "queen", count: 1, widthCm: 160 }], sizeSqm: options.sizeSqm ?? 24, totalAllotment: 7,
      isActive: options.active ?? true,
    } });
  }

  async function createPlan(organizationId: string, propertyId: string, roomTypeId: string, code: string, cancellationPolicyId?: string | null, active = true) {
    return db.hotelRatePlan.create({ data: { organizationId, propertyId, roomTypeId, code, name: `${testPrefix} internal plan`, baseNightlyRate: BigInt("987654321"), cancellationPolicyId: cancellationPolicyId ?? null, isActive: active } });
  }

  async function addInventory(organizationId: string, propertyId: string, roomTypeId: string) {
    return db.hotelInventory.create({ data: { organizationId, propertyId, roomTypeId, date: new Date("2035-01-02T00:00:00.000Z"), allotment: 7, booked: 2, held: 1 } });
  }

  try {
    const identity = await db.$queryRaw<Array<{ databaseName: string; schemaName: string }>>`
      SELECT current_database() AS "databaseName", current_schema() AS "schemaName"
    `;
    assert.equal(identity[0]?.databaseName, expectedDatabase);
    assert.equal(identity[0]?.schemaName, "public");

    const alpha = await createOrganization("alpha", alphaHost);
    const beta = await createOrganization("beta", betaHost);
    const disabledCapabilityHost = `${testPrefix}-disabled-capability.hotel.test`;
    await createOrganization("disabled-capability", disabledCapabilityHost, false);
    const alphaProperty = await createProperty(alpha.id, alpha.slug, "shared-property", { addressLine1: "tenant alpha private address" });
    const betaProperty = await createProperty(beta.id, beta.slug, "shared-property", { addressLine1: "tenant beta private address" });
    const siblingProperty = await createProperty(alpha.id, alpha.slug, "sibling-property");
    await createProperty(alpha.id, alpha.slug, "unapproved-property");
    const archivedProperty = await createProperty(alpha.id, alpha.slug, "archived-property");
    const staleProperty = await createProperty(alpha.id, alpha.slug, "stale-property");
    await approve(alpha.id, alphaProperty.id, "PROPERTY", alphaProperty.id, { availability: true, quote: false, policies: false });
    await approve(beta.id, betaProperty.id, "PROPERTY", betaProperty.id, { availability: true, quote: false, policies: false });
    await approve(alpha.id, siblingProperty.id, "PROPERTY", siblingProperty.id, { availability: true, quote: false, policies: false });
    await approve(alpha.id, archivedProperty.id, "PROPERTY", archivedProperty.id, { availability: true, quote: false, policies: false });
    await db.hotelProperty.update({ where: { id: archivedProperty.id }, data: { isActive: false } });
    await approve(alpha.id, staleProperty.id, "PROPERTY", staleProperty.id, { availability: true, quote: false, policies: false });
    await db.hotelProperty.update({ where: { id: staleProperty.id }, data: { description: "changed after approval", updatedAt: new Date(Date.now() + 5000) } });

    const standard = await createRoom(alpha.id, alphaProperty.id, "standard", { localizedContent: { en: "English room" } });
    await createRoom(alpha.id, alphaProperty.id, "draft-room");
    const archivedRoom = await createRoom(alpha.id, alphaProperty.id, "archived-room");
    const staleRoom = await createRoom(alpha.id, alphaProperty.id, "stale-room");
    const noPlanRoom = await createRoom(alpha.id, alphaProperty.id, "no-plan-room");
    const siblingRoom = await createRoom(alpha.id, siblingProperty.id, "standard");
    for (const room of [standard, archivedRoom, staleRoom, noPlanRoom, siblingRoom]) {
      const propertyId = room.id === siblingRoom.id ? siblingProperty.id : alphaProperty.id;
      await approve(alpha.id, propertyId, "ROOM_TYPE", room.id, { availability: true, quote: false, policies: false });
    }
    await db.hotelRoomType.update({ where: { id: archivedRoom.id }, data: { isActive: false } });
    await db.hotelRoomType.update({ where: { id: staleRoom.id }, data: { description: "changed after approval", updatedAt: new Date(Date.now() + 5000) } });

    const validPolicy = await db.hotelCancellationPolicy.create({ data: {
      organizationId: alpha.id, propertyId: alphaProperty.id, key: "standard-policy", name: "Standard cancellation",
      description: "Current approved policy", freeCancellationCutoffHours: 48, fullCancellationRetention: 2500,
      localizedContent: { en: "English cancellation terms" }, cancellationTiers: [{ cutoffHours: 24, retentionBasisPoints: 2500, penaltyBasis: "RESERVATION_TOTAL" }],
    } });
    const invalidTiersPolicy = await db.hotelCancellationPolicy.create({ data: {
      organizationId: alpha.id, propertyId: alphaProperty.id, key: "invalid-tiers", name: "Malformed tiers",
      freeCancellationCutoffHours: 12, cancellationTiers: [{ cutoffHours: -1, retentionBasisPoints: 12000, penaltyBasis: "UNKNOWN" }],
    } });
    const unapprovedPolicy = await db.hotelCancellationPolicy.create({ data: {
      organizationId: alpha.id, propertyId: alphaProperty.id, key: "unapproved-policy", name: "Unapproved policy", freeCancellationCutoffHours: 24,
    } });
    const inactiveLinkedPolicy = await db.hotelCancellationPolicy.create({ data: {
      organizationId: alpha.id, propertyId: alphaProperty.id, key: "inactive-plan-policy", name: "Inactive plan policy", freeCancellationCutoffHours: 36,
    } });
    const validPlan = await createPlan(alpha.id, alphaProperty.id, standard.id, "public-plan", validPolicy.id);
    const invalidTiersPlan = await createPlan(alpha.id, alphaProperty.id, standard.id, "invalid-tiers-plan", invalidTiersPolicy.id);
    const unapprovedPolicyPlan = await createPlan(alpha.id, alphaProperty.id, standard.id, "unapproved-policy-plan", unapprovedPolicy.id);
    await createPlan(alpha.id, alphaProperty.id, standard.id, "inactive-plan", unapprovedPolicy.id, false);
    await createPlan(alpha.id, alphaProperty.id, standard.id, "inactive-only-plan", inactiveLinkedPolicy.id, false);
    const siblingPlan = await createPlan(alpha.id, siblingProperty.id, siblingRoom.id, "sibling-plan");
    await createPlan(alpha.id, alphaProperty.id, noPlanRoom.id, "unapproved-plan");
    await approve(alpha.id, alphaProperty.id, "RATE_PLAN", validPlan.id, { availability: true, quote: true, policies: true });
    await approve(alpha.id, alphaProperty.id, "RATE_PLAN", invalidTiersPlan.id, { availability: true, quote: true, policies: true });
    await approve(alpha.id, alphaProperty.id, "RATE_PLAN", unapprovedPolicyPlan.id, { availability: true, quote: true, policies: true });
    await approve(alpha.id, siblingProperty.id, "RATE_PLAN", siblingPlan.id, { availability: true, quote: true, policies: true });
    await approve(alpha.id, alphaProperty.id, "CANCELLATION_POLICY", validPolicy.id, { availability: false, quote: false, policies: true });
    await approve(alpha.id, alphaProperty.id, "CANCELLATION_POLICY", invalidTiersPolicy.id, { availability: false, quote: false, policies: true });
    await approve(alpha.id, alphaProperty.id, "CANCELLATION_POLICY", inactiveLinkedPolicy.id, { availability: false, quote: false, policies: true });

    await db.organizationDomain.create({ data: { organizationId: alpha.id, domain: `${testPrefix}-inactive.hotel.test`, normalizedDomain: `${testPrefix}-inactive.hotel.test`, status: "DISABLED" } });
    await addInventory(alpha.id, alphaProperty.id, standard.id);
    const fixtureOrganizations = { organizationId: { in: organizationIds } };
    const initialInventory = await db.hotelInventory.findMany({ where: fixtureOrganizations, orderBy: { id: "asc" } });
    const initialHolds = await db.hotelBookingHold.findMany({ where: fixtureOrganizations, orderBy: { id: "asc" }, select: { id: true, organizationId: true, propertyId: true, roomTypeId: true, status: true, quantity: true } });
    const initialReservations = await db.hotelReservation.findMany({ where: fixtureOrganizations, orderBy: { id: "asc" }, select: { id: true, organizationId: true, propertyId: true, roomTypeId: true, status: true } });
    const initialCapabilities = await db.organizationCapability.findMany({ where: fixtureOrganizations, orderBy: [{ organizationId: "asc" }, { key: "asc" }] });
    const initialApprovals = await db.hotelPublicationApproval.findMany({ where: fixtureOrganizations, orderBy: { id: "asc" } });

    await t.test("trusted active domains isolate identical property slugs across tenants", async () => {
      const alphaResult = await catalog.getPublishedHotelProperty({ host: `${alphaHost}:443`, propertySlug: "shared-property", locale: "fa", db });
      const betaResult = await catalog.getPublishedHotelProperty({ host: betaHost, propertySlug: "shared-property", locale: "fa", db });
      assert.equal(alphaResult?.property.name, `${alpha.slug} shared-property`);
      assert.equal(betaResult?.property.name, `${beta.slug} shared-property`);
      assert.notEqual(betaResult?.property.name, alphaResult?.property.name);
      assert.equal(await catalog.getPublishedHotelProperty({ host: alphaHost, propertySlug: "archived-property", locale: "fa", db }), null);
      assert.equal(await catalog.getPublishedHotelProperty({ host: alphaHost, propertySlug: "unapproved-property", locale: "fa", db }), null);
      assert.equal(await catalog.getPublishedHotelProperty({ host: alphaHost, propertySlug: "stale-property", locale: "fa", db }), null);
      assert.equal(await catalog.getPublishedHotelProperty({ host: `${testPrefix}-inactive.hotel.test`, propertySlug: "shared-property", locale: "fa", db }), null);
      assert.equal(await catalog.getPublishedHotelProperty({ host: `${testPrefix}-unknown.hotel.test`, propertySlug: "shared-property", locale: "fa", db }), null);
      assert.equal(await catalog.getPublishedHotelProperty({ host: betaHost, propertySlug: "sibling-property", locale: "fa", db }), null);
    });

    await t.test("disabled capability fails closed and current publication is required", async () => {
      assert.equal(await catalog.getPublishedHotelProperty({ host: disabledCapabilityHost, propertySlug: "shared-property", locale: "fa", db }), null);

      const current = await catalog.getPublishedHotelProperty({ host: alphaHost, propertySlug: "shared-property", locale: "fa", db });
      assert.ok(current);
      assert.equal(current.property.localizedText, "متن فارسی");
      const missingLocale = await catalog.getPublishedHotelProperty({ host: alphaHost, propertySlug: "shared-property", locale: "ar", db });
      assert.equal(missingLocale?.property.localizedText, null);
    });

    await t.test("room categories require property-scoped current approval and an active published rate plan", async () => {
      const result = await catalog.listPublishedHotelRoomCategories({ host: alphaHost, propertySlug: "shared-property", locale: "en", db });
      assert.deepEqual(result?.roomCategories.map((room) => room.slug), ["standard"]);
      assert.equal(result?.roomCategories[0]?.localizedText, "English room");
      assert.deepEqual(result?.roomCategories[0]?.beds, [{ kind: "queen", count: 1, widthCm: 160 }]);
      assert.equal(await catalog.listPublishedHotelRoomCategories({ host: alphaHost, propertySlug: "sibling-property", locale: "fa", db }).then((value) => value?.roomCategories[0]?.slug), "standard");
    });

    await t.test("only approved valid policies linked through active published plans are public", async () => {
      const result = await catalog.listPublishedHotelRoomPolicies({ host: alphaHost, propertySlug: "shared-property", roomTypeSlug: "standard", locale: "en", db });
      assert.deepEqual(result?.cancellationPolicies.map((policy) => policy.key), ["standard-policy"]);
      assert.equal(result?.cancellationPolicies[0]?.localizedText, "English cancellation terms");
      assert.equal(result?.cancellationPolicies[0]?.fullCancellationRetention, 0.25);
      assert.equal(await catalog.listPublishedHotelRoomPolicies({ host: alphaHost, propertySlug: "sibling-property", roomTypeSlug: "standard", locale: "fa", db }).then((value) => value?.cancellationPolicies.length), 0);
    });

    await t.test("live GET routes apply the global publication gate and no-store headers without leaking private fields or rates", async () => {
      delete process.env.HOTEL_PUBLICATION_OPERATIONAL_ENABLED;
      const disabledResponse = await propertyRoute.GET(new Request(`http://${alphaHost}/api/hotel/v1/properties/shared-property`, { headers: { host: alphaHost } }), { params: Promise.resolve({ propertySlug: "shared-property" }) });
      const disabledCategories = await categoriesRoute.GET(new Request(`http://${alphaHost}/api/hotel/v1/properties/shared-property/room-types`, { headers: { host: alphaHost } }), { params: Promise.resolve({ propertySlug: "shared-property" }) });
      const disabledPolicies = await policiesRoute.GET(new Request(`http://${alphaHost}/api/hotel/v1/properties/shared-property/room-types/standard/policies`, { headers: { host: alphaHost } }), { params: Promise.resolve({ propertySlug: "shared-property", roomTypeSlug: "standard" }) });
      for (const response of [disabledResponse, disabledCategories, disabledPolicies]) {
        assert.equal(response.status, 503);
        assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
      }
      process.env.HOTEL_PUBLICATION_OPERATIONAL_ENABLED = "1";

      const propertyResponse = await propertyRoute.GET(new Request(`http://${alphaHost}/api/hotel/v1/properties/shared-property?locale=fa`, { headers: { host: alphaHost } }), { params: Promise.resolve({ propertySlug: "shared-property" }) });
      const categoriesResponse = await categoriesRoute.GET(new Request(`http://${alphaHost}/api/hotel/v1/properties/shared-property/room-types?locale=ar`, { headers: { host: alphaHost } }), { params: Promise.resolve({ propertySlug: "shared-property" }) });
      const policiesResponse = await policiesRoute.GET(new Request(`http://${alphaHost}/api/hotel/v1/properties/shared-property/room-types/standard/policies?locale=fa`, { headers: { host: alphaHost } }), { params: Promise.resolve({ propertySlug: "shared-property", roomTypeSlug: "standard" }) });
      for (const response of [propertyResponse, categoriesResponse, policiesResponse]) {
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
      }
      const propertyBody = await propertyResponse.json();
      const categoriesBody = await categoriesResponse.json();
      const policiesBody = await policiesResponse.json();
      const serialized = JSON.stringify({ propertyBody, categoriesBody, policiesBody });
      for (const privateValue of [alpha.id, beta.id, alphaProperty.id, betaProperty.id, "tenant alpha private address", "tenant beta private address", "987654321"]) assert.equal(serialized.includes(privateValue), false);
      for (const privateKey of ["organizationId", "propertyId", "roomTypeId", "ratePlanId", "baseNightlyRate", "totalAllotment", "addressLine1", "latitude", "longitude"]) assert.equal(serialized.includes(`\"${privateKey}\"`), false);
    });

    await t.test("public reads leave inventory, holds, and reservations unchanged", async () => {
      const [inventoryAfter, holdsAfter, reservationsAfter, capabilitiesAfter, approvalsAfter] = await Promise.all([
        db.hotelInventory.findMany({ where: fixtureOrganizations, orderBy: { id: "asc" } }),
        db.hotelBookingHold.findMany({ where: fixtureOrganizations, orderBy: { id: "asc" }, select: { id: true, organizationId: true, propertyId: true, roomTypeId: true, status: true, quantity: true } }),
        db.hotelReservation.findMany({ where: fixtureOrganizations, orderBy: { id: "asc" }, select: { id: true, organizationId: true, propertyId: true, roomTypeId: true, status: true } }),
        db.organizationCapability.findMany({ where: fixtureOrganizations, orderBy: [{ organizationId: "asc" }, { key: "asc" }] }),
        db.hotelPublicationApproval.findMany({ where: fixtureOrganizations, orderBy: { id: "asc" } }),
      ]);
      assert.deepEqual(inventoryAfter, initialInventory);
      assert.deepEqual(holdsAfter, initialHolds);
      assert.deepEqual(reservationsAfter, initialReservations);
      assert.deepEqual(capabilitiesAfter, initialCapabilities);
      assert.deepEqual(approvalsAfter, initialApprovals);
      assert.equal(inventoryAfter.length, 1);
      assert.equal(inventoryAfter[0]?.allotment, 7);
      assert.equal(inventoryAfter[0]?.booked, 2);
      assert.equal(inventoryAfter[0]?.held, 1);
    });
  } finally {
    if (priorGate === undefined) delete process.env.HOTEL_PUBLICATION_OPERATIONAL_ENABLED;
    else process.env.HOTEL_PUBLICATION_OPERATIONAL_ENABLED = priorGate;
    if (organizationIds.length) {
      await db.hotelPublicationApproval.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await db.organization.deleteMany({ where: { id: { in: organizationIds } } });
    }
    await db.$disconnect();
    await runtime.prisma.$disconnect();
  }
});
