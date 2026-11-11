import { isDeepStrictEqual } from "node:util";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db-runtime";
import { enumerateStayNights, stayNightCount } from "@/lib/hotel/domain/stay-dates";
import { resolveNightlyRatesForWindow } from "@/lib/hotel/domain/rate";
import { resourceRevision } from "@/lib/hotel/services/hotel-publication.service";
import { decideReservationTransition } from "@/lib/hotel/domain/booking-state";
import type {
  CancellationPolicySet,
  HotelProperty,
  PhysicalRoom,
  RatePlan,
  Reservation,
  ReservationCancellationPolicySnapshot,
  ReservationGuest,
  RoomType,
  SeasonalRate,
  StayDate,
} from "@/lib/hotel/domain/types";
import type {
  HoldRecord,
  HoldReleaseResult,
  HotelAvailabilityRepository,
  HotelBookingRepository,
  HotelCatalogueRepository,
  HotelPaymentSubjectRepository,
  InventoryClaimResult,
  PaymentApplicationResult,
  PaymentSubjectRecord,
  PersistedInventoryNight,
  ReservationRecord,
  ReservationUpdateResult,
  TenantScope,
} from "@/lib/hotel/persistence/hotel-repositories";

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

export class HotelReservationIntegrityError extends Error {
  readonly code = "HOTEL_RESERVATION_INTEGRITY";
  constructor() { super("Reservation does not match an active held inventory allocation."); this.name = "HotelReservationIntegrityError"; }
}

export class HotelIdempotencyConflictError extends Error {
  readonly code = "HOTEL_IDEMPOTENCY_CONFLICT";

  constructor() {
    super("The idempotency key was already used with different reservation parameters.");
    this.name = "HotelIdempotencyConflictError";
  }
}

function dateOnly(value: Date): StayDate {
  return value.toISOString().slice(0, 10);
}

function dateValue(value: StayDate): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function property(row: any): HotelProperty {
  return {
    id: row.id,
    organizationId: row.organizationId,
    slug: row.slug,
    name: row.name,
    timezone: row.timezone,
    currency: row.currency,
    checkInTime: row.checkInTime,
    checkOutTime: row.checkOutTime,
    minStayNights: row.minStayNights,
    maxStayNights: row.maxStayNights,
    policies: {
      key: "PENDING_OWNER_INPUT",
      name: "PENDING_OWNER_INPUT",
      description: "PENDING_OWNER_INPUT",
      freeCancellationCutoffHours: 0,
      fullCancellationRetention: 0,
    },
  };
}

function roomType(row: any): RoomType {
  const amenities = (row.amenities ?? []).map((join: any) => ({
    key: join.amenity.key,
    label: join.amenity.label,
    ...(join.amenity.description ? { description: join.amenity.description } : {}),
  }));
  return {
    id: row.id,
    propertyId: row.propertyId,
    slug: row.slug,
    name: row.name,
    ...(row.description ? { description: row.description } : {}),
    capacity: { maxAdults: row.maxAdults, maxChildren: row.maxChildren, maxOccupancy: row.maxOccupancy },
    beds: row.beds as RoomType["beds"],
    amenities,
    ...(row.sizeSqm == null ? {} : { sizeSqm: row.sizeSqm }),
    maxOccupancy: row.maxOccupancy,
    isActive: row.isActive,
  };
}

function ratePlan(row: any): RatePlan {
  return {
    id: row.id,
    propertyId: row.propertyId,
    roomTypeId: row.roomTypeId,
    code: row.code,
    name: row.name,
    ...(row.description ? { description: row.description } : {}),
    baseNightlyRate: Number(row.baseNightlyRate),
    currency: row.currency,
    mealPlan: row.mealPlan,
    minNights: row.minNights,
    maxNights: row.maxNights,
    isRefundable: row.isRefundable,
    isActive: row.isActive,
    ...(row.validFrom ? { validFrom: dateOnly(row.validFrom) } : {}),
    ...(row.validTo ? { validTo: dateOnly(row.validTo) } : {}),
    ...(row.cancellationPolicy ? { cancellationPolicy: cancellationPolicy(row.cancellationPolicy) } : {}),
  };
}

function cancellationPolicy(row: any): CancellationPolicySet {
  return {
    ...(typeof row.id === "string" ? { id: row.id } : {}),
    key: row.key,
    name: row.name,
    description: row.description ?? "",
    freeCancellationCutoffHours: row.freeCancellationCutoffHours,
    fullCancellationRetention: row.fullCancellationRetention / 10000,
    ...(Array.isArray(row.cancellationTiers) ? { cancellationTiers: row.cancellationTiers } : {}),
    ...(Number.isInteger(row.version) ? { version: row.version } : {}),
  };
}

function hold(row: any): HoldRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    propertyId: row.propertyId,
    reference: row.reference,
    roomTypeId: row.roomTypeId,
    checkIn: dateOnly(row.checkIn),
    checkOut: dateOnly(row.checkOut),
    nights: enumerateStayNights(dateOnly(row.checkIn), dateOnly(row.checkOut)),
    quantity: row.quantity,
    expiresAt: row.expiresAt,
    status: row.status,
    createdAt: row.createdAt,
  };
}

