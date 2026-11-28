import "server-only";
import type { Prisma } from "@prisma/client";
import { hasOrganizationCapability } from "../organization-capabilities";
import { normalizeIranianMobile } from "../integrations/inoti-ussd/parser";
import { appointmentGuestScope } from "../appointments/guest-scope";
import { guestOrderScope } from "../retail/guest-order-scope";
import { matchesHotelGuestReservationProof } from "../hotel/domain/guest-reservation-proof";
import type { GuestClaimScope } from "./guest-claim.contract";

// Do not move records out of the G2 rolling guest-creation budget. The first
// increment is deliberately limited to settled/completed, modern per-record rows.
const MIN_AGE_MS = 15 * 60_000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const privileged = ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF", "DRIVER"] as const;
const samePhone = (value: string | null, phone: string) => !!value && normalizeIranianMobile(value) === phone;

export async function currentClaimActor(tx: Prisma.TransactionClient, scope: GuestClaimScope, phone: string, now: Date) {
  return tx.customerPhoneSession.findFirst({ where: {
    id: scope.sessionId, userId: scope.userId, organizationId: scope.organizationId, revokedAt: null, expiresAt: { gt: now },
    user: { role: "CUSTOMER", isActive: true, isTeamMember: false, deletedAt: null,
      customerPhoneIdentity: { is: { phone, verifiedAt: { lte: now } } },
      memberOf: { none: { isActive: true, role: { in: [...privileged] } } },
      customerClubMemberships: { none: { organizationId: scope.organizationId, status: { not: "ACTIVE" } } },
    }, organization: { isActive: true, deletedAt: null, isPlatformOwner: false },
  }, select: { organization: { select: { id: true, slug: true, type: true, capabilitiesInitializedAt: true,
    capabilities: { select: { key: true, status: true } }, branding: { select: { retailPreviewOnly: true } } } } } });
}

function orderWhere(scope: GuestClaimScope, slug: string, now: Date): Prisma.OrderWhereInput {
  return { id: scope.recordId, organizationSlug: slug, organization: { id: scope.organizationId, isActive: true, deletedAt: null },
    customerId: null, guestCustomerId: { not: null }, deletedAt: null,
    retailCheckoutKey: { not: null }, publicTrackingToken: null,
    createdAt: { lt: new Date(now.getTime() - MIN_AGE_MS) },
    OR: [{ status: { in: ["DELIVERED", "RECEIVED"] } }, { status: "PICKED_UP", type: "PICK_UP" }],
    paymentStatus: "COMPLETED", paymentMethod: { in: ["CASH", "BANK_TRANSFER"] },
    payment: { is: { status: "COMPLETED", method: { in: ["CASH", "BANK_TRANSFER"] } } },
    paymentRequests: { none: {} }, ussdPaymentIntents: { none: {} },
    retailPaymentReports: { none: { status: { in: ["PENDING_REVIEW", "CORRECTION_REQUESTED"] } } },
    guestCustomer: { is: { sessionId: { startsWith: guestOrderScope(slug, scope.guestSessionId) } } },
  };
}
function appointmentWhere(scope: GuestClaimScope, now: Date): Prisma.AppointmentWhereInput {
  return { id: scope.recordId, customerId: null, guestCustomerId: { not: null }, deletedAt: null,
    status: "COMPLETED", endTime: { lte: now }, createdAt: { lt: new Date(now.getTime() - MIN_AGE_MS) },
    service: { organizationId: scope.organizationId, organization: { isActive: true, deletedAt: null } },
    paymentRequests: { none: {} },
    guestCustomer: { is: { sessionId: { startsWith: appointmentGuestScope(scope.organizationId, scope.guestSessionId) } } },
  };
}

