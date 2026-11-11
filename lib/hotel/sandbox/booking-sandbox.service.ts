import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db-runtime";
import { ApiError } from "@/lib/api-guards";
import { PrismaHotelRepositories } from "@/lib/hotel/persistence/prisma-hotel-repositories";
import { enumerateStayNights, resolvePropertyInstant } from "@/lib/hotel/domain/stay-dates";
import { quoteCancellation } from "@/lib/hotel/domain/rate";
import { decideReservationTransition } from "@/lib/hotel/domain/booking-state";
import type { ReservationStatus } from "@/lib/hotel/domain/types";
import { priceHotelStay, type HotelPricedQuote } from "@/lib/hotel/services/booking-quote";

import { authorizeHotelBookingActor } from "@/lib/hotel/services/booking-context";

type Tx = Prisma.TransactionClient;
export type HotelSandboxActor = { userId: string; role: string; organizationId?: string | null; customerContextVerified?: boolean };
const identifier = z.string().trim().min(1).max(200);
const stay = { roomTypeId: identifier, ratePlanId: identifier, checkIn: z.iso.date(), checkOut: z.iso.date(), adults: z.number().int().min(1).max(30), childAges: z.array(z.number().int().min(0).max(17)).max(20) };
export const hotelSandboxCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("search"), ...stay }).strict(),
  z.object({ action: z.literal("quote"), ...stay }).strict(),
  z.object({ action: z.literal("hold"), quoteId: identifier }).strict(),
  z.object({ action: z.literal("reserve"), quoteId: identifier, holdId: identifier, guests: z.array(z.object({ fullName: z.string().trim().min(1).max(150), isPrimary: z.boolean(), isChild: z.boolean().optional(), age: z.number().int().min(0).max(120).optional() }).strict()).min(1).max(50) }).strict(),
  z.object({ action: z.literal("pay"), reservationId: identifier, outcome: z.enum(["SUCCESS", "FAILED", "EXPIRED"]) }).strict(),
  z.object({ action: z.literal("cancel"), reservationId: identifier }).strict(),
  z.object({ action: z.literal("check-in"), reservationId: identifier }).strict(),
  z.object({ action: z.literal("check-out"), reservationId: identifier }).strict(),
  z.object({ action: z.literal("assign-room"), reservationId: identifier, roomId: identifier }).strict(),
]);
type Quote = HotelPricedQuote;
type JsonResult = Record<string, unknown>;
export type SandboxResult = {
  quote?: Quote;
  hold?: { id: string; reference: string; expiresAt: string };
  reservation?: { id: string; reference: string; status: string; totalAmount: string; currency: string; simulated: boolean };
  payment?: { id: string; status: string; simulated: boolean; financialTransaction: boolean; amountToman: string; currency: string };
  cancellation?: { refundableAmount: number; retainedAmount: number; reason: string };
  available?: boolean; remaining?: number; simulated?: boolean;
};
const QUOTES = "HOTEL_SANDBOX_QUOTE";
const ACTIONS = "HOTEL_SANDBOX_ACTION";
const PAYMENTS = "HOTEL_SANDBOX_PAYMENT";
const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
const json = (value: unknown) => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item)) as Prisma.InputJsonValue;
const fail = (message: string, status = 409): never => { throw new ApiError(status, message); };

/** Impossible to enable in a production process or against a non-fixture database. */
export function hotelBookingSandboxEnabled(env: { DATABASE_URL?: string; NODE_ENV?: string; HOTEL_BOOKING_SANDBOX_ENABLED?: string } = process.env) {
  try {
    const url = new URL(env.DATABASE_URL ?? "");
    return env.NODE_ENV !== "production" && env.HOTEL_BOOKING_SANDBOX_ENABLED === "1" &&
      ["postgres:", "postgresql:"].includes(url.protocol) && url.hostname === "127.0.0.1" && url.port === "55439" &&
      url.pathname === "/retail_hero_test" && url.username === "hero_test" && !url.search && !url.hash;
  } catch { return false; }
}

