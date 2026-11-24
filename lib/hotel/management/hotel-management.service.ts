import { Prisma, type PrismaClient } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { prisma as defaultPrisma } from "@/lib/db-runtime";
import { canTransitionHotelGuestBookingRequest, HOTEL_GUEST_REQUEST_STATUSES, type HotelGuestBookingRequestStatus } from "@/lib/hotel/domain/guest-booking-request";
import { PrismaHotelRepositories } from "@/lib/hotel/persistence/prisma-hotel-repositories";
import { searchPublicHotelAvailability, serializePublicAvailability } from "@/lib/hotel/services/public-availability.service";
import type { AvailabilityQuery } from "@/lib/hotel/domain/types";
import { enumerateStayNights } from "@/lib/hotel/domain/stay-dates";
import { buildHotelRoomBoard } from "@/lib/hotel/management/room-board";
import { authorizeHotelBookingActor } from "@/lib/hotel/services/booking-context";
import { isDamoonDemoOrganizationSlug } from "@/lib/hotel/services/damoon-demo-booking";

export type HotelManagementPrincipal = {
  readonly userId: string;
  readonly role: "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER" | "GUEST";
  readonly organizationId?: string | null;
};

export type HotelManagementScope = { readonly organizationId: string };
export type PhysicalRoomCreationInput = { propertyId: string; roomTypeId: string; code: string; floor?: string; description?: string; isOutOfService?: boolean };
type Db = PrismaClient;
export type HotelInventoryInitializationResult = {
  from: string; to: string; requestedNights: number; createdNights: string[];
  createdCount: number; skippedExistingCount: number; allotment: number;
};

export class HotelManagementAuthorizationError extends Error {}
export class HotelManagementValidationError extends Error {}
export class HotelManagementConflictError extends Error {}

const MANAGEMENT_LOCALES = ["fa", "en", "ar"] as const;
type ManagementLocale = (typeof MANAGEMENT_LOCALES)[number];
type LocalizedContent = Partial<Record<ManagementLocale, string>>;
type CancellationTier = {
  cutoffHours: number;
  retentionBasisPoints: number;
  penaltyBasis: "RESERVATION_TOTAL" | "FIRST_NIGHT";
};

function assertText(value: string, name: string, max = 200) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    throw new HotelManagementValidationError(`${name} is required`);
  }
}

function assertClock(value: string, name: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new HotelManagementValidationError(`${name} must be HH:mm`);
}

function assertTimezone(value: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(); }
  catch { throw new HotelManagementValidationError("Invalid IANA timezone"); }
}

function assertLocalizedContent(value: LocalizedContent | undefined) {
  if (value === undefined) return;
  for (const [locale, text] of Object.entries(value)) {
    if (!(MANAGEMENT_LOCALES as readonly string[]).includes(locale) || typeof text !== "string" || text.length > 4000) {
      throw new HotelManagementValidationError("Localized content must use fa, en, or ar and contain bounded text");
    }
  }
}

function assertTiers(tiers: readonly CancellationTier[] | undefined) {
  if (tiers === undefined) return;
  let previous = Number.POSITIVE_INFINITY;
  for (const tier of tiers) {
    if (!Number.isSafeInteger(tier.cutoffHours) || tier.cutoffHours < 0 || tier.cutoffHours >= previous) throw new HotelManagementValidationError("Cancellation tiers must be ordered by descending cutoff");
    if (!Number.isSafeInteger(tier.retentionBasisPoints) || tier.retentionBasisPoints < 0 || tier.retentionBasisPoints > 10000) throw new HotelManagementValidationError("Invalid cancellation retention");
    if (tier.penaltyBasis !== "RESERVATION_TOTAL" && tier.penaltyBasis !== "FIRST_NIGHT") throw new HotelManagementValidationError("Invalid cancellation penalty basis");
    previous = tier.cutoffHours;
  }
}

function assertInteger(value: number, name: string, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new HotelManagementValidationError(`${name} must be a safe integer >= ${minimum}`);
}

export class HotelManagementService {
  constructor(private readonly db: Db = defaultPrisma) {}

  private async authorize(principal: HotelManagementPrincipal, scope: HotelManagementScope) {
    if (!principal.userId || !scope.organizationId) throw new HotelManagementAuthorizationError("Organization management requires an authenticated organization scope");
    if (principal.role !== "SUPER_ADMIN" && principal.organizationId !== scope.organizationId) throw new HotelManagementAuthorizationError("Tenant context mismatch");
    if (principal.role !== "SUPER_ADMIN") {
      const membership = await this.db.organizationMember.findFirst({ where: { userId: principal.userId, organizationId: scope.organizationId, isActive: true, role: { in: ["ADMIN", "MANAGER"] } }, select: { id: true } });
      if (!membership) throw new HotelManagementAuthorizationError("Hotel management requires an active organization owner or manager membership");
    }
    const capability = await this.db.organizationCapability.findFirst({ where: { organizationId: scope.organizationId, key: "HOTEL_BOOKING", status: "ACTIVE" }, select: { id: true } });
    if (!capability) throw new HotelManagementAuthorizationError("HOTEL_BOOKING capability is not enabled");
  }

