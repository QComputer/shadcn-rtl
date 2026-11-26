import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db-runtime";
import { ApiError } from "@/lib/api-guards";
import { normalizeCustomerPhone } from "@/lib/customer-identity/customer-identity.service";
import { authorizeHotelBookingActor, type HotelBookingActor } from "./booking-context";
import { cleanGuestProfileName } from "../domain/guest-profiles";
import { propertyCalendarDate } from "../domain/property-calendar";
import { WAITLIST_PAGE_SIZE, WAITLIST_STATUSES, waitlistStayAllowed, waitlistTransitionAllowed, type WaitlistEntry, type WaitlistResponse, type WaitlistStatus } from "../domain/reception-waitlist";
const id = z.string().min(1).max(200);
const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list"), status: z.enum(["OPEN", ...WAITLIST_STATUSES]).default("OPEN"), page: z.number().int().min(1).max(400).default(1) }).strict(),
  z.object({ action: z.literal("create"), requestKey: z.string().min(8).max(100).regex(/^[a-zA-Z0-9-]+$/), guestName: z.string().max(160), phone: z.string().min(8).max(32), roomTypeId: id, checkIn: z.iso.date(), checkOut: z.iso.date(), adults: z.number().int().min(1).max(30), childAges: z.array(z.number().int().min(0).max(17)).max(20) }).strict(),
  z.object({ action: z.literal("transition"), id, expectedVersion: z.number().int().nonnegative().max(2147483646), status: z.enum(WAITLIST_STATUSES), reservationReference: z.string().trim().min(1).max(120).optional(), confirmed: z.literal(true).optional() }).strict(),
]);
const select = { id: true, guestName: true, phone: true, roomTypeId: true, roomType: { select: { name: true } }, checkIn: true, checkOut: true, adults: true, childAges: true, status: true, version: true, reservationReference: true, createdAt: true } as const;
type Row = Prisma.HotelReceptionWaitlistGetPayload<{ select: typeof select }>;
const date = (value: string) => new Date(value + "T00:00:00.000Z");
const iso = (value: Date) => value.toISOString().slice(0, 10);
function project(row: Row): WaitlistEntry {
  return { id: row.id, guestName: row.guestName, phone: row.phone, roomTypeId: row.roomTypeId, roomTypeName: row.roomType.name, checkIn: iso(row.checkIn), checkOut: iso(row.checkOut), adults: row.adults, childAges: row.childAges, createdAt: row.createdAt.toISOString(), status: row.status as WaitlistStatus, version: row.version, reservationReference: row.reservationReference };
}
export async function receptionWaitlist(actor: HotelBookingActor, organizationId: string, propertyId: string, input: unknown, db: PrismaClient = prisma): Promise<WaitlistResponse | WaitlistEntry> {
  if (!["ADMIN", "MANAGER", "STAFF", "SUPER_ADMIN"].includes(actor.role)) throw new ApiError(403, "Reception role required");
  const property = await authorizeHotelBookingActor(db, actor, organizationId, propertyId);
  if (process.env.HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED !== "1" || process.env.HOTEL_RECEPTION_WAITLIST_ENABLED !== "1" || property.slug === "damoon-demo") throw new ApiError(403, "Reception waitlist is disabled");
  const parsed = command.safeParse(input);
  if (!parsed.success) throw new ApiError(400, "Invalid waitlist request");
  const cmd = parsed.data, scope = { organizationId, propertyId }, today = propertyCalendarDate(property.timezone);
  if (cmd.action === "list") {
    const rows = await db.hotelReceptionWaitlist.findMany({ where: { ...scope, status: cmd.status === "OPEN" ? { in: ["WAITING", "CONTACTED"] } : cmd.status }, select, orderBy: [{ checkIn: "asc" }, { createdAt: "asc" }, { id: "asc" }], skip: (cmd.page - 1) * WAITLIST_PAGE_SIZE, take: WAITLIST_PAGE_SIZE + 1 });
    return { items: rows.slice(0, WAITLIST_PAGE_SIZE).map(project), page: cmd.page, hasMore: rows.length > WAITLIST_PAGE_SIZE && cmd.page < 400 };
  }
  return db.$transaction(async tx => {
    const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { slug: true } });
    const audit = async (entryId: string, action: "CREATE" | "UPDATE", status: string) => tx.auditLog.create({ data: { action, entityType: "HotelReceptionWaitlist", entityId: entryId, description: "Reception waitlist action", newValue: { propertyId, status }, userId: actor.userId, organizationId, organizationSlug: org.slug } });
    if (cmd.action === "create") {
      const guestName = cleanGuestProfileName(cmd.guestName), phone = normalizeCustomerPhone(cmd.phone);
      if (!guestName || !phone) throw new ApiError(422, "Invalid waitlist contact");
      const fingerprint = createHash("sha256").update(JSON.stringify([guestName, phone, cmd.roomTypeId, cmd.checkIn, cmd.checkOut, cmd.adults, cmd.childAges])).digest("hex");
      const previous = await tx.hotelReceptionWaitlist.findUnique({ where: { organizationId_propertyId_requestKey: { ...scope, requestKey: cmd.requestKey } }, select: { ...select, requestHash: true } });
      if (previous) { if (previous.requestHash !== fingerprint) throw new ApiError(409, "Waitlist request key conflict"); return project(previous); }
      if (!waitlistStayAllowed(cmd.checkIn, cmd.checkOut, today, property.minStayNights, property.maxStayNights)) throw new ApiError(422, "Invalid waitlist dates");
      const type = await tx.hotelRoomType.findFirst({ where: { ...scope, id: cmd.roomTypeId, isActive: true, deletedAt: null }, select: { maxAdults: true, maxChildren: true, maxOccupancy: true } });
      if (!type || cmd.adults > type.maxAdults || cmd.childAges.length > type.maxChildren || cmd.adults + cmd.childAges.length > type.maxOccupancy) throw new ApiError(422, "Invalid waitlist room or party size");
      const newId = randomUUID();
      // Empty update provides atomic conflict handling. Only the winning insert is audited.
      const row = await tx.hotelReceptionWaitlist.upsert({ where: { organizationId_propertyId_requestKey: { ...scope, requestKey: cmd.requestKey } }, create: { ...scope, id: newId, requestKey: cmd.requestKey, requestHash: fingerprint, guestName, phone, roomTypeId: cmd.roomTypeId, checkIn: date(cmd.checkIn), checkOut: date(cmd.checkOut), adults: cmd.adults, childAges: cmd.childAges }, update: {}, select: { ...select, requestHash: true } });
      if (row.requestHash !== fingerprint) throw new ApiError(409, "Waitlist request key conflict");
      if (row.id === newId) await audit(row.id, "CREATE", row.status);
      return project(row);
    }
    const row = await tx.hotelReceptionWaitlist.findFirst({ where: { ...scope, id: cmd.id }, select });
    if (!row) throw new ApiError(404, "Waitlist entry not found");
    if (row.version !== cmd.expectedVersion) throw new ApiError(409, "Waitlist version conflict");
    if (!waitlistTransitionAllowed(row.status, cmd.status, iso(row.checkIn), today)) throw new ApiError(409, "Invalid waitlist transition");
    let reservationReference: string | null = null;
    if (cmd.status === "BOOKED") {
      if (!cmd.reservationReference || !cmd.confirmed) throw new ApiError(422, "Confirmed reservation reference required");
      const matches = await tx.$queryRaw<Array<{ reference: string; adults: number | null; childAges: number[] }>>(Prisma.sql`SELECT reference, adults, "childAges" FROM "HotelReservation" WHERE "organizationId" = ${organizationId} AND "propertyId" = ${propertyId} AND reference = ${cmd.reservationReference} AND "roomTypeId" = ${row.roomTypeId} AND "checkIn" = ${row.checkIn}::date AND "checkOut" = ${row.checkOut}::date AND status = 'CONFIRMED' FOR UPDATE`);
      const reservation = matches[0];
      if (!reservation || reservation.adults !== row.adults || JSON.stringify([...reservation.childAges].sort((a,b)=>a-b)) !== JSON.stringify([...row.childAges].sort((a,b)=>a-b))) throw new ApiError(422, "Matching confirmed reservation required");
      if (await tx.hotelReceptionWaitlist.findFirst({ where: { ...scope, reservationReference: reservation.reference }, select: { id: true } })) throw new ApiError(409, "Reservation already linked to waitlist");
      reservationReference = reservation.reference;
    } else if (cmd.reservationReference !== undefined) throw new ApiError(400, "Unexpected reservation reference");
    const updated = await tx.hotelReceptionWaitlist.updateMany({ where: { ...scope, id: row.id, version: cmd.expectedVersion }, data: { status: cmd.status, reservationReference, version: { increment: 1 } } });
    if (updated.count !== 1) throw new ApiError(409, "Waitlist version conflict");
    await audit(row.id, "UPDATE", cmd.status);
    return project(await tx.hotelReceptionWaitlist.findFirstOrThrow({ where: { ...scope, id: row.id }, select }));
  }).catch(error => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiError(409, "Waitlist conflict; reload or retry the same request");
    throw error;
  });
}
