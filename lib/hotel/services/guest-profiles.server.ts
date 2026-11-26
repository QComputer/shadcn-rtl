import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db-runtime";
import { ApiError } from "@/lib/api-guards";
import { authorizeHotelBookingActor, type HotelBookingActor } from "./booking-context";
import { cleanGuestProfileName, GUEST_PROFILE_MAX_PAGE, GUEST_PROFILE_PAGE_SIZE, type GuestProfileResponse } from "../domain/guest-profiles";

const id = z.string().min(1).max(200);
const name = z.string().max(160).refine(value => cleanGuestProfileName(value) !== null);
const page = z.number().int().min(1).max(GUEST_PROFILE_MAX_PAGE).default(1);
const confirmed = z.literal(true);
const commands = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list"), query: z.string().trim().max(160).default(""), page }).strict(),
  z.object({ action: z.literal("detail"), profileId: id, page }).strict(),
  z.object({ action: z.literal("guest"), guestId: id }).strict(),
  z.object({ action: z.literal("create"), guestId: id, displayName: name, confirmed }).strict(),
  z.object({ action: z.literal("link"), guestId: id, profileId: id, confirmed }).strict(),
  z.object({ action: z.literal("unlink"), guestId: id, profileId: id, confirmed }).strict(),
  z.object({ action: z.literal("rename"), profileId: id, displayName: name, expectedVersion: z.number().int().nonnegative().max(2147483646), confirmed }).strict(),
]);
const profileSelect = { id: true, displayName: true, version: true } as const;

