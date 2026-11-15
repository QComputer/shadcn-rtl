import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db-runtime";
import { authorizeHotelBookingActor, type HotelBookingActor } from "./booking-context";
import { priceHotelStay, type HotelPricedQuote } from "./booking-quote";

const id = z.string().trim().min(1).max(200);
export const hotelStayRequestCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("quote"), roomTypeId: id, ratePlanId: id, checkIn: z.iso.date(), checkOut: z.iso.date(), adults: z.number().int().min(1).max(30), childAges: z.array(z.number().int().min(0).max(17)).max(20) }).strict(),
  z.object({ action: z.literal("request"), quoteId: id, guestName: z.string().trim().min(1).max(150), message: z.string().trim().max(1000).optional() }).strict(),
  z.object({ action: z.literal("cancel-request"), requestId: id }).strict(),
  z.object({ action: z.literal("review-request"), requestId: id, status: z.enum(["CONTACTED", "DECLINED"]) }).strict(),
]);
const fail = (message: string, status = 409): never => { throw new ApiError(status, message); };
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const SCOPE = "HOTEL_STAY_REQUEST_ACTION";
export type HotelStayRequestResult = {
  quote?: HotelPricedQuote;
  request?: { id: string; status: string; guestName: string; message: string | null; snapshot: Prisma.JsonValue; [key: string]: unknown };
};

/** Deployable request service: no simulated payment, inventory or reservation mutation. */
export class HotelStayRequestService {
  constructor(private readonly db: PrismaClient = prisma, private readonly now = () => new Date()) {}

  async configure(actor: HotelBookingActor, organizationId: string, propertyId: string, input: unknown) {
    const { mode } = z.object({ mode: z.enum(["DISABLED", "REQUEST_ONLY"]) }).strict().parse(input);
    await authorizeHotelBookingActor(this.db, actor, organizationId, propertyId);
    if (!["ADMIN", "SUPER_ADMIN"].includes(actor.role)) fail("Organization administrator required", 403);
    await this.db.hotelProperty.update({ where: { id: propertyId, organizationId }, data: { operationalMode: mode } });
    return { mode };
  }

  private async authorize(actor: HotelBookingActor, organizationId: string, propertyId: string) {
    if (process.env.HOTEL_GUEST_PORTAL_ENABLED !== "1") fail("Hotel guest portal is disabled", 403);
    const property = await authorizeHotelBookingActor(this.db, actor, organizationId, propertyId);
    if (property.operationalMode === "DISABLED") fail("Hotel guest portal is disabled for this property", 403);
    return property;
  }

  async get(actor: HotelBookingActor, organizationId: string, propertyId: string) {
    const property = await this.authorize(actor, organizationId, propertyId);
    const [roomTypes, ratePlans, requests] = await Promise.all([
      this.db.hotelRoomType.findMany({ where: { organizationId, propertyId, isActive: true, deletedAt: null }, select: { id: true, name: true } }),
      this.db.hotelRatePlan.findMany({ where: { organizationId, propertyId, isActive: true }, select: { id: true, name: true, roomTypeId: true } }),
      this.db.hotelStayRequest.findMany({ where: { organizationId, propertyId, ...(actor.role === "CUSTOMER" ? { userId: actor.userId } : {}) }, orderBy: { createdAt: "desc" }, take: 100,
        select: { id: true, status: true, guestName: true, message: true, snapshot: true, createdAt: true } }),
    ]);
    return { enabled: true, mode: property.operationalMode === "RESERVATION" && process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED !== "1" ? "REQUEST_ONLY" : property.operationalMode, view: actor.role === "CUSTOMER" ? "guest" : "reception", roomTypes, ratePlans, requests };
  }