  protected async authorizeOperations(principal: HotelManagementPrincipal, scope: HotelManagementScope) {
    await this.authorize(principal, scope);
    const [user, organization] = await Promise.all([
      this.db.user.findFirst({ where: { id: principal.userId, role: principal.role, isActive: true, deletedAt: null }, select: { id: true } }),
      this.db.organization.findFirst({ where: { id: scope.organizationId, isActive: true, deletedAt: null, capabilities: { some: { key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: { not: null } } } }, select: { id: true } }),
    ]);
    if (!user || !organization || !["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(principal.role)) throw new HotelManagementAuthorizationError("Active hotel management authority required");
  }

  private async authorizeOwnerPreview(principal: HotelManagementPrincipal, scope: HotelManagementScope) {
    if (!principal.userId || !scope.organizationId) throw new HotelManagementAuthorizationError("Hotel owner preview requires an authenticated organization scope");
    if (principal.role !== "SUPER_ADMIN" && principal.organizationId !== scope.organizationId) throw new HotelManagementAuthorizationError("Tenant context mismatch");
    const [user, organization] = await Promise.all([
      this.db.user.findFirst({ where: { id: principal.userId, role: principal.role, isActive: true, deletedAt: null }, select: { id: true } }),
      this.db.organization.findFirst({ where: { id: scope.organizationId, isActive: true, deletedAt: null, capabilities: { some: { key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: { not: null } } } }, select: { id: true } }),
    ]);
    if (!user || !organization) throw new HotelManagementAuthorizationError("Active hotel owner authority required");
    if (principal.role === "SUPER_ADMIN") return;
    if (principal.role !== "ADMIN") throw new HotelManagementAuthorizationError("Hotel availability preview is limited to organization owners");
    const membership = await this.db.organizationMember.findFirst({ where: { userId: principal.userId, organizationId: scope.organizationId, isActive: true, role: "ADMIN" }, select: { id: true } });
    if (!membership) throw new HotelManagementAuthorizationError("An active owner membership is required for Hotel availability preview");
  }

  async getOperations(principal: HotelManagementPrincipal, scope: HotelManagementScope, propertyId: string, range: { from: Date; to: Date }) {
    await this.authorizeOperations(principal, scope);
    const fromTime = range.from.getTime();
    const toTime = range.to.getTime();
    const dayMs = 86_400_000;
    const isUtcDate = (date: Date) => Number.isFinite(date.getTime()) && date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
    const nightCount = (toTime - fromTime) / dayMs;
    if (!isUtcDate(range.from) || !isUtcDate(range.to) || !Number.isInteger(nightCount) || nightCount < 1 || nightCount > 31) throw new HotelManagementValidationError("Operations range must be 1 to 31 whole property nights");
    const property = await this.db.hotelProperty.findFirst({ where: { id: propertyId, organizationId: scope.organizationId, isActive: true, deletedAt: null }, select: { id: true, slug: true, name: true, timezone: true, currency: true, checkInTime: true, checkOutTime: true, minStayNights: true, maxStayNights: true } });
    if (!property) throw new HotelManagementAuthorizationError("Property is outside the active organization scope");
    const [roomTypes, ratePlans, inventory, cancellationPolicies, physicalCapacities, reservations, maintenanceBlocks, amenities] = await Promise.all([
      this.db.hotelRoomType.findMany({
        where: { organizationId: scope.organizationId, propertyId, isActive: true, deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true, slug: true, name: true, description: true, maxAdults: true, maxChildren: true, maxOccupancy: true, beds: true, totalAllotment: true,
          amenities: {
            where: { organizationId: scope.organizationId, amenity: { is: { organizationId: scope.organizationId, propertyId } } },
            select: { amenity: { select: { id: true, key: true, label: true, isActive: true } } },
          },
          rooms: {
            where: { organizationId: scope.organizationId, propertyId, isActive: true, deletedAt: null },
            orderBy: { code: "asc" },
            select: { id: true, code: true, floor: true, isOutOfService: true, isActive: true },
          },
        },
      }),
      this.db.hotelRatePlan.findMany({ where: { organizationId: scope.organizationId, propertyId, isActive: true }, orderBy: [{ roomTypeId: "asc" }, { code: "asc" }], select: { id: true, roomTypeId: true, code: true, name: true, currency: true, baseNightlyRate: true, minNights: true, maxNights: true, isRefundable: true, validFrom: true, validTo: true, cancellationPolicyId: true, nightlyRates: { where: { from: { lt: range.to }, to: { gt: range.from } }, orderBy: [{ from: "asc" }, { to: "asc" }], select: { id: true, from: true, to: true, nightlyRate: true, minNights: true, maxNights: true } } } }),
      this.db.hotelInventory.findMany({ where: { organizationId: scope.organizationId, propertyId, roomType: { isActive: true, deletedAt: null }, date: { gte: range.from, lt: range.to } }, orderBy: [{ date: "asc" }, { roomTypeId: "asc" }], select: { id: true, roomTypeId: true, date: true, allotment: true, booked: true, held: true, outOfService: true, closedToArrival: true, closedToDeparture: true } }),
      this.db.hotelCancellationPolicy.findMany({ where: { organizationId: scope.organizationId, propertyId }, orderBy: [{ isActive: "desc" }, { name: "asc" }], select: { id: true, key: true, name: true, freeCancellationCutoffHours: true, fullCancellationRetention: true, isActive: true, version: true } }),
      this.db.$queryRaw<Array<{ roomTypeId: string; configuredRooms: number; availableRooms: number }>>(Prisma.sql`SELECT "roomTypeId", COUNT(*)::int AS "configuredRooms", COUNT(*) FILTER (WHERE "isActive"=true AND "deletedAt" IS NULL AND "isOutOfService"=false)::int AS "availableRooms" FROM "HotelRoom" WHERE "organizationId"=${scope.organizationId} AND "propertyId"=${propertyId} GROUP BY "roomTypeId"`),
      this.db.hotelReservation.findMany({ where: { organizationId: scope.organizationId, propertyId, status: { in: ["CONFIRMED", "CHECKED_IN"] }, checkIn: { lt: range.to }, checkOut: { gt: range.from } }, orderBy: [{ checkIn: "asc" }, { reference: "asc" }], select: { reference: true, status: true, nights: { where: { date: { gte: range.from, lt: range.to } }, select: { date: true, roomId: true } } } }),
      this.db.hotelRoomMaintenanceBlock.findMany({ where: { organizationId: scope.organizationId, propertyId, releasedAt: null, from: { lt: range.to }, to: { gt: range.from } }, orderBy: [{ from: "asc" }, { roomId: "asc" }], select: { id: true, roomId: true, from: true, to: true, reason: true, room: { select: { code: true } } } }),
      this.db.hotelAmenity.findMany({ where: { organizationId: scope.organizationId, propertyId, isActive: true }, orderBy: [{ label: "asc" }, { key: "asc" }], select: { id: true, key: true, label: true } }),
    ]);
    const roomBoard = buildHotelRoomBoard({
      from: range.from.toISOString().slice(0, 10),
      to: range.to.toISOString().slice(0, 10),
      rooms: roomTypes.flatMap((roomType) => roomType.rooms.map((room) => ({ id: room.id, code: room.code, roomTypeId: roomType.id, isOutOfService: room.isOutOfService }))),
      reservations: reservations.map((reservation) => ({
        reference: reservation.reference,
        status: reservation.status as "CONFIRMED" | "CHECKED_IN",
        nights: reservation.nights.map((night) => ({ date: night.date.toISOString().slice(0, 10), roomId: night.roomId })),
      })),
      maintenanceBlocks: maintenanceBlocks.map((block) => ({ roomId: block.roomId, from: block.from.toISOString().slice(0, 10), to: block.to.toISOString().slice(0, 10) })),
    });
    return {
      property,
      range: { from: range.from.toISOString().slice(0, 10), to: range.to.toISOString().slice(0, 10), nights: nightCount },
      roomTypes: roomTypes.map((roomType) => {
        const physical = physicalCapacities.find((capacity) => capacity.roomTypeId === roomType.id);
        return { ...roomType, amenities: roomType.amenities.map((link) => link.amenity), physicalCapacity: { configuredRooms: physical?.configuredRooms ?? 0, sellableRooms: physical?.availableRooms ?? 0 } };
      }),
      amenities,
      roomBoard,
      manualRoomManagementEnabled: process.env.HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED === "1",
      maintenanceBlocks: maintenanceBlocks.map((block) => ({ id: block.id, roomId: block.roomId, roomCode: block.room.code, from: block.from.toISOString().slice(0, 10), to: block.to.toISOString().slice(0, 10), reason: block.reason })),
      ratePlans: ratePlans.map((plan) => ({ ...plan, baseNightlyRate: plan.baseNightlyRate.toString(), validFrom: plan.validFrom?.toISOString().slice(0, 10) ?? null, validTo: plan.validTo?.toISOString().slice(0, 10) ?? null, nightlyRates: plan.nightlyRates.map((rate) => ({ ...rate, from: rate.from.toISOString().slice(0, 10), to: rate.to.toISOString().slice(0, 10), nightlyRate: rate.nightlyRate?.toString() ?? null })) })),
      inventory: inventory.map((night) => {
        const physical = physicalCapacities.find((capacity) => capacity.roomTypeId === night.roomTypeId);
        const stockRemaining = night.allotment - night.booked - night.held - night.outOfService;
        const roomType = roomTypes.find((type) => type.id === night.roomTypeId);
        const roomRemaining = physical ? physical.availableRooms - night.booked - night.held : (roomType?.totalAllotment ?? 0) > 0 ? Number.POSITIVE_INFINITY : 0;
        return { ...night, date: night.date.toISOString().slice(0, 10), available: Math.max(0, Math.min(stockRemaining, roomRemaining)) };
      }),
      cancellationPolicies: cancellationPolicies.map((policy) => ({ ...policy, fullCancellationRetention: policy.fullCancellationRetention / 10000 })),
    };
  }

  /** Reservation-center read model. Staff can read occupancy, but not the wider management configuration payload. */
  async getOccupancyBoard(principal: HotelManagementPrincipal, scope: HotelManagementScope, propertyId: string, range: { from: Date; to: Date }) {
    const property = await authorizeHotelBookingActor(this.db, principal, scope.organizationId, propertyId);
    const fromTime = range.from.getTime();
    const toTime = range.to.getTime();
    const dayMs = 86_400_000;
    const nightCount = (toTime - fromTime) / dayMs;
    const isUtcDate = (date: Date) => Number.isFinite(date.getTime()) && date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
    if (!isUtcDate(range.from) || !isUtcDate(range.to) || !Number.isInteger(nightCount) || nightCount < 1 || nightCount > 31) throw new HotelManagementValidationError("Occupancy range must be 1 to 31 whole property nights");

    const [organization, rooms, reservations, maintenanceBlocks] = await Promise.all([
      this.db.organization.findFirst({ where: { id: scope.organizationId, vertical: "HOTEL", isActive: true, deletedAt: null }, select: { slug: true } }),
      this.db.hotelRoom.findMany({ where: { organizationId: scope.organizationId, propertyId, isActive: true, deletedAt: null }, orderBy: [{ roomTypeId: "asc" }, { code: "asc" }], select: { id: true, code: true, roomTypeId: true, isOutOfService: true } }),
      this.db.hotelReservation.findMany({ where: { organizationId: scope.organizationId, propertyId, status: { in: ["CONFIRMED", "CHECKED_IN"] }, checkIn: { lt: range.to }, checkOut: { gt: range.from } }, orderBy: [{ checkIn: "asc" }, { reference: "asc" }], select: { reference: true, status: true, nights: { where: { date: { gte: range.from, lt: range.to } }, select: { date: true, roomId: true } } } }),
      // Failure to read maintenance must fail the whole board; an unknown block state is never shown as vacant.
      this.db.hotelRoomMaintenanceBlock.findMany({ where: { organizationId: scope.organizationId, propertyId, releasedAt: null, from: { lt: range.to }, to: { gt: range.from } }, select: { roomId: true, from: true, to: true } }),
    ]);
    const roomBoard = buildHotelRoomBoard({
      from: range.from.toISOString().slice(0, 10),
      to: range.to.toISOString().slice(0, 10),
      rooms,
      reservations: reservations.map((reservation) => ({
        reference: reservation.reference,
        status: reservation.status as "CONFIRMED" | "CHECKED_IN",
        nights: reservation.nights.map((night) => ({ date: night.date.toISOString().slice(0, 10), roomId: night.roomId })),
      })),
      maintenanceBlocks: maintenanceBlocks.map((block) => ({ roomId: block.roomId, from: block.from.toISOString().slice(0, 10), to: block.to.toISOString().slice(0, 10) })),
    });
    return {
      property: { id: property.id, name: property.name, timezone: property.timezone },
      range: { from: range.from.toISOString().slice(0, 10), to: range.to.toISOString().slice(0, 10), nights: nightCount },
      roomBoard,
      demoProperty: property.slug === "damoon-demo" && isDamoonDemoOrganizationSlug(organization?.slug),
    };
  }

  async createRoomMaintenanceBlock(principal: HotelManagementPrincipal, scope: HotelManagementScope, input: { propertyId: string; roomId: string; from: string; to: string; reason: string; idempotencyKey: string }) {
    await this.authorizeOperations(principal, scope);
    if (process.env.HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED !== "1") throw new HotelManagementAuthorizationError("Manual room management is disabled");
    const parseDate = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HotelManagementValidationError("Maintenance dates must be YYYY-MM-DD");
      const parsed = new Date(`${value}T00:00:00.000Z`);
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new HotelManagementValidationError("Maintenance dates must be valid calendar dates");
      return parsed;
    };
    const from = parseDate(input.from), to = parseDate(input.to);
    const nights = (to.getTime() - from.getTime()) / 86_400_000;
    if (!Number.isInteger(nights) || nights < 1 || nights > 366) throw new HotelManagementValidationError("Maintenance range must be 1 to 366 nights");
    const reason = input.reason.trim();
    if (!reason || reason.length > 500) throw new HotelManagementValidationError("A maintenance reason of up to 500 characters is required");
    const idempotencyKey = input.idempotencyKey.trim();
    if (idempotencyKey.length < 8 || idempotencyKey.length > 200) throw new HotelManagementValidationError("A valid idempotency key is required");
    const fingerprint = createHash("sha256").update(JSON.stringify([principal.userId, input.propertyId, input.roomId, input.from, input.to, reason])).digest("hex");
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([scope.organizationId, "HOTEL_ROOM_MAINTENANCE", idempotencyKey])},0))`);
      const replay = await tx.hotelRoomMaintenanceBlock.findFirst({ where: { organizationId: scope.organizationId, idempotencyKey } });
      if (replay) {
        if (replay.requestFingerprint !== fingerprint) throw new HotelManagementConflictError("Idempotency key was reused with different maintenance details");
        return replay;
      }
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelRoom" WHERE "id"=${input.roomId} AND "organizationId"=${scope.organizationId} AND "propertyId"=${input.propertyId} FOR UPDATE`);
      const room = await tx.hotelRoom.findFirst({ where: { id: input.roomId, organizationId: scope.organizationId, propertyId: input.propertyId, isActive: true, deletedAt: null }, select: { id: true } });
      if (!room) throw new HotelManagementAuthorizationError("Room is outside the active property scope");
      const [allocation, overlap] = await Promise.all([
        tx.hotelReservationRoom.findFirst({ where: { organizationId: scope.organizationId, roomId: input.roomId, date: { gte: from, lt: to }, reservation: { status: { in: ["HELD", "PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"] } } }, select: { date: true } }),
        tx.hotelRoomMaintenanceBlock.findFirst({ where: { organizationId: scope.organizationId, roomId: input.roomId, releasedAt: null, from: { lt: to }, to: { gt: from } }, select: { id: true } }),
      ]);
      if (allocation || overlap) throw new HotelManagementConflictError("ROOM_MAINTENANCE_CONFLICT");
      return tx.hotelRoomMaintenanceBlock.create({ data: { organizationId: scope.organizationId, propertyId: input.propertyId, roomId: input.roomId, from, to, reason, createdBy: principal.userId, idempotencyKey, requestFingerprint: fingerprint } });
    }, { maxWait: 10_000, timeout: 20_000 });
  }

  async releaseRoomMaintenanceBlock(principal: HotelManagementPrincipal, scope: HotelManagementScope, propertyId: string, blockId: string) {
    await this.authorizeOperations(principal, scope);
    if (process.env.HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED !== "1") throw new HotelManagementAuthorizationError("Manual room management is disabled");
    return this.db.$transaction(async (tx) => {
      const block = await tx.hotelRoomMaintenanceBlock.findFirst({ where: { id: blockId, organizationId: scope.organizationId, propertyId } });
      if (!block) throw new HotelManagementAuthorizationError("Maintenance block is outside the active property scope");
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelRoom" WHERE "id"=${block.roomId} AND "organizationId"=${scope.organizationId} AND "propertyId"=${propertyId} FOR UPDATE`);
      if (block.releasedAt) return block;
      return tx.hotelRoomMaintenanceBlock.update({ where: { id: block.id }, data: { releasedBy: principal.userId, releasedAt: new Date() } });
    }, { maxWait: 10_000, timeout: 20_000 });
  }

  /** Owner-only, read-only preview using the same availability contract as guest search. */
  async previewAvailability(principal: HotelManagementPrincipal, scope: HotelManagementScope, propertyId: string, query: AvailabilityQuery) {
    await this.authorizeOwnerPreview(principal, scope);
    if (query.propertyId !== propertyId) throw new HotelManagementAuthorizationError("Property is outside the active organization scope");
    let nights: string[];
    try { nights = enumerateStayNights(query.window.checkIn, query.window.checkOut); }
    catch { throw new HotelManagementValidationError("Availability preview requires a valid stay date range"); }
    if (nights.length < 1 || nights.length > 31) throw new HotelManagementValidationError("Availability preview range must be 1 to 31 nights");
    const property = await this.db.hotelProperty.findFirst({ where: { id: propertyId, organizationId: scope.organizationId, isActive: true, deletedAt: null }, select: { slug: true } });
    if (!property) throw new HotelManagementAuthorizationError("Property is outside the active organization scope");
    const result = await searchPublicHotelAvailability({ scope, propertySlug: property.slug, query }, new PrismaHotelRepositories(this.db));
    if (!result) throw new HotelManagementAuthorizationError("Property is outside the active organization scope");
    return serializePublicAvailability(result);
  }

  async initializeInventoryIdempotent(principal: HotelManagementPrincipal, scope: HotelManagementScope, input: { propertyId: string; roomTypeId: string; from: Date; to: Date; allotment: number; reason: string; idempotencyKey: string; requestFingerprint: string }): Promise<HotelInventoryInitializationResult> {
    await this.authorizeOperations(principal, scope);
    if (!input.idempotencyKey || input.idempotencyKey.length < 8 || input.idempotencyKey.length > 200) throw new HotelManagementValidationError("Invalid Idempotency-Key");
    assertInteger(input.allotment, "allotment"); assertText(input.reason, "reason", 500);
    if (input.allotment > 2_147_483_647) throw new HotelManagementValidationError("Allotment exceeds supported capacity");
    const fromTime = input.from.getTime(); const toTime = input.to.getTime(); const dayMs = 86_400_000;
    const isUtcDate = (date: Date) => Number.isFinite(date.getTime()) && date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
    const nightCount = (toTime - fromTime) / dayMs;
    if (!isUtcDate(input.from) || !isUtcDate(input.to) || !Number.isInteger(nightCount) || nightCount < 1 || nightCount > 31) throw new HotelManagementValidationError("Inventory range must be 1 to 31 whole property nights");
    return this.db.$transaction(async (tx) => {
      const property = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "HotelProperty" WHERE "id"=${input.propertyId} AND "organizationId"=${scope.organizationId} AND "isActive"=true AND "deletedAt" IS NULL FOR SHARE`);
      const roomType = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "HotelRoomType" WHERE "id"=${input.roomTypeId} AND "propertyId"=${input.propertyId} AND "organizationId"=${scope.organizationId} AND "isActive"=true AND "deletedAt" IS NULL FOR UPDATE`);
      if (!property.length || !roomType.length) throw new HotelManagementAuthorizationError("Room type is outside the active property scope");
      const inserted = await tx.$queryRaw<Array<{ id: string; status: string; requestFingerprint: string; resultJson: unknown }>>(Prisma.sql`INSERT INTO "HotelInventoryIdempotency" ("id","organizationId","operationScope","idempotencyKey","requestFingerprint") VALUES (${randomUUID()},${scope.organizationId},${"HOTEL_INVENTORY_INITIALIZE"},${input.idempotencyKey},${input.requestFingerprint}) ON CONFLICT ("organizationId","operationScope","idempotencyKey") DO NOTHING RETURNING "id","status","requestFingerprint","resultJson"`);
      const record = inserted[0] ?? (await tx.$queryRaw<Array<{ id: string; status: string; requestFingerprint: string; resultJson: unknown }>>(Prisma.sql`SELECT "id","status","requestFingerprint","resultJson" FROM "HotelInventoryIdempotency" WHERE "organizationId"=${scope.organizationId} AND "operationScope"=${"HOTEL_INVENTORY_INITIALIZE"} AND "idempotencyKey"=${input.idempotencyKey} FOR UPDATE`))[0];
      if (!record) throw new HotelManagementConflictError("Idempotency record could not be established");
      if (record.requestFingerprint !== input.requestFingerprint) throw new HotelManagementConflictError("Idempotency-Key was already used for a different request");
      if (record.status === "COMPLETED" && record.resultJson) return record.resultJson as HotelInventoryInitializationResult;
      if (!inserted[0]) throw new HotelManagementConflictError("Idempotency request is already processing");
      const dates = Array.from({ length: nightCount }, (_, index) => new Date(fromTime + index * dayMs));
      const created = await tx.$queryRaw<Array<{ id: string; date: Date }>>(Prisma.sql`INSERT INTO "HotelInventory" ("id","organizationId","propertyId","roomTypeId","date","allotment","booked","held","outOfService","closedToArrival","closedToDeparture","createdAt","updatedAt") VALUES ${Prisma.join(dates.map((date) => Prisma.sql`(${randomUUID()},${scope.organizationId},${input.propertyId},${input.roomTypeId},${date},${input.allotment},0,0,0,false,false,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`))} ON CONFLICT ("roomTypeId","date") DO NOTHING RETURNING "id","date"`);
      if (created.length) await tx.hotelInventoryAdjustment.createMany({ data: created.map((night) => ({ organizationId: scope.organizationId, propertyId: input.propertyId, roomTypeId: input.roomTypeId, date: night.date, allotmentDelta: input.allotment, outOfServiceDelta: 0, reason: input.reason.trim(), createdByUserId: principal.userId })) });
      const result = { from: input.from.toISOString().slice(0, 10), to: input.to.toISOString().slice(0, 10), requestedNights: nightCount, createdNights: created.map((night) => night.date.toISOString().slice(0, 10)), createdCount: created.length, skippedExistingCount: nightCount - created.length, allotment: input.allotment };
      await tx.$executeRaw(Prisma.sql`UPDATE "HotelInventoryIdempotency" SET "status"='COMPLETED',"resultJson"=${JSON.stringify(result)}::jsonb,"completedAt"=CURRENT_TIMESTAMP WHERE "id"=${record.id}`);
      return result;
    });
  }
  async createProperty(principal: HotelManagementPrincipal, input: { organizationId: string; slug: string; name: string; timezone?: string; organizationSlug: string }) {
    const scope = { organizationId: input.organizationId };
    await this.authorize(principal, scope);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) throw new HotelManagementValidationError("Invalid property slug");
    assertText(input.name, "Property name");
    const timezone = input.timezone ?? "Asia/Tehran";
    assertTimezone(timezone);
    return this.db.hotelProperty.create({ data: { organizationId: scope.organizationId, organizationSlug: input.organizationSlug, slug: input.slug, name: input.name.trim(), timezone } });
  }

  async updateProperty(principal: HotelManagementPrincipal, scope: HotelManagementScope, propertyId: string, patch: { name?: string; description?: string | null; localizedContent?: LocalizedContent; timezone?: string; checkInTime?: string; checkOutTime?: string; minStayNights?: number; maxStayNights?: number; isActive?: boolean }) {
    await this.authorize(principal, scope);
    if (patch.name !== undefined) assertText(patch.name, "Property name");
    if (patch.timezone !== undefined) assertTimezone(patch.timezone);
    if (patch.checkInTime !== undefined) assertClock(patch.checkInTime, "checkInTime");
    if (patch.checkOutTime !== undefined) assertClock(patch.checkOutTime, "checkOutTime");
    if (patch.minStayNights !== undefined) assertInteger(patch.minStayNights, "minStayNights", 1);
    if (patch.maxStayNights !== undefined) assertInteger(patch.maxStayNights, "maxStayNights", 1);
    const currentProperty = await this.db.hotelProperty.findFirst({ where: { id: propertyId, organizationId: scope.organizationId }, select: { minStayNights: true, maxStayNights: true } });
    if (!currentProperty) throw new HotelManagementAuthorizationError("Property is outside the organization scope");
    if ((patch.minStayNights ?? currentProperty.minStayNights) > (patch.maxStayNights ?? currentProperty.maxStayNights)) throw new HotelManagementValidationError("Invalid stay range");
    assertLocalizedContent(patch.localizedContent);
    if (patch.isActive === false) await this.assertNoActiveCommitments(scope, propertyId);
    return this.db.hotelProperty.update({ where: { id: propertyId, organizationId: scope.organizationId }, data: patch as never });
  }

  async archiveProperty(principal: HotelManagementPrincipal, scope: HotelManagementScope, propertyId: string) {
    await this.authorize(principal, scope); await this.assertNoActiveCommitments(scope, propertyId);
    return this.db.hotelProperty.update({ where: { id: propertyId, organizationId: scope.organizationId }, data: { isActive: false, deletedAt: new Date() } });
  }

  async createRoomType(principal: HotelManagementPrincipal, scope: HotelManagementScope, input: { propertyId: string; slug: string; name: string; description?: string; localizedContent?: LocalizedContent; maxAdults: number; maxChildren?: number; maxOccupancy: number; beds: Prisma.InputJsonValue }) {
    await this.authorize(principal, scope);
    assertInteger(input.maxAdults, "maxAdults", 1); assertInteger(input.maxChildren ?? 0, "maxChildren"); assertInteger(input.maxOccupancy, "maxOccupancy", 1);
    if (input.maxOccupancy < input.maxAdults) throw new HotelManagementValidationError("maxOccupancy cannot be below maxAdults");
    assertText(input.name, "Room type name"); assertLocalizedContent(input.localizedContent);
    const property = await this.db.hotelProperty.findFirst({ where: { id: input.propertyId, organizationId: scope.organizationId } });
    if (!property) throw new HotelManagementAuthorizationError("Property is outside the organization scope");
    return this.db.hotelRoomType.create({ data: { organizationId: scope.organizationId, propertyId: input.propertyId, slug: input.slug, name: input.name.trim(), description: input.description, localizedContent: input.localizedContent, maxAdults: input.maxAdults, maxChildren: input.maxChildren ?? 0, maxOccupancy: input.maxOccupancy, beds: input.beds } });
  }

  async updateRoomType(principal: HotelManagementPrincipal, scope: HotelManagementScope, roomTypeId: string, patch: { name?: string; description?: string | null; localizedContent?: LocalizedContent; maxAdults?: number; maxChildren?: number; maxOccupancy?: number; beds?: Prisma.InputJsonValue; isActive?: boolean }) {
    await this.authorize(principal, scope); if (patch.name !== undefined) assertText(patch.name, "Room type name"); assertLocalizedContent(patch.localizedContent);
    for (const [key, value] of Object.entries({ maxAdults: patch.maxAdults, maxChildren: patch.maxChildren, maxOccupancy: patch.maxOccupancy })) if (value !== undefined) assertInteger(value, key, key === "maxChildren" ? 0 : 1);
    return this.db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "HotelRoomType" WHERE "id"=${roomTypeId} AND "organizationId"=${scope.organizationId} FOR UPDATE`);
      const row = locked.length ? await tx.hotelRoomType.findFirst({ where: { id: roomTypeId, organizationId: scope.organizationId } }) : null;
      if (!row) throw new HotelManagementAuthorizationError("Room type is outside the organization scope");
      const adults = patch.maxAdults ?? row.maxAdults, children = patch.maxChildren ?? row.maxChildren, occupancy = patch.maxOccupancy ?? row.maxOccupancy;
      if (occupancy < adults || occupancy < children) throw new HotelManagementValidationError("Occupancy is below configured limits");
      if (patch.isActive === false) {
        const where = { organizationId: scope.organizationId, propertyId: row.propertyId, roomTypeId };
        const [hold, reservation] = await Promise.all([
          tx.hotelBookingHold.findFirst({ where: { ...where, status: { in: ["ACTIVE", "CONSUMED"] } } }),
          tx.hotelReservation.findFirst({ where: { ...where, status: { in: ["HELD", "PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"] } } }),
        ]);
        if (hold || reservation) throw new HotelManagementValidationError("Active hotel commitments prevent deactivation");
      }
      return tx.hotelRoomType.update({ where: { id: roomTypeId }, data: { ...patch, name: patch.name?.trim() } as never });
    }, { maxWait: 5000, timeout: 10000 });
  }

  async archiveRoomType(principal: HotelManagementPrincipal, scope: HotelManagementScope, roomTypeId: string) {
    await this.authorize(principal, scope);
    return this.db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string; propertyId: string }>>(Prisma.sql`SELECT "id","propertyId" FROM "HotelRoomType" WHERE "id"=${roomTypeId} AND "organizationId"=${scope.organizationId} FOR UPDATE`);
      const row = locked[0];
      if (!row) throw new HotelManagementAuthorizationError("Room type is outside the organization scope");
      const where = { organizationId: scope.organizationId, propertyId: row.propertyId, roomTypeId };
      const [hold, reservation] = await Promise.all([
        tx.hotelBookingHold.findFirst({ where: { ...where, status: { in: ["ACTIVE", "CONSUMED"] } } }),
        tx.hotelReservation.findFirst({ where: { ...where, status: { in: ["HELD", "PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"] } } }),
      ]);
      if (hold || reservation) throw new HotelManagementValidationError("Active hotel commitments prevent deactivation");
      return tx.hotelRoomType.update({ where: { id: roomTypeId }, data: { isActive: false, deletedAt: new Date() } });
    }, { maxWait: 5000, timeout: 10000 });
  }

  async createPhysicalRoom(principal: HotelManagementPrincipal, scope: HotelManagementScope, input: PhysicalRoomCreationInput) {
    await this.authorize(principal, scope);
    const roomType = await this.db.hotelRoomType.findFirst({ where: { id: input.roomTypeId, propertyId: input.propertyId, organizationId: scope.organizationId } });
    if (!roomType) throw new HotelManagementAuthorizationError("Room type does not belong to this property");
    assertText(input.code, "Room code", 64);
    return this.db.$transaction((tx) => this.createPhysicalRoomInTransaction(tx, scope, input), { maxWait: 5000, timeout: 10000 });
  }

  /** Creates a room using the caller's transaction, for atomic workflows that also mutate related records. */
  protected async createPhysicalRoomInTransaction(tx: Prisma.TransactionClient, scope: HotelManagementScope, input: PhysicalRoomCreationInput) {
    assertText(input.code, "Room code", 64);
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "HotelRoomType" WHERE "id"=${input.roomTypeId} AND "organizationId"=${scope.organizationId} AND "propertyId"=${input.propertyId} AND "isActive"=true AND "deletedAt" IS NULL FOR UPDATE`);
    if (!locked.length) throw new HotelManagementAuthorizationError("Room type is outside the active property scope");
    const created = await tx.hotelRoom.create({ data: { organizationId: scope.organizationId, propertyId: input.propertyId, roomTypeId: input.roomTypeId, code: input.code.trim(), floor: input.floor, description: input.description, isOutOfService: input.isOutOfService ?? false } });
    const counts = await tx.$queryRaw<Array<{ configuredRooms: number; availableRooms: number }>>(Prisma.sql`SELECT COUNT(*)::int AS "configuredRooms", COUNT(*) FILTER (WHERE "isActive"=true AND "deletedAt" IS NULL AND "isOutOfService"=false)::int AS "availableRooms" FROM "HotelRoom" WHERE "organizationId"=${scope.organizationId} AND "propertyId"=${input.propertyId} AND "roomTypeId"=${input.roomTypeId}`);
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const commitments = await tx.$queryRaw<Array<{ maxCommitted: number | null }>>(Prisma.sql`SELECT MAX("booked" + "held")::int AS "maxCommitted" FROM "HotelInventory" WHERE "organizationId"=${scope.organizationId} AND "propertyId"=${input.propertyId} AND "roomTypeId"=${input.roomTypeId} AND "date">=${today}`);
    if ((commitments[0]?.maxCommitted ?? 0) > (counts[0]?.availableRooms ?? 0)) throw new HotelManagementValidationError("Physical room configuration would be below existing bookings and holds");
    return created;
  }

  async updatePhysicalRoom(principal: HotelManagementPrincipal, scope: HotelManagementScope, roomId: string, patch: { code?: string; roomTypeId?: string; floor?: string | null; description?: string | null; isOutOfService?: boolean; isActive?: boolean }) {
    await this.authorize(principal, scope); const room = await this.db.hotelRoom.findFirst({ where: { id: roomId, organizationId: scope.organizationId } }); if (!room) throw new HotelManagementAuthorizationError("Room is outside the organization scope");
    if (patch.code !== undefined) assertText(patch.code, "Room code", 64);
    if (patch.roomTypeId && patch.roomTypeId !== room.roomTypeId) { const target = await this.db.hotelRoomType.findFirst({ where: { id: patch.roomTypeId, propertyId: room.propertyId, organizationId: scope.organizationId, isActive: true } }); if (!target) throw new HotelManagementAuthorizationError("Target room type is outside the property scope"); await this.assertNoRoomAllocations(roomId); await this.assertNoActiveCommitments(scope, room.propertyId, room.roomTypeId); }
    if (patch.isActive === false || patch.isOutOfService === true) await this.assertNoRoomAllocations(roomId);
    const affectedTypes = [...new Set([room.roomTypeId, patch.roomTypeId ?? room.roomTypeId])].sort();
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "HotelRoomType" WHERE "organizationId"=${scope.organizationId} AND "propertyId"=${room.propertyId} AND "id" IN (${Prisma.join(affectedTypes)}) ORDER BY "id" FOR UPDATE`);
      const reducesPhysicalCapacity = patch.isActive === false || patch.isOutOfService === true || Boolean(patch.roomTypeId && patch.roomTypeId !== room.roomTypeId);
      if (reducesPhysicalCapacity) {
        await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "HotelRoom" WHERE "id"=${roomId} AND "organizationId"=${scope.organizationId} AND "propertyId"=${room.propertyId} FOR UPDATE`);
        const assignment = await tx.hotelReservationRoom.findFirst({ where: { organizationId: scope.organizationId, roomId, reservation: { status: { in: ["HELD", "PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"] } } }, select: { id: true } });
        if (assignment) throw new HotelManagementValidationError("Room has an active reservation allocation");
      }
      const current = await tx.hotelRoom.findFirst({ where: { id: roomId, organizationId: scope.organizationId, propertyId: room.propertyId } });
      if (!current) throw new HotelManagementAuthorizationError("Room is outside the organization scope");
      // A concurrent move changes the source type whose commitments must be protected.
      // Reject the stale operation; a retry will lock the correct types in order.
      if (current.roomTypeId !== room.roomTypeId) throw new HotelManagementValidationError("Room changed concurrently; reload and retry");
      if (patch.roomTypeId && patch.roomTypeId !== current.roomTypeId) {
        const target = await tx.hotelRoomType.findFirst({ where: { id: patch.roomTypeId, propertyId: room.propertyId, organizationId: scope.organizationId, isActive: true, deletedAt: null }, select: { id: true } });
        if (!target) throw new HotelManagementAuthorizationError("Target room type is outside the active property scope");
      }
      const updated = await tx.hotelRoom.update({ where: { id: roomId }, data: { ...patch, code: patch.code?.trim() } as never });
      const today = new Date(); today.setUTCHours(0, 0, 0, 0);
      for (const typeId of affectedTypes) {
        const counts = await tx.$queryRaw<Array<{ configuredRooms: number; availableRooms: number }>>(Prisma.sql`SELECT COUNT(*)::int AS "configuredRooms", COUNT(*) FILTER (WHERE "isActive"=true AND "deletedAt" IS NULL AND "isOutOfService"=false)::int AS "availableRooms" FROM "HotelRoom" WHERE "organizationId"=${scope.organizationId} AND "propertyId"=${room.propertyId} AND "roomTypeId"=${typeId}`);
        if (!counts[0]?.configuredRooms) continue;
        const commitments = await tx.$queryRaw<Array<{ maxCommitted: number | null }>>(Prisma.sql`SELECT MAX("booked" + "held")::int AS "maxCommitted" FROM "HotelInventory" WHERE "organizationId"=${scope.organizationId} AND "propertyId"=${room.propertyId} AND "roomTypeId"=${typeId} AND "date">=${today}`);
        if ((commitments[0]?.maxCommitted ?? 0) > counts[0].availableRooms) throw new HotelManagementValidationError("Cannot reduce in-service rooms below existing bookings and holds");
      }
      return updated;
    }, { maxWait: 5000, timeout: 10000 });
  }

  async archivePhysicalRoom(principal: HotelManagementPrincipal, scope: HotelManagementScope, roomId: string) { await this.authorize(principal, scope); const room = await this.db.hotelRoom.findFirst({ where: { id: roomId, organizationId: scope.organizationId } }); if (!room) throw new HotelManagementAuthorizationError("Room is outside the organization scope"); await this.updatePhysicalRoom(principal, scope, roomId, { isActive: false }); return this.db.hotelRoom.updateMany({ where: { id: roomId, organizationId: scope.organizationId }, data: { deletedAt: new Date() } }); }

  async listGuestBookingRequests(principal: HotelManagementPrincipal, scope: HotelManagementScope, propertyId: string, options: { cursor?: string; status?: string; search?: string; sort?: string } = {}) {
    await this.authorize(principal, scope);
    await this.assertProperty(scope, propertyId);
    if (options.sort && options.sort !== "oldest") throw new HotelManagementValidationError("Invalid request sort order");
    const status = options.status?.trim() || undefined;
    if (status && status !== "NEEDS_ACTION" && !(HOTEL_GUEST_REQUEST_STATUSES as readonly string[]).includes(status)) {
      throw new HotelManagementValidationError("Invalid booking request status filter");
    }
    const search = options.search?.trim() || undefined;
    if (search && (search.length < 2 || search.length > 80)) {
      throw new HotelManagementValidationError("Booking request search must contain between 2 and 80 characters");
    }
    const rows = await this.db.hotelGuestBookingRequest.findMany({
      where: {
        organizationId: scope.organizationId,
        propertyId,
        ...(status ? { status: status === "NEEDS_ACTION" ? { in: ["RECEIVED", "IN_REVIEW"] } : status } : {}),
        ...(search ? { OR: [
          { guestName: { contains: search, mode: "insensitive" } },
          { guestPhone: { contains: search } },
        ] } : {}),
      },
      orderBy: [{ createdAt: options.sort === "oldest" ? "asc" : "desc" }, { id: options.sort === "oldest" ? "asc" : "desc" }],
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      take: 50,
      select: { id: true, status: true, checkIn: true, checkOut: true, adults: true, children: true, childAges: true, roomTypeSlug: true, ratePlanCode: true, preferredCategory: true, availabilityHint: true, managerMessage: true, guestName: true, guestPhone: true, guestEmail: true, guestNote: true, version: true, createdAt: true, updatedAt: true },
    });
    return { requests: rows, nextCursor: rows.length === 50 ? rows[rows.length - 1]?.id ?? null : null };
  }

  async listGuestBookingRequestActivity(principal: HotelManagementPrincipal, scope: HotelManagementScope, propertyId: string, requestId: string) {
    await this.authorize(principal, scope);
    const property = await this.assertProperty(scope, propertyId);
    const request = await this.db.hotelGuestBookingRequest.findFirst({ where: { id: requestId, organizationId: scope.organizationId, propertyId }, select: { id: true } });
    if (!request) throw new HotelManagementAuthorizationError("Booking request is outside the property scope");
    const rows = await this.db.auditLog.findMany({
      where: { organizationId: scope.organizationId, entityType: "HotelGuestBookingRequest", entityId: request.id, action: { in: ["UPDATE", "CHANGE_STATUS"] } },
      select: { id: true, action: true, createdAt: true, previousValue: true, newValue: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50,
    });
    const parseStatus = (value: unknown) => {
      if (!value || typeof value !== "object" || Array.isArray(value) || !("status" in value)) return null;
      const status = value.status;
      return typeof status === "string" && (HOTEL_GUEST_REQUEST_STATUSES as readonly string[]).includes(status) ? status : null;
    };
    const events = rows.flatMap<{ id: string; type: "status" | "note"; createdAt: Date; from: string | null; to: string | null }>((row) => {
      const before = parseStatus(row.previousValue);
      const after = parseStatus(row.newValue);
      if (row.action === "CHANGE_STATUS" && before && after && before !== after) return [{ id: row.id, type: "status" as const, createdAt: row.createdAt, from: before, to: after }];
      if (row.action === "UPDATE" && before && after && before === after && row.newValue && typeof row.newValue === "object" && !Array.isArray(row.newValue) && "hasManagerMessage" in row.newValue) return [{ id: row.id, type: "note" as const, createdAt: row.createdAt, from: null, to: null }];
      return [];
    });
    return { timezone: property.timezone, events: events.reverse(), limited: rows.length === 50 };
  }

  async updateGuestBookingRequestStatus(principal: HotelManagementPrincipal, scope: HotelManagementScope, propertyId: string, requestId: string, input: { status?: HotelGuestBookingRequestStatus; expectedVersion: number; managerMessage?: string }) {
    await this.authorize(principal, scope);
    await this.assertProperty(scope, propertyId);
    return this.db.$transaction(async (tx) => {
      const current = await tx.hotelGuestBookingRequest.findFirst({ where: { id: requestId, organizationId: scope.organizationId, propertyId } });
      if (!current) throw new HotelManagementAuthorizationError("Booking request is outside the property scope");
      if (current.version !== input.expectedVersion) throw new HotelManagementConflictError("Booking request changed; reload before updating");
      if (input.status !== undefined && !canTransitionHotelGuestBookingRequest(current.status as HotelGuestBookingRequestStatus, input.status)) {
        throw new HotelManagementValidationError("Invalid booking request status transition");
      }
      if (current.roomTypeSlug === null && current.ratePlanCode === null &&
          (input.status === "OPTION_OFFERED" || input.status === "UNAVAILABLE")) {
        throw new HotelManagementValidationError("Coordination requests support review, decline and closure");
      }
      const managerMessage = input.managerMessage === undefined ? current.managerMessage : input.managerMessage.trim() || null;
      const nextStatus = input.status ?? current.status;
      if (nextStatus === "OPTION_OFFERED" && !managerMessage) throw new HotelManagementValidationError("Add a message explaining the option or requested changes");
      const changed = await tx.hotelGuestBookingRequest.updateMany({
        where: { id: requestId, organizationId: scope.organizationId, propertyId, version: input.expectedVersion, status: current.status },
        data: { status: nextStatus, managerMessage, version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new HotelManagementConflictError("Booking request changed concurrently");
      await tx.auditLog.create({ data: {
        action: input.status === undefined ? "UPDATE" : "CHANGE_STATUS",
        entityType: "HotelGuestBookingRequest",
        entityId: current.id,
        organizationId: scope.organizationId,
        userId: principal.userId,
        previousValue: { status: current.status, version: current.version, hasManagerMessage: Boolean(current.managerMessage) },
        newValue: { status: nextStatus, version: current.version + 1, hasManagerMessage: Boolean(managerMessage) },
      } });
      return tx.hotelGuestBookingRequest.findFirstOrThrow({
        where: { id: requestId, organizationId: scope.organizationId, propertyId },
        select: { id: true, status: true, managerMessage: true, version: true, updatedAt: true },
      });
    });
  }

  async recheckGuestBookingRequestAvailability(principal: HotelManagementPrincipal, scope: HotelManagementScope, propertyId: string, requestId: string) {
    await this.authorize(principal, scope);
    const property = await this.assertProperty(scope, propertyId);
    const request = await this.db.hotelGuestBookingRequest.findFirst({ where: { id: requestId, organizationId: scope.organizationId, propertyId } });
    if (!request) throw new HotelManagementAuthorizationError("Booking request is outside the property scope");
    if (request.roomTypeSlug === null && request.ratePlanCode === null) {
      throw new HotelManagementValidationError("Coordination requests have no room or rate to check");
    }

    const availability = await searchPublicHotelAvailability({
      scope: { organizationId: scope.organizationId },
      propertySlug: property.slug,
      query: {
        propertyId,
        window: { checkIn: request.checkIn.toISOString().slice(0, 10), checkOut: request.checkOut.toISOString().slice(0, 10) },
        occupancy: { adults: request.adults, children: request.children, childAges: request.childAges },
      },
    }, new PrismaHotelRepositories(this.db));
    if (!availability) throw new HotelManagementAuthorizationError("Property is outside the organization scope");
    const available = availability.options.some((option) => option.isAvailable && option.roomType.slug === request.roomTypeSlug && option.ratePlan.code === request.ratePlanCode);
    const availabilityHint = available ? "AVAILABLE" : "UNAVAILABLE";

    return this.db.$transaction(async (tx) => {
      const changed = await tx.hotelGuestBookingRequest.updateMany({
        where: { id: request.id, organizationId: scope.organizationId, propertyId, version: request.version },
        data: { availabilityHint, version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new HotelManagementConflictError("Booking request changed while availability was being checked");
      await tx.auditLog.create({ data: {
        action: "UPDATE",
        entityType: "HotelGuestBookingRequest",
        entityId: request.id,
        organizationId: scope.organizationId,
        userId: principal.userId,
        previousValue: { availabilityHint: request.availabilityHint, version: request.version },
        newValue: { availabilityHint, version: request.version + 1 },
      } });
      return { id: request.id, availabilityHint, version: request.version + 1 };
    });
  }

  async createAmenity(principal: HotelManagementPrincipal, scope: HotelManagementScope, input: { propertyId: string; key: string; label: string; description?: string; localizedContent?: LocalizedContent }) { await this.authorize(principal, scope); assertText(input.key, "Amenity key", 64); assertText(input.label, "Amenity label"); assertLocalizedContent(input.localizedContent); await this.assertProperty(scope, input.propertyId); return this.db.hotelAmenity.create({ data: { organizationId: scope.organizationId, propertyId: input.propertyId, key: input.key.trim(), label: input.label.trim(), description: input.description, localizedContent: input.localizedContent } }); }
  async updateAmenity(principal: HotelManagementPrincipal, scope: HotelManagementScope, amenityId: string, patch: { label?: string; description?: string | null; localizedContent?: LocalizedContent; isActive?: boolean }) { await this.authorize(principal, scope); if (patch.label !== undefined) assertText(patch.label, "Amenity label"); assertLocalizedContent(patch.localizedContent); return this.db.hotelAmenity.updateMany({ where: { id: amenityId, organizationId: scope.organizationId }, data: patch as never }); }
  async setRoomTypeAmenities(principal: HotelManagementPrincipal, scope: HotelManagementScope, roomTypeId: string, amenityIds: readonly string[]) { await this.authorize(principal, scope); const room = await this.db.hotelRoomType.findFirst({ where: { id: roomTypeId, organizationId: scope.organizationId } }); if (!room) throw new HotelManagementAuthorizationError("Room type is outside the organization scope"); const amenities = await this.db.hotelAmenity.findMany({ where: { id: { in: [...new Set(amenityIds)] }, propertyId: room.propertyId, organizationId: scope.organizationId, isActive: true }, select: { id: true } }); if (amenities.length !== new Set(amenityIds).size) throw new HotelManagementAuthorizationError("Amenity is outside the property scope"); return this.db.$transaction(async (tx) => { await tx.hotelRoomTypeAmenity.deleteMany({ where: { roomTypeId, organizationId: scope.organizationId } }); if (amenities.length) await tx.hotelRoomTypeAmenity.createMany({ data: amenities.map((a) => ({ organizationId: scope.organizationId, roomTypeId, amenityId: a.id })) }); return amenities; }); }

  async createRatePlan(principal: HotelManagementPrincipal, scope: HotelManagementScope, input: { propertyId: string; roomTypeId: string; code: string; name: string; description?: string; localizedContent?: LocalizedContent; baseNightlyRate: bigint; minNights?: number; maxNights?: number; isRefundable?: boolean; validFrom?: Date; validTo?: Date; cancellationPolicyId?: string | null }) {
    await this.authorize(principal, scope);
    if (input.baseNightlyRate < BigInt(0)) throw new HotelManagementValidationError("baseNightlyRate cannot be negative"); assertText(input.code, "Rate code", 64); assertText(input.name, "Rate name"); assertLocalizedContent(input.localizedContent);
    const roomType = await this.db.hotelRoomType.findFirst({ where: { id: input.roomTypeId, propertyId: input.propertyId, organizationId: scope.organizationId } });
    if (!roomType) throw new HotelManagementAuthorizationError("Room type does not belong to this property");
    if (input.cancellationPolicyId) await this.assertActivePolicy(scope, input.propertyId, input.cancellationPolicyId);
    if ((input.maxNights ?? 0) > 0 && (input.minNights ?? 1) > input.maxNights!) throw new HotelManagementValidationError("Invalid stay range");
    if (input.minNights !== undefined) assertInteger(input.minNights, "minNights", 1); if (input.maxNights !== undefined) assertInteger(input.maxNights, "maxNights");
    return this.db.hotelRatePlan.create({ data: { organizationId: scope.organizationId, propertyId: input.propertyId, roomTypeId: input.roomTypeId, code: input.code.trim(), name: input.name.trim(), description: input.description, localizedContent: input.localizedContent, baseNightlyRate: input.baseNightlyRate, minNights: input.minNights ?? 1, maxNights: input.maxNights ?? 0, isRefundable: input.isRefundable ?? true, validFrom: input.validFrom, validTo: input.validTo, cancellationPolicyId: input.cancellationPolicyId ?? null } });
  }

  async updateRatePlan(principal: HotelManagementPrincipal, scope: HotelManagementScope, ratePlanId: string, patch: { code?: string; name?: string; description?: string | null; localizedContent?: LocalizedContent; baseNightlyRate?: bigint; minNights?: number; maxNights?: number; isRefundable?: boolean; validFrom?: Date | null; validTo?: Date | null; cancellationPolicyId?: string | null; isActive?: boolean }) { await this.authorize(principal, scope); if (patch.baseNightlyRate !== undefined && patch.baseNightlyRate < BigInt(0)) throw new HotelManagementValidationError("baseNightlyRate cannot be negative"); if (patch.code !== undefined) assertText(patch.code, "Rate code", 64); if (patch.name !== undefined) assertText(patch.name, "Rate name"); assertLocalizedContent(patch.localizedContent); if (patch.minNights !== undefined) assertInteger(patch.minNights, "minNights", 1); if (patch.maxNights !== undefined) assertInteger(patch.maxNights, "maxNights"); if (patch.minNights !== undefined && patch.maxNights !== undefined && patch.maxNights > 0 && patch.minNights > patch.maxNights) throw new HotelManagementValidationError("Invalid stay range"); const plan=await this.db.hotelRatePlan.findFirst({where:{id:ratePlanId,organizationId:scope.organizationId}}); if(!plan) throw new HotelManagementAuthorizationError("Rate plan is outside the organization scope"); if(patch.cancellationPolicyId) await this.assertActivePolicy(scope, plan.propertyId, patch.cancellationPolicyId); return this.db.hotelRatePlan.update({ where: { id: ratePlanId }, data: { ...patch, code: patch.code?.trim(), name: patch.name?.trim() } as never }); }
  async upsertNightlyRate(principal: HotelManagementPrincipal, scope: HotelManagementScope, input: { ratePlanId: string; from: Date; to: Date; nightlyRate?: bigint; minNights?: number; maxNights?: number }) { await this.authorize(principal, scope); if (input.to <= input.from) throw new HotelManagementValidationError("Rate window must be non-empty"); if (input.nightlyRate !== undefined && input.nightlyRate < BigInt(0)) throw new HotelManagementValidationError("nightlyRate cannot be negative"); const plan=await this.db.hotelRatePlan.findFirst({where:{id:input.ratePlanId,organizationId:scope.organizationId}}); if(!plan) throw new HotelManagementAuthorizationError("Rate plan is outside the organization scope"); const conflict=await this.db.hotelNightlyRate.findFirst({where:{organizationId:scope.organizationId,ratePlanId:input.ratePlanId,from:{lt:input.to},to:{gt:input.from},NOT:{from:input.from,to:input.to}}}); if(conflict) throw new HotelManagementValidationError("Rate windows overlap"); return this.db.hotelNightlyRate.upsert({where:{ratePlanId_from_to:{ratePlanId:input.ratePlanId,from:input.from,to:input.to}},create:{organizationId:scope.organizationId,propertyId:plan.propertyId,ratePlanId:input.ratePlanId,from:input.from,to:input.to,nightlyRate:input.nightlyRate,minNights:input.minNights,maxNights:input.maxNights},update:{nightlyRate:input.nightlyRate,minNights:input.minNights,maxNights:input.maxNights}}); }

  async adjustInventory(principal: HotelManagementPrincipal, scope: HotelManagementScope, input: { propertyId: string; roomTypeId: string; date: Date; allotmentDelta?: number; outOfServiceDelta?: number; reason: string; createdByUserId?: string }) {
    await this.authorize(principal, scope);
    const delta = input.allotmentDelta ?? 0; const outDelta = input.outOfServiceDelta ?? 0;
    if (!Number.isSafeInteger(delta) || !Number.isSafeInteger(outDelta)) throw new HotelManagementValidationError("Inventory adjustments must be safe integers");
    return this.db.$transaction(async (tx) => {
      const roomType = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "HotelRoomType" WHERE "id"=${input.roomTypeId} AND "organizationId"=${scope.organizationId} AND "propertyId"=${input.propertyId} AND "isActive"=true AND "deletedAt" IS NULL FOR UPDATE`);
      if (!roomType.length) throw new HotelManagementAuthorizationError("Room type is outside the active property scope");
      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "HotelInventory" WHERE "organizationId" = ${scope.organizationId} AND "propertyId" = ${input.propertyId} AND "roomTypeId" = ${input.roomTypeId} AND "date" = ${input.date} FOR UPDATE`);
      const row = locked[0] ? await tx.hotelInventory.findUnique({ where: { id: locked[0].id } }) : null;
      if (!row) throw new HotelManagementValidationError("Inventory night does not exist");
      const nextAllotment = row.allotment + delta, nextOutOfService = row.outOfService + outDelta;
      if (nextAllotment < 0 || nextOutOfService < 0 || nextAllotment < row.booked + row.held + nextOutOfService) throw new HotelManagementValidationError("Adjustment would invalidate committed inventory");
      const updated = await tx.hotelInventory.update({ where: { id: row.id }, data: { allotment: { increment: delta }, outOfService: { increment: outDelta } } });
      await tx.hotelInventoryAdjustment.create({ data: { organizationId: scope.organizationId, propertyId: input.propertyId, roomTypeId: input.roomTypeId, date: input.date, allotmentDelta: delta, outOfServiceDelta: outDelta, reason: input.reason, createdByUserId: input.createdByUserId } });
      return updated;
    });
  }

  async adjustInventoryIdempotent(principal: HotelManagementPrincipal, scope: HotelManagementScope, input: { propertyId: string; roomTypeId: string; date: Date; allotmentDelta?: number; outOfServiceDelta?: number; reason: string; idempotencyKey: string; requestFingerprint: string }) {
    await this.authorize(principal, scope);
    if (!input.idempotencyKey || input.idempotencyKey.length < 8 || input.idempotencyKey.length > 200) throw new HotelManagementValidationError("Invalid Idempotency-Key");
    const delta = input.allotmentDelta ?? 0; const outDelta = input.outOfServiceDelta ?? 0;
    if (!Number.isSafeInteger(delta) || !Number.isSafeInteger(outDelta)) throw new HotelManagementValidationError("Inventory adjustments must be safe integers");
    return this.db.$transaction(async (tx) => {
      const inserted = await tx.$queryRaw<Array<{ id: string; status: string; requestFingerprint: string; resultJson: unknown }>>(Prisma.sql`INSERT INTO "HotelInventoryIdempotency" ("id","organizationId","operationScope","idempotencyKey","requestFingerprint") VALUES (${randomUUID()},${scope.organizationId},${"HOTEL_INVENTORY_ADJUSTMENT"},${input.idempotencyKey},${input.requestFingerprint}) ON CONFLICT ("organizationId","operationScope","idempotencyKey") DO NOTHING RETURNING "id","status","requestFingerprint","resultJson"`);
      const record = inserted[0] ?? (await tx.$queryRaw<Array<{ id: string; status: string; requestFingerprint: string; resultJson: unknown }>>(Prisma.sql`SELECT "id","status","requestFingerprint","resultJson" FROM "HotelInventoryIdempotency" WHERE "organizationId"=${scope.organizationId} AND "operationScope"=${"HOTEL_INVENTORY_ADJUSTMENT"} AND "idempotencyKey"=${input.idempotencyKey} FOR UPDATE`))[0];
      if (!record) throw new HotelManagementConflictError("Idempotency record could not be established");
      if (record.requestFingerprint !== input.requestFingerprint) throw new HotelManagementConflictError("Idempotency-Key was already used for a different request");
      if (record.status === "COMPLETED" && record.resultJson) return record.resultJson;
      if (!inserted[0]) throw new HotelManagementConflictError("Idempotency request is already processing");

      const roomType = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "HotelRoomType" WHERE "id"=${input.roomTypeId} AND "organizationId"=${scope.organizationId} AND "propertyId"=${input.propertyId} AND "isActive"=true AND "deletedAt" IS NULL FOR UPDATE`);
      if (!roomType.length) throw new HotelManagementAuthorizationError("Room type is outside the active property scope");
      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "HotelInventory" WHERE "organizationId"=${scope.organizationId} AND "propertyId"=${input.propertyId} AND "roomTypeId"=${input.roomTypeId} AND "date"=${input.date} FOR UPDATE`);
      const row = locked[0] ? await tx.hotelInventory.findUnique({ where: { id: locked[0].id } }) : null;
      if (!row) throw new HotelManagementValidationError("Inventory night does not exist");
      const nextAllotment = row.allotment + delta, nextOutOfService = row.outOfService + outDelta;
      if (nextAllotment < 0 || nextOutOfService < 0 || nextAllotment < row.booked + row.held + nextOutOfService) throw new HotelManagementValidationError("Adjustment would invalidate committed inventory");
      const updated = await tx.hotelInventory.update({ where: { id: row.id }, data: { allotment: { increment: delta }, outOfService: { increment: outDelta } } });
      await tx.hotelInventoryAdjustment.create({ data: { organizationId: scope.organizationId, propertyId: input.propertyId, roomTypeId: input.roomTypeId, date: input.date, allotmentDelta: delta, outOfServiceDelta: outDelta, reason: input.reason, createdByUserId: principal.userId } });
      await tx.$executeRaw(Prisma.sql`UPDATE "HotelInventoryIdempotency" SET "status"='COMPLETED',"resultJson"=${JSON.stringify(updated)}::jsonb,"completedAt"=CURRENT_TIMESTAMP WHERE "id"=${record.id}`);
      return updated;
    });
  }

  async createCancellationPolicy(principal: HotelManagementPrincipal, scope: HotelManagementScope, input: { propertyId: string; key: string; name: string; description?: string; localizedContent?: LocalizedContent; freeCancellationCutoffHours: number; fullCancellationRetention?: number; cancellationTiers?: readonly CancellationTier[] }) { await this.authorize(principal, scope); assertText(input.key, "Policy key", 64); assertText(input.name, "Policy name"); assertLocalizedContent(input.localizedContent); assertInteger(input.freeCancellationCutoffHours, "freeCancellationCutoffHours"); const retention=input.fullCancellationRetention ?? 0; if(retention<0||retention>1) throw new HotelManagementValidationError("Invalid cancellation retention"); assertTiers(input.cancellationTiers); await this.assertProperty(scope,input.propertyId); return this.db.hotelCancellationPolicy.create({data:{organizationId:scope.organizationId,propertyId:input.propertyId,key:input.key.trim(),name:input.name.trim(),description:input.description,localizedContent:input.localizedContent,freeCancellationCutoffHours:input.freeCancellationCutoffHours,fullCancellationRetention:Math.round(retention*10000),cancellationTiers:input.cancellationTiers}}); }
  async updateCancellationPolicy(principal: HotelManagementPrincipal, scope: HotelManagementScope, policyId: string, patch: { name?: string; description?: string | null; localizedContent?: LocalizedContent; freeCancellationCutoffHours?: number; fullCancellationRetention?: number; cancellationTiers?: readonly CancellationTier[]; isActive?: boolean }) { await this.authorize(principal,scope); if(patch.name!==undefined) assertText(patch.name,"Policy name"); assertLocalizedContent(patch.localizedContent); if(patch.freeCancellationCutoffHours!==undefined) assertInteger(patch.freeCancellationCutoffHours,"freeCancellationCutoffHours"); if(patch.fullCancellationRetention!==undefined&&(patch.fullCancellationRetention<0||patch.fullCancellationRetention>1)) throw new HotelManagementValidationError("Invalid cancellation retention"); assertTiers(patch.cancellationTiers); const old=await this.db.hotelCancellationPolicy.findFirst({where:{id:policyId,organizationId:scope.organizationId}}); if(!old) throw new HotelManagementAuthorizationError("Policy is outside the organization scope"); return this.db.hotelCancellationPolicy.update({where:{id:policyId},data:{...patch,name:patch.name?.trim(),fullCancellationRetention:patch.fullCancellationRetention===undefined?undefined:Math.round(patch.fullCancellationRetention*10000),version:{increment:1}} as never}); }
  async setCancellationPolicyActive(principal: HotelManagementPrincipal, scope: HotelManagementScope, policyId: string, isActive: boolean) { await this.authorize(principal,scope); return this.db.hotelCancellationPolicy.updateMany({where:{id:policyId,organizationId:scope.organizationId},data:{isActive,version:{increment:1}}}); }

  private async assertProperty(scope: HotelManagementScope, propertyId: string) { const property=await this.db.hotelProperty.findFirst({where:{id:propertyId,organizationId:scope.organizationId}}); if(!property) throw new HotelManagementAuthorizationError("Property is outside the organization scope"); return property; }
  private async assertActivePolicy(scope: HotelManagementScope, propertyId: string, policyId: string) { const policy=await this.db.hotelCancellationPolicy.findFirst({where:{id:policyId,propertyId,organizationId:scope.organizationId,isActive:true}}); if(!policy) throw new HotelManagementAuthorizationError("Cancellation policy is outside the active property scope"); return policy; }
  private async assertNoRoomAllocations(roomId: string) { const active=await this.db.hotelReservationRoom.findFirst({where:{roomId,reservation:{status:{in:["HELD","PENDING_PAYMENT","CONFIRMED","CHECKED_IN"]}}}}); if(active) throw new HotelManagementValidationError("Room has an active reservation allocation"); }
  private async assertNoActiveCommitments(scope: HotelManagementScope, propertyId: string, roomTypeId?: string) { const where={organizationId:scope.organizationId,propertyId,...(roomTypeId?{roomTypeId}:{})}; const [hold,reservation]=await Promise.all([this.db.hotelBookingHold.findFirst({where:{...where,status:{in:["ACTIVE","CONSUMED"]}}}),this.db.hotelReservation.findFirst({where:{...where,status:{in:["HELD","PENDING_PAYMENT","CONFIRMED","CHECKED_IN"]}}})]); if(hold||reservation) throw new HotelManagementValidationError("Active hotel commitments prevent deactivation"); }
}

export function createHotelManagementService(db: Db = defaultPrisma) { return new HotelManagementService(db); }
