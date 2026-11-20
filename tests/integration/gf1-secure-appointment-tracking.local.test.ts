import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db-runtime";
import { createHash, randomBytes } from "node:crypto";

mock.module("next/cache", { namedExports: { revalidatePath: () => undefined } });
let appointmentService: typeof import("@/lib/services/appointment.service").appointmentService;

const EXPECTED_DB = "bazarbaaz_h3c1_verify";
let organizationId = "";
let tenantHost = "";
let serviceId = "";
let guestCustomerId = "";
let appointmentId = "";
let bookingReference = "";
let trackingToken = "";
let testBookingReference = "";
let testTrackingToken = "";

function fixtureId(prefix: string) {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

function generateTestToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

function futureAppointmentSlot(daysFromNow: number, hour: number) {
  const startTime = new Date();
  startTime.setUTCDate(startTime.getUTCDate() + daysFromNow);
  startTime.setUTCHours(hour, 0, 0, 0);
  return { date: startTime.toISOString().slice(0, 10), startTime: startTime.toISOString() };
}

describe("GF1 Secure Guest Appointment Tracking", () => {
  before(async () => {
    appointmentService = (await import("@/lib/services/appointment.service")).appointmentService;
    const rows = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database()::text AS db`;
    assert.equal(rows[0]?.db, EXPECTED_DB, `must run against ${EXPECTED_DB}`);

    // Create test organization with APPOINTMENT capability
    const org = await prisma.organization.create({
      data: {
        name: "GF1 Test Org",
        slug: `gf1-test-${Date.now()}`,
        type: "APPOINTMENT",
        capabilitiesInitializedAt: new Date(),
      },
    });
    organizationId = org.id;
    tenantHost = `${org.slug}.example.test`;

    await prisma.organizationDomain.create({
      data: {
        organizationId,
        domain: tenantHost,
        normalizedDomain: tenantHost,
        status: "ACTIVE",
        providerVerified: true,
        dnsConfigured: true,
        sslReady: true,
        verifiedAt: new Date(),
      },
    });

    await prisma.organizationCapability.create({
      data: {
        organizationId,
        key: "APPOINTMENT",
        status: "ACTIVE",
        enabledAt: new Date(),
      },
    });
    await prisma.businessHour.createMany({
      data: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].map((day) => ({
        organizationId,
        day: day as "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY",
        openTime: "08:00",
        closeTime: "17:00",
        isOpen: true,
      })),
    });

    // Create service category
    const serviceCategory = await prisma.serviceCategory.create({
      data: {
        organizationId,
        name: "Test Category",
        slug: "test-category",
      },
    });

    // Create service
    const service = await prisma.service.create({
      data: {
        organizationId,
        categoryId: serviceCategory.id,
        name: "Test Service",
        slug: "test-service",
        duration: 30,
        price: 100,
        isActive: true,
      },
    });
    serviceId = service.id;

    // Create guest customer
    const guestCustomer = await prisma.guestCustomer.create({
      data: {
        sessionId: `test-session-${Date.now()}`,
        name: "Test Guest",
        firstName: "Test",
        lastName: "Guest",
        phone: "09123456789",
        email: "test@example.com",
      },
    });
    guestCustomerId = guestCustomer.id;
  });

  after(async () => {
    if (appointmentId) {
      await prisma.appointment.deleteMany({ where: { id: appointmentId } });
    }
    if (guestCustomerId) {
      await prisma.guestCustomer.deleteMany({ where: { id: guestCustomerId } });
    }
    if (serviceId) {
      await prisma.service.deleteMany({ where: { id: serviceId } });
    }
    if (organizationId) {
      await prisma.organizationDomain.deleteMany({ where: { organizationId } });
      await prisma.businessHour.deleteMany({ where: { organizationId } });
      await prisma.organizationCapability.deleteMany({ where: { organizationId } });
      await prisma.serviceCategory.deleteMany({ where: { organizationId } });
      await prisma.organization.delete({ where: { id: organizationId } });
    }
  });

  it("creates guest appointment with tracking token", async () => {
    const slot = futureAppointmentSlot(10, 8);
    const result = await appointmentService.createForGuest(guestCustomerId, {
      serviceId,
      ...slot,
      customerName: "Test Guest",
      customerPhone: "09123456789",
      customerEmail: "test@example.com",
    });

    assert.ok(result.appointment);
    assert.ok(result.trackingToken);
    assert.equal(typeof result.trackingToken, "string");
    assert.ok(result.trackingToken.length >= 32);

    appointmentId = result.appointment.id;
    bookingReference = result.appointment.bookingReference || "";
    trackingToken = result.trackingToken || "";
    testBookingReference = bookingReference;
    testTrackingToken = trackingToken;

    // Verify tracking token is stored as hash in database
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        trackingTokenHash: true,
        trackingTokenExpiresAt: true,
        bookingReference: true,
      },
    });

    assert.ok(appointment);
    assert.ok(appointment.trackingTokenHash);
    assert.ok(appointment.trackingTokenExpiresAt);
    assert.equal(appointment.trackingTokenHash, createHash("sha256").update(trackingToken).digest("hex"));
    assert.ok(appointment.trackingTokenExpiresAt > new Date());

    const defaultAppointmentResult = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    assert.ok(defaultAppointmentResult);
    assert.equal("trackingTokenHash" in defaultAppointmentResult, false, "global Prisma omit hides the token hash from default appointment results");
    assert.equal("trackingTokenExpiresAt" in defaultAppointmentResult, false, "global Prisma omit hides token expiry from default appointment results");
  });

  it("tracks appointment with valid token via POST endpoint", async () => {
    assert.ok(trackingToken, "trackingToken must be set from previous test");

    // Simulate POST request to tracking endpoint
    const tokenHash = createHash("sha256").update(trackingToken).digest("hex");

    const appointment = await prisma.appointment.findFirst({
      where: {
        trackingTokenHash: tokenHash,
        trackingTokenExpiresAt: { gt: new Date() },
        deletedAt: null,
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            duration: true,
            price: true,
            organization: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    assert.ok(appointment);
    assert.equal(appointment.id, appointmentId);
    assert.ok(appointment.service);
    assert.equal(appointment.service.name, "Test Service");
  });

  it("rejects expired tracking token", async () => {
    // Create appointment with expired token
    const { token, hash } = generateTestToken();
    const expiredAppointment = await prisma.appointment.create({
      data: {
        date: new Date("2030-01-01"),
        startTime: new Date("2030-01-01T08:00:00.000Z"),
        endTime: new Date("2030-01-01T08:30:00.000Z"),
        status: "PENDING",
        serviceId,
        guestCustomerId,
        trackingTokenHash: hash,
        trackingTokenExpiresAt: new Date(Date.now() - 86400000), // Expired yesterday
      },
    });

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const found = await prisma.appointment.findFirst({
      where: {
        trackingTokenHash: tokenHash,
        trackingTokenExpiresAt: { gt: new Date() },
        deletedAt: null,
      },
    });

    assert.equal(found, null, "Expired token should not find appointment");

    // Cleanup
    await prisma.appointment.delete({ where: { id: expiredAppointment.id } });
  });

  it("rejects malformed tracking token", async () => {
    const tokenHash = createHash("sha256").update("invalid-token").digest("hex");
    const found = await prisma.appointment.findFirst({
      where: {
        trackingTokenHash: tokenHash,
        trackingTokenExpiresAt: { gt: new Date() },
        deletedAt: null,
      },
    });

    assert.equal(found, null, "Malformed token should not find appointment");
  });

  it("rejects revoked tracking token (soft deleted appointment)", async () => {
    const { token, hash } = generateTestToken();
    const deletedAppointment = await prisma.appointment.create({
      data: {
        date: new Date("2030-01-01"),
        startTime: new Date("2030-01-01T08:00:00.000Z"),
        endTime: new Date("2030-01-01T08:30:00.000Z"),
        status: "CANCELLED",
        deletedAt: new Date(),
        serviceId,
        guestCustomerId,
        trackingTokenHash: hash,
        trackingTokenExpiresAt: new Date(Date.now() + 86400000),
      },
    });

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const found = await prisma.appointment.findFirst({
      where: {
        trackingTokenHash: tokenHash,
        trackingTokenExpiresAt: { gt: new Date() },
        deletedAt: null,
      },
    });

    assert.equal(found, null, "Deleted appointment should not be found via tracking token");

    // Cleanup
    await prisma.appointment.delete({ where: { id: deletedAppointment.id } });
  });

  it("enforces tenant isolation - token from tenant A cannot access tenant B", async () => {
    // Create second organization
    const orgB = await prisma.organization.create({
      data: {
        name: "GF1 Test Org B",
        slug: `gf1-test-b-${Date.now()}`,
        type: "APPOINTMENT",
        capabilitiesInitializedAt: new Date(),
      },
    });

    await prisma.organizationCapability.create({
      data: { organizationId: orgB.id, key: "APPOINTMENT", status: "ACTIVE", enabledAt: new Date() },
    });

    const serviceCategoryB = await prisma.serviceCategory.create({
      data: { organizationId: orgB.id, name: "Test Category B", slug: "test-category-b" },
    });

    const serviceB = await prisma.service.create({
      data: {
        organizationId: orgB.id,
        categoryId: serviceCategoryB.id,
        name: "Test Service B",
        slug: "test-service-b",
        duration: 30,
        price: 100,
        isActive: true,
      },
    });

    const guestCustomerB = await prisma.guestCustomer.create({
      data: {
        sessionId: `test-session-b-${Date.now()}`,
        name: "Test Guest B",
        firstName: "Test",
        lastName: "Guest B",
        phone: "09123456788",
        email: "testb@example.com",
      },
    });

    const { token, hash } = generateTestToken();
    const appointmentB = await prisma.appointment.create({
      data: {
        date: new Date("2030-01-01"),
        startTime: new Date("2030-01-01T08:00:00.000Z"),
        endTime: new Date("2030-01-01T08:30:00.000Z"),
        status: "PENDING",
        serviceId: serviceB.id,
        guestCustomerId: guestCustomerB.id,
        trackingTokenHash: hash,
        trackingTokenExpiresAt: new Date(Date.now() + 86400000),
      },
    });

    // Token from orgB appointment should not work for orgA lookup (different service)
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const found = await prisma.appointment.findFirst({
      where: {
        trackingTokenHash: tokenHash,
        trackingTokenExpiresAt: { gt: new Date() },
        deletedAt: null,
        service: { organizationId: organizationId }, // Different org!
      },
    });

    assert.equal(found, null, "Cross-tenant token should not work");

    // Cleanup
    await prisma.appointment.delete({ where: { id: appointmentB.id } });
    await prisma.guestCustomer.delete({ where: { id: guestCustomerB.id } });
    await prisma.service.delete({ where: { id: serviceB.id } });
    await prisma.serviceCategory.delete({ where: { id: serviceCategoryB.id } });
    await prisma.organizationCapability.deleteMany({ where: { organizationId: orgB.id } });
    await prisma.organization.delete({ where: { id: orgB.id } });
  });

  it("authenticated CUSTOMER appointment access still works", async () => {
    const slot = futureAppointmentSlot(11, 9);
    // Create a customer user
    const customer = await prisma.user.create({
      data: {
        name: `Test Customer ${Date.now()}`,
        phone: "09123456780",
        email: "customer@example.com",
        password: "hashed",
        role: "CUSTOMER",
        isTeamMember: false,
      },
    });

    await prisma.customerClubMembership.create({
      data: {
        organizationId,
        customerId: customer.id,
        status: "ACTIVE",
        source: "PUBLIC_SHOP",
      },
    });

    const customerAppointment = await appointmentService.create(customer.id, {
      serviceId,
      ...slot,
    });

    assert.ok(customerAppointment.appointment);
    assert.equal(customerAppointment.appointment.customerId, customer.id);
    assert.ok(!customerAppointment.appointment.trackingTokenHash, "Customer appointments should not have tracking tokens");

    // Cleanup
    await prisma.appointment.delete({ where: { id: customerAppointment.appointment.id } });
    await prisma.customerClubMembership.delete({ where: { organizationId_customerId: { organizationId, customerId: customer.id } } });
    await prisma.user.delete({ where: { id: customer.id } });
  });

  it("legacy appointments without tracking token handled gracefully", async () => {
    // Create appointment without tracking token (legacy)
    const legacyAppointment = await prisma.appointment.create({
      data: {
        date: new Date("2030-01-01"),
        startTime: new Date("2030-01-01T10:00:00.000Z"),
        endTime: new Date("2030-01-01T10:30:00.000Z"),
        status: "PENDING",
        serviceId,
        guestCustomerId,
        bookingReference: "LEGACY123",
        // No trackingTokenHash or trackingTokenExpiresAt
      },
    });

    // Lookup by booking reference should work but not expose tracking token
    const found = await prisma.appointment.findFirst({
      where: { bookingReference: "LEGACY123", deletedAt: null },
      select: { id: true, trackingTokenHash: true, trackingTokenExpiresAt: true },
    });

    assert.ok(found);
    assert.equal(found.trackingTokenHash, null);
    assert.equal(found.trackingTokenExpiresAt, null);

    // Cleanup
    await prisma.appointment.delete({ where: { id: legacyAppointment.id } });
  });

  it("concurrent tracking token operations preserve authorization", async () => {
    // Create multiple appointments with tokens
    const tokens = [];
    const appointments = [];

    for (let i = 0; i < 3; i++) {
      const { token, hash } = generateTestToken();
      const apt = await prisma.appointment.create({
        data: {
          date: new Date(`2030-01-${String(i + 10).padStart(2, "0")}`),
          startTime: new Date(`2030-01-${String(i + 10).padStart(2, "0")}T08:00:00.000Z`),
          endTime: new Date(`2030-01-${String(i + 10).padStart(2, "0")}T08:30:00.000Z`),
          status: "PENDING",
          serviceId,
          guestCustomerId,
          trackingTokenHash: hash,
          trackingTokenExpiresAt: new Date(Date.now() + 86400000),
        },
      });
      tokens.push(token);
      appointments.push(apt);
    }

    // All tokens should work independently
    for (const token of tokens) {
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const found = await prisma.appointment.findFirst({
        where: {
          trackingTokenHash: tokenHash,
          trackingTokenExpiresAt: { gt: new Date() },
          deletedAt: null,
        },
      });
      assert.ok(found);
    }

// Cleanup
    for (const apt of appointments) {
      await prisma.appointment.delete({ where: { id: apt.id } });
    }
  });

  // HTTP Route Handler Tests
  describe("HTTP Route Handlers", () => {
    let orgSlug = "";
    let testTrackingToken = "";
    let testBookingReference = "";

    before(async () => {
      // Get the organization slug from the setup
      const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { slug: true } });
      orgSlug = org?.slug || "";
      testTrackingToken = trackingToken;
      testBookingReference = bookingReference;
    });

    function makeRequest(body: unknown, origin = "https://platform.example") {
      return new NextRequest("https://platform.example/api/public/appointments/lookup", {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    function makeTrackRequest(token: string, host = tenantHost) {
      return new NextRequest(`https://${host}/api/public/appointments/track`, {
        method: "POST",
        headers: { host, "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
    }

    it("POST /lookup - phone-only returns generic anti-enumeration response", async () => {
      const { POST: lookupPOST } = await import("../../app/api/public/appointments/lookup/route");
      const response = await lookupPOST(makeRequest({ phone: "09123456789", organizationSlug: orgSlug }));
      assert.equal(response.status, 200);
      const json = await response.json();
      assert.equal(json.message, "Tracking credentials are provided at booking. Phone based recovery is unavailable.");
      assert.equal("appointments" in json, false);
    });

    it("POST /lookup - phone-only for non-existent org returns generic response (no enumeration)", async () => {
      const { POST: lookupPOST } = await import("../../app/api/public/appointments/lookup/route");
      const response = await lookupPOST(makeRequest({ phone: "09123456789", organizationSlug: "non-existent-org" }));
      assert.equal(response.status, 200);
      const json = await response.json();
      assert.equal(json.message, "Tracking credentials are provided at booking. Phone based recovery is unavailable.");
      assert.equal(response.headers.get("Cache-Control"), "no-store, no-cache, must-revalidate, private");
    });

    it("POST /lookup - booking reference only returns generic OTP prompt", async () => {
      const { POST: lookupPOST } = await import("../../app/api/public/appointments/lookup/route");
      const response = await lookupPOST(makeRequest({ bookingReference: testBookingReference, organizationSlug: orgSlug }));
      assert.equal(response.status, 200);
      const json = await response.json();
      assert.equal(json.message, "Tracking credentials are provided at booking. Phone based recovery is unavailable.");
    });

    it("POST /lookup - booking reference + phone + OTP without phone match returns generic", async () => {
      const { POST: lookupPOST } = await import("../../app/api/public/appointments/lookup/route");
      const response = await lookupPOST(makeRequest({
        bookingReference: testBookingReference,
        phone: "09999999999",
        otpCode: "123456",
        organizationSlug: orgSlug,
      }));
      assert.equal(response.status, 200);
      const json = await response.json();
      assert.equal(json.message, "Tracking credentials are provided at booking. Phone based recovery is unavailable.");
    });

    it("POST /track - valid token returns appointment with security headers", async () => {
      const { POST: trackPOST } = await import("../../app/api/public/appointments/track/route");
      const response = await trackPOST(makeTrackRequest(testTrackingToken));
      assert.equal(response.status, 200);
      const json = await response.json();
      assert.ok(json.appointment);
      assert.equal(json.appointment.bookingReference, bookingReference);
      assert.equal(json.appointment.service.name, "Test Service");
      assert.equal("trackingTokenHash" in json.appointment, false);
      assert.equal("id" in json.appointment, false);
      // Security headers
      assert.equal(response.headers.get("Cache-Control"), "no-store, no-cache, must-revalidate, private");
      assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
      assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    });

    it("POST /track - invalid token returns 404", async () => {
      const { POST: trackPOST } = await import("../../app/api/public/appointments/track/route");
      const response = await trackPOST(makeTrackRequest("A".repeat(43)));
      assert.equal(response.status, 404);
      const json = await response.json();
      assert.equal(json.error, "Appointment not found or tracking expired");
    });

    it("POST /track - malformed token returns 400", async () => {
      const { POST: trackPOST } = await import("../../app/api/public/appointments/track/route");
      const response = await trackPOST(makeTrackRequest("short"));
      assert.equal(response.status, 400);
      const json = await response.json();
      assert.equal(json.error, "Invalid tracking token");
    });

    it("POST /track - cross-tenant token from org B cannot access org A appointment", async () => {
      // Create second organization
      const orgB = await prisma.organization.create({
        data: {
          name: "GF1 Test Org B HTTP",
          slug: `gf1-test-b-http-${Date.now()}`,
          type: "APPOINTMENT",
          capabilitiesInitializedAt: new Date(),
        },
      });
      await prisma.organizationCapability.create({
        data: { organizationId: orgB.id, key: "APPOINTMENT", status: "ACTIVE", enabledAt: new Date() },
      });
      const hostB = `${orgB.slug}.example.test`;
      await prisma.organizationDomain.create({
        data: {
          organizationId: orgB.id,
          domain: hostB,
          normalizedDomain: hostB,
          status: "ACTIVE",
          providerVerified: true,
          dnsConfigured: true,
          sslReady: true,
          verifiedAt: new Date(),
        },
      });
      const serviceCategoryB = await prisma.serviceCategory.create({
        data: { organizationId: orgB.id, name: "Test Category B", slug: "test-category-b" },
      });
      const serviceB = await prisma.service.create({
        data: { organizationId: orgB.id, categoryId: serviceCategoryB.id, name: "Test Service B", slug: "test-service-b", duration: 30, price: 100, isActive: true },
      });
      const guestCustomerB = await prisma.guestCustomer.create({
        data: { sessionId: `test-session-b-http-${Date.now()}`, name: "Test Guest B", firstName: "Test", lastName: "Guest B", phone: "09123456788", email: "testb@example.com" },
      });
      const { token, hash } = generateTestToken();
      const appointmentB = await prisma.appointment.create({
        data: { date: new Date("2030-01-01"), startTime: new Date("2030-01-01T08:00:00.000Z"), endTime: new Date("2030-01-01T08:30:00.000Z"), status: "PENDING", serviceId: serviceB.id, guestCustomerId: guestCustomerB.id, trackingTokenHash: hash, trackingTokenExpiresAt: new Date(Date.now() + 86400000) },
      });

      const { POST: trackPOST } = await import("../../app/api/public/appointments/track/route");
      const ownTenantResponse = await trackPOST(makeTrackRequest(token, hostB));
      assert.equal(ownTenantResponse.status, 200, "Tenant B token works on Tenant B's host");
      assert.equal((await ownTenantResponse.json()).appointment.service.organization.slug, orgB.slug);

      const unrelatedTenantResponse = await trackPOST(makeTrackRequest(token, tenantHost));
      assert.equal(unrelatedTenantResponse.status, 404, "Tenant B token is rejected on Tenant A's host");

      // Cleanup
      await prisma.appointment.delete({ where: { id: appointmentB.id } });
      await prisma.guestCustomer.delete({ where: { id: guestCustomerB.id } });
      await prisma.service.delete({ where: { id: serviceB.id } });
      await prisma.serviceCategory.delete({ where: { id: serviceCategoryB.id } });
      await prisma.organizationDomain.deleteMany({ where: { organizationId: orgB.id } });
      await prisma.organizationCapability.deleteMany({ where: { organizationId: orgB.id } });
      await prisma.organization.delete({ where: { id: orgB.id } });
    });

it("POST /lookup - legacy appointment without tracking token handled gracefully", async () => {
      const legacyAppointment = await prisma.appointment.create({
        data: { date: new Date("2030-01-01"), startTime: new Date("2030-01-01T10:00:00.000Z"), endTime: new Date("2030-01-01T10:30:00.000Z"), status: "PENDING", serviceId, guestCustomerId, bookingReference: "LEGACY-HTTP" },
      });

      const { POST: lookupPOST } = await import("../../app/api/public/appointments/lookup/route");
      const response = await lookupPOST(makeRequest({ bookingReference: "LEGACY-HTTP", organizationSlug: orgSlug }));
      assert.equal(response.status, 200);
      const json = await response.json();
      assert.equal(json.message, "Tracking credentials are provided at booking. Phone based recovery is unavailable.");

      await prisma.appointment.delete({ where: { id: legacyAppointment.id } });
    });

    it("POST /lookup - error responses never leak sensitive details", async () => {
      const { POST: lookupPOST } = await import("../../app/api/public/appointments/lookup/route");
      const response = await lookupPOST(makeRequest({ phone: "09123456789", organizationSlug: orgSlug }));
      assert.equal(response.status, 200);
      const json = await response.json();
      assert.equal(typeof json.message, "string");
      assert.ok(json.message.length > 0);
      assert.equal("stack" in json, false);
      assert.equal("error" in json, false); // No error field on success
    });
  });
});
