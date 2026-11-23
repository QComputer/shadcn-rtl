import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import prisma from "@/lib/db";

const ORG = "damoon-hotel";
const PROPERTY = "damoon-demo";
const ROOM_TYPE = "demo-double";
const RATE_PLAN = "demo-rate";
const POLICY = "damoon-demo-no-charge-v1";
const RATE_DEFAULT = 125_000;

async function authorizedOrganization(request: Request) {
  const session = await requireAuthSession(request);
  if (!["ADMIN", "MANAGER", "STAFF"].includes(session.user.role)) return null;
  const memberships = await prisma.organizationMember.findMany({
    where: { userId: session.user.id, isActive: true, role: { in: ["ADMIN", "MANAGER", "STAFF"] } },
    select: { role: true, organization: { select: { id: true, slug: true, vertical: true, isActive: true, deletedAt: true } } },
  });
  const membership = memberships.find(({ organization }) =>
    organization.vertical === "HOTEL" && organization.isActive && !organization.deletedAt &&
    (organization.slug === ORG || (process.env.DAMOON_LOCAL_E2E === "1" && organization.slug.startsWith("damoon-e2e-"))),
  );
  return membership ? { organization: membership.organization, actorId: session.user.id, role: membership.role } : null;
}

/** Idempotently provisions only the separately scoped synthetic Damoon demo catalog. */
export async function POST(request: Request) {
  try {
    requireSameOriginMutation(request);
    const access = await authorizedOrganization(request);
    if (!access) return Response.json({ error: "Damoon management access required" }, { status: 403 });
    if (!(["ADMIN", "MANAGER"].includes(access.role))) return Response.json({ error: "Hotel manager access required" }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const rate = body?.nightlyRate === undefined ? RATE_DEFAULT : Number(body.nightlyRate);
    const allotment = body?.allotment === undefined ? 2 : Number(body.allotment);
    if (!Number.isSafeInteger(rate) || rate < 1 || rate > 100_000_000 || !Number.isSafeInteger(allotment) || allotment < 1 || allotment > 10) {
      return Response.json({ error: "Synthetic rate or inventory is outside the demo limits" }, { status: 400 });
    }
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([access.organization.id, "DAMOON_DEMO_BOOKING_PROVISION"])},0))`);
      let property = await tx.hotelProperty.findFirst({ where: { organizationId: access.organization.id, slug: PROPERTY }, select: { id: true, isActive: true, deletedAt: true } });
      if (!property) property = await tx.hotelProperty.create({ data: { organizationId: access.organization.id, organizationSlug: ORG, slug: PROPERTY, name: "DEMO — Synthetic Damoon accommodation", timezone: "Asia/Tehran", currency: "TOMAN", isActive: true }, select: { id: true, isActive: true, deletedAt: true } });
      if (!property.isActive || property.deletedAt) throw new Error("The Damoon demo property is inactive; an administrator must review it.");
      let roomType = await tx.hotelRoomType.findFirst({ where: { organizationId: access.organization.id, propertyId: property.id, slug: ROOM_TYPE }, select: { id: true } });
      if (!roomType) roomType = await tx.hotelRoomType.create({ data: { organizationId: access.organization.id, propertyId: property.id, slug: ROOM_TYPE, name: "DEMO — Synthetic double room", maxAdults: 2, maxChildren: 2, maxOccupancy: 4, beds: [{ kind: "queen", count: 1 }], totalAllotment: allotment }, select: { id: true } });
      let policy = await tx.hotelCancellationPolicy.findFirst({ where: { organizationId: access.organization.id, propertyId: property.id, key: POLICY }, select: { id: true } });
      if (!policy) policy = await tx.hotelCancellationPolicy.create({ data: { organizationId: access.organization.id, propertyId: property.id, key: POLICY, name: "DEMO — No-charge demonstration terms", freeCancellationCutoffHours: 0, fullCancellationRetention: 0, cancellationTiers: [], isActive: true, version: 1 }, select: { id: true } });
      let ratePlan = await tx.hotelRatePlan.findFirst({ where: { organizationId: access.organization.id, propertyId: property.id, roomTypeId: roomType.id, code: RATE_PLAN }, select: { id: true } });
      if (!ratePlan) ratePlan = await tx.hotelRatePlan.create({ data: { organizationId: access.organization.id, propertyId: property.id, roomTypeId: roomType.id, code: RATE_PLAN, name: "DEMO — Synthetic sample price", currency: "TOMAN", baseNightlyRate: BigInt(rate), mealPlan: "none", minNights: 1, maxNights: 0, cancellationPolicyId: policy.id, isActive: true }, select: { id: true } });
      else await tx.hotelRatePlan.update({ where: { id: ratePlan.id }, data: { baseNightlyRate: BigInt(rate), isActive: true } });
      const start = new Date(); start.setUTCHours(0, 0, 0, 0);
      const nights = Array.from({ length: 365 }, (_, index) => ({ id: randomUUID(), organizationId: access.organization.id, propertyId: property!.id, roomTypeId: roomType!.id, date: new Date(start.getTime() + index * 86_400_000), allotment, booked: 0, held: 0, outOfService: 0 }));
      await tx.hotelInventory.createMany({ data: nights, skipDuplicates: true });
      return { propertyId: property.id, roomTypeId: roomType.id, ratePlanId: ratePlan.id, nightlyRate: String(rate), currency: "TOMAN", synthetic: true, mode: "DEMO_BOOKING" };
    }, { isolationLevel: "Serializable" });
    return Response.json(result, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function GET(request: Request) {
  try {
    const access = await authorizedOrganization(request);
    if (!access) return Response.json({ available: false }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    const property = await prisma.hotelProperty.findFirst({ where: { organizationId: access.organization.id, slug: PROPERTY, isActive: true, deletedAt: null }, select: { id: true } });
    const plan = property ? await prisma.hotelRatePlan.findFirst({ where: { organizationId: access.organization.id, propertyId: property.id, code: RATE_PLAN, isActive: true }, select: { baseNightlyRate: true } }) : null;
    return Response.json({ available: true, configured: Boolean(property && plan), canConfigure: ["ADMIN", "MANAGER"].includes(access.role), propertyId: property?.id ?? null, nightlyRate: plan?.baseNightlyRate.toString() ?? String(RATE_DEFAULT), mode: "DEMO_BOOKING" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