/** Test adapter: produces local simulated outcomes, never provider verification or money movement. */
export class LocalHotelPaymentAdapter {
  settle(outcome: "SUCCESS" | "FAILED" | "EXPIRED") {
    return { status: outcome, simulated: true as const, financialTransaction: false as const };
  }
}

export class HotelBookingSandboxService {
  constructor(private readonly db: PrismaClient = prisma, private readonly now = () => new Date()) {}

  private async authorize(actor: HotelSandboxActor, organizationId: string, propertyId: string) {
    if (!hotelBookingSandboxEnabled()) fail("Hotel booking sandbox is disabled", 403);
    const identity = await this.db.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database()::text AS database,current_user::text AS role`;
    if (identity[0]?.database !== "retail_hero_test" || identity[0]?.role !== "hero_test") fail("Fixture database required", 403);
    return authorizeHotelBookingActor(this.db, actor, organizationId, propertyId);
  }

  async get(actor: HotelSandboxActor, organizationId: string, propertyId: string) {
    await this.authorize(actor, organizationId, propertyId);
    const [roomTypes, ratePlans, quotes] = await Promise.all([
      this.db.hotelRoomType.findMany({ where: { organizationId, propertyId, isActive: true, deletedAt: null }, select: { id: true, name: true } }),
      this.db.hotelRatePlan.findMany({ where: { organizationId, propertyId, isActive: true }, select: { id: true, name: true, roomTypeId: true } }),
      this.db.hotelInventoryIdempotency.findMany({ where: { organizationId, operationScope: QUOTES }, orderBy: { createdAt: "desc" }, take: 1000 }),
    ]);
    const ids = quotes.map(row => row.resultJson as unknown as Quote).filter(quote => quote.propertyId === propertyId && (actor.role !== "CUSTOMER" || quote.actorUserId === actor.userId)).flatMap(quote => quote.reservationId ? [quote.reservationId] : []);
    const reservations = await this.db.hotelReservation.findMany({ where: { organizationId, propertyId, id: { in: ids } }, orderBy: { createdAt: "desc" }, take: 100,
      select: { id: true, reference: true, roomTypeId: true, status: true, checkIn: true, checkOut: true, totalAmount: true, currency: true, nights: { select: { roomId: true } } } });
    const rooms = actor.role === "CUSTOMER" ? undefined : await this.db.hotelRoom.findMany({ where: { organizationId, propertyId, isActive: true, isOutOfService: false, deletedAt: null }, select: { id: true, roomTypeId: true, code: true }, orderBy: { code: "asc" } });
    return { enabled: true, roomTypes, ratePlans, ...(rooms ? { rooms } : {}), reservations: reservations.map(({ nights, ...row }) => ({ ...row, assignedRoomId: nights.length && nights[0].roomId && nights.every(night => night.roomId === nights[0].roomId) ? nights[0].roomId : null, checkIn: dateOnly(row.checkIn), checkOut: dateOnly(row.checkOut), totalAmount: row.totalAmount.toString(), simulated: true })) };
  }

  async execute(actor: HotelSandboxActor, organizationId: string, propertyId: string, input: unknown, idempotencyKey: string): Promise<SandboxResult> {
    const property = await this.authorize(actor, organizationId, propertyId);
    const command = hotelSandboxCommand.parse(input);
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200) fail("Idempotency-Key required", 400);
    // Reuse the existing exactly-once release path for abandoned sandbox holds.
    // This is request-driven local cleanup, not activation of the Hotel scheduler.
    if (command.action === "search" || command.action === "quote") {
      const owned = await this.db.hotelInventoryIdempotency.findMany({ where: { organizationId, operationScope: QUOTES }, take: 1000 });
      const holdIds = owned.map(row => row.resultJson as unknown as Quote).filter(quote => quote.propertyId === propertyId).flatMap(quote => quote.holdId ? [quote.holdId] : []);
      const expired = await this.db.hotelBookingHold.findMany({ where: { organizationId, propertyId, id: { in: holdIds }, status: "ACTIVE", expiresAt: { lte: this.now() } }, take: 100 });
      const repo = new PrismaHotelRepositories(this.db);
      for (const held of expired) await repo.releaseHold({ organizationId }, held.id, this.now());
    }
    const fingerprint = createHash("sha256").update(JSON.stringify([actor.userId, propertyId, command])).digest("hex");
    return this.db.$transaction(async tx => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([organizationId, ACTIONS, idempotencyKey])},0))`);
      const key = { organizationId_operationScope_idempotencyKey: { organizationId, operationScope: ACTIONS, idempotencyKey } };
      const replay = await tx.hotelInventoryIdempotency.findUnique({ where: key });
      if (replay) {
        if (replay.requestFingerprint !== fingerprint) fail("Idempotency-Key conflict");
        return replay.resultJson as unknown as SandboxResult;
      }
      let now = this.now();
      let result: JsonResult;
      if (command.action === "search" || command.action === "quote") {
        const priced = await priceHotelStay(tx, property, actor.userId, command, now);
        if (priced.quote) {
          const quote = priced.quote;
          await tx.hotelInventoryIdempotency.create({ data: { id: quote.id, organizationId, operationScope: QUOTES, idempotencyKey: quote.id, requestFingerprint: fingerprint, status: "COMPLETED", resultJson: json(quote), completedAt: now } });
        }
        result = { ...priced, simulated: true };
      } else if (command.action === "hold" || command.action === "reserve") {
        const quote = await this.lockQuote(tx, organizationId, propertyId, actor, command.quoteId);
        now = this.now();
        const repo = new PrismaHotelRepositories(this.db);
        if (command.action === "hold") {
          if (quote.holdId) {
            const existing = await tx.hotelBookingHold.findUniqueOrThrow({ where: { id: quote.holdId } });
            if (existing.status !== "ACTIVE" || existing.expiresAt <= now) fail("Hold is no longer active");
            result = { hold: { id: existing.id, reference: existing.reference, expiresAt: existing.expiresAt } };
          } else {
            if (new Date(quote.expiresAt) <= now) fail("Quote expired");
            const holdId = randomUUID(); const expiresAt = new Date(Math.min(now.getTime() + 10 * 60_000, new Date(quote.expiresAt).getTime()));
            const claim = await repo.claimInventoryAndCreateHold({ scope: { organizationId }, propertyId, roomTypeId: quote.roomTypeId, nights: enumerateStayNights(quote.checkIn, quote.checkOut), quantity: 1, now,
              hold: { id: holdId, reference: `SB-${holdId}`, organizationId, propertyId, roomTypeId: quote.roomTypeId, checkIn: quote.checkIn, checkOut: quote.checkOut, nights: enumerateStayNights(quote.checkIn, quote.checkOut), quantity: 1, expiresAt, status: "ACTIVE", createdAt: now } }, tx);
            if (!claim.isClaimed) fail(claim.reason ?? "Hold conflict");
            await tx.hotelBookingHold.update({ where: { id: holdId }, data: { ratePlanId: quote.ratePlanId, currency: quote.currency, totalAmount: BigInt(quote.totalAmount), nightlyRates: quote.nightlyRates, cancellationPolicySnapshot: json(quote.policy) } });
            quote.holdId = holdId; await this.saveQuote(tx, quote);
            result = { hold: { id: holdId, reference: `SB-${holdId}`, expiresAt } };
          }
        } else {
          if (!quote.holdId || quote.holdId !== command.holdId) fail("Quote and hold mismatch", 403);
          if (command.guests.length !== quote.adults + quote.childAges.length || command.guests.filter(guest => guest.isPrimary).length !== 1 ||
            command.guests.filter(guest => !guest.isChild).length !== quote.adults ||
            JSON.stringify(command.guests.filter(guest => guest.isChild).map(guest => guest.age).sort()) !== JSON.stringify([...quote.childAges].sort())) fail("Guests do not match quoted occupancy", 422);
          const held = await tx.hotelBookingHold.findUniqueOrThrow({ where: { id: quote.holdId } });
          const reservation = await repo.createReservation({ id: quote.reservationId ?? randomUUID(), organizationId, propertyId, reference: held.reference, idempotencyKey: `sandbox:${quote.id}`, holdId: held.id,
            roomTypeId: quote.roomTypeId, ratePlanId: quote.ratePlanId, status: "PENDING_PAYMENT", checkIn: quote.checkIn, checkOut: quote.checkOut,
            nights: enumerateStayNights(quote.checkIn, quote.checkOut), nightlyRates: quote.nightlyRates, totalAmount: Number(quote.totalAmount), currency: quote.currency, cancellationPolicySnapshot: quote.policy,
            guests: command.guests, createdAt: now, updatedAt: now }, tx);
          if (actor.role === "CUSTOMER") {
            await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([organizationId, "HOTEL_SANDBOX_GUEST", actor.userId])},0))`);
            const guest = await tx.guestCustomer.upsert({ where: { sessionId: `hotel-sandbox:${organizationId}:${actor.userId}` }, update: {}, create: { sessionId: `hotel-sandbox:${organizationId}:${actor.userId}`, name: command.guests.find(guest => guest.isPrimary)!.fullName } });
            if (!await tx.customerIdentity.findFirst({ where: { organizationId, userId: actor.userId, guestCustomerId: guest.id } })) await tx.customerIdentity.create({ data: { organizationId, userId: actor.userId, guestCustomerId: guest.id } });
            await tx.hotelReservation.update({ where: { id: reservation.id }, data: { guestCustomerId: guest.id } });
          }
          quote.reservationId = reservation.id; await this.saveQuote(tx, quote);
          result = { reservation: this.reservationJson(reservation) };
        }
      } else {
        // Lock the quote before the reservation, in the same order as reserve.
        const rows = await tx.hotelInventoryIdempotency.findMany({ where: { organizationId, operationScope: QUOTES, resultJson: { path: ["reservationId"], equals: command.reservationId } }, take: 2 });
        if (rows.length !== 1) fail("Reservation not found", 404);
        const quote = await this.lockQuote(tx, organizationId, propertyId, actor, rows[0]!.id);
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelReservation" WHERE "id"=${command.reservationId} AND "organizationId"=${organizationId} AND "propertyId"=${propertyId} FOR UPDATE`);
        now = this.now();
        let reservation = await tx.hotelReservation.findFirst({ where: { id: command.reservationId, organizationId, propertyId }, include: { nights: true } });
        if (!reservation) fail("Reservation not found", 404);
        if (command.action === "pay") {
          const paymentKey = { organizationId_operationScope_idempotencyKey: { organizationId, operationScope: PAYMENTS, idempotencyKey: reservation!.id } };
          let paymentRow = await tx.hotelInventoryIdempotency.findUnique({ where: paymentKey });
          if (!paymentRow) {
            if (reservation!.status !== "PENDING_PAYMENT") fail("Reservation cannot accept payment");
            const held = reservation!.holdId ? await tx.hotelBookingHold.findUnique({ where: { id: reservation!.holdId } }) : null;
            const outcome = !held || held.expiresAt <= now ? "EXPIRED" : command.outcome;
            const payment = { id: `sandbox-${randomUUID()}`, reservationId: reservation!.id, ...new LocalHotelPaymentAdapter().settle(outcome), amountToman: reservation!.totalAmount.toString(), currency: reservation!.currency };
            paymentRow = await tx.hotelInventoryIdempotency.create({ data: { id: randomUUID(), organizationId, operationScope: PAYMENTS, idempotencyKey: reservation!.id, requestFingerprint: "LOCAL_SIMULATION_ONLY", status: "COMPLETED", resultJson: json(payment), completedAt: now } });
            if (outcome === "SUCCESS") reservation = await tx.hotelReservation.update({ where: { id: reservation!.id }, data: { status: "CONFIRMED", paidAmount: reservation!.totalAmount, confirmedAt: now, version: { increment: 1 } }, include: { nights: true } });
            else reservation = await this.releaseReservation(tx, reservation!, outcome === "EXPIRED" ? "EXPIRED" : "CANCELLED", now);
          }
          result = { payment: paymentRow.resultJson, reservation: this.reservationJson(reservation!) };
        } else if (command.action === "cancel") {
          if (reservation!.status === "CANCELLED" || reservation!.status === "EXPIRED") result = { reservation: this.reservationJson(reservation!), simulated: true };
          else {
            const checkInAt = resolvePropertyInstant({ date: quote.checkIn, time: property.checkInTime, timeZone: property.timezone });
            if (!checkInAt) fail("Invalid property calendar", 422);
            const cancellation = quoteCancellation({ totalAmount: Number(reservation!.totalAmount), cancelledAt: now, checkInAt: checkInAt!, firstNightAmount: quote.nightlyRates[0], policy: quote.policy });
            const decision = decideReservationTransition({ current: reservation!.status as ReservationStatus, transition: "CANCEL", event: { type: "CANCELLATION_REQUESTED", at: now.toISOString(), refundableAmount: cancellation.refundableAmount }, now: now.toISOString() });
            if (!decision.isAllowed) fail(decision.reason ?? "Cancellation rejected");
            const paid = reservation!.paidAmount;
            reservation = await this.releaseReservation(tx, reservation!, "CANCELLED", now);
            if (paid > BigInt(0)) reservation = await tx.hotelReservation.update({ where: { id: reservation!.id }, data: { refundedAmount: BigInt(cancellation.refundableAmount) }, include: { nights: true } });
            result = { reservation: this.reservationJson(reservation!), cancellation: { ...cancellation, refundableAmount: paid > BigInt(0) ? cancellation.refundableAmount : 0 }, simulated: true };
          }
        } else if (command.action === "assign-room") {
          if (actor.role === "CUSTOMER") fail("Reception role required", 403);
          if (reservation!.status !== "CONFIRMED") fail("Only confirmed reservations can receive a room");
          await this.lockAssignableRoom(tx, organizationId, propertyId, reservation!.roomTypeId, command.roomId);
          const expectedNights = enumerateStayNights(quote.checkIn, quote.checkOut);
          if (reservation!.nights.length !== expectedNights.length || expectedNights.some(night => !reservation!.nights.some(row => dateOnly(row.date) === night))) fail("Reservation night integrity conflict");
          const occupied = await tx.hotelReservationRoom.findFirst({ where: { organizationId, roomId: command.roomId, date: { in: reservation!.nights.map(night => night.date) }, reservationId: { not: reservation!.id } }, select: { id: true } });
          if (occupied) fail("Room is already assigned for this stay");
          await tx.hotelReservationRoom.updateMany({ where: { organizationId, reservationId: reservation!.id }, data: { roomId: command.roomId } });
          await tx.hotelReservation.update({ where: { id: reservation!.id }, data: { version: { increment: 1 } } });
          result = { reservation: { ...this.reservationJson(reservation!), assignedRoomId: command.roomId } };
        } else {
          if (actor.role === "CUSTOMER") fail("Reception role required", 403);
          const checkingIn = command.action === "check-in";
          if (checkingIn) {
            const roomId = reservation!.nights[0]?.roomId;
            const expectedNights = enumerateStayNights(quote.checkIn, quote.checkOut);
            if (!roomId || reservation!.nights.length !== expectedNights.length || reservation!.nights.some(night => night.roomId !== roomId) || expectedNights.some(night => !reservation!.nights.some(row => dateOnly(row.date) === night))) fail("Assign a room before check-in");
            await this.lockAssignableRoom(tx, organizationId, propertyId, reservation!.roomTypeId, roomId);
          }
          const decision = decideReservationTransition({ current: reservation!.status as ReservationStatus, transition: checkingIn ? "CHECK_IN" : "CHECK_OUT", event: { type: checkingIn ? "GUEST_CHECKED_IN" : "GUEST_CHECKED_OUT", at: now.toISOString() }, now: now.toISOString() });
          if (!decision.isAllowed) fail(decision.reason ?? "Reception transition rejected");
          reservation = await tx.hotelReservation.update({ where: { id: reservation!.id }, data: { status: checkingIn ? "CHECKED_IN" : "CHECKED_OUT", ...(checkingIn ? { checkedInAt: now } : { checkedOutAt: now }), version: { increment: 1 } }, include: { nights: true } });
          result = { reservation: this.reservationJson(reservation!) };
        }
      }
      const durableResult = json(result);
      await tx.hotelInventoryIdempotency.create({ data: { id: randomUUID(), organizationId, operationScope: ACTIONS, idempotencyKey, requestFingerprint: fingerprint, status: "COMPLETED", resultJson: durableResult, completedAt: now } });
      return durableResult as unknown as SandboxResult;
    }, { maxWait: 10000, timeout: 20000 });
  }

  private reservationJson(row: { id: string; reference: string; status: string; totalAmount: number | bigint; currency: string }) {
    return { id: row.id, reference: row.reference, status: row.status, totalAmount: row.totalAmount.toString(), currency: row.currency, simulated: true };
  }
  private async lockAssignableRoom(tx: Tx, organizationId: string, propertyId: string, roomTypeId: string, roomId: string) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelRoom" WHERE "id"=${roomId} AND "organizationId"=${organizationId} AND "propertyId"=${propertyId} FOR UPDATE`);
    const room = await tx.hotelRoom.findFirst({ where: { id: roomId, organizationId, propertyId, roomTypeId, isActive: true, isOutOfService: false, deletedAt: null } });
    if (!room) fail("Room is not available for this reservation", 409);
  }
  private async lockQuote(tx: Tx, organizationId: string, propertyId: string, actor: HotelSandboxActor, quoteId: string): Promise<Quote> {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelInventoryIdempotency" WHERE "id"=${quoteId} AND "organizationId"=${organizationId} AND "operationScope"=${QUOTES} FOR UPDATE`);
    const row = await tx.hotelInventoryIdempotency.findFirst({ where: { id: quoteId, organizationId, operationScope: QUOTES } });
    const quote = row?.resultJson as unknown as Quote | undefined;
    if (!quote || quote.propertyId !== propertyId || (actor.role === "CUSTOMER" && quote.actorUserId !== actor.userId)) fail("Quote not found", 404);
    return quote!;
  }
  private saveQuote(tx: Tx, quote: Quote) { return tx.hotelInventoryIdempotency.update({ where: { id: quote.id }, data: { resultJson: json(quote) } }); }
  private async releaseReservation(tx: Tx, reservation: { id: string; organizationId: string; propertyId: string; roomTypeId: string; status: string; nights: Array<{ date: Date }> }, status: "CANCELLED" | "EXPIRED", now: Date) {
    if (!["PENDING_PAYMENT", "CONFIRMED"].includes(reservation.status)) fail("Reservation cannot release inventory");
    for (const night of [...reservation.nights].sort((a, b) => a.date.getTime() - b.date.getTime())) {
      const updated = await tx.hotelInventory.updateMany({ where: { organizationId: reservation.organizationId, propertyId: reservation.propertyId, roomTypeId: reservation.roomTypeId, date: night.date, booked: { gte: 1 } }, data: { booked: { decrement: 1 } } });
      if (updated.count !== 1) fail("Inventory integrity conflict");
    }
    // Preserve historical nightly prices, but relinquish physical room claims.
    await tx.hotelReservationRoom.updateMany({ where: { organizationId: reservation.organizationId, reservationId: reservation.id }, data: { roomId: null } });
    return tx.hotelReservation.update({ where: { id: reservation.id }, data: { status, cancelledAt: now, version: { increment: 1 } }, include: { nights: true } });
  }
}
