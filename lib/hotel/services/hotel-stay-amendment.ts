import "server-only";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import { sellableUnitsForNight } from "../domain/availability";
import { propertyCalendarDate } from "../domain/property-calendar";
import { planStayAmendment, stayDatesBetween } from "../domain/stay-amendment";
import { priceHotelStay, type HotelPricingProperty } from "./booking-quote";
import { HOTEL_MAINTENANCE_SCHEMA_NOT_READY, isMissingHotelMaintenanceTableError } from "./hotel-maintenance-schema";

type Tx = Prisma.TransactionClient;
type Reservation = Prisma.HotelReservationGetPayload<{ include: { nights: true; hold: true } }>;
export type StayAmendmentCommand =
  | { action: "preview-amend-stay"; reservationId: string; checkIn: string; checkOut: string }
  | { action: "amend-stay"; reservationId: string; checkIn: string; checkOut: string; expectedVersion: number; expectedTotal: string };
const day = (date: string) => new Date(`${date}T00:00:00.000Z`);
const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const fail = (message: string, status = 409): never => { throw new ApiError(status, message); };

type LockedInventory = { id: string; date: Date; allotment: number; booked: number; held: number; outOfService: number; closedToArrival: boolean; closedToDeparture: boolean };

/** Called inside the existing authorized, idempotent transaction with the reservation row locked. */
export async function amendManualHotelStay(tx: Tx, input: {
  reservation: Reservation; property: HotelPricingProperty; actorUserId: string; command: StayAmendmentCommand; now: Date;
}) {
  const { reservation: r, property, actorUserId, command, now } = input;
  const { organizationId, propertyId, roomTypeId } = r;
  const scope = { organizationId, propertyId };
  if (property.id !== propertyId || property.organizationId !== organizationId) fail("Forbidden", 403);
  if (r.status !== "CONFIRMED" && r.status !== "CHECKED_IN") fail("Invalid reception transition");
  if (r.paidAmount !== BigInt(0) || r.refundedAmount !== BigInt(0) || r.paymentMethod !== null || r.currency !== property.currency || r.currency !== "TOMAN") fail("STAY_AMENDMENT_PAYMENT_ACTIVITY");
  const [allocations, offline, requests] = await Promise.all([
    tx.hotelPaymentAllocation.count({ where: { organizationId, hotelReservationId: r.id } }),
    tx.hotelOfflinePayment.count({ where: { organizationId, reservationId: r.id } }),
    tx.paymentRequest.count({ where: { organizationId, metadata: { path: ["hotelReservationId"], equals: r.id } } }),
  ]);
  if (allocations || offline || requests) fail("STAY_AMENDMENT_PAYMENT_ACTIVITY");
  const oldCheckIn = dateOnly(r.checkIn), oldCheckOut = dateOnly(r.checkOut);
  const today = propertyCalendarDate(property.timezone, now);
  let dates: string[] = [];
  try { dates = stayDatesBetween(command.checkIn, command.checkOut); }
  catch { fail("Stay is outside property limits", 422); }
  if (dates.length < property.minStayNights || dates.length > property.maxStayNights) fail("Stay is outside property limits", 422);
  if (r.status === "CONFIRMED" && command.checkIn < today) fail("Stay is outside property limits: check-in precedes property today", 422);
  if (r.status === "CHECKED_IN" && (oldCheckIn > today || oldCheckOut <= today || command.checkIn !== oldCheckIn || command.checkOut <= today)) fail("STAY_AMENDMENT_ACTIVE_DATES", 422);
  if (command.action === "amend-stay" && r.version !== command.expectedVersion) fail("STAY_AMENDMENT_STALE");
  if (!r.holdId) fail("STAY_AMENDMENT_INTEGRITY");
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelBookingHold" WHERE "id"=${r.holdId} AND "organizationId"=${organizationId} AND "propertyId"=${propertyId} FOR UPDATE`);
  const hold = await tx.hotelBookingHold.findFirst({ where: { ...scope, id: r.holdId!, roomTypeId, status: "CONSUMED", quantity: 1 } });
  if (!hold || dateOnly(hold.checkIn) !== oldCheckIn || dateOnly(hold.checkOut) !== oldCheckOut || r.nights.some(n => n.roomTypeId !== roomTypeId) || r.nights.reduce((sum, n) => sum + n.rate, BigInt(0)) !== r.totalAmount) fail("STAY_AMENDMENT_INTEGRITY");
  // Same type and target room lock order as manual creation; inventory rows always in date order.
  const type = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "HotelRoomType" WHERE "id"=${roomTypeId} AND "organizationId"=${organizationId} AND "propertyId"=${propertyId} AND "isActive"=true AND "deletedAt" IS NULL FOR UPDATE`);
  if (!type.length) fail("Room type is not available", 422);
  const existing = r.nights.map(n => ({ date: dateOnly(n.date), roomId: n.roomId, rate: n.rate }));
  const oldDates = new Set(existing.map(n => n.date));
  const added = dates.filter(date => !oldDates.has(date));
  const addedRates = new Map<string, bigint>();
  if (added.length) {
    if (r.adults === null || r.children === null || r.childAges.length !== r.children) fail("STAY_AMENDMENT_INTEGRITY");
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelRatePlan" WHERE "id"=${r.ratePlanId} AND "organizationId"=${organizationId} AND "propertyId"=${propertyId} FOR SHARE`);
    const { quote } = await priceHotelStay(tx, property, actorUserId, { action: "quote", roomTypeId, ratePlanId: r.ratePlanId, checkIn: command.checkIn, checkOut: command.checkOut, adults: r.adults!, childAges: r.childAges }, now, { requireAvailability: false });
    if (!quote || quote.currency !== r.currency || quote.nightlyRates.length !== dates.length) fail("Room, rate plan or currency not available", 422);
    for (const date of added) addedRates.set(date, BigInt(quote!.nightlyRates[dates.indexOf(date)]!));
  }
  let plan: ReturnType<typeof planStayAmendment>;
  try { plan = planStayAmendment({ oldCheckIn, oldCheckOut, checkIn: command.checkIn, checkOut: command.checkOut, today, status: r.status, nights: existing, addedRates }); }
  catch (error) { fail(error instanceof Error ? error.message : "STAY_AMENDMENT_INTEGRITY", 422); }
  if (!plan!.added.length && !plan!.removed.length) fail("STAY_AMENDMENT_NO_CHANGE", 422);
  const p = plan!;
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelRoom" WHERE "id"=${p.newRoomId} AND "organizationId"=${organizationId} AND "propertyId"=${propertyId} FOR UPDATE`);
  if (!await tx.hotelRoom.findFirst({ where: { ...scope, id: p.newRoomId, roomTypeId, isActive: true, deletedAt: null, isOutOfService: false }, select: { id: true } })) fail("Room is not available");
  try {
    if (p.added.length) {
      if (await tx.hotelRoomMaintenanceBlock.findFirst({ where: { ...scope, roomId: p.newRoomId, releasedAt: null, OR: p.added.map(date => ({ from: { lte: day(date) }, to: { gt: day(date) } })) }, select: { id: true } })) fail("ROOM_MAINTENANCE_CONFLICT");
      if (await tx.hotelReservationRoom.findFirst({ where: { organizationId, roomId: p.newRoomId, date: { in: p.added.map(day) }, reservationId: { not: r.id } }, select: { id: true } })) fail("Room is already assigned");
    }
  } catch (error) {
    if (isMissingHotelMaintenanceTableError(error)) fail(HOTEL_MAINTENANCE_SCHEMA_NOT_READY, 503);
    throw error;
  }
  const allDates = [...new Set([...oldDates, ...p.dates])].sort();
  const inventory = await tx.$queryRaw<LockedInventory[]>(Prisma.sql`SELECT "id","date","allotment","booked","held","outOfService","closedToArrival","closedToDeparture" FROM "HotelInventory" WHERE "organizationId"=${organizationId} AND "propertyId"=${propertyId} AND "roomTypeId"=${roomTypeId} AND "date" IN (${Prisma.join(allDates.map(day))}) ORDER BY "date" FOR UPDATE`);
  const byDate = new Map(inventory.map(row => [dateOnly(row.date), row]));
  if ([...oldDates].some(date => !byDate.has(date) || byDate.get(date)!.booked < 1)) fail("STAY_AMENDMENT_INTEGRITY");
  const physicalCap = await tx.hotelRoom.count({ where: { ...scope, roomTypeId, isActive: true, deletedAt: null, isOutOfService: false } });
  for (const date of p.added) {
    const row = byDate.get(date);
    if (!row || sellableUnitsForNight({ ...row, date, scope: { kind: "ROOM_TYPE", roomTypeId } }, physicalCap) < 1) fail("No room inventory is available for these dates");
  }
  const amendment = { checkIn: command.checkIn, checkOut: command.checkOut, previousCheckIn: oldCheckIn, previousCheckOut: oldCheckOut, previousTotal: r.totalAmount.toString(), total: p.total.toString(), currency: r.currency, version: r.version, added: p.added, removed: p.removed };
  if (command.action === "preview-amend-stay") return amendment;
  if (command.expectedTotal !== amendment.total) fail("STAY_AMENDMENT_STALE");
  // Rechecked under the same locks: either all rows, totals and hold dates move, or none do.
  for (const date of p.removed) await tx.hotelInventory.update({ where: { id: byDate.get(date)!.id }, data: { booked: { decrement: 1 } } });
  for (const date of p.added) await tx.hotelInventory.update({ where: { id: byDate.get(date)!.id }, data: { booked: { increment: 1 } } });
  if (p.removed.length) {
    const removed = await tx.hotelReservationRoom.deleteMany({ where: { organizationId, reservationId: r.id, date: { in: p.removed.map(day) } } });
    if (removed.count !== p.removed.length) fail("STAY_AMENDMENT_INTEGRITY");
  }
  if (p.added.length) await tx.hotelReservationRoom.createMany({ data: p.added.map(date => ({ organizationId, reservationId: r.id, roomTypeId, roomId: p.newRoomId, date: day(date), rate: addedRates.get(date)! })) });
  // Keep the consumed hold consistent with cancellation/release repository invariants.
  await tx.hotelBookingHold.update({ where: { id: hold!.id }, data: { checkIn: day(command.checkIn), checkOut: day(command.checkOut), totalAmount: p.total, nightlyRates: p.rates.map(Number), ratePlanId: r.ratePlanId, currency: r.currency } });
  const updated = await tx.hotelReservation.updateMany({ where: { ...scope, id: r.id, version: r.version, status: r.status }, data: { checkIn: day(command.checkIn), checkOut: day(command.checkOut), totalAmount: p.total, version: { increment: 1 } } });
  if (updated.count !== 1) fail("STAY_AMENDMENT_STALE");
  return { ...amendment, version: r.version + 1 };
}