function reservation(row: any): ReservationRecord {
  const nights = [...(row.nights ?? [])].sort((a: any, b: any) => a.date.getTime() - b.date.getTime());
  const guests: ReservationGuest[] = (row.guests ?? []).map((guest: any) => ({
    fullName: guest.fullName,
    isPrimary: guest.isPrimary,
    ...(guest.isChild ? { isChild: true } : {}),
    ...(guest.age == null ? {} : { age: guest.age }),
  }));
  return {
    id: row.id,
    organizationId: row.organizationId,
    propertyId: row.propertyId,
    reference: row.reference,
    idempotencyKey: row.idempotencyKey,
    roomTypeId: row.roomTypeId,
    ratePlanId: row.ratePlanId,
    status: row.status as Reservation["status"],
    checkIn: dateOnly(row.checkIn),
    checkOut: dateOnly(row.checkOut),
    nights: nights.map((night: any) => dateOnly(night.date)),
    guests,
    nightlyRates: nights.map((night: any) => Number(night.rate)),
    totalAmount: Number(row.totalAmount),
    currency: row.currency,
    cancellationPolicySnapshot: row.cancellationPolicySnapshot as ReservationCancellationPolicySnapshot,
    ...(row.holdId ? { holdId: row.holdId } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaHotelRepositories
  implements HotelCatalogueRepository, HotelAvailabilityRepository, HotelBookingRepository, HotelPaymentSubjectRepository
{
  constructor(private readonly client: Db = defaultPrisma) {}

  private transact<T>(work: (tx: Tx) => Promise<T>, transaction?: Tx, options?: { isolationLevel?: Prisma.TransactionIsolationLevel; maxWait?: number; timeout?: number }): Promise<T> {
    return transaction ? work(transaction) : this.client.$transaction(work, options);
  }

  async findAnonymousHoldReplay(input: Parameters<NonNullable<HotelBookingRepository["findAnonymousHoldReplay"]>>[0]) {
    const rows = await this.client.$queryRaw<Array<{ requestFingerprint: string; status: string; resultJson: any }>>(Prisma.sql`SELECT "requestFingerprint","status","resultJson" FROM "HotelBookingHoldIdempotency" WHERE "organizationId"=${input.scope.organizationId} AND "operationScope"='ANONYMOUS_HOLD' AND "idempotencyKey"=${input.idempotencyKey} LIMIT 1`);
    const row = rows[0];
    if (!row) return null;
    if (row.requestFingerprint !== input.requestFingerprint) return { isConflict: true as const };
    if (row.status !== "COMPLETED" || !row.resultJson) return null;
    const holdId = row.resultJson?.holdId;
    if (typeof holdId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(holdId)) return null;
    const storedHold = await this.client.hotelBookingHold.findFirst({
      where: { id: holdId, organizationId: input.scope.organizationId },
      select: { status: true, expiresAt: true },
    });
    if (!storedHold || storedHold.status !== "ACTIVE" || storedHold.expiresAt <= new Date()) return null;
    const propertyRow = await this.client.hotelProperty.findFirst({ where: { organizationId: input.scope.organizationId, slug: input.propertySlug, isActive: true, deletedAt: null } });
    const roomRow = propertyRow ? await this.client.hotelRoomType.findFirst({ where: { organizationId: input.scope.organizationId, propertyId: propertyRow.id, slug: input.roomTypeSlug, isActive: true, deletedAt: null } }) : null;
    const planRow = propertyRow ? await this.client.hotelRatePlan.findFirst({ where: { organizationId: input.scope.organizationId, propertyId: propertyRow.id, code: input.ratePlanCode, isActive: true }, include: { cancellationPolicy: true } }) : null;
    if (!propertyRow || !roomRow || !planRow) return null;
    const [propertyRev, roomRev, planRev, policyRev] = await Promise.all([
      resourceRevision(this.client, { organizationId: input.scope.organizationId, propertyId: propertyRow.id, resourceType: "PROPERTY", resourceId: propertyRow.id }),
      resourceRevision(this.client, { organizationId: input.scope.organizationId, propertyId: propertyRow.id, resourceType: "ROOM_TYPE", resourceId: roomRow.id }),
      resourceRevision(this.client, { organizationId: input.scope.organizationId, propertyId: propertyRow.id, resourceType: "RATE_PLAN", resourceId: planRow.id }),
      planRow.cancellationPolicy ? resourceRevision(this.client, { organizationId: input.scope.organizationId, propertyId: propertyRow.id, resourceType: "CANCELLATION_POLICY", resourceId: planRow.cancellationPolicy.id }) : Promise.resolve(null),
    ]);
    const approvals = await this.client.$queryRaw<Array<{ resourceType: string; resourceId: string; resourceRevision: string; scope: unknown }>>(Prisma.sql`SELECT "resourceType","resourceId","resourceRevision","scope" FROM "HotelPublicationApproval" WHERE "organizationId"=${input.scope.organizationId} AND "propertyId"=${propertyRow.id} AND "status"='APPROVED' AND "revokedAt" IS NULL`);
    const expected = [
      { resourceType: "PROPERTY", resourceId: propertyRow.id, resourceRevision: propertyRev, scope: "availability" },
      { resourceType: "ROOM_TYPE", resourceId: roomRow.id, resourceRevision: roomRev, scope: "availability" },
      { resourceType: "RATE_PLAN", resourceId: planRow.id, resourceRevision: planRev, scope: "availability" },
      ...(planRow.cancellationPolicy && policyRev ? [{ resourceType: "CANCELLATION_POLICY", resourceId: planRow.cancellationPolicy.id, resourceRevision: policyRev, scope: "policies" }] : []),
    ];
    if (!expected.every((item) => approvals.some((approval) => approval.resourceType === item.resourceType && approval.resourceId === item.resourceId && approval.resourceRevision === item.resourceRevision && (approval.scope as Record<string, unknown>)?.[item.scope] === true))) return null;
    const result = row.resultJson as any;
    return { isReplay: true as const, result: { ...result, expiresAt: new Date(result.expiresAt), inventoryReserved: true as const } };
  }

  async createAnonymousHoldAtomically(input: Parameters<NonNullable<HotelBookingRepository["createAnonymousHoldAtomically"]>>[0]): ReturnType<NonNullable<HotelBookingRepository["createAnonymousHoldAtomically"]>> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.client.$transaction(async (tx) => {
      const inserted = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`INSERT INTO "HotelBookingHoldIdempotency" ("id","organizationId","operationScope","idempotencyKey","requestFingerprint") VALUES (${input.holdId},${input.scope.organizationId},'ANONYMOUS_HOLD',${input.idempotencyKey},${input.requestFingerprint}) ON CONFLICT ("organizationId","operationScope","idempotencyKey") DO NOTHING RETURNING "id"`);
      const idem = await tx.$queryRaw<Array<{ id: string; requestFingerprint: string; status: string; resultJson: any; holdId: string | null }>>(Prisma.sql`SELECT "id","requestFingerprint","status","resultJson","holdId" FROM "HotelBookingHoldIdempotency" WHERE "organizationId"=${input.scope.organizationId} AND "operationScope"='ANONYMOUS_HOLD' AND "idempotencyKey"=${input.idempotencyKey} FOR UPDATE`);
      const existing = idem[0];
      if (!existing) return { isHeld: false as const, reason: "IDEMPOTENCY_COORDINATION_FAILED" };
      if (existing.requestFingerprint !== input.requestFingerprint) return { isHeld: false as const, reason: "IDEMPOTENCY_CONFLICT" };
      if (!inserted.length && existing.status === "COMPLETED" && existing.resultJson) {
        const storedHold = existing.holdId ? await tx.hotelBookingHold.findFirst({ where: { id: existing.holdId, organizationId: input.scope.organizationId }, select: { status: true, expiresAt: true } }) : null;
        if (!storedHold || storedHold.status !== "ACTIVE" || storedHold.expiresAt <= input.now) return { isHeld: false as const, reason: "IDEMPOTENCY_REPLAY_INACTIVE" };
        const replay = existing.resultJson as any;
        return { ...replay, expiresAt: new Date(replay.expiresAt), replay: true as const } as any;
      }
      const propertyRow = await tx.hotelProperty.findFirst({ where: { id: input.propertyId, organizationId: input.scope.organizationId, isActive: true, deletedAt: null } });
      const planRow = await tx.hotelRatePlan.findFirst({ where: { id: input.ratePlanId, organizationId: input.scope.organizationId, propertyId: input.propertyId, roomTypeId: input.roomTypeId, isActive: true }, include: { cancellationPolicy: true } });
      if (!propertyRow || !planRow) return { isHeld: false as const, reason: "RESOURCE_NOT_AVAILABLE" };
      const [propertyRevision, roomRevision, rateRevision, policyRevision] = await Promise.all([
        resourceRevision(tx, { organizationId: input.scope.organizationId, propertyId: input.propertyId, resourceType: "PROPERTY", resourceId: input.propertyId }),
        resourceRevision(tx, { organizationId: input.scope.organizationId, propertyId: input.propertyId, resourceType: "ROOM_TYPE", resourceId: input.roomTypeId }),
        resourceRevision(tx, { organizationId: input.scope.organizationId, propertyId: input.propertyId, resourceType: "RATE_PLAN", resourceId: input.ratePlanId }),
        planRow.cancellationPolicy ? resourceRevision(tx, { organizationId: input.scope.organizationId, propertyId: input.propertyId, resourceType: "CANCELLATION_POLICY", resourceId: planRow.cancellationPolicy.id }) : Promise.resolve(null),
      ]);
      const approved = await tx.$queryRaw<Array<{ resourceType: string; resourceId: string; resourceRevision: string; scope: unknown }>>(Prisma.sql`SELECT "resourceType","resourceId","resourceRevision","scope" FROM "HotelPublicationApproval" WHERE "organizationId"=${input.scope.organizationId} AND "propertyId"=${input.propertyId} AND "status"='APPROVED' AND "revokedAt" IS NULL`);
      const expected = [
        { resourceType: "PROPERTY", resourceId: input.propertyId, resourceRevision: propertyRevision, scope: "availability" },
        { resourceType: "ROOM_TYPE", resourceId: input.roomTypeId, resourceRevision: roomRevision, scope: "availability" },
        { resourceType: "RATE_PLAN", resourceId: input.ratePlanId, resourceRevision: rateRevision, scope: "availability" },
        ...(planRow.cancellationPolicy && policyRevision ? [{ resourceType: "CANCELLATION_POLICY", resourceId: planRow.cancellationPolicy.id, resourceRevision: policyRevision, scope: "policies" }] : []),
      ];
      if (!expected.every((item) => approved.some((row) => row.resourceType === item.resourceType && row.resourceId === item.resourceId && row.resourceRevision === item.resourceRevision && (row.scope as Record<string, unknown>)?.[item.scope] === true))) return { isHeld: false as const, reason: "PUBLICATION_NOT_APPROVED" };
      if (planRow.cancellationPolicy && Number.isInteger((input as { acceptedCancellationPolicyVersion?: number | null }).acceptedCancellationPolicyVersion) && planRow.cancellationPolicy.version !== (input as { acceptedCancellationPolicyVersion?: number | null }).acceptedCancellationPolicyVersion) return { isHeld: false as const, reason: "POLICY_TERMS_CHANGED" };
      const nights = enumerateStayNights(input.query.window.checkIn, input.query.window.checkOut);
      const seasonalRows = await tx.hotelNightlyRate.findMany({ where: { organizationId: input.scope.organizationId, propertyId: input.propertyId, ratePlanId: input.ratePlanId } });
      const resolution = resolveNightlyRatesForWindow({ property: property(propertyRow), ratePlan: ratePlan({ ...planRow, cancellationPolicy: planRow.cancellationPolicy }), seasonalRates: seasonalRows.map((row) => ({ id: row.id, ratePlanId: row.ratePlanId, from: dateOnly(row.from), to: dateOnly(row.to), nightlyRate: Number(row.nightlyRate), ...(row.minNights == null ? {} : { minNights: row.minNights }), ...(row.maxNights == null ? {} : { maxNights: row.maxNights }) })), checkIn: input.query.window.checkIn, checkOut: input.query.window.checkOut });
      if (!resolution.isResolved) return { isHeld: false as const, reason: resolution.reason };
      const acceptedTotalRate = (input as { acceptedTotalRate?: string | null }).acceptedTotalRate;
      if (typeof acceptedTotalRate === "string" && acceptedTotalRate !== String(resolution.total)) return { isHeld: false as const, reason: "PRICE_CHANGED" };
      const inventoryRows = await tx.$queryRaw<any[]>(Prisma.sql`SELECT "id","allotment","booked","held","outOfService","closedToArrival","closedToDeparture" FROM "HotelInventory" WHERE "organizationId"=${input.scope.organizationId} AND "propertyId"=${input.propertyId} AND "roomTypeId"=${input.roomTypeId} AND "date" IN (${Prisma.join(nights.map(dateValue))}) ORDER BY "date" FOR UPDATE`);
      if (inventoryRows.length !== nights.length || inventoryRows.some((row) => row.closedToArrival || row.closedToDeparture || row.allotment - row.booked - row.held - row.outOfService < 1)) return { isHeld: false as const, reason: "NO_INVENTORY" };
      for (const row of inventoryRows) await tx.hotelInventory.update({ where: { id: row.id }, data: { held: { increment: 1 } } });
      const expiresAt = new Date(input.now.getTime() + 15 * 60_000);
      await tx.$executeRaw(Prisma.sql`INSERT INTO "HotelBookingHold" ("id","organizationId","propertyId","roomTypeId","reference","quantity","checkIn","checkOut","expiresAt","status","updatedAt","ratePlanId","currency","totalAmount","nightlyRates","cancellationPolicySnapshot") VALUES (${input.holdId},${input.scope.organizationId},${input.propertyId},${input.roomTypeId},${input.reference},1,${dateValue(input.query.window.checkIn)},${dateValue(input.query.window.checkOut)},${expiresAt},'ACTIVE',${input.now},${input.ratePlanId},${planRow.currency},${BigInt(resolution.total)},${JSON.stringify(resolution.nights.map((night) => night.amount))}::jsonb,${planRow.cancellationPolicy ? JSON.stringify({ ...cancellationPolicy(planRow.cancellationPolicy), organizationId: input.scope.organizationId, policyVersion: planRow.cancellationPolicy.version, capturedAt: input.now.toISOString() }) : null}::jsonb)`);
      const result = { isHeld: true as const, holdId: input.holdId, reference: input.reference, expiresAt, totalAmount: resolution.total, currency: planRow.currency, nightlyRates: resolution.nights.map((night) => night.amount), policySnapshot: planRow.cancellationPolicy ? { ...cancellationPolicy(planRow.cancellationPolicy), organizationId: input.scope.organizationId, policyVersion: planRow.cancellationPolicy.version, capturedAt: input.now.toISOString() } : null };
      await tx.$executeRaw(Prisma.sql`UPDATE "HotelBookingHoldIdempotency" SET "status"='COMPLETED',"holdId"=${input.holdId},"resultJson"=${JSON.stringify(result)}::jsonb,"completedAt"=${input.now} WHERE "id"=${existing.id}`);
      return result;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isRetryableSerialization = (error as { code?: string }).code === "P2034" || /could not serialize|serialization failure|deadlock detected/i.test(message);
        if (!isRetryableSerialization || attempt === 2) throw error;
      }
    }
    throw new Error("Anonymous hold transaction retry limit exceeded");
  }

  async findPropertyBySlug(scope: TenantScope, slug: string): Promise<HotelProperty | null> {
    const row = await this.client.hotelProperty.findFirst({ where: { organizationId: scope.organizationId, slug, isActive: true, deletedAt: null } });
    return row ? property(row) : null;
  }

  private async ownedProperty(tx: Db | Tx, scope: TenantScope, propertyId: string) {
    return tx.hotelProperty.findFirst({ where: { id: propertyId, organizationId: scope.organizationId, isActive: true, deletedAt: null } });
  }

  async listRoomTypes(scope: TenantScope, propertyId: string): Promise<readonly RoomType[]> {
    if (!(await this.ownedProperty(this.client, scope, propertyId))) return [];
    const rows = await this.client.hotelRoomType.findMany({ where: { organizationId: scope.organizationId, propertyId, isActive: true, deletedAt: null }, include: { amenities: { include: { amenity: true } }, }, orderBy: { sortOrder: "asc" } });
    return rows.map(roomType);
  }

  async findRoomTypeBySlug(scope: TenantScope, propertyId: string, slug: string): Promise<RoomType | null> {
    if (!(await this.ownedProperty(this.client, scope, propertyId))) return null;
    const row = await this.client.hotelRoomType.findFirst({ where: { organizationId: scope.organizationId, propertyId, slug, isActive: true, deletedAt: null }, include: { amenities: { include: { amenity: true } } } });
    return row ? roomType(row) : null;
  }

  async listPhysicalRooms(scope: TenantScope, propertyId: string): Promise<readonly PhysicalRoom[]> {
    if (!(await this.ownedProperty(this.client, scope, propertyId))) return [];
    const rows = await this.client.hotelRoom.findMany({ where: { organizationId: scope.organizationId, propertyId, isActive: true, deletedAt: null } });
    return rows.map((row) => ({ id: row.id, propertyId: row.propertyId, roomTypeId: row.roomTypeId, code: row.code, ...(row.floor ? { floor: row.floor } : {}), isActive: row.isActive }));
  }

  async listRatePlans(scope: TenantScope, propertyId: string): Promise<readonly RatePlan[]> {
    if (!(await this.ownedProperty(this.client, scope, propertyId))) return [];
    const rows = await this.client.hotelRatePlan.findMany({ where: { organizationId: scope.organizationId, propertyId, isActive: true }, include: { cancellationPolicy: { where: { isActive: true } } } });
    return rows.map(ratePlan);
  }

  async listSeasonalRates(scope: TenantScope, ratePlanIds: readonly string[]): Promise<readonly SeasonalRate[]> {
    if (!ratePlanIds.length) return [];
    const rows = await this.client.hotelNightlyRate.findMany({ where: { organizationId: scope.organizationId, ratePlanId: { in: [...ratePlanIds] } } });
    return rows.map((row) => ({ id: row.id, ratePlanId: row.ratePlanId, from: dateOnly(row.from), to: dateOnly(row.to), ...(row.nightlyRate == null ? {} : { nightlyRate: Number(row.nightlyRate) }), ...(row.minNights == null ? {} : { minNights: row.minNights }), ...(row.maxNights == null ? {} : { maxNights: row.maxNights }) }));
  }

  async listCancellationPolicies(scope: TenantScope, propertyId: string): Promise<readonly CancellationPolicySet[]> {
    if (!(await this.ownedProperty(this.client, scope, propertyId))) return [];
    const rows = await this.client.hotelCancellationPolicy.findMany({ where: { organizationId: scope.organizationId, propertyId, isActive: true } });
    return rows.map(cancellationPolicy);
  }

  async resolveRatePlanCancellationPolicy(scope: TenantScope, ratePlanId: string): Promise<ReservationCancellationPolicySnapshot | null> {
    const row = await this.client.hotelRatePlan.findFirst({ where: { id: ratePlanId, organizationId: scope.organizationId, isActive: true }, include: { cancellationPolicy: true } });
    if (!row?.cancellationPolicy) return null;
    if (row.cancellationPolicy.propertyId !== row.propertyId || !row.cancellationPolicy.isActive) return null;
    return { ...cancellationPolicy(row.cancellationPolicy), organizationId: scope.organizationId, policyVersion: row.cancellationPolicy.version, capturedAt: new Date().toISOString() };
  }

  async getInventoryNights(scope: TenantScope, propertyId: string, roomTypeIds: readonly string[], nights: readonly StayDate[]): Promise<readonly PersistedInventoryNight[]> {
    if (!(await this.ownedProperty(this.client, scope, propertyId)) || !roomTypeIds.length || !nights.length) return [];
    const rows = await this.client.hotelInventory.findMany({ where: { organizationId: scope.organizationId, propertyId, roomTypeId: { in: [...roomTypeIds] }, date: { in: nights.map(dateValue) } } });
    const byKey = new Map(rows.map((row) => [`${row.roomTypeId}:${dateOnly(row.date)}`, row]));
    return roomTypeIds.flatMap((roomTypeId) => nights.map((date) => { const row = byKey.get(`${roomTypeId}:${date}`); return { propertyId, roomTypeId, date, allotment: row?.allotment ?? 0, booked: row?.booked ?? 0, held: row?.held ?? 0, outOfService: row?.outOfService ?? 0, closedToArrival: row?.closedToArrival ?? false, closedToDeparture: row?.closedToDeparture ?? false }; }));
  }

  async claimInventoryForHold(input: Parameters<HotelBookingRepository["claimInventoryForHold"]>[0]): Promise<InventoryClaimResult> {
    const result = await this.claimInventoryAndCreateHold({ ...input, hold: { id: input.holdId, organizationId: input.scope.organizationId, propertyId: input.propertyId, roomTypeId: input.roomTypeId, reference: input.holdId, checkIn: input.nights[0]!, checkOut: input.nights[input.nights.length - 1]!, nights: input.nights, quantity: input.quantity, expiresAt: input.expiresAt, status: "ACTIVE", createdAt: input.now }, now: input.now });
    return result;
  }

  async claimInventoryAndCreateHold(input: { scope: TenantScope; propertyId: string; roomTypeId: string; nights: readonly StayDate[]; quantity: number; hold: Omit<HoldRecord, "id"> & { id: string }; now: Date }, transaction?: Tx): Promise<InventoryClaimResult & { hold?: HoldRecord }> {
    if (!input.nights.length || input.quantity < 1) return { isClaimed: false, reason: "NO_INVENTORY", failedDates: [...input.nights] };
    try {
      return await this.transact(async (tx) => {
        if (!(await this.ownedProperty(tx, input.scope, input.propertyId))) return { isClaimed: false as const, reason: "TENANT_MISMATCH" as const, failedDates: [...input.nights] };
        const roomType = await tx.hotelRoomType.findFirst({ where: { id: input.roomTypeId, propertyId: input.propertyId, organizationId: input.scope.organizationId } });
        if (!roomType) return { isClaimed: false as const, reason: "TENANT_MISMATCH" as const, failedDates: [...input.nights] };
        const dates = [...input.nights].sort();
        const rows = await tx.$queryRaw<any[]>(Prisma.sql`SELECT "id", "date", "allotment", "booked", "held", "outOfService", "closedToArrival", "closedToDeparture" FROM "HotelInventory" WHERE "organizationId" = ${input.scope.organizationId} AND "propertyId" = ${input.propertyId} AND "roomTypeId" = ${input.roomTypeId} AND "date" IN (${Prisma.join(dates.map(dateValue))}) ORDER BY "date" FOR UPDATE`);
        const byDate = new Map(rows.map((row) => [dateOnly(row.date), row]));
        const failedDates = dates.filter((date) => { const row = byDate.get(date); return !row || row.closedToArrival || row.closedToDeparture || row.allotment - row.booked - row.held - row.outOfService < input.quantity; });
        if (failedDates.length) return { isClaimed: false as const, reason: "NO_INVENTORY" as const, failedDates };
        for (const date of dates) await tx.hotelInventory.update({ where: { id: byDate.get(date).id }, data: { held: { increment: input.quantity } } });
        const saved = await tx.hotelBookingHold.create({ data: { id: input.hold.id, organizationId: input.scope.organizationId, propertyId: input.propertyId, roomTypeId: input.roomTypeId, reference: input.hold.reference, quantity: input.quantity, checkIn: dateValue(input.hold.checkIn), checkOut: dateValue(input.hold.checkOut), expiresAt: input.hold.expiresAt, status: "ACTIVE", createdAt: input.hold.createdAt } });
        return { isClaimed: true as const, claims: dates.map((date) => ({ date, roomTypeId: input.roomTypeId })), hold: hold(saved) };
      }, transaction, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if ((error as { code?: string }).code === "P2034" || (error as { code?: string }).code === "40P01" || /serialize access|deadlock detected/i.test(message)) return { isClaimed: false, reason: "CONFLICT", failedDates: [...input.nights] };
      throw error;
    }
  }

  async createHold(input: Omit<HoldRecord, "id"> & { id: string }): Promise<HoldRecord> { const row = await this.client.hotelBookingHold.create({ data: { id: input.id, organizationId: input.organizationId, propertyId: input.propertyId, roomTypeId: input.roomTypeId, reference: input.reference, quantity: input.quantity, checkIn: dateValue(input.checkIn), checkOut: dateValue(input.checkOut), expiresAt: input.expiresAt, status: input.status, createdAt: input.createdAt } }); return hold(row); }
  async findHold(scope: TenantScope, holdId: string): Promise<HoldRecord | null> { const row = await this.client.hotelBookingHold.findFirst({ where: { id: holdId, organizationId: scope.organizationId } }); return row ? hold(row) : null; }
  async findHoldByReference(scope: TenantScope, reference: string): Promise<HoldRecord | null> { const row = await this.client.hotelBookingHold.findFirst({ where: { organizationId: scope.organizationId, reference } }); return row ? hold(row) : null; }
  async listExpiredActiveHolds(scope: TenantScope, input: { propertyId?: string; now: Date; limit: number }): Promise<readonly HoldRecord[]> { const rows = await this.client.hotelBookingHold.findMany({ where: { organizationId: scope.organizationId, ...(input.propertyId ? { propertyId: input.propertyId } : {}), status: "ACTIVE", expiresAt: { lte: input.now } }, orderBy: { expiresAt: "asc" }, take: Math.max(1, Math.min(input.limit, 500)) }); return rows.map(hold); }

  async releaseHold(scope: TenantScope, holdId: string, now: Date): Promise<HoldReleaseResult> {
    try {
      return await this.client.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelBookingHold" WHERE "id" = ${holdId} AND "organizationId" = ${scope.organizationId} FOR UPDATE`);
        const row = await tx.hotelBookingHold.findFirst({ where: { id: holdId, organizationId: scope.organizationId }, });
        if (!row) return { isReleased: false as const, reason: "NOT_FOUND" as const };
        if (row.status === "CONSUMED") return { isReleased: false as const, reason: "ALREADY_CONSUMED" as const };
        if (row.status !== "ACTIVE") return { isReleased: false as const, reason: "NOT_FOUND" as const };
        const nights = enumerateStayNights(dateOnly(row.checkIn), dateOnly(row.checkOut));
        for (const date of nights) {
          const updated = await tx.hotelInventory.updateMany({
            where: { organizationId: scope.organizationId, propertyId: row.propertyId, roomTypeId: row.roomTypeId, date: dateValue(date), held: { gte: row.quantity } },
            data: { held: { decrement: row.quantity } }
          });
          if (updated.count !== 1) {
            throw new Error(`INSUFFICIENT_INVENTORY: night ${date} affected ${updated.count} rows`);
          }
        }
        const updated = await tx.hotelBookingHold.updateMany({ where: { id: row.id, organizationId: scope.organizationId, status: "ACTIVE" }, data: { status: row.expiresAt <= now ? "EXPIRED" : "RELEASED" } });
        return updated.count === 1 ? { isReleased: true as const } : { isReleased: false as const, reason: "NOT_FOUND" as const };
      });
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("INSUFFICIENT_INVENTORY")) {
        return { isReleased: false as const, reason: "INSUFFICIENT_INVENTORY" as const };
      }
      throw err;
    }
  }

  async createReservation(record: ReservationRecord, transaction?: Tx): Promise<ReservationRecord> {
    const key = record.idempotencyKey ?? record.reference;
    const invalid = () => new HotelReservationIntegrityError();
    let nights: StayDate[] = [];
    try {
      const count = stayNightCount(record.checkIn, record.checkOut);
      if (count > 0 && count === record.nights.length) nights = enumerateStayNights(record.checkIn, record.checkOut);
    } catch { /* Invalid calendar windows fail below. */ }
    const validRecord = Boolean(key && key.length <= 200) && nights.length > 0 &&
      isDeepStrictEqual(nights, [...record.nights]) && record.nightlyRates.length === nights.length &&
      record.nightlyRates.every(rate => Number.isSafeInteger(rate) && rate >= 0) &&
      Number.isSafeInteger(record.totalAmount) && record.totalAmount >= 0 &&
      record.nightlyRates.reduce((sum, rate) => sum + rate, 0) === record.totalAmount &&
      Number.isFinite(record.createdAt.getTime());
    const normalizeGuests = (guests: readonly ReservationGuest[]) => guests.map(guest => ({
      fullName: guest.fullName, isPrimary: guest.isPrimary, isChild: guest.isChild ?? false, age: guest.age ?? null,
    })).sort((left, right) => left.fullName.localeCompare(right.fullName));
    const sameRequest = (existing: ReservationRecord) => existing.idempotencyKey === key &&
      existing.propertyId === record.propertyId && existing.roomTypeId === record.roomTypeId &&
      existing.ratePlanId === record.ratePlanId && existing.reference === record.reference &&
      existing.holdId === record.holdId && existing.checkIn === record.checkIn && existing.checkOut === record.checkOut &&
      existing.totalAmount === record.totalAmount && existing.currency === record.currency &&
      isDeepStrictEqual(existing.nights, record.nights) && isDeepStrictEqual(existing.nightlyRates, record.nightlyRates) &&
      isDeepStrictEqual(normalizeGuests(existing.guests), normalizeGuests(record.guests)) &&
      isDeepStrictEqual(existing.cancellationPolicySnapshot ?? {}, record.cancellationPolicySnapshot ?? {});

    return this.transact(async tx => {
      if (record.holdId) await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelBookingHold" WHERE "id"=${record.holdId} AND "organizationId"=${record.organizationId} FOR UPDATE`);
      // Serialize even different hold IDs using the same tenant retry key.
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([record.organizationId, key])}, 0))`);
      const replay = await tx.hotelReservation.findFirst({ where: { organizationId: record.organizationId, idempotencyKey: key }, include: { nights: true, guests: true } });
      if (replay) {
        const existing = reservation(replay);
        if (!sameRequest(existing)) throw new HotelIdempotencyConflictError();
        return existing;
      }
      if (!validRecord) throw invalid();
      const plan = await tx.hotelRatePlan.findFirst({ where: { id: record.ratePlanId, organizationId: record.organizationId, propertyId: record.propertyId, roomTypeId: record.roomTypeId, ...(record.holdId ? { isActive: true } : {}) }, select: { id: true, currency: true } });
      if (!plan || plan.currency !== record.currency) throw invalid();
      if (record.holdId) {
        const held = await tx.hotelBookingHold.findFirst({ where: { id: record.holdId, organizationId: record.organizationId } });
        if (!held || held.status !== "ACTIVE" || held.expiresAt <= record.createdAt || held.quantity !== 1 ||
          held.propertyId !== record.propertyId || held.roomTypeId !== record.roomTypeId || held.reference !== record.reference ||
          dateOnly(held.checkIn) !== record.checkIn || dateOnly(held.checkOut) !== record.checkOut || record.status !== "PENDING_PAYMENT") throw invalid();
        const activeType = await tx.hotelRoomType.findFirst({ where: { id: record.roomTypeId, propertyId: record.propertyId, organizationId: record.organizationId, isActive: true, deletedAt: null, property: { isActive: true, deletedAt: null, organization: { isActive: true, deletedAt: null } } }, select: { id: true } });
        if (!activeType) throw invalid();
        const inventory = await tx.$queryRaw<Array<{ id: string; date: Date; held: number }>>(Prisma.sql`SELECT "id","date","held" FROM "HotelInventory" WHERE "organizationId"=${record.organizationId} AND "propertyId"=${record.propertyId} AND "roomTypeId"=${record.roomTypeId} AND "date" IN (${Prisma.join(nights.map(dateValue))}) ORDER BY "date" FOR UPDATE`);
        if (inventory.length !== nights.length || inventory.some(night => night.held < held.quantity)) throw invalid();
        for (const night of inventory) await tx.hotelInventory.update({ where: { id: night.id }, data: { held: { decrement: held.quantity }, booked: { increment: held.quantity } } });
        await tx.hotelBookingHold.update({ where: { id: held.id }, data: { status: "CONSUMED" } });
      }
      const row = await tx.hotelReservation.create({ data: {
        id: record.id, organizationId: record.organizationId, propertyId: record.propertyId,
        roomTypeId: record.roomTypeId, ratePlanId: record.ratePlanId, reference: record.reference, status: record.status,
        checkIn: dateValue(record.checkIn), checkOut: dateValue(record.checkOut), currency: record.currency,
        totalAmount: BigInt(record.totalAmount), cancellationPolicyKey: record.cancellationPolicySnapshot?.key ?? "PENDING_OWNER_INPUT",
        cancellationPolicySnapshot: record.cancellationPolicySnapshot ?? {}, holdId: record.holdId, idempotencyKey: key,
        nights: { create: nights.map((date, index) => ({ date: dateValue(date), roomTypeId: record.roomTypeId, rate: BigInt(record.nightlyRates[index]) })) },
        guests: { create: record.guests.map(guest => ({ fullName: guest.fullName, isPrimary: guest.isPrimary, isChild: guest.isChild ?? false, age: guest.age })) },
      }, include: { nights: true, guests: true } });
      return reservation(row);
    }, transaction, { maxWait: 5000, timeout: 10000 });
  }
  async findReservationByReference(scope: TenantScope, reference: string): Promise<ReservationRecord | null> { const row = await this.client.hotelReservation.findFirst({ where: { organizationId: scope.organizationId, reference }, include: { nights: true, guests: true } }); return row ? reservation(row) : null; }
  async findReservation(scope: TenantScope, reservationId: string): Promise<ReservationRecord | null> { const row = await this.client.hotelReservation.findFirst({ where: { id: reservationId, organizationId: scope.organizationId }, include: { nights: true, guests: true } }); return row ? reservation(row) : null; }
  async updateReservationStatus(input: { scope: TenantScope; reservationId: string; expectedStatus: readonly Reservation["status"][]; nextStatus: Reservation["status"]; now: Date; patch?: Partial<Pick<ReservationRecord, "paymentRequestPublicId" | "cancellationPolicySnapshot">> }): Promise<ReservationUpdateResult> {
    const updated = await this.client.hotelReservation.updateMany({ where: { id: input.reservationId, organizationId: input.scope.organizationId, status: { in: [...input.expectedStatus] } }, data: { status: input.nextStatus, version: { increment: 1 }, ...(input.nextStatus === "CONFIRMED" ? { confirmedAt: input.now } : {}), ...(input.nextStatus === "CANCELLED" ? { cancelledAt: input.now } : {}), ...(input.patch?.cancellationPolicySnapshot ? { cancellationPolicySnapshot: input.patch.cancellationPolicySnapshot } : {}) } });
    if (updated.count !== 1) { const current = await this.findReservation(input.scope, input.reservationId); return { isUpdated: false, reason: current ? "STATUS_CONFLICT" : "NOT_FOUND" }; }
    const current = await this.findReservation(input.scope, input.reservationId); return current ? { isUpdated: true, reservation: current } : { isUpdated: false, reason: "NOT_FOUND" };
  }

  async cancelReservationAndReleaseInventory(input: { scope: TenantScope; reservationId: string; expectedStatus: readonly Reservation["status"][]; now: Date }, transaction?: Tx): Promise<ReservationUpdateResult> {
    return this.transact(async tx => {
      const organizationId = input.scope.organizationId;
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelReservation" WHERE "id"=${input.reservationId} AND "organizationId"=${organizationId} FOR UPDATE`);
      const current = await tx.hotelReservation.findFirst({ where: { id: input.reservationId, organizationId }, include: { nights: true, guests: true } });
      if (!current) return { isUpdated: false, reason: "NOT_FOUND" };
      if ((current.status !== "PENDING_PAYMENT" && current.status !== "CONFIRMED") || !input.expectedStatus.includes(current.status)) return { isUpdated: false, reason: "STATUS_CONFLICT" };
      const decision = decideReservationTransition({ current: current.status, transition: "CANCEL", event: { type: "CANCELLATION_REQUESTED", at: input.now.toISOString(), refundableAmount: 0 }, now: input.now.toISOString() });
      if (!decision.isAllowed) return { isUpdated: false, reason: "STATUS_CONFLICT" };
      const held = current.holdId ? await tx.hotelBookingHold.findFirst({ where: { id: current.holdId, organizationId, propertyId: current.propertyId, roomTypeId: current.roomTypeId, status: "CONSUMED", quantity: 1 } }) : null;
      const nights = enumerateStayNights(dateOnly(current.checkIn), dateOnly(current.checkOut));
      if (!held || dateOnly(held.checkIn) !== dateOnly(current.checkIn) || dateOnly(held.checkOut) !== dateOnly(current.checkOut) || nights.length !== current.nights.length || nights.some(date => !current.nights.some(row => dateOnly(row.date) === date && row.roomTypeId === current.roomTypeId))) throw new HotelReservationIntegrityError();
      const inventory = await tx.$queryRaw<Array<{ id: string; booked: number }>>(Prisma.sql`SELECT "id","booked" FROM "HotelInventory" WHERE "organizationId"=${organizationId} AND "propertyId"=${current.propertyId} AND "roomTypeId"=${current.roomTypeId} AND "date" IN (${Prisma.join(nights.map(dateValue))}) ORDER BY "date" FOR UPDATE`);
      if (inventory.length !== nights.length || inventory.some(row => row.booked < 1)) throw new HotelReservationIntegrityError();
      for (const row of inventory) await tx.hotelInventory.update({ where: { id: row.id }, data: { booked: { decrement: 1 } } });
      await tx.hotelReservationRoom.updateMany({ where: { organizationId, reservationId: current.id }, data: { roomId: null } });
      // Financial balances and allocations are historical facts. Provider refund execution is separate.
      const updated = await tx.hotelReservation.update({ where: { id: current.id }, data: { status: "CANCELLED", cancelledAt: input.now, version: { increment: 1 } }, include: { nights: true, guests: true } });
      return { isUpdated: true, reservation: reservation(updated) };
    }, transaction, { maxWait: 10000, timeout: 20000 });
  }

  private paymentSubject(row: { publicId: string; organizationId: string; purpose: string; amountToman: bigint; status: PaymentSubjectRecord["status"]; paidAt: Date | null; metadata: Prisma.JsonValue }): PaymentSubjectRecord | null {
    if (!["RESERVATION_DEPOSIT", "RESERVATION_BALANCE", "RESERVATION_REFUND"].includes(row.purpose)) return null;
    const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata : {};
    if (typeof metadata.hotelReservationId !== "string" || typeof metadata.hotelPropertyId !== "string") return null;
    return { paymentRequestPublicId: row.publicId, organizationId: row.organizationId, purpose: row.purpose as PaymentSubjectRecord["purpose"], amountToman: row.amountToman, status: row.status, reservationId: metadata.hotelReservationId, ...(row.paidAt ? { paidAt: row.paidAt } : {}) };
  }
  async findByPublicId(scope: TenantScope, publicId: string): Promise<PaymentSubjectRecord | null> {
    const payment = await this.client.paymentRequest.findFirst({ where: { publicId, organizationId: scope.organizationId, orderId: null, appointmentId: null } });
    const subject = payment ? this.paymentSubject(payment) : null;
    const metadata = payment?.metadata as { hotelPropertyId?: string } | null;
    if (!subject || !await this.client.hotelReservation.findFirst({ where: { id: subject.reservationId, organizationId: scope.organizationId, propertyId: metadata?.hotelPropertyId }, select: { id: true } })) return null;
    return subject;
  }
  async listForReservation(scope: TenantScope, reservationId: string): Promise<readonly PaymentSubjectRecord[]> {
    const booking = await this.client.hotelReservation.findFirst({ where: { id: reservationId, organizationId: scope.organizationId }, select: { propertyId: true } });
    if (!booking) return [];
    const payments = await this.client.paymentRequest.findMany({ where: { organizationId: scope.organizationId, orderId: null, appointmentId: null, metadata: { path: ["hotelReservationId"], equals: reservationId } }, orderBy: { createdAt: "asc" } });
    return payments.flatMap(row => { const subject = this.paymentSubject(row); const metadata = row.metadata as { hotelPropertyId?: string } | null; return subject && metadata?.hotelPropertyId === booking.propertyId ? [subject] : []; });
  }
  /** Consumes existing server verification; this method never verifies a browser outcome or marks a payment PAID. */
  async applyVerifiedPayment(input: { scope: TenantScope; reservationId: string; paymentRequestPublicId: string; paidAt: Date; amountToman: bigint; now: Date }, transaction?: Tx): Promise<PaymentApplicationResult> {
    return this.transact(async tx => {
      const organizationId = input.scope.organizationId;
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelReservation" WHERE "id"=${input.reservationId} AND "organizationId"=${organizationId} FOR UPDATE`);
      let current = await tx.hotelReservation.findFirst({ where: { id: input.reservationId, organizationId }, include: { nights: true, guests: true } });
      if (!current) return { isApplied: false, reason: "NOT_FOUND" };
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PaymentRequest" WHERE "publicId"=${input.paymentRequestPublicId} AND "organizationId"=${organizationId} FOR UPDATE`);
      const payment = await tx.paymentRequest.findFirst({ where: { publicId: input.paymentRequestPublicId, organizationId } });
      if (!payment) return { isApplied: false, reason: "NOT_FOUND" };
      const metadata = payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata) ? payment.metadata : {};
      if (metadata.hotelReservationId !== current.id || metadata.hotelPropertyId !== current.propertyId || payment.purpose !== "RESERVATION_BALANCE" || payment.orderId || payment.appointmentId || payment.guestCustomerId !== current.guestCustomerId) return { isApplied: false, reason: "TENANT_MISMATCH" };
      if (payment.amountToman <= BigInt(0) || payment.amountToman !== input.amountToman || payment.amountToman !== current.totalAmount || payment.currency !== "TOMAN" || payment.currency !== current.currency) return { isApplied: false, reason: "AMOUNT_MISMATCH" };
      if (payment.status !== "PAID" || !payment.paidAt || !payment.providerIntegrationId || !payment.merchantAccountKey || !payment.credentialProfileKeySnapshot || (metadata.simulated !== undefined && metadata.simulated !== false)) return { isApplied: false, reason: "STATUS_CONFLICT" };
      const integration = await tx.organizationIntegration.findFirst({ where: { id: payment.providerIntegrationId, organizationId, status: "ACTIVE", disabledAt: null, revokedAt: null }, select: { provider: true } });
      if (!integration) return { isApplied: false, reason: "STATUS_CONFLICT" };
      const attempts = await tx.paymentProviderAttempt.findMany({ where: { organizationId, paymentRequestId: payment.id, providerIntegrationId: payment.providerIntegrationId, provider: integration.provider, status: "VERIFIED", verifiedAt: { not: null }, amountToman: payment.amountToman, merchantAccountKey: payment.merchantAccountKey, credentialProfileKeySnapshot: payment.credentialProfileKeySnapshot }, orderBy: { verifiedAt: "asc" } });
      const verified = attempts.find(attempt => {
        const evidence = attempt.verificationEvidence && typeof attempt.verificationEvidence === "object" && !Array.isArray(attempt.verificationEvidence) ? attempt.verificationEvidence : {};
        return attempt.verifiedAt! <= input.now && (evidence.simulated === undefined || evidence.simulated === false);
      });
      if (!verified || payment.paidAt > input.now) return { isApplied: false, reason: "STATUS_CONFLICT" };
      const allocation = await tx.hotelPaymentAllocation.findUnique({ where: { paymentRequestPublicId: payment.publicId } });
      if (allocation) {
        if (allocation.organizationId !== organizationId || allocation.hotelReservationId !== current.id || allocation.kind !== "BALANCE" || allocation.amountToman !== payment.amountToman || current.paidAmount < allocation.amountToman) return { isApplied: false, reason: "AMOUNT_MISMATCH" };
        return { isApplied: true, isIdempotentReplay: true, reservation: { ...reservation(current), paymentRequestPublicId: payment.publicId } };
      }
      if (current.paidAmount !== BigInt(0) || current.refundedAmount !== BigInt(0)) return { isApplied: false, reason: "STATUS_CONFLICT" };
      const held = current.holdId ? await tx.hotelBookingHold.findFirst({ where: { id: current.holdId, organizationId, propertyId: current.propertyId, status: "CONSUMED" } }) : null;
      if (!held || payment.paidAt > held.expiresAt || verified.verifiedAt! > held.expiresAt || (payment.expiresAt && payment.paidAt > payment.expiresAt)) return { isApplied: false, reason: "STATUS_CONFLICT" };
      if (current.status !== "PENDING_PAYMENT") return { isApplied: false, reason: "STATUS_CONFLICT" };
      const decision = decideReservationTransition({ current: current.status, transition: "CONFIRM", event: { type: "PAYMENT_VERIFIED", paymentRequestPublicId: payment.publicId }, now: input.now.toISOString() });
      if (!decision.isAllowed) return { isApplied: false, reason: "STATUS_CONFLICT" };
      await tx.hotelPaymentAllocation.create({ data: { organizationId, hotelReservationId: current.id, paymentRequestPublicId: payment.publicId, kind: "BALANCE", amountToman: payment.amountToman } });
      current = await tx.hotelReservation.update({ where: { id: current.id }, data: { status: "CONFIRMED", paidAmount: payment.amountToman, confirmedAt: input.now, version: { increment: 1 } }, include: { nights: true, guests: true } });
      return { isApplied: true, isIdempotentReplay: false, reservation: { ...reservation(current), paymentRequestPublicId: payment.publicId } };
    }, transaction, { maxWait: 10000, timeout: 20000 });
  }
}

export function createPrismaHotelRepositories(client: Db = defaultPrisma): PrismaHotelRepositories { return new PrismaHotelRepositories(client); }