/** The account/contact remains independent: link only a reception-confirmed individual. */
export async function guestProfiles(actor: HotelBookingActor, organizationId: string, propertyId: string, input: unknown, db: PrismaClient = prisma): Promise<GuestProfileResponse> {
  if (!["ADMIN", "MANAGER", "STAFF", "SUPER_ADMIN"].includes(actor.role)) throw new ApiError(403, "Reception role required");
  await authorizeHotelBookingActor(db, actor, organizationId, propertyId);
  const validated = commands.safeParse(input);
  if (!validated.success) throw new ApiError(400, "Invalid guest profile request");
  const cmd = validated.data;
  const scope = { organizationId, propertyId };
  const size = GUEST_PROFILE_PAGE_SIZE;
  const canManage = ["ADMIN", "MANAGER", "SUPER_ADMIN"].includes(actor.role);
  if (cmd.action === "list") {
    const items = await db.hotelGuestProfile.findMany({ where: { ...scope, ...(cmd.query ? { displayName: { contains: cmd.query, mode: "insensitive" } } : {}) }, select: profileSelect, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: (cmd.page - 1) * size, take: size + 1 });
    return { kind: "list", canManage, items: items.slice(0, size), page: cmd.page, hasMore: items.length > size && cmd.page < GUEST_PROFILE_MAX_PAGE };
  }
  if (cmd.action === "detail") {
    const profile = await db.hotelGuestProfile.findFirst({ where: { ...scope, id: cmd.profileId }, select: profileSelect });
    if (!profile) throw new ApiError(404, "Guest profile not found");
    const rows = await db.hotelGuestProfileLink.findMany({ where: { ...scope, profileId: profile.id }, orderBy: [{ createdAt: "desc" }, { guestId: "desc" }], skip: (cmd.page - 1) * size, take: size + 1, select: { guestId: true, guest: { select: { fullName: true } }, reservation: { select: { reference: true, status: true, checkIn: true, checkOut: true } } } });
    return { kind: "detail", canManage, profile, page: cmd.page, hasMore: rows.length > size && cmd.page < GUEST_PROFILE_MAX_PAGE, stays: rows.slice(0, size).map(row => ({ guestId: row.guestId, fullName: row.guest.fullName, reference: row.reservation.reference, status: row.reservation.status, checkIn: row.reservation.checkIn.toISOString().slice(0, 10), checkOut: row.reservation.checkOut.toISOString().slice(0, 10) })) };
  }
  if (cmd.action === "guest") {
    const guest = await db.hotelReservationGuest.findFirst({ where: { id: cmd.guestId, organizationId, reservation: scope }, select: { id: true, fullName: true, profileLink: { select: { profile: { select: profileSelect } } } } });
    if (!guest) throw new ApiError(404, "Reservation guest not found");
    return { kind: "guest", canManage, guestId: guest.id, fullName: guest.fullName, profile: guest.profileLink?.profile ?? null };
  }
  // Manager-only mutations. Staff may inspect but cannot assert or change a person's identity.
  if (!canManage) throw new ApiError(403, "Guest profile management role required");
  return db.$transaction(async (tx): Promise<GuestProfileResponse> => {
    const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { slug: true } });
    async function audit(profileId: string, action: "CREATE" | "UPDATE", description: string, data: Prisma.InputJsonObject) {
      await tx.auditLog.create({ data: { action, entityType: "HotelGuestProfile", entityId: profileId, description, newValue: { propertyId, ...data }, userId: actor.userId, organizationId, organizationSlug: org.slug } });
    }
    if (cmd.action === "rename") {
      const profile = await tx.hotelGuestProfile.findFirst({ where: { ...scope, id: cmd.profileId }, select: profileSelect });
      if (!profile) throw new ApiError(404, "Guest profile not found");
      const updated = await tx.hotelGuestProfile.updateMany({ where: { ...scope, id: cmd.profileId, version: cmd.expectedVersion }, data: { displayName: cleanGuestProfileName(cmd.displayName)!, version: { increment: 1 } } });
      if (updated.count !== 1) throw new ApiError(409, "Guest profile version conflict");
      await audit(profile.id, "UPDATE", "Reception guest profile renamed", { version: cmd.expectedVersion + 1 });
      return { kind: "saved" as const, profile: { id: profile.id, displayName: cleanGuestProfileName(cmd.displayName)!, version: cmd.expectedVersion + 1 } };
    }
    // Lock the immutable guest anchor before checking or changing its single link.
    const anchors = await tx.$queryRaw<Array<{ id: string; reservationId: string }>>(Prisma.sql`
      SELECT g.id, g."reservationId" FROM "HotelReservationGuest" g
      JOIN "HotelReservation" r ON r.id = g."reservationId" AND r."organizationId" = g."organizationId"
      WHERE g.id = ${cmd.guestId} AND g."organizationId" = ${organizationId} AND r."propertyId" = ${propertyId}
      FOR UPDATE OF g
    `);
    const anchor = anchors[0];
    if (!anchor) throw new ApiError(404, "Reservation guest not found");
    const existing = await tx.hotelGuestProfileLink.findFirst({ where: { ...scope, guestId: anchor.id }, select: { profileId: true } });
    if (cmd.action === "unlink") {
      if (!existing || existing.profileId !== cmd.profileId) throw new ApiError(409, "Guest profile link changed");
      await tx.hotelGuestProfileLink.deleteMany({ where: { ...scope, guestId: anchor.id, profileId: cmd.profileId } });
      await audit(cmd.profileId, "UPDATE", "Reception guest profile link removed", { guestId: anchor.id, reservationId: anchor.reservationId });
      return { kind: "saved" as const, profile: null };
    }
    if (existing) throw new ApiError(409, "Reservation guest already linked");
    let profile;
    if (cmd.action === "create") {
      profile = await tx.hotelGuestProfile.create({ data: { ...scope, displayName: cleanGuestProfileName(cmd.displayName)! }, select: profileSelect });
    } else {
      // Serialize competing links to this profile (including two guests in one reservation).
      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM "HotelGuestProfile" WHERE id = ${cmd.profileId} AND "organizationId" = ${organizationId} AND "propertyId" = ${propertyId} FOR UPDATE`);
      if (!locked.length) throw new ApiError(404, "Guest profile not found");
      profile = await tx.hotelGuestProfile.findFirstOrThrow({ where: { ...scope, id: cmd.profileId }, select: profileSelect });
      if (await tx.hotelGuestProfileLink.findFirst({ where: { ...scope, profileId: profile.id, reservationId: anchor.reservationId }, select: { guestId: true } })) throw new ApiError(409, "Profile already linked to this stay");
    }
    await tx.hotelGuestProfileLink.create({ data: { ...scope, guestId: anchor.id, reservationId: anchor.reservationId, profileId: profile.id, linkedBy: actor.userId } });
    await audit(profile.id, cmd.action === "create" ? "CREATE" : "UPDATE", cmd.action === "create" ? "Reception guest profile created" : "Reception guest profile linked", { guestId: anchor.id, reservationId: anchor.reservationId });
    return { kind: "saved" as const, profile };
  });
}
