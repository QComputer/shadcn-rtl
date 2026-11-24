import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db-runtime";
import { ApiError } from "@/lib/api-guards";
import { authorizeHotelBookingActor, type HotelBookingActor } from "./booking-context";
import { priceHotelStay, type HotelPricedQuote } from "./booking-quote";
import { PrismaHotelRepositories } from "../persistence/prisma-hotel-repositories";
import { enumerateStayNights } from "../domain/stay-dates";
import { decideReservationTransition } from "../domain/booking-state";
import { HOTEL_BOOKING_BASE_PROPERTY_SELECT } from "./booking-context";
import { assertHotelOperationalReservationSchemaReady } from "./hotel-schema-readiness";
import { HOTEL_MAINTENANCE_SCHEMA_NOT_READY, isMissingHotelMaintenanceTableError } from "./hotel-maintenance-schema";
import { hashCustomerIdentifier, normalizeCustomerPhone } from "@/lib/customer-identity/customer-identity.service";
import { isDamoonDemoOrganizationSlug } from "./damoon-demo-booking";

const id = z.string().trim().min(1).max(200);
const MAX_TOMAN = BigInt(Number.MAX_SAFE_INTEGER);
const stay = { roomTypeId: id, ratePlanId: id, checkIn: z.iso.date(), checkOut: z.iso.date(), adults: z.number().int().min(1).max(30), childAges: z.array(z.number().int().min(0).max(17)).max(20) };
const confirmationAmount = z.union([z.number().int().safe().nonnegative(), z.string().regex(/^\d{1,16}$/)]).nullable().optional();
const manualReservation = z.object({
  roomId: id, roomTypeId: id, ratePlanId: id, checkIn: z.iso.date(), checkOut: z.iso.date(),
  adults: z.number().int().min(1).max(30), childAges: z.array(z.number().int().min(0).max(17)).max(20),
  source: z.enum(["WALK_IN", "PHONE", "RECEPTION"]),
  guests: z.array(z.object({ fullName: z.string().trim().min(1).max(150), isPrimary: z.boolean(), isChild: z.boolean().optional(), age: z.number().int().min(0).max(17).optional(), phone: z.string().trim().min(8).max(24).optional() }).strict()).min(1).max(50),
}).strict();
export const hotelOperationalCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("quote"), ...stay }).strict(),
  z.object({ action: z.literal("search"), ...stay }).strict(),
  z.object({ action: z.literal("quote-request"), requestId: id }).strict(),
  z.object({ action: z.literal("hold"), quoteId: id }).strict(),
  z.object({ action: z.literal("reserve"), quoteId: id, holdId: id, guests: z.array(z.object({ fullName: z.string().trim().min(1).max(150), isPrimary: z.boolean(), isChild: z.boolean().optional(), age: z.number().int().min(0).max(120).optional() }).strict()).min(1).max(50) }).strict(),
  z.object({ action: z.literal("cancel"), reservationId: id }).strict(),
  z.object({ action: z.literal("select-payment-method"), reservationId: id, method: z.enum(["CASH", "BANK_TRANSFER"]) }).strict(),
  z.object({ action: z.literal("confirm-reservation"), reservationId: id }).strict(),
  z.object({ action: z.literal("assign-room"), reservationId: id, roomId: id }).strict(),
  z.object({ action: z.literal("check-in"), reservationId: id }).strict(),
  z.object({ action: z.literal("check-out"), reservationId: id }).strict(),
]);
const ACTIONS = "HOTEL_OPERATIONAL_ACTION";
const QUOTES = "HOTEL_OPERATIONAL_QUOTE";
const MANUAL_RESERVATIONS = "HOTEL_MANUAL_RESERVATION";
const fail = (message: string, status = 409): never => { throw new ApiError(status, message); };
const json = (value: unknown) => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item)) as Prisma.InputJsonValue;
const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
type Tx = Prisma.TransactionClient;

/** Deployable orchestration around the existing pricing, inventory and reservation repositories. */
export class HotelOperationalReservationService {
  constructor(private readonly db: PrismaClient = prisma, private readonly now = () => new Date()) {}