async function eligible(tx: Prisma.TransactionClient, scope: GuestClaimScope, now: Date, secret = process.env.NEXTAUTH_SECRET ?? "") {
  const phone = normalizeIranianMobile(scope.phone);
  if (!phone) return null;
  const actor = await currentClaimActor(tx, scope, phone, now);
  if (!actor) return null;
  const org = actor.organization;
  const capability = scope.kind === "ORDER" ? "SHOP" : scope.kind === "HOTEL" ? "HOTEL_BOOKING" : "APPOINTMENT";
  if (!hasOrganizationCapability({ legacyType: org.type, capabilitiesInitializedAt: org.capabilitiesInitializedAt, capabilities: org.capabilities }, capability)) return null;
  if (scope.kind === "HOTEL") {
    const row = await tx.hotelReservation.findFirst({ where: { id: scope.recordId, organizationId: scope.organizationId, status: "CHECKED_OUT", checkedOutAt: { lte: now }, customerOwnership: null, guestClaimProof: { isNot: null }, property: { isActive: true, deletedAt: null } }, select: { id: true, propertyId: true, guestClaimProof: true } });
    if (!row?.guestClaimProof || !matchesHotelGuestReservationProof(row.guestClaimProof, { reservationId: row.id, organizationId: scope.organizationId, propertyId: row.propertyId, origin: scope.origin }, scope.guestSessionId, phone, secret, now)) return null;
    return { kind: "HOTEL" as const, rowId: row.id, guestId: "", slug: org.slug, propertyId: row.propertyId };
  }
  if (scope.kind === "ORDER") {
    if (org.branding?.retailPreviewOnly) return null;
    const where = orderWhere(scope, org.slug, now);
    const row = await tx.order.findFirst({ where, select: { id: true, retailCheckoutKey: true, guestCustomerId: true, guestCustomer: { select: { phone: true, sessionId: true } } } });
    if (!row?.guestCustomerId || !row.guestCustomer || !row.retailCheckoutKey || !uuid.test(row.retailCheckoutKey) ||
        row.guestCustomer.sessionId !== `${guestOrderScope(org.slug, scope.guestSessionId)}${row.retailCheckoutKey}` || !samePhone(row.guestCustomer.phone, phone)) return null;
    return { kind: "ORDER" as const, rowId: row.id, guestId: row.guestCustomerId, slug: org.slug, where };
  }
  const where = appointmentWhere(scope, now);
  const row = await tx.appointment.findFirst({ where, select: { id: true, guestCustomerId: true, customerPhoneAtBooking: true, guestCustomer: { select: { phone: true, sessionId: true } } } });
  const prefix = appointmentGuestScope(scope.organizationId, scope.guestSessionId);
  if (!row?.guestCustomerId || !row.guestCustomer || !row.guestCustomer.sessionId.startsWith(prefix) || !uuid.test(row.guestCustomer.sessionId.slice(prefix.length)) ||
    !samePhone(row.guestCustomer.phone, phone) || !samePhone(row.customerPhoneAtBooking, phone)) return null;
  return { kind: "APPOINTMENT" as const, rowId: row.id, guestId: row.guestCustomerId, slug: org.slug, where };
}

/** Called only after the identity lock and origin validation in the OTP core. */
export async function guestClaimEligible(tx: Prisma.TransactionClient, scope: GuestClaimScope, now: Date, secret?: string) {
  return Boolean(await eligible(tx, scope, now, secret));
}

/** Runs inside the OTP consume transaction. Never expose as an independent route.
 * Null means the caller must throw and roll back OTP consumption. The existing
 * guest row and all payment/inventory/booking snapshots stay intact. */
