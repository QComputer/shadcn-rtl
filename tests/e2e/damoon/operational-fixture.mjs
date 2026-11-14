import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function guardedDatabase() {
  const env = process.env;
  if (env.NODE_ENV !== "test" || env.DAMOON_E2E_ENABLED !== "1" || env.VERCEL_ENV === "production" || env.VERCEL) {
    throw new Error("Damoon operational fixtures require isolated test mode");
  }
  if (env.DATABASE_URL !== env.DIRECT_URL) throw new Error("Fixture DATABASE_URL and DIRECT_URL must match");
  const url = new URL(env.DATABASE_URL || "https://invalid.local");
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (url.protocol !== "postgresql:" || !["127.0.0.1", "::1", "localhost"].includes(url.hostname) || url.port !== "5432" || url.searchParams.get("schema") !== "public" || !/^damoon_[a-f0-9]{16}$/i.test(databaseName) || env.DAMOON_CI_DATABASE_NAME !== databaseName) {
    throw new Error("Fixture database must be the workflow-owned loopback damoon_<16 hex> database");
  }
  const required = ["DAMOON_ORGANIZATION_ID", "DAMOON_PROPERTY_ID", "DAMOON_ROOM_TYPE_SLUG", "DAMOON_RATE_PLAN_CODE"];
  if (required.some((name) => !env[name]?.trim())) throw new Error("Synthetic Damoon seed identifiers are required");
  if (env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED !== "1" || env.HOTEL_GUEST_PORTAL_ENABLED !== "1" || env.HOTEL_OFFLINE_PAYMENT_OPERATIONAL_ENABLED !== "1") {
    throw new Error("Operational reservation, guest portal, and offline payment gates must be explicitly enabled for this disposable acceptance");
  }
  if (env.HOTEL_PAYMENT_OPERATIONAL_ENABLED === "1" || env.HOTEL_PAYMENT_SIMULATOR_ENABLED === "1" || env.HOTEL_SMS_ENABLED === "1" || env.CUSTOMER_AUTH_SMS_WORKER_ENABLED === "1") {
    throw new Error("Real or simulated payment processing and SMS must remain disabled");
  }
  return { url, databaseName, databaseUser: decodeURIComponent(url.username) };
}

/** Adds only synthetic login/resource/configuration fixtures to the existing empty CI acceptance DB. */
export async function seedOperationalGuestFixture() {
  const target = guardedDatabase();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.url.toString(), max: 4 }), log: [] });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
  const username = `damoon-op-guest-${suffix}`;
  const password = randomBytes(24).toString("base64url");
  try {
    await db.$connect();
    const [identity] = await db.$queryRaw`SELECT current_database() AS database, current_user AS role, current_schema() AS schema, inet_server_port() AS port`;
    if (identity?.database !== target.databaseName || identity.role !== target.databaseUser || identity.schema !== "public" || Number(identity.port) !== 5432) throw new Error("Connected database identity did not match the disposable fixture target");

    const organizationId = process.env.DAMOON_ORGANIZATION_ID;
    const propertyId = process.env.DAMOON_PROPERTY_ID;
    const organization = await db.organization.findFirst({ where: { id: organizationId, vertical: "HOTEL", isActive: true, deletedAt: null }, select: { id: true } });
    const property = await db.hotelProperty.findFirst({ where: { id: propertyId, organizationId, isActive: true, deletedAt: null }, select: { id: true } });
    const roomType = await db.hotelRoomType.findFirst({ where: { organizationId, propertyId, slug: process.env.DAMOON_ROOM_TYPE_SLUG, isActive: true, deletedAt: null }, select: { id: true } });
    const ratePlan = await db.hotelRatePlan.findFirst({ where: { organizationId, propertyId, code: process.env.DAMOON_RATE_PLAN_CODE, isActive: true }, select: { id: true } });
    if (!organization || !property || !roomType || !ratePlan) throw new Error("Existing Damoon seed does not contain the expected tenant, property, room type, and rate plan");

    const user = await db.user.create({ data: { name: username, password: await bcrypt.hash(password, 10), role: "CUSTOMER", isTeamMember: false, isActive: true, locale: "fa" }, select: { id: true } });
    await db.customerClubMembership.create({ data: { organizationId, customerId: user.id, status: "ACTIVE", source: "PUBLIC_SHOP" } });

    const policy = await db.hotelCancellationPolicy.create({ data: {
      organizationId, propertyId, key: `ci-${suffix}`, name: "Synthetic CI policy", freeCancellationCutoffHours: 24, fullCancellationRetention: 0,
      cancellationTiers: [{ cutoffHours: 24, retentionBasisPoints: 0, penaltyBasis: "RESERVATION_TOTAL" }], isActive: true, version: 1,
    } });
    await db.hotelRatePlan.update({ where: { id: ratePlan.id }, data: { cancellationPolicyId: policy.id } });
    await db.hotelProperty.update({ where: { id: propertyId }, data: { operationalMode: "RESERVATION", manualConfirmationPolicy: "CASH_ON_ARRIVAL", allowedOfflinePaymentMethods: ["CASH"], minimumVerifiedDepositAmount: null } });

    const room = await db.hotelRoom.create({ data: { organizationId, propertyId, roomTypeId: roomType.id, code: `CI-${suffix.slice(0, 8)}`, floor: "CI", isActive: true } });
    return { username, password, roomId: room.id, roomTypeId: roomType.id, ratePlanId: ratePlan.id, organizationId, propertyId };
  } finally {
    await db.$disconnect();
  }
}
