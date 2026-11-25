import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { ApiError, jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import prisma from "@/lib/db";

const ORG = "damoon-hotel";
const PROPERTY = "damoon-demo";
const ROOM_TYPE = "demo-double";
const RATE_PLAN = "demo-rate";
const POLICY = "damoon-demo-no-charge-v1";
const RATE_DEFAULT = 125_000;
const CATALOG_VERSION = "DAMOON_31_UNIT_V1";
const CATALOG = [
  { slug: "demo-single", count: 3, adults: 1, en: "DEMO — Single room", fa: "نمایشی — اتاق یک‌نفره", ar: "تجريبي — غرفة مفردة" },
  { slug: "demo-double", count: 17, adults: 2, en: "DEMO — Synthetic double room", fa: "نمایشی — اتاق دونفره", ar: "تجريبي — غرفة مزدوجة" },
  { slug: "demo-suite-3", count: 6, adults: 3, en: "DEMO — Three-person suite", fa: "نمایشی — سوئیت سه‌نفره", ar: "تجريبي — جناح لثلاثة أشخاص" },
  { slug: "demo-suite-4", count: 3, adults: 4, en: "DEMO — Four-person suite", fa: "نمایشی — سوئیت چهارنفره", ar: "تجريبي — جناح لأربعة أشخاص" },
  { slug: "demo-suite-5", count: 2, adults: 5, en: "DEMO — Five-person suite", fa: "نمایشی — سوئیت پنج‌نفره", ar: "تجريبي — جناح لخمسة أشخاص" },
] as const;
const rateCode = (slug: string) => slug === ROOM_TYPE ? RATE_PLAN : `demo-rate-${slug.replace(/^demo-/, "")}`;

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
    const catalogMode = body?.catalogVersion === CATALOG_VERSION;
    if (body?.catalogVersion !== undefined && !catalogMode) return Response.json({ error: "Unsupported demo catalog version" }, { status: 400 });
    const rate = body?.nightlyRate === undefined ? RATE_DEFAULT : Number(body.nightlyRate);
    const allotment = body?.allotment === undefined ? 2 : Number(body.allotment);
    if (catalogMode && body?.rates !== undefined && (!body.rates || typeof body.rates !== "object" || Array.isArray(body.rates))) {
      return Response.json({ error: "Demo rates must be a category-to-amount object" }, { status: 400 });
    }
    const requestedRates = body?.rates && typeof body.rates === "object" && !Array.isArray(body.rates) ? body.rates as Record<string, unknown> : {};
    const rateEntries = CATALOG.map(({ slug }) => {
      const value = requestedRates[slug] ?? (slug === ROOM_TYPE ? rate : RATE_DEFAULT);
      const amount = Number(value);
      return [slug, amount];
    });
    const rates = Object.fromEntries(rateEntries) as Record<(typeof CATALOG)[number]["slug"], number>;
    if ((!catalogMode && (!Number.isSafeInteger(rate) || rate < 1 || rate > 100_000_000 || !Number.isSafeInteger(allotment) || allotment < 1 || allotment > 10)) || (catalogMode && (Object.keys(requestedRates).some(key => !CATALOG.some(category => category.slug === key)) || rateEntries.some(([, amount]) => !Number.isSafeInteger(amount) || Number(amount) < 1 || Number(amount) > 100_000_000)))) {
      return Response.json({ error: "Synthetic rate or inventory is outside the demo limits" }, { status: 400 });
    }
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([access.organization.id, "DAMOON_DEMO_BOOKING_PROVISION"])},0))`);
      let property = await tx.hotelProperty.findFirst({ where: { organizationId: access.organization.id, slug: PROPERTY }, select: { id: true, isActive: true, deletedAt: true } });
      if (!property) property = await tx.hotelProperty.create({ data: { organizationId: access.organization.id, organizationSlug: access.organization.slug, slug: PROPERTY, name: "DEMO — Synthetic Damoon accommodation", timezone: "Asia/Tehran", currency: "TOMAN", isActive: true }, select: { id: true, isActive: true, deletedAt: true } });
      if (!property.isActive || property.deletedAt) throw new ApiError(409, "The Damoon demo property is inactive; an administrator must review it.");
      if (catalogMode) {
        const policy = await tx.hotelCancellationPolicy.upsert({
          where: { propertyId_key: { propertyId: property.id, key: POLICY } },
          update: {},
          create: { organizationId: access.organization.id, propertyId: property.id, key: POLICY, name: "DEMO — No-charge demonstration terms", freeCancellationCutoffHours: 0, fullCancellationRetention: 0, cancellationTiers: [], isActive: true, version: 1 },
          select: { id: true, isActive: true },
        });
        if (!policy.isActive) throw new ApiError(409, "The demo cancellation policy is inactive and needs manager review.");
        const start = new Date(); start.setUTCHours(0, 0, 0, 0);
        const categoryResults = [];
        for (let index = 0; index < CATALOG.length; index += 1) {
          const category = CATALOG[index];
          const existing = await tx.hotelRoomType.findFirst({ where: { organizationId: access.organization.id, propertyId: property.id, slug: category.slug }, select: { id: true, isActive: true, deletedAt: true } });
          if (existing && (!existing.isActive || existing.deletedAt)) throw new ApiError(409, `Demo category ${category.slug} is inactive and needs manager review.`);
          const roomType = existing
            ? await tx.hotelRoomType.update({ where: { id: existing.id }, data: { totalAllotment: category.count, sortOrder: index, localizedContent: { fa: category.fa, en: category.en, ar: category.ar }, description: "Synthetic demonstration category only. Room layout and amenities are not represented as verified hotel facts." }, select: { id: true } })
            : await tx.hotelRoomType.create({ data: {
              organizationId: access.organization.id, propertyId: property.id, slug: category.slug,
              name: category.en, localizedContent: { fa: category.fa, en: category.en, ar: category.ar },
              description: "Synthetic demonstration category only. Room layout and amenities are not represented as verified hotel facts.",
              maxAdults: category.adults, maxChildren: 0, maxOccupancy: category.adults,
              beds: [{ kind: "single", count: category.adults }], totalAllotment: category.count, sortOrder: index,
            }, select: { id: true } });
          const existingPlan = await tx.hotelRatePlan.findFirst({ where: { organizationId: access.organization.id, propertyId: property.id, code: rateCode(category.slug) }, select: { id: true, roomTypeId: true, isActive: true } });
          if (existingPlan && (existingPlan.roomTypeId !== roomType.id || !existingPlan.isActive)) throw new ApiError(409, `Demo rate ${rateCode(category.slug)} needs manager review.`);
          const ratePlan = existingPlan
            ? await tx.hotelRatePlan.update({ where: { id: existingPlan.id }, data: { baseNightlyRate: BigInt(rates[category.slug]) }, select: { id: true, baseNightlyRate: true } })
            : await tx.hotelRatePlan.create({ data: { organizationId: access.organization.id, propertyId: property.id, roomTypeId: roomType.id, code: rateCode(category.slug), name: `DEMO — Synthetic sample rate (${category.en.replace("DEMO — ", "")})`, currency: "TOMAN", baseNightlyRate: BigInt(rates[category.slug]), mealPlan: "none", minNights: 1, maxNights: 0, cancellationPolicyId: policy.id, isActive: true }, select: { id: true, baseNightlyRate: true } });
          const codes = Array.from({ length: category.count }, (_, roomIndex) => `${category.slug.toUpperCase().replaceAll("-", "_")}-${String(roomIndex + 1).padStart(3, "0")}`);
          await tx.hotelRoom.createMany({ data: codes.map(code => ({ id: randomUUID(), organizationId: access.organization.id, propertyId: property!.id, roomTypeId: roomType.id, code, description: "Synthetic demo room", isActive: true })), skipDuplicates: true });
          const rooms = await tx.hotelRoom.findMany({ where: { organizationId: access.organization.id, propertyId: property.id, roomTypeId: roomType.id, code: { in: codes }, isActive: true, deletedAt: null }, select: { id: true, code: true } });
          if (rooms.length !== category.count) throw new ApiError(409, `Demo category ${category.slug} has a conflicting room-code assignment.`);
          const dates = Array.from({ length: 365 }, (_, dayIndex) => new Date(start.getTime() + dayIndex * 86_400_000));
          await tx.hotelInventory.createMany({ data: dates.map(date => ({ id: randomUUID(), organizationId: access.organization.id, propertyId: property!.id, roomTypeId: roomType.id, date, allotment: category.count, booked: 0, held: 0, outOfService: 0 })), skipDuplicates: true });
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelInventory" WHERE "organizationId"=${access.organization.id} AND "propertyId"=${property.id} AND "roomTypeId"=${roomType.id} AND "date">=${start} AND "date"<${new Date(start.getTime() + 365 * 86_400_000)} FOR UPDATE`);
          const inventory = await tx.hotelInventory.findMany({ where: { organizationId: access.organization.id, propertyId: property.id, roomTypeId: roomType.id, date: { gte: start, lt: new Date(start.getTime() + 365 * 86_400_000) } }, select: { id: true, booked: true, held: true, outOfService: true } });
          if (inventory.some(night => night.booked + night.held + night.outOfService > category.count)) throw new ApiError(409, `Demo category ${category.slug} has committed inventory above its ${category.count}-room synthetic limit.`);
          await tx.hotelInventory.updateMany({ where: { organizationId: access.organization.id, propertyId: property.id, roomTypeId: roomType.id, date: { gte: start, lt: new Date(start.getTime() + 365 * 86_400_000) } }, data: { allotment: category.count } });
          categoryResults.push({ slug: category.slug, roomTypeId: roomType.id, ratePlanId: ratePlan.id, quantity: category.count, nightlyRate: ratePlan.baseNightlyRate.toString(), physicalRoomCount: rooms.length });
        }
        return { propertyId: property.id, catalogVersion: CATALOG_VERSION, categories: categoryResults, totalUnits: categoryResults.reduce((sum, item) => sum + item.quantity, 0), synthetic: true, mode: "DEMO_BOOKING" };
      }
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
    const plans = property ? await prisma.hotelRatePlan.findMany({ where: { organizationId: access.organization.id, propertyId: property.id, isActive: true, code: { in: CATALOG.map(category => rateCode(category.slug)) } }, select: { code: true, roomTypeId: true, baseNightlyRate: true } }) : [];
    const [roomCounts, roomTypes] = property ? await Promise.all([
      prisma.hotelRoom.groupBy({
        by: ["roomTypeId"],
        where: { organizationId: access.organization.id, propertyId: property.id, isActive: true, deletedAt: null },
        _count: { _all: true },
      }),
      prisma.hotelRoomType.findMany({ where: { organizationId: access.organization.id, propertyId: property.id, slug: { in: CATALOG.map(category => category.slug) }, isActive: true, deletedAt: null }, select: { id: true, slug: true } }),
    ]) : [[], []];
    const categories = CATALOG.map(category => {
      const roomType = roomTypes.find(item => item.slug === category.slug);
      const ratePlan = plans.find(plan => plan.code === rateCode(category.slug) && plan.roomTypeId === roomType?.id);
      const physicalRoomCount = roomCounts.find(item => item.roomTypeId === roomType?.id)?._count._all ?? 0;
      return { slug: category.slug, quantity: category.count, physicalRoomCount, nightlyRate: ratePlan?.baseNightlyRate.toString() ?? String(RATE_DEFAULT) };
    });
    const configured = Boolean(property && categories.every(category => category.physicalRoomCount === category.quantity && plans.some(plan => plan.code === rateCode(category.slug) && plan.roomTypeId === roomTypes.find(item => item.slug === category.slug)?.id)));
    const physicalRoomCount = categories.reduce((sum, category) => sum + category.physicalRoomCount, 0);
    return Response.json({ available: true, configured, catalogVersion: configured ? CATALOG_VERSION : null, canConfigure: ["ADMIN", "MANAGER"].includes(access.role), propertyId: property?.id ?? null, nightlyRate: plans.find(plan => plan.code === RATE_PLAN)?.baseNightlyRate.toString() ?? String(RATE_DEFAULT), categories, totalUnits: CATALOG.reduce((sum, category) => sum + category.count, 0), physicalRoomCount, mode: "DEMO_BOOKING" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