export async function completeGuestClaim(tx: Prisma.TransactionClient, scope: GuestClaimScope, now: Date, secret?: string) {
  const initial = await eligible(tx, scope, now, secret);
  if (!initial) return null;
  // Revalidate after locks. Concurrent revocation/ownership updates serialize or fail closed.
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${scope.userId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "CustomerPhoneIdentity" WHERE "userId" = ${scope.userId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "OrganizationMember" WHERE "userId" = ${scope.userId} ORDER BY "id" FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "CustomerClubMembership" WHERE "customerId" = ${scope.userId} AND "organizationId" = ${scope.organizationId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "CustomerPhoneSession" WHERE "id" = ${scope.sessionId} FOR UPDATE`;
  if (initial.kind !== "HOTEL") await tx.$queryRaw`SELECT "id" FROM "GuestCustomer" WHERE "id" = ${initial.guestId} FOR UPDATE`;
  if (initial.kind === "ORDER") await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${initial.rowId} FOR UPDATE`;
  else if (initial.kind === "APPOINTMENT") await tx.$queryRaw`SELECT "id" FROM "Appointment" WHERE "id" = ${initial.rowId} FOR UPDATE`;
  else await tx.$queryRaw`SELECT "id" FROM "HotelReservation" WHERE "id" = ${initial.rowId} AND "organizationId" = ${scope.organizationId} FOR UPDATE`;
  const current = await eligible(tx, scope, now, secret);
  if (!current || current.kind !== initial.kind || current.guestId !== initial.guestId || current.rowId !== initial.rowId) return null;
  if (current.kind === "HOTEL") {
    await tx.hotelReservationOwnership.create({ data: { reservationId: current.rowId, organizationId: scope.organizationId, propertyId: current.propertyId, userId: scope.userId, claimedAt: now } });
    await tx.auditLog.create({ data: { action: "CREATE", entityType: "HotelGuestReservationClaim", entityId: current.rowId, userId: scope.userId, organizationId: scope.organizationId, organizationSlug: current.slug, description: "Explicit hotel reservation ownership claim v1" } });
    return { outcome: "CLAIMED" as const, kind: current.kind, recordId: current.rowId };
  }
  const result = current.kind === "ORDER"
    ? await tx.order.updateMany({ where: { ...current.where, guestCustomerId: current.guestId }, data: { customerId: scope.userId } })
    : await tx.appointment.updateMany({ where: { ...current.where, guestCustomerId: current.guestId }, data: { customerId: scope.userId } });
  if (result.count !== 1) return null;
  await tx.auditLog.create({ data: { action: "UPDATE", entityType: current.kind === "ORDER" ? "GuestOrderClaim" : "GuestAppointmentClaim",
    entityId: current.rowId, userId: scope.userId, organizationId: scope.organizationId, organizationSlug: current.slug,
    description: "Explicit guest record ownership claim v1", previousValue: { customerId: null }, newValue: { customerId: scope.userId } } });
  return { outcome: "CLAIMED" as const, kind: current.kind, recordId: current.rowId };
}

/** Private discovery: only scoped modern browser records, exact core eligibility, bounded output. */
export async function listGuestClaimCandidates(tx: Prisma.TransactionClient, scope: Omit<GuestClaimScope, "recordId">, now: Date, reference?: string) {
  const phone = normalizeIranianMobile(scope.phone);
  if (!phone) return [];
  const actor = await currentClaimActor(tx, { ...scope, recordId: "list" }, phone, now);
  if (!actor) return [];
  const org = actor.organization;
  const capability = scope.kind === "ORDER" ? "SHOP" : scope.kind === "HOTEL" ? "HOTEL_BOOKING" : "APPOINTMENT";
  if (!hasOrganizationCapability({ legacyType: org.type, capabilitiesInitializedAt: org.capabilitiesInitializedAt, capabilities: org.capabilities }, capability)) return [];
  if (scope.kind === "HOTEL") {
    if (!reference || !/^[A-Za-z0-9_-]{1,128}$/.test(reference)) return [];
    const row = await tx.hotelReservation.findUnique({ where: { organizationId_reference: { organizationId: scope.organizationId, reference } }, select: { id: true, reference: true, checkIn: true } });
    if (!row || !await guestClaimEligible(tx, { ...scope, recordId: row.id }, now)) return [];
    return [{ recordId: row.id, reference: row.reference, date: row.checkIn.toISOString() }];
  }
  const bound = { ...scope, recordId: "list" };
  if (scope.kind === "ORDER") {
    if (org.branding?.retailPreviewOnly) return [];
    const where = orderWhere(bound, org.slug, now);
    delete where.id;
    const rows = await tx.order.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 20,
      select: { id: true, orderNumber: true, createdAt: true } });
    const result = [];
    for (const row of rows) if (await guestClaimEligible(tx, { ...scope, recordId: row.id }, now)) result.push({ recordId: row.id, reference: row.orderNumber, date: row.createdAt.toISOString() });
    return result;
  }
  const where = appointmentWhere(bound, now);
  delete where.id;
  const rows = await tx.appointment.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 20,
    select: { id: true, bookingReference: true, startTime: true } });
  const result = [];
  for (const row of rows) if (await guestClaimEligible(tx, { ...scope, recordId: row.id }, now)) result.push({ recordId: row.id, reference: row.bookingReference, date: row.startTime.toISOString() });
  return result;
}
