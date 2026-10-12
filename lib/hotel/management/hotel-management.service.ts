import { Prisma, type PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma as defaultPrisma } from "@/lib/db-runtime";

export type HotelManagementPrincipal = {
  readonly userId: string;
  readonly role: "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER" | "GUEST";
  readonly organizationId?: string | null;
};

export type HotelManagementScope = { readonly organizationId: string };
type Db = PrismaClient;

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
    const row = await this.db.hotelRoomType.findFirst({ where: { id: roomTypeId, organizationId: scope.organizationId } }); if (!row) throw new HotelManagementAuthorizationError("Room type is outside the organization scope");
    const adults = patch.maxAdults ?? row.maxAdults, children = patch.maxChildren ?? row.maxChildren, occupancy = patch.maxOccupancy ?? row.maxOccupancy;
    if (occupancy < adults || occupancy < children) throw new HotelManagementValidationError("Occupancy is below configured limits");
    if (patch.isActive === false) await this.assertNoActiveCommitments(scope, row.propertyId, roomTypeId);
    return this.db.hotelRoomType.update({ where: { id: roomTypeId }, data: { ...patch, name: patch.name?.trim() } as never });
  }

  async archiveRoomType(principal: HotelManagementPrincipal, scope: HotelManagementScope, roomTypeId: string) { await this.authorize(principal, scope); const row = await this.db.hotelRoomType.findFirst({ where: { id: roomTypeId, organizationId: scope.organizationId } }); if (!row) throw new HotelManagementAuthorizationError("Room type is outside the organization scope"); await this.assertNoActiveCommitments(scope, row.propertyId, roomTypeId); return this.db.hotelRoomType.update({ where: { id: roomTypeId }, data: { isActive: false, deletedAt: new Date() } }); }

  async createPhysicalRoom(principal: HotelManagementPrincipal, scope: HotelManagementScope, input: { propertyId: string; roomTypeId: string; code: string; floor?: string; description?: string; isOutOfService?: boolean }) {
    await this.authorize(principal, scope);
    const roomType = await this.db.hotelRoomType.findFirst({ where: { id: input.roomTypeId, propertyId: input.propertyId, organizationId: scope.organizationId } });
    if (!roomType) throw new HotelManagementAuthorizationError("Room type does not belong to this property");
    assertText(input.code, "Room code", 64); return this.db.hotelRoom.create({ data: { organizationId: scope.organizationId, propertyId: input.propertyId, roomTypeId: input.roomTypeId, code: input.code.trim(), floor: input.floor, description: input.description, isOutOfService: input.isOutOfService ?? false } });
  }

  async updatePhysicalRoom(principal: HotelManagementPrincipal, scope: HotelManagementScope, roomId: string, patch: { code?: string; roomTypeId?: string; floor?: string | null; description?: string | null; isOutOfService?: boolean; isActive?: boolean }) {
    await this.authorize(principal, scope); const room = await this.db.hotelRoom.findFirst({ where: { id: roomId, organizationId: scope.organizationId } }); if (!room) throw new HotelManagementAuthorizationError("Room is outside the organization scope");
    if (patch.code !== undefined) assertText(patch.code, "Room code", 64);
    if (patch.roomTypeId && patch.roomTypeId !== room.roomTypeId) { const target = await this.db.hotelRoomType.findFirst({ where: { id: patch.roomTypeId, propertyId: room.propertyId, organizationId: scope.organizationId, isActive: true } }); if (!target) throw new HotelManagementAuthorizationError("Target room type is outside the property scope"); await this.assertNoRoomAllocations(roomId); }
    if (patch.isActive === false || patch.isOutOfService === true) await this.assertNoRoomAllocations(roomId);
    return this.db.hotelRoom.update({ where: { id: roomId }, data: { ...patch, code: patch.code?.trim() } as never });
  }

  async archivePhysicalRoom(principal: HotelManagementPrincipal, scope: HotelManagementScope, roomId: string) { await this.authorize(principal, scope); await this.assertNoRoomAllocations(roomId); return this.db.hotelRoom.updateMany({ where: { id: roomId, organizationId: scope.organizationId }, data: { isActive: false, deletedAt: new Date() } }); }

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
      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "HotelInventory" WHERE "organizationId" = ${scope.organizationId} AND "propertyId" = ${input.propertyId} AND "roomTypeId" = ${input.roomTypeId} AND "date" = ${input.date} FOR UPDATE`);
      const row = locked[0] ? await tx.hotelInventory.findUnique({ where: { id: locked[0].id } }) : null;
      if (!row) throw new HotelManagementValidationError("Inventory night does not exist");
      if (row.allotment + delta < row.booked + row.held || row.outOfService + outDelta < 0 || row.allotment + delta < 0) throw new HotelManagementValidationError("Adjustment would invalidate committed inventory");
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

      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "HotelInventory" WHERE "organizationId"=${scope.organizationId} AND "propertyId"=${input.propertyId} AND "roomTypeId"=${input.roomTypeId} AND "date"=${input.date} FOR UPDATE`);
      const row = locked[0] ? await tx.hotelInventory.findUnique({ where: { id: locked[0].id } }) : null;
      if (!row) throw new HotelManagementValidationError("Inventory night does not exist");
      if (row.allotment + delta < row.booked + row.held || row.outOfService + outDelta < 0 || row.allotment + delta < 0) throw new HotelManagementValidationError("Adjustment would invalidate committed inventory");
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