  async execute(actor: HotelBookingActor, organizationId: string, propertyId: string, input: unknown, idempotencyKey: string): Promise<HotelStayRequestResult> {
    await this.authorize(actor, organizationId, propertyId);
    const command = hotelStayRequestCommand.parse(input);
    if (idempotencyKey.length < 8 || idempotencyKey.length > 200) fail("Idempotency-Key required", 400);
    const fingerprint = createHash("sha256").update(JSON.stringify([actor.userId, propertyId, command])).digest("hex");
    return this.db.$transaction(async tx => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([organizationId, SCOPE, idempotencyKey])},0))`);
      const key = { organizationId_operationScope_idempotencyKey: { organizationId, operationScope: SCOPE, idempotencyKey } };
      const replay = await tx.hotelInventoryIdempotency.findUnique({ where: key });
      if (replay) {
        if (replay.requestFingerprint !== fingerprint) fail("Idempotency-Key conflict");
        return replay.resultJson as HotelStayRequestResult;
      }
      // Serialize property disablement with a submission; no application lock is trusted as authority.
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelProperty" WHERE "id"=${propertyId} AND "organizationId"=${organizationId} FOR SHARE`);
      const property = await tx.hotelProperty.findFirst({ where: { id: propertyId, organizationId, isActive: true, deletedAt: null, operationalMode: { not: "DISABLED" } } });
      if (!property) fail("Hotel guest portal is disabled for this property", 403);
      let result: Record<string, unknown>;
      if (command.action === "quote") {
        const count = (Date.parse(command.checkOut) - Date.parse(command.checkIn)) / 86_400_000;
        const todayParts = new Intl.DateTimeFormat("en", { timeZone: property!.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(this.now());
        const part = (kind: string) => todayParts.find(value => value.type === kind)!.value;
        const today = `${part("year")}-${part("month")}-${part("day")}`;
        if (command.checkIn < today || count < property!.minStayNights || count > property!.maxStayNights) fail("Stay is outside property limits", 422);
        const priced = await priceHotelStay(tx, property!, actor.userId, command, this.now());
        const quote = priced.quote!;
        await tx.hotelStayQuote.create({ data: { id: quote.id, organizationId, propertyId, userId: actor.userId, snapshot: json(quote), expiresAt: new Date(quote.expiresAt) } });
        result = { quote };
      } else if (command.action === "request") {
        if (actor.role !== "CUSTOMER") fail("Customer account required", 403);
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelStayQuote" WHERE "id"=${command.quoteId} AND "organizationId"=${organizationId} AND "propertyId"=${propertyId} AND "userId"=${actor.userId} FOR UPDATE`);
        const quoteRow = await tx.hotelStayQuote.findFirst({ where: { id: command.quoteId, organizationId, propertyId, userId: actor.userId } });
        if (!quoteRow) fail("Quote not found", 404);
        const existing = await tx.hotelStayRequest.findUnique({ where: { quoteId: command.quoteId } });
        if (existing) {
          if (existing.guestName !== command.guestName || (existing.message ?? "") !== (command.message ?? "")) fail("Quote request conflict");
          result = { request: existing };
        } else {
          if (quoteRow!.expiresAt <= this.now()) fail("Quote expired");
          const snapshot = quoteRow!.snapshot as unknown as HotelPricedQuote;
          if (snapshot.actorUserId !== actor.userId || snapshot.propertyId !== propertyId) fail("Quote context mismatch", 403);
          const request = await tx.hotelStayRequest.create({ data: { organizationId, propertyId, userId: actor.userId, quoteId: command.quoteId, guestName: command.guestName, message: command.message || null, snapshot: quoteRow!.snapshot as Prisma.InputJsonValue } });
          result = { request };
        }
      } else {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelStayRequest" WHERE "id"=${command.requestId} AND "organizationId"=${organizationId} AND "propertyId"=${propertyId} FOR UPDATE`);
        const request = await tx.hotelStayRequest.findFirst({ where: { id: command.requestId, organizationId, propertyId, ...(actor.role === "CUSTOMER" ? { userId: actor.userId } : {}) } });
        if (!request) fail("Request not found", 404);
        if (command.action === "review-request" && actor.role === "CUSTOMER") fail("Reception role required", 403);
        const target = command.action === "cancel-request" ? "CANCELLED" : command.status;
        if (request!.status === target) result = { request };
        else {
          if (["CANCELLED", "DECLINED"].includes(request!.status)) fail("Request is already closed");
          result = { request: await tx.hotelStayRequest.update({ where: { id: request!.id }, data: { status: target } }) };
        }
      }
      const durable = json(result);
      await tx.hotelInventoryIdempotency.create({ data: { id: randomUUID(), organizationId, operationScope: SCOPE, idempotencyKey, requestFingerprint: fingerprint, status: "COMPLETED", resultJson: durable, completedAt: this.now() } });
      return durable as HotelStayRequestResult;
    }, { maxWait: 10000, timeout: 20000 });
  }
}