  async configure(actor: HotelBookingActor, organizationId: string, propertyId: string, input: unknown) {
    const parsed = z.object({
      mode: z.enum(["DISABLED", "REQUEST_ONLY", "RESERVATION"]),
      manualConfirmationPolicy: z.enum(["DISABLED", "CASH_ON_ARRIVAL", "MINIMUM_VERIFIED_DEPOSIT"]).optional(),
      allowedOfflinePaymentMethods: z.array(z.enum(["CASH", "BANK_TRANSFER"])).max(2).optional(),
      minimumVerifiedDepositAmount: confirmationAmount,
      pendingPaymentMinutes: z.number().int().min(5).max(10080).optional(),
    }).strict().parse(input);
    const { mode } = parsed;
    await authorizeHotelBookingActor(this.db, actor, organizationId, propertyId);
    if (!["ADMIN", "SUPER_ADMIN"].includes(actor.role)) fail("Organization administrator required", 403);
    if (actor.role !== "SUPER_ADMIN" && !await this.db.organizationMember.findFirst({ where: { organizationId, userId: actor.userId, isActive: true, role: "ADMIN" } })) fail("Organization administrator required", 403);
    await assertHotelOperationalReservationSchemaReady(this.db);
    const hasPaymentConfig = parsed.manualConfirmationPolicy !== undefined || parsed.allowedOfflinePaymentMethods !== undefined || parsed.minimumVerifiedDepositAmount !== undefined;
    const data: Prisma.HotelPropertyUpdateInput = { operationalMode: mode };
    if (parsed.pendingPaymentMinutes !== undefined) data.pendingPaymentMinutes = parsed.pendingPaymentMinutes;
    if (hasPaymentConfig) {
      if (parsed.manualConfirmationPolicy === undefined || parsed.allowedOfflinePaymentMethods === undefined) fail("Confirmation policy and allowed methods must be configured together", 400);
      const methods = parsed.allowedOfflinePaymentMethods;
      if (new Set(methods).size !== methods.length) fail("Duplicate payment method", 400);
      const rawMinimum = parsed.minimumVerifiedDepositAmount;
      const minimum = rawMinimum == null ? null : BigInt(rawMinimum);
      if (minimum !== null && (minimum <= BigInt(0) || minimum > MAX_TOMAN)) fail("Minimum deposit is outside the supported Toman range", 400);
      if (parsed.manualConfirmationPolicy === "CASH_ON_ARRIVAL" && (!methods.includes("CASH") || minimum !== null)) fail("Cash-on-arrival policy requires CASH and no minimum deposit", 400);
      if (parsed.manualConfirmationPolicy === "MINIMUM_VERIFIED_DEPOSIT" && (!methods.length || minimum === null)) fail("Minimum-deposit policy requires allowed methods and a positive minimum", 400);
      if (parsed.manualConfirmationPolicy === "DISABLED" && minimum !== null) fail("Disabled confirmation policy cannot set a minimum deposit", 400);
      data.manualConfirmationPolicy = parsed.manualConfirmationPolicy;
      data.allowedOfflinePaymentMethods = methods;
      data.minimumVerifiedDepositAmount = minimum;
    }
    const updated = await this.db.hotelProperty.update({ where: { id: propertyId, organizationId }, data });
    return { mode, manualConfirmationPolicy: updated.manualConfirmationPolicy, allowedOfflinePaymentMethods: updated.allowedOfflinePaymentMethods, minimumVerifiedDepositAmount: updated.minimumVerifiedDepositAmount?.toString() ?? null, pendingPaymentMinutes: updated.pendingPaymentMinutes };
  }
  private async authorize(actor: HotelBookingActor, organizationId: string, propertyId: string) {
    if (process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED !== "1" || process.env.HOTEL_GUEST_PORTAL_ENABLED !== "1") fail("Operational reservations are disabled", 403);
    await assertHotelOperationalReservationSchemaReady(this.db);
    await authorizeHotelBookingActor(this.db, actor, organizationId, propertyId);
    const property = await this.db.hotelProperty.findFirst({
      where: { id: propertyId, organizationId, operationalMode: "RESERVATION", isActive: true, deletedAt: null },
      select: { ...HOTEL_BOOKING_BASE_PROPERTY_SELECT, operationalMode: true, manualConfirmationPolicy: true, allowedOfflinePaymentMethods: true, minimumVerifiedDepositAmount: true, pendingPaymentMinutes: true },
    });
    if (!property) fail("Operational reservations are disabled for this property", 403);
    return property;
  }
  private async authorizeManual(actor: HotelBookingActor, organizationId: string, propertyId: string) {
    if (process.env.HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED !== "1") fail("Manual room management is disabled", 403);
    if (actor.role === "CUSTOMER") fail("Reception role required", 403);
    await authorizeHotelBookingActor(this.db, actor, organizationId, propertyId);
    await assertHotelOperationalReservationSchemaReady(this.db);
    const property = await this.db.hotelProperty.findFirst({ where: { id: propertyId, organizationId, isActive: true, deletedAt: null }, select: { ...HOTEL_BOOKING_BASE_PROPERTY_SELECT, operationalMode: true, manualConfirmationPolicy: true, allowedOfflinePaymentMethods: true, minimumVerifiedDepositAmount: true, pendingPaymentMinutes: true } });
    if (!property) fail("Hotel property not found", 404);
    return property;
  }
  private async quotes(tx: Prisma.TransactionClient | PrismaClient, organizationId: string, propertyId: string, actor?: HotelBookingActor) {
    return tx.hotelStayQuote.findMany({ where: { organizationId, propertyId, ...(actor?.role === "CUSTOMER" ? { userId: actor.userId } : {}), id: { in: (await tx.hotelInventoryIdempotency.findMany({ where: { organizationId, operationScope: QUOTES }, select: { idempotencyKey: true } })).map(row => row.idempotencyKey) } } });
  }
  /** Request-driven expiry; does not enable a scheduler or touch sandbox holds. */
  private async expire(organizationId: string, propertyId: string) {
    const quotes = await this.quotes(this.db, organizationId, propertyId);
    const repo = new PrismaHotelRepositories(this.db);
    for (const row of quotes) {
      const quote = row.snapshot as unknown as HotelPricedQuote;
      if (!quote.holdId) continue;
      const held = await this.db.hotelBookingHold.findFirst({ where: { id: quote.holdId, organizationId, propertyId, expiresAt: { lte: this.now() } } });
      if (!held) continue;
      if (held.status === "ACTIVE") await repo.releaseHold({ organizationId }, held.id, this.now());
      else if (held.status === "CONSUMED" && quote.reservationId) await this.db.$transaction(async tx => {
        const cancelled = await repo.cancelReservationAndReleaseInventory({ scope: { organizationId }, reservationId: quote.reservationId!, expectedStatus: ["PENDING_PAYMENT"], now: this.now() }, tx);
        if (cancelled.isUpdated) {
          await tx.hotelReservation.update({ where: { id: cancelled.reservation.id }, data: { status: "EXPIRED" } });
          await tx.hotelInventoryIdempotency.create({ data: { id: randomUUID(), organizationId, operationScope: "HOTEL_OPERATIONAL_SYSTEM_EXPIRY", idempotencyKey: "expire:" + cancelled.reservation.id, requestFingerprint: "SERVER_EXPIRY", status: "COMPLETED", resultJson: json({ propertyId, action: "expire", reservation: { id: cancelled.reservation.id, status: "EXPIRED" }, actorUserId: "SYSTEM" }), completedAt: this.now() } });
        }
      });
    }
  }
  async get(actor: HotelBookingActor, organizationId: string, propertyId: string, receptionCenter = false) {
    // The demo reception view reads only the isolated demo property. It deliberately
    // bypasses operational booking gates and mutations, but keeps the normal
    // authenticated tenant/property authorization boundary.
    if (["ADMIN", "MANAGER", "STAFF"].includes(actor.role)) {
      const demoProperty = await authorizeHotelBookingActor(this.db, actor, organizationId, propertyId);
      const demoOrganization = await this.db.organization.findFirst({ where: { id: organizationId, vertical: "HOTEL", isActive: true, deletedAt: null }, select: { slug: true } });
      if (demoProperty.slug === "damoon-demo" && isDamoonDemoOrganizationSlug(demoOrganization?.slug)) {
        const [reservations, roomTypes, ratePlans] = await Promise.all([
          this.db.hotelReservation.findMany({ where: { organizationId, propertyId }, include: { nights: { select: { date: true, roomId: true } }, guests: { select: { fullName: true, isPrimary: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
          this.db.hotelRoomType.findMany({ where: { organizationId, propertyId, isActive: true, deletedAt: null }, select: { id: true, name: true } }),
          this.db.hotelRatePlan.findMany({ where: { organizationId, propertyId, isActive: true }, select: { id: true, name: true, roomTypeId: true } }),
        ]);
        return json({ mode: "MANUAL", view: "reception", demoBooking: true, manualRoomManagementEnabled: false, roomTypes, ratePlans, rooms: [], history: [], confirmationPolicy: { manualConfirmationPolicy: "DISABLED", allowedOfflinePaymentMethods: [], minimumVerifiedDepositAmount: null, pendingPaymentMinutes: 0 }, reservations: reservations.map(row => ({ id: row.id, reference: row.reference, guestName: row.guests.find(guest => guest.isPrimary)?.fullName ?? "Demo Guest", status: row.status, paymentMethod: null, roomTypeId: row.roomTypeId, checkIn: dateOnly(row.checkIn), checkOut: dateOnly(row.checkOut), totalAmount: row.totalAmount, currency: row.currency, paidAmount: row.paidAmount, refundedAmount: row.refundedAmount, outstandingAmount: row.totalAmount, createdAt: row.createdAt, confirmedAt: row.confirmedAt, checkedInAt: null, checkedOutAt: null, cancelledAt: null, nights: row.nights, source: "DEMO_BOOKING", simulatedPaymentStatus: row.status === "CONFIRMED" ? "SIMULATED_SUCCESS" : "PENDING_SIMULATION" })) });
      }
    }
    if (receptionCenter) {
      if (actor.role === "CUSTOMER") fail("Reception role required", 403);
      const property = await authorizeHotelBookingActor(this.db, actor, organizationId, propertyId);
      const [reservations, roomTypes, ratePlans, rooms, manualRows] = await Promise.all([
        this.db.hotelReservation.findMany({ where: { organizationId, propertyId }, include: { nights: { select: { date: true, roomId: true } }, guests: { select: { fullName: true, isPrimary: true } } }, orderBy: { createdAt: "desc" }, take: 200 }),
        this.db.hotelRoomType.findMany({ where: { organizationId, propertyId, isActive: true, deletedAt: null }, select: { id: true, name: true } }),
        this.db.hotelRatePlan.findMany({ where: { organizationId, propertyId, isActive: true }, select: { id: true, name: true, roomTypeId: true } }),
        this.db.hotelRoom.findMany({ where: { organizationId, propertyId, isActive: true, deletedAt: null, isOutOfService: false }, select: { id: true, code: true, roomTypeId: true } }),
        this.db.hotelInventoryIdempotency.findMany({ where: { organizationId, operationScope: MANUAL_RESERVATIONS, AND: [{ resultJson: { path: ["propertyId"], equals: propertyId } }] }, orderBy: { createdAt: "desc" }, take: 200, select: { resultJson: true } }),
      ]);
      const manualSources = new Map(manualRows.flatMap((row) => {
        const value = row.resultJson as Record<string, unknown> | null;
        return value && typeof value === "object" && typeof value.reservationId === "string" ? [[value.reservationId, typeof value.source === "string" ? value.source : null] as const] : [];
      }));
      return json({
        mode: "MANUAL", view: "reception", demoBooking: property.slug === "damoon-demo" && isDamoonDemoOrganizationSlug(property.organizationSlug),
        manualRoomManagementEnabled: process.env.HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED === "1",
        roomTypes, ratePlans, rooms,
        reservations: reservations.map((row) => ({
          id: row.id, reference: row.reference, guestName: row.guests.find((guest) => guest.isPrimary)?.fullName ?? "", status: row.status,
          paymentMethod: row.paymentMethod, roomTypeId: row.roomTypeId, checkIn: dateOnly(row.checkIn), checkOut: dateOnly(row.checkOut),
          totalAmount: row.totalAmount, currency: row.currency, paidAmount: row.paidAmount, refundedAmount: row.refundedAmount,
          createdAt: row.createdAt, confirmedAt: row.confirmedAt, checkedInAt: row.checkedInAt, checkedOutAt: row.checkedOutAt, cancelledAt: row.cancelledAt,
          nights: row.nights, source: manualSources.get(row.id) ?? null,
        })),
      });
    }
    const canUseManual = process.env.HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED === "1" && actor.role !== "CUSTOMER";
    const manualProperty = canUseManual ? await this.authorizeManual(actor, organizationId, propertyId) : null;
    const manualOnly = Boolean(manualProperty && (process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED !== "1" || process.env.HOTEL_GUEST_PORTAL_ENABLED !== "1" || manualProperty.operationalMode !== "RESERVATION"));
    const property = manualOnly ? manualProperty! : await this.authorize(actor, organizationId, propertyId);
    if (!manualOnly) await this.expire(organizationId, propertyId);
    const quotes = manualOnly ? [] : await this.quotes(this.db, organizationId, propertyId, actor);
    const ids = quotes.flatMap(row => { const quote = row.snapshot as unknown as HotelPricedQuote; return quote.reservationId ? [quote.reservationId] : []; });
    const manualRows = actor.role === "CUSTOMER" ? [] : await this.db.hotelInventoryIdempotency.findMany({ where: { organizationId, operationScope: MANUAL_RESERVATIONS, AND: [{ resultJson: { path: ["propertyId"], equals: propertyId } }] }, orderBy: { createdAt: "desc" }, take: 200, select: { resultJson: true } });
    const manualMeta = manualRows.flatMap(row => { const value = row.resultJson as Record<string, unknown> | null; return value && typeof value === "object" && typeof value.reservationId === "string" ? [{ id: value.reservationId, source: typeof value.source === "string" ? value.source : null }] : []; });
    const manualIds = manualMeta.map(item => item.id);
    const reservationIds = [...new Set([...ids, ...manualIds])];
    const reservations = await this.db.hotelReservation.findMany({ where: { organizationId, propertyId, id: { in: reservationIds } }, include: { nights: { select: { date: true, roomId: true } }, guests: { select: { fullName: true, isPrimary: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
    const roomTypes = await this.db.hotelRoomType.findMany({ where: { organizationId, propertyId, isActive: true, deletedAt: null }, select: { id: true, name: true } });
    const ratePlans = await this.db.hotelRatePlan.findMany({ where: { organizationId, propertyId, isActive: true }, select: { id: true, name: true, roomTypeId: true } });
    const rooms = actor.role === "CUSTOMER" ? [] : await this.db.hotelRoom.findMany({ where: { organizationId, propertyId, isActive: true, deletedAt: null, isOutOfService: false }, select: { id: true, code: true, roomTypeId: true } });
    const history = await this.db.hotelInventoryIdempotency.findMany({ where: { organizationId, operationScope: { in: [ACTIONS, "HOTEL_OPERATIONAL_SYSTEM_EXPIRY", ...(actor.role === "CUSTOMER" ? [] : [MANUAL_RESERVATIONS])] }, AND: [{ resultJson: { path: ["propertyId"], equals: propertyId } }, ...(actor.role === "CUSTOMER" ? [{ resultJson: { path: ["actorUserId"], equals: actor.userId } }] : [])] }, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, resultJson: true, createdAt: true } });
    return json({ mode: manualOnly ? "MANUAL" : "RESERVATION", view: actor.role === "CUSTOMER" ? "guest" : "reception", manualRoomManagementEnabled: process.env.HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED === "1", confirmationPolicy: { manualConfirmationPolicy: property.manualConfirmationPolicy, allowedOfflinePaymentMethods: property.allowedOfflinePaymentMethods, minimumVerifiedDepositAmount: property.minimumVerifiedDepositAmount?.toString() ?? null, pendingPaymentMinutes: property.pendingPaymentMinutes }, roomTypes, ratePlans, rooms, history, reservations: reservations.map(row => ({ id: row.id, reference: row.reference, guestName: row.guests.find(g => g.isPrimary)?.fullName ?? "", status: row.status, paymentMethod: row.paymentMethod, roomTypeId: row.roomTypeId, checkIn: dateOnly(row.checkIn), checkOut: dateOnly(row.checkOut), totalAmount: row.totalAmount, currency: row.currency, paidAmount: row.paidAmount, refundedAmount: row.refundedAmount, outstandingAmount: row.totalAmount - row.paidAmount, createdAt: row.createdAt, confirmedAt: row.confirmedAt, checkedInAt: row.checkedInAt, checkedOutAt: row.checkedOutAt, cancelledAt: row.cancelledAt, nights: row.nights, source: manualMeta.find(item => item.id === row.id)?.source ?? null })) });
  }
  /** Creates an immediately confirmed, unpaid reception booking behind the manual operations gate. */
  async createManual(actor: HotelBookingActor, organizationId: string, propertyId: string, input: unknown, idempotencyKey: string) {
    const property = await this.authorizeManual(actor, organizationId, propertyId);
    const command = manualReservation.parse(input);
    if (idempotencyKey.trim().length < 8 || idempotencyKey.length > 200) fail("Idempotency-Key required", 400);
    const guestRecords = command.guests.map(guest => {
      const normalizedPhone = guest.phone ? normalizeCustomerPhone(guest.phone) : null;
      if (guest.phone && !normalizedPhone) fail("Enter a valid guest phone number", 422);
      return { fullName: guest.fullName, isPrimary: guest.isPrimary, isChild: guest.isChild ?? false, age: guest.isChild ? guest.age ?? null : null, phoneHash: normalizedPhone ? hashCustomerIdentifier(organizationId, normalizedPhone) : undefined };
    });
    if (command.guests.filter(guest => guest.isPrimary).length !== 1 || guestRecords.filter(guest => !guest.isChild).length !== command.adults || guestRecords.filter(guest => guest.isChild).length !== command.childAges.length || !isDeepStrictEqual(guestRecords.filter(guest => guest.isChild).map(guest => guest.age).sort(), [...command.childAges].sort())) fail("Guest details do not match the party size", 422);
    if (guestRecords.some(guest => guest.isChild && (guest.age === null || guest.age < 0 || guest.age > 17))) fail("Enter a valid age for each child", 422);
    const nights = enumerateStayNights(command.checkIn, command.checkOut);
    if (nights.length < property.minStayNights || nights.length > Math.min(property.maxStayNights, 31)) fail("Stay is outside property limits", 422);
    const fingerprint = createHash("sha256").update(JSON.stringify([actor.userId, propertyId, command])).digest("hex");
    try {
      return await this.db.$transaction(async tx => {
        await assertHotelOperationalReservationSchemaReady(tx);
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([organizationId, MANUAL_RESERVATIONS, idempotencyKey])},0))`);
        const key = { organizationId_operationScope_idempotencyKey: { organizationId, operationScope: MANUAL_RESERVATIONS, idempotencyKey } };
        const replay = await tx.hotelInventoryIdempotency.findUnique({ where: key });
        if (replay) { if (replay.requestFingerprint !== fingerprint) fail("Idempotency-Key conflict"); return replay.resultJson; }
        const activeProperty = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "HotelProperty" WHERE "id"=${propertyId} AND "organizationId"=${organizationId} AND "isActive"=true AND "deletedAt" IS NULL FOR SHARE`);
        if (!activeProperty.length) fail("Hotel property is inactive", 404);
        const lockedType = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "HotelRoomType" WHERE "id"=${command.roomTypeId} AND "propertyId"=${propertyId} AND "organizationId"=${organizationId} AND "isActive"=true AND "deletedAt" IS NULL FOR UPDATE`);
        if (!lockedType.length) fail("Room type is not available", 422);
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelRoom" WHERE "id"=${command.roomId} AND "organizationId"=${organizationId} AND "propertyId"=${propertyId} FOR UPDATE`);
        const room = await tx.hotelRoom.findFirst({ where: { id: command.roomId, organizationId, propertyId, roomTypeId: command.roomTypeId, isActive: true, deletedAt: null, isOutOfService: false }, select: { id: true } });
        if (!room) fail("Selected physical room is unavailable", 422);
        const from = new Date(`${command.checkIn}T00:00:00.000Z`), to = new Date(`${command.checkOut}T00:00:00.000Z`);
        const [allocation, maintenance] = await Promise.all([
          tx.hotelReservationRoom.findFirst({ where: { organizationId, roomId: command.roomId, date: { in: nights.map(day => new Date(`${day}T00:00:00.000Z`)) }, reservation: { status: { in: ["HELD", "PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"] } } }, select: { date: true } }),
          tx.hotelRoomMaintenanceBlock.findFirst({ where: { organizationId, propertyId, roomId: command.roomId, releasedAt: null, from: { lt: to }, to: { gt: from } }, select: { id: true } }),
        ]);
        if (allocation) fail("Selected physical room is occupied for one or more stay nights");
        if (maintenance) fail("Selected physical room has scheduled maintenance during this stay");
        const now = this.now();
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: property.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
        if (command.checkIn < today) fail("Stay is outside property limits", 422);
        const quote = (await priceHotelStay(tx, property, actor.userId, { action: "quote", roomTypeId: command.roomTypeId, ratePlanId: command.ratePlanId, checkIn: command.checkIn, checkOut: command.checkOut, adults: command.adults, childAges: command.childAges }, now)).quote!;
        const holdId = randomUUID(), reference = `HD-${holdId.slice(0, 12).toUpperCase()}`;
        const repository = new PrismaHotelRepositories(this.db);
        const claimed = await repository.claimInventoryAndCreateHold({ scope: { organizationId }, propertyId, roomTypeId: command.roomTypeId, nights, quantity: 1, now, hold: { id: holdId, organizationId, propertyId, roomTypeId: command.roomTypeId, reference, checkIn: command.checkIn, checkOut: command.checkOut, nights, quantity: 1, expiresAt: new Date(now.getTime() + 600_000), status: "ACTIVE", createdAt: now } }, tx);
        if (!claimed.isClaimed) fail(claimed.reason === "CONFLICT" ? "Inventory changed; reload and try again" : "No room inventory is available for these dates");
        const reservationKey = `manual:${createHash("sha256").update(idempotencyKey).digest("hex")}`;
        const reservation = await repository.createReservation({ id: randomUUID(), organizationId, propertyId, reference, idempotencyKey: reservationKey, holdId, roomTypeId: command.roomTypeId, ratePlanId: command.ratePlanId, status: "PENDING_PAYMENT", checkIn: command.checkIn, checkOut: command.checkOut, nights, nightlyRates: quote.nightlyRates, totalAmount: Number(quote.totalAmount), currency: quote.currency, cancellationPolicySnapshot: quote.policy, guests: guestRecords, occupancy: { adults: command.adults, children: command.childAges.length, childAges: command.childAges }, createdAt: now, updatedAt: now }, tx);
        await tx.hotelBookingHold.update({ where: { id: holdId }, data: { status: "CONSUMED", expiresAt: new Date("9999-12-31T00:00:00.000Z") } });
        await tx.hotelReservation.update({ where: { id: reservation.id }, data: { status: "CONFIRMED", confirmedAt: now } });
        const assigned = await tx.hotelReservationRoom.updateMany({ where: { organizationId, reservationId: reservation.id, roomId: null }, data: { roomId: command.roomId } });
        if (assigned.count !== nights.length) fail("Reservation room allocation could not be completed");
        const result = { reservationId: reservation.id, reference, status: "CONFIRMED", totalAmount: String(quote.totalAmount), currency: quote.currency, source: command.source, paymentStatus: "UNPAID" };
        await tx.hotelInventoryIdempotency.create({ data: { id: randomUUID(), organizationId, operationScope: MANUAL_RESERVATIONS, idempotencyKey, requestFingerprint: fingerprint, status: "COMPLETED", resultJson: json({ ...result, propertyId, action: "CREATE_MANUAL_RESERVATION", actorUserId: actor.userId }), completedAt: now } });
        return result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 20000 });
    } catch (error) {
      if (isMissingHotelMaintenanceTableError(error)) throw new ApiError(503, HOTEL_MAINTENANCE_SCHEMA_NOT_READY);
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) fail("Room or inventory changed while saving; refresh and choose another room", 409);
      throw error;
    }
  }
  private async lockQuote(tx: Tx, actor: HotelBookingActor, organizationId: string, propertyId: string, quoteId: string) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelStayQuote" WHERE "id"=${quoteId} AND "organizationId"=${organizationId} AND "propertyId"=${propertyId} FOR UPDATE`);
    const row = await tx.hotelStayQuote.findFirst({ where: { id: quoteId, organizationId, propertyId } });
    if (!row || (actor.role === "CUSTOMER" && row.userId !== actor.userId) || !await tx.hotelInventoryIdempotency.findFirst({ where: { organizationId, operationScope: QUOTES, idempotencyKey: quoteId } })) fail("Quote not found", 404);
    return { row: row!, quote: row!.snapshot as unknown as HotelPricedQuote };
  }
  async execute(actor: HotelBookingActor, organizationId: string, propertyId: string, input: unknown, idempotencyKey: string) {
    const submitted = hotelOperationalCommand.parse(input);
    const manualLifecycle = process.env.HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED === "1" && actor.role !== "CUSTOMER" && ["cancel", "assign-room", "check-in", "check-out"].includes(submitted.action);
    if (manualLifecycle) await this.authorizeManual(actor, organizationId, propertyId);
    else await this.authorize(actor, organizationId, propertyId);
    if (idempotencyKey.length < 8 || idempotencyKey.length > 200) fail("Idempotency-Key required", 400);
    if (["quote", "search", "quote-request"].includes(submitted.action)) await this.expire(organizationId, propertyId);
    const fingerprint = createHash("sha256").update(JSON.stringify([actor.userId, propertyId, submitted])).digest("hex");
    return this.db.$transaction(async tx => {
      await assertHotelOperationalReservationSchemaReady(tx);
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([organizationId, ACTIONS, idempotencyKey])},0))`);
      const key = { organizationId_operationScope_idempotencyKey: { organizationId, operationScope: ACTIONS, idempotencyKey } };
      const replay = await tx.hotelInventoryIdempotency.findUnique({ where: key });
      if (replay) { if (replay.requestFingerprint !== fingerprint) fail("Idempotency-Key conflict"); return replay.resultJson; }
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelProperty" WHERE "id"=${propertyId} AND "organizationId"=${organizationId} FOR SHARE`);
      const property = await tx.hotelProperty.findFirst({ where: { id: propertyId, organizationId, ...(!manualLifecycle ? { operationalMode: "RESERVATION" } : {}), isActive: true, deletedAt: null }, select: { ...HOTEL_BOOKING_BASE_PROPERTY_SELECT, operationalMode: true, manualConfirmationPolicy: true, allowedOfflinePaymentMethods: true, minimumVerifiedDepositAmount: true, pendingPaymentMinutes: true } });
      if (!property) fail("Operational reservations disabled", 403);
      const now = this.now(); const repo = new PrismaHotelRepositories(this.db);
      let result: Record<string, unknown>;
      const command = submitted.action === "quote-request" ? await (async () => {
        if (actor.role !== "CUSTOMER") fail("Customer account required", 403);
        const request = await tx.hotelStayRequest.findFirst({ where: { id: submitted.requestId, organizationId, propertyId, userId: actor.userId, status: { in: ["NEW", "CONTACTED"] } } });
        if (!request) fail("Request not found or closed", 404);
        const q = request!.snapshot as unknown as HotelPricedQuote;
        return { action: "quote" as const, roomTypeId: q.roomTypeId, ratePlanId: q.ratePlanId, checkIn: q.checkIn, checkOut: q.checkOut, adults: q.adults, childAges: q.childAges };
      })() : submitted;
      if (command.action === "quote" || command.action === "search") {
        const nights = enumerateStayNights(command.checkIn, command.checkOut);
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: property!.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
        if (command.checkIn < today || nights.length < property!.minStayNights || nights.length > property!.maxStayNights) fail("Stay is outside property limits", 422);
        const priced = await priceHotelStay(tx, property!, actor.userId, command, now);
        if (priced.quote) {
          const quote = priced.quote;
          await tx.hotelStayQuote.create({ data: { id: quote.id, organizationId, propertyId, userId: actor.userId, snapshot: json(quote), expiresAt: new Date(quote.expiresAt) } });
          await tx.hotelInventoryIdempotency.create({ data: { id: randomUUID(), organizationId, operationScope: QUOTES, idempotencyKey: quote.id, requestFingerprint: fingerprint, status: "COMPLETED", resultJson: json({ quoteId: quote.id }), completedAt: now } });
        }
        result = priced;
      } else if (command.action === "hold" || command.action === "reserve") {
        const { quote } = await this.lockQuote(tx, actor, organizationId, propertyId, command.quoteId);
        // Serialize pricing/resource edits against this transaction, then re-price on the server.
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelRoomType" WHERE "id"=${quote.roomTypeId} AND "organizationId"=${organizationId} FOR SHARE`);
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelRatePlan" WHERE "id"=${quote.ratePlanId} AND "organizationId"=${organizationId} FOR SHARE`);
        if (quote.policy.id) await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelCancellationPolicy" WHERE "id"=${quote.policy.id} AND "organizationId"=${organizationId} FOR SHARE`);
        if (command.action === "reserve" && quote.reservationId) {
          const reservation = await tx.hotelReservation.findFirstOrThrow({ where: { id: quote.reservationId, organizationId, propertyId } });
          if (quote.holdId !== command.holdId) fail("Hold mismatch");
          const stored = await tx.hotelReservationGuest.findMany({ where: { reservationId: reservation.id }, select: { fullName: true, isPrimary: true, isChild: true, age: true }, orderBy: { fullName: "asc" } });
          const desired = command.guests.map(g => ({ fullName: g.fullName, isPrimary: g.isPrimary, isChild: g.isChild ?? false, age: g.age ?? null })).sort((a,b) => a.fullName.localeCompare(b.fullName));
          if (!isDeepStrictEqual(stored, desired)) fail("Reservation retry conflict");
          result = { reservation: this.summary(reservation) };
        } else {
          if (new Date(quote.expiresAt) <= now) fail("Quote expired");
          const repriced = (await priceHotelStay(tx, property!, quote.actorUserId, { ...quote, action: "quote" }, now, { requireAvailability: command.action === "hold" && !quote.holdId })).quote!;
          const terms = (q: HotelPricedQuote) => ({ total: q.totalAmount, currency: q.currency, nights: q.nightlyRates, version: q.policyVersion, policy: { ...q.policy, capturedAt: undefined } });
          if (!isDeepStrictEqual(json(terms(quote)), json(terms(repriced)))) fail("Quote changed; request a new quote");
          if (command.action === "hold") {
            if (quote.holdId) {
              const held = await tx.hotelBookingHold.findFirst({ where: { id: quote.holdId, organizationId, propertyId, status: "ACTIVE", expiresAt: { gt: now } } });
              if (!held) fail("Hold expired"); result = { hold: held };
            } else {
              const holdId = randomUUID(), reference = `HT-${holdId}`, expiresAt = new Date(Math.min(new Date(quote.expiresAt).getTime(), now.getTime() + 600000));
              const claimed = await repo.claimInventoryAndCreateHold({ scope: { organizationId }, propertyId, roomTypeId: quote.roomTypeId, nights: enumerateStayNights(quote.checkIn, quote.checkOut), quantity: 1, now, hold: { id: holdId, organizationId, propertyId, roomTypeId: quote.roomTypeId, reference, checkIn: quote.checkIn, checkOut: quote.checkOut, nights: enumerateStayNights(quote.checkIn, quote.checkOut), quantity: 1, expiresAt, status: "ACTIVE", createdAt: now } }, tx);
              if (!claimed.isClaimed) fail(claimed.reason ?? "Inventory conflict");
              await tx.hotelBookingHold.update({ where: { id: holdId }, data: { ratePlanId: quote.ratePlanId, currency: quote.currency, totalAmount: BigInt(quote.totalAmount), nightlyRates: quote.nightlyRates, cancellationPolicySnapshot: json(quote.policy) } });
              quote.holdId = holdId;
              result = { hold: { id: holdId, reference, expiresAt } };
            }
          } else {
            if (actor.role !== "CUSTOMER") fail("Customer account required to reserve", 403);
            if (!quote.holdId || quote.holdId !== command.holdId) fail("Quote and hold mismatch", 403);
            if (command.guests.length !== quote.adults + quote.childAges.length || command.guests.filter(g => g.isPrimary).length !== 1 || command.guests.filter(g => !g.isChild).length !== quote.adults || !isDeepStrictEqual(command.guests.filter(g => g.isChild).map(g => g.age).sort(), [...quote.childAges].sort())) fail("Guests do not match quoted occupancy", 422);
            const held = await tx.hotelBookingHold.findFirstOrThrow({ where: { id: quote.holdId, organizationId, propertyId } });
            if (held.status !== "ACTIVE" || held.expiresAt <= now) fail("Hold expired");
            const reservation = await repo.createReservation({ id: randomUUID(), organizationId, propertyId, reference: held.reference, idempotencyKey: `operational:${quote.id}`, holdId: held.id, roomTypeId: quote.roomTypeId, ratePlanId: quote.ratePlanId, status: "PENDING_PAYMENT", checkIn: quote.checkIn, checkOut: quote.checkOut, nights: enumerateStayNights(quote.checkIn, quote.checkOut), nightlyRates: quote.nightlyRates, totalAmount: Number(quote.totalAmount), currency: quote.currency, cancellationPolicySnapshot: quote.policy, guests: command.guests, createdAt: now, updatedAt: now }, tx);
            const pendingPaymentExpiresAt = new Date(now.getTime() + property!.pendingPaymentMinutes * 60_000);
            const consumedHold = await tx.hotelBookingHold.updateMany({ where: { id: held.id, organizationId, propertyId, status: "CONSUMED" }, data: { expiresAt: pendingPaymentExpiresAt } });
            if (consumedHold.count !== 1) fail("Reservation hold could not be converted");
            await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([organizationId, "HOTEL_OPERATIONAL_GUEST", actor.userId])},0))`);
            const guest = await tx.guestCustomer.upsert({ where: { sessionId: `hotel-operational:${organizationId}:${actor.userId}` }, update: {}, create: { sessionId: `hotel-operational:${organizationId}:${actor.userId}`, name: command.guests.find(g => g.isPrimary)!.fullName } });
            if (!await tx.customerIdentity.findFirst({ where: { organizationId, userId: actor.userId, guestCustomerId: guest.id } })) await tx.customerIdentity.create({ data: { organizationId, userId: actor.userId, guestCustomerId: guest.id } });
            await tx.hotelReservation.update({ where: { id: reservation.id }, data: { guestCustomerId: guest.id } });
            quote.reservationId = reservation.id; result = { reservation: this.summary(reservation) };
          }
          await tx.hotelStayQuote.update({ where: { id: quote.id }, data: { snapshot: json(quote) } });
        }
      } else {
        const candidates = await this.quotes(tx, organizationId, propertyId, actor);
        const manualCandidates = manualLifecycle ? await tx.hotelInventoryIdempotency.findMany({ where: { organizationId, operationScope: MANUAL_RESERVATIONS, AND: [{ resultJson: { path: ["propertyId"], equals: propertyId } }] }, select: { resultJson: true } }) : [];
        const isManualReservation = manualCandidates.some(row => row.resultJson && typeof row.resultJson === "object" && !Array.isArray(row.resultJson) && row.resultJson.reservationId === command.reservationId);
        const isQuotedReservation = candidates.some(row => (row.snapshot as unknown as HotelPricedQuote).reservationId === command.reservationId);
        if (manualLifecycle ? !isManualReservation : !isQuotedReservation) fail("Reservation not found", 404);
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelReservation" WHERE "id"=${command.reservationId} AND "organizationId"=${organizationId} AND "propertyId"=${propertyId} FOR UPDATE`);
        let reservation = await tx.hotelReservation.findFirstOrThrow({ where: { id: command.reservationId, organizationId, propertyId }, include: { nights: true, hold: true } });
        if (command.action === "select-payment-method") {
          if (actor.role !== "CUSTOMER") fail("Guest account required to select a payment method", 403);
          if (reservation.status !== "PENDING_PAYMENT") fail("Only pending reservations can select a payment method");
          if (!reservation.holdId) fail("Reservation hold is unavailable");
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelBookingHold" WHERE "id"=${reservation.holdId} AND "organizationId"=${organizationId} AND "propertyId"=${propertyId} FOR UPDATE`);
          const activeHold = await tx.hotelBookingHold.findFirst({ where: { id: reservation.holdId, organizationId, propertyId } });
          if (!activeHold || activeHold.status !== "CONSUMED" || activeHold.expiresAt <= now) fail("Reservation hold expired");
          if (!property!.allowedOfflinePaymentMethods.includes(command.method)) fail("Payment method is not enabled for this property", 422);
          const selected = await tx.hotelReservation.updateMany({ where: { id: reservation.id, organizationId, propertyId, status: "PENDING_PAYMENT", version: reservation.version }, data: { paymentMethod: command.method, version: { increment: 1 } } });
          if (selected.count !== 1) fail("Reservation changed while selecting payment method");
          reservation = await tx.hotelReservation.findFirstOrThrow({ where: { id: reservation.id, organizationId, propertyId }, include: { nights: true, hold: true } });
        } else if (command.action === "confirm-reservation") {
          if (actor.role === "CUSTOMER") fail("Reception role required", 403);
          if (reservation.status !== "PENDING_PAYMENT") fail("Only pending reservations can be confirmed");
          if (!reservation.holdId || !reservation.hold || reservation.hold.status !== "CONSUMED") fail("Reservation hold is unavailable");
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelBookingHold" WHERE "id"=${reservation.holdId} AND "organizationId"=${organizationId} AND "propertyId"=${propertyId} FOR UPDATE`);
          const hold = await tx.hotelBookingHold.findFirst({ where: { id: reservation.holdId, organizationId, propertyId } });
          if (!hold || hold.status !== "CONSUMED" || hold.expiresAt <= now) fail("Reservation hold expired");
          if (!reservation.paymentMethod || !property!.allowedOfflinePaymentMethods.includes(reservation.paymentMethod)) fail("Select an enabled payment method before confirmation");
          if (property!.manualConfirmationPolicy === "CASH_ON_ARRIVAL") {
            if (reservation.paymentMethod === "BANK_TRANSFER" && reservation.paidAmount < reservation.totalAmount) fail("Bank transfer confirmation requires a verified full payment");
          } else if (property!.manualConfirmationPolicy === "MINIMUM_VERIFIED_DEPOSIT") {
            const minimum = property!.minimumVerifiedDepositAmount;
            if (minimum === null || minimum <= BigInt(0) || minimum > MAX_TOMAN || reservation.paidAmount < minimum) fail("Minimum verified deposit has not been received");
          } else {
            fail("Manual confirmation is disabled for this property", 403);
          }
          const confirmed = await tx.hotelReservation.updateMany({ where: { id: reservation.id, organizationId, propertyId, status: "PENDING_PAYMENT", version: reservation.version }, data: { status: "CONFIRMED", confirmedAt: now, version: { increment: 1 } } });
          if (confirmed.count !== 1) fail("Reservation changed while confirming");
          reservation = await tx.hotelReservation.findFirstOrThrow({ where: { id: reservation.id, organizationId, propertyId }, include: { nights: true, hold: true } });
        } else if (command.action === "cancel") {
          if (!["CANCELLED", "EXPIRED"].includes(reservation.status)) {
            const cancelled = await repo.cancelReservationAndReleaseInventory({ scope: { organizationId }, reservationId: reservation.id, expectedStatus: ["PENDING_PAYMENT", "CONFIRMED"], now }, tx);
            if (!cancelled.isUpdated) fail(cancelled.reason); reservation = await tx.hotelReservation.findUniqueOrThrow({ where: { id: reservation.id }, include: { nights: true, hold: true } });
          }
        } else {
          if (actor.role === "CUSTOMER") fail("Reception role required", 403);
          if (command.action === "assign-room") {
            if (reservation.status !== "CONFIRMED") fail("Only confirmed reservations can receive a room");
            await this.lockRoom(tx, organizationId, propertyId, reservation.roomTypeId, command.roomId);
            await this.assertRoomMaintenanceClear(tx, organizationId, propertyId, command.roomId, reservation.checkIn, reservation.checkOut);
            if (await tx.hotelReservationRoom.findFirst({ where: { organizationId, roomId: command.roomId, date: { in: reservation.nights.map(n => n.date) }, reservationId: { not: reservation.id } } })) fail("Room is already assigned");
            await tx.hotelReservationRoom.updateMany({ where: { organizationId, reservationId: reservation.id }, data: { roomId: command.roomId } });
            reservation = await tx.hotelReservation.update({ where: { id: reservation.id }, data: { version: { increment: 1 } }, include: { nights: true, hold: true } });
          } else {
            const checkingIn = command.action === "check-in";
            if (checkingIn) {
              const roomId = reservation.nights[0]?.roomId;
              if (!roomId || reservation.nights.length !== enumerateStayNights(dateOnly(reservation.checkIn), dateOnly(reservation.checkOut)).length || reservation.nights.some(n => n.roomId !== roomId)) fail("Assign a room before check-in");
              await this.lockRoom(tx, organizationId, propertyId, reservation.roomTypeId, roomId);
              await this.assertRoomMaintenanceClear(tx, organizationId, propertyId, roomId, reservation.checkIn, reservation.checkOut);
            }
            if (checkingIn ? reservation.status !== "CONFIRMED" : reservation.status !== "CHECKED_IN") fail("Invalid reception transition");
            const decision = decideReservationTransition({ current: checkingIn ? "CONFIRMED" : "CHECKED_IN", transition: checkingIn ? "CHECK_IN" : "CHECK_OUT", event: { type: checkingIn ? "GUEST_CHECKED_IN" : "GUEST_CHECKED_OUT", at: now.toISOString() }, now: now.toISOString() });
            if (!decision.isAllowed) fail(decision.reason);
            reservation = await tx.hotelReservation.update({ where: { id: reservation.id }, data: { status: checkingIn ? "CHECKED_IN" : "CHECKED_OUT", ...(checkingIn ? { checkedInAt: now } : { checkedOutAt: now }), version: { increment: 1 } }, include: { nights: true, hold: true } });
          }
        }
        result = { reservation: this.summary(reservation) };
      }
      const durable = json({ ...result, simulated: false, propertyId, action: command.action, actorUserId: actor.userId });
      await tx.hotelInventoryIdempotency.create({ data: { id: randomUUID(), organizationId, operationScope: ACTIONS, idempotencyKey, requestFingerprint: fingerprint, status: "COMPLETED", resultJson: durable, completedAt: now } });
      return durable;
    }, { maxWait: 10000, timeout: 20000 });
  }
  private summary(row: { id: string; reference: string; status: string; paymentMethod?: string | null; totalAmount: string | number | bigint; currency: string }) { return { id: row.id, reference: row.reference, status: row.status, paymentMethod: row.paymentMethod ?? null, totalAmount: row.totalAmount.toString(), currency: row.currency, simulated: false }; }
  private async lockRoom(tx: Tx, organizationId: string, propertyId: string, roomTypeId: string, roomId: string) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelRoom" WHERE "id"=${roomId} AND "organizationId"=${organizationId} AND "propertyId"=${propertyId} FOR UPDATE`);
    if (!await tx.hotelRoom.findFirst({ where: { id: roomId, organizationId, propertyId, roomTypeId, isActive: true, deletedAt: null, isOutOfService: false } })) fail("Room is not available");
  }
  private async assertRoomMaintenanceClear(tx: Tx, organizationId: string, propertyId: string, roomId: string, checkIn: Date, checkOut: Date) {
    try {
      const overlap = await tx.hotelRoomMaintenanceBlock.findFirst({ where: { organizationId, propertyId, roomId, releasedAt: null, from: { lt: checkOut }, to: { gt: checkIn } }, select: { id: true } });
      if (overlap) fail("ROOM_MAINTENANCE_CONFLICT");
    } catch (error) {
      if (isMissingHotelMaintenanceTableError(error)) throw new ApiError(503, HOTEL_MAINTENANCE_SCHEMA_NOT_READY);
      throw error;
    }
  }
}
