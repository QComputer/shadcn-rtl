import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db-runtime";
import { ApiError } from "@/lib/api-guards";
import { hashCustomerIdentifier, normalizeCustomerPhone } from "@/lib/customer-identity/customer-identity.service";
import { authorizeHotelBookingActor, type HotelBookingActor } from "./booking-context";
import { RECEPTION_DIRECTORY_MAX_PAGE, RECEPTION_DIRECTORY_PAGE_SIZE, receptionDirectoryTokens, type ReceptionDirectoryResult } from "../domain/reception-directory";

const page = z.number().int().min(1).max(RECEPTION_DIRECTORY_MAX_PAGE).default(1);
const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("search"), query: z.string().trim().min(2).max(120), page }).strict(),
  z.object({ action: z.literal("phone"), query: z.string().trim().min(8).max(32), page }).strict(),
  z.object({ action: z.literal("history"), reservationId: z.string().min(1).max(200), page }).strict(),
]);

/** Same Persian/Arabic normalization as the local reception filter. All inputs are bound parameters. */
function normalized(value: Prisma.Sql) {
  return Prisma.sql`lower(translate(regexp_replace(normalize(${value}, NFKC), ${"[\u064b-\u065f\u0670\u200c\u200d]"}, '', 'g'), ${"يىك٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹"}, ${"ییک01234567890123456789"}))`;
}

/** Read-only directory; never join people by name. Property scope applies to all lookups. */
export async function readReceptionDirectory(actor: HotelBookingActor, organizationId: string, propertyId: string, input: unknown, db: PrismaClient = prisma): Promise<ReceptionDirectoryResult> {
  if (!["ADMIN", "MANAGER", "STAFF", "SUPER_ADMIN"].includes(actor.role)) throw new ApiError(403, "Reception role required");
  await authorizeHotelBookingActor(db, actor, organizationId, propertyId);
  const validation = command.safeParse(input);
  if (!validation.success) throw new ApiError(400, "Invalid reception directory request");
  const parsed = validation.data;
  const scope = { organizationId, propertyId };
  const offset = (parsed.page - 1) * RECEPTION_DIRECTORY_PAGE_SIZE;
  const take = RECEPTION_DIRECTORY_PAGE_SIZE + 1;
  let ids: string[];
  let basis: ReceptionDirectoryResult["basis"];
  if (parsed.action === "search") {
    const tokens = receptionDirectoryTokens(parsed.query);
    if (!tokens) throw new ApiError(400, "Invalid reception search");
    const predicates = tokens.map(token => Prisma.sql`strpos(search.text, ${token}) > 0`);
    const matches = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT r.id FROM "HotelReservation" r
      CROSS JOIN LATERAL (
        SELECT ${normalized(Prisma.sql`concat_ws(' ', r.reference,
          (SELECT string_agg(g."fullName", ' ') FROM "HotelReservationGuest" g WHERE g."organizationId" = r."organizationId" AND g."reservationId" = r.id),
          (SELECT string_agg(room.code, ' ') FROM "HotelReservationRoom" n JOIN "HotelRoom" room ON room.id = n."roomId" AND room."organizationId" = r."organizationId" AND room."propertyId" = r."propertyId" WHERE n."organizationId" = r."organizationId" AND n."reservationId" = r.id))`)} AS text
      ) search
      WHERE r."organizationId" = ${organizationId} AND r."propertyId" = ${propertyId}
        AND ${Prisma.join(predicates, " AND ")}
      ORDER BY r."createdAt" DESC, r.id DESC LIMIT ${take} OFFSET ${offset}
    `);
    ids = matches.map(row => row.id);
  } else {
    let where: Prisma.HotelReservationWhereInput = scope;
    if (parsed.action === "phone") {
      const phone = normalizeCustomerPhone(parsed.query);
      if (!phone) throw new ApiError(400, "Invalid reception phone");
      where = { ...scope, guests: { some: { organizationId, phoneHash: hashCustomerIdentifier(organizationId, phone) } } };
    } else {
      const anchor = await db.hotelReservation.findFirst({ where: { ...scope, id: parsed.reservationId }, select: { id: true, guestCustomerId: true, guests: { where: { organizationId, isPrimary: true }, select: { phoneHash: true }, take: 2 } } });
      if (!anchor) throw new ApiError(404, "Reservation not found");
      if (anchor.guestCustomerId) {
        basis = "LINKED_CUSTOMER";
        where = { ...scope, guestCustomerId: anchor.guestCustomerId };
      } else if (anchor.guests.length === 1 && anchor.guests[0].phoneHash) {
        basis = "CONTACT";
        where = { ...scope, guests: { some: { organizationId, isPrimary: true, phoneHash: anchor.guests[0].phoneHash } } };
      } else {
        basis = "RESERVATION_ONLY";
        where = { ...scope, id: anchor.id };
      }
    }
    ids = (await db.hotelReservation.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: offset, take, select: { id: true } })).map(row => row.id);
  }
  const hasExtra = ids.length > RECEPTION_DIRECTORY_PAGE_SIZE;
  ids = ids.slice(0, RECEPTION_DIRECTORY_PAGE_SIZE);
  const records = await db.hotelReservation.findMany({ where: { ...scope, id: { in: ids } }, select: {
    id: true, reference: true, status: true, checkIn: true, checkOut: true,
    guests: { where: { organizationId }, orderBy: [{ isPrimary: "desc" }, { id: "asc" }], select: { id: true, fullName: true, isPrimary: true, isChild: true, age: true } },
    nights: { where: { organizationId }, orderBy: { date: "asc" }, select: { room: { select: { organizationId: true, propertyId: true, code: true } } } },
  } });
  const byId = new Map(records.map(row => [row.id, row]));
  const rows = ids.flatMap(id => {
    const row = byId.get(id);
    if (!row) return [];
    const { nights, checkIn, checkOut, ...rest } = row;
    const rooms = [...new Set(nights.flatMap(night => night.room?.organizationId === organizationId && night.room.propertyId === propertyId ? [night.room.code] : []))];
    return [{ ...rest, checkIn: checkIn.toISOString().slice(0, 10), checkOut: checkOut.toISOString().slice(0, 10), rooms }];
  });
  return { rows, page: parsed.page, hasMore: hasExtra && parsed.page < RECEPTION_DIRECTORY_MAX_PAGE, pageLimitReached: hasExtra && parsed.page === RECEPTION_DIRECTORY_MAX_PAGE, ...(basis ? { basis } : {}) };
}
