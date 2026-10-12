import { Prisma, type PrismaClient } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { prisma as defaultPrisma } from "@/lib/db-runtime";
import { normalizeDomainHost } from "@/lib/custom-domain-routing";

type Db = PrismaClient;
export type HotelPublicationResource = "PROPERTY" | "ROOM_TYPE" | "RATE_PLAN" | "CANCELLATION_POLICY";
export type HotelPublicationScope = { readonly availability: boolean; readonly quote: boolean; readonly policies: boolean };

export class HotelPublicationAuthorizationError extends Error {}
export class HotelPublicationValidationError extends Error {}

const resourceTables: Record<HotelPublicationResource, string> = {
  PROPERTY: "hotelProperty",
  ROOM_TYPE: "hotelRoomType",
  RATE_PLAN: "hotelRatePlan",
  CANCELLATION_POLICY: "hotelCancellationPolicy",
};

export async function resourceRevision(db: Db | Prisma.TransactionClient, input: { organizationId: string; propertyId: string; resourceType: HotelPublicationResource; resourceId: string }) {
  const where = { id: input.resourceId, organizationId: input.organizationId, ...(input.resourceType === "PROPERTY" ? {} : { propertyId: input.propertyId }) };
  const row = await (db[resourceTables[input.resourceType] as keyof Db] as { findFirst: (args: unknown) => Promise<{ id: string; propertyId?: string; updatedAt: Date; isActive: boolean; deletedAt?: Date | null } | null> }).findFirst({ where });
  if (!row || row.propertyId && row.propertyId !== input.propertyId || !row.isActive || row.deletedAt) throw new HotelPublicationValidationError("Resource is not active in the requested property scope");
  if (input.resourceType !== "RATE_PLAN") return row.updatedAt.toISOString();
  const rates = await db.hotelNightlyRate.findMany({ where: { organizationId: input.organizationId, ratePlanId: input.resourceId }, orderBy: [{ from: "asc" }, { to: "asc" }, { id: "asc" }], select: { id: true, from: true, to: true, nightlyRate: true, minNights: true, maxNights: true, updatedAt: true } });
  return createHash("sha256").update(JSON.stringify({ planUpdatedAt: row.updatedAt.toISOString(), rates: rates.map((rate) => ({ ...rate, from: rate.from.toISOString(), to: rate.to.toISOString(), nightlyRate: rate.nightlyRate?.toString(), updatedAt: rate.updatedAt.toISOString() })) })).digest("hex");
}

async function assertApprover(db: Db, organizationId: string, userId: string, role: string) {
  if (role === "SUPER_ADMIN") return;
  if (role !== "ADMIN") throw new HotelPublicationAuthorizationError("Only an organization administrator may approve hotel publication");
  const membership = await db.organizationMember.findFirst({ where: { organizationId, userId, role: "ADMIN", isActive: true }, select: { id: true } });
  if (!membership) throw new HotelPublicationAuthorizationError("Active organization administrator membership is required");
}

export async function approveHotelPublication(input: { organizationId: string; propertyId: string; resourceType: HotelPublicationResource; resourceId: string; scope: HotelPublicationScope; userId: string; role: string }, db: Db = defaultPrisma) {
  await assertApprover(db, input.organizationId, input.userId, input.role);
  const revision = await resourceRevision(db, input);
  await db.$executeRaw(Prisma.sql`UPDATE "HotelPublicationApproval" SET "status"='REVOKED', "revokedAt"=CURRENT_TIMESTAMP, "revokedReason"='Superseded by a newer approval' WHERE "organizationId"=${input.organizationId} AND "propertyId"=${input.propertyId} AND "resourceType"=${input.resourceType} AND "resourceId"=${input.resourceId} AND "status"='APPROVED'`);
  await db.$executeRaw(Prisma.sql`INSERT INTO "HotelPublicationApproval" ("id","organizationId","propertyId","resourceType","resourceId","resourceRevision","scope","approvedByUserId") VALUES (${randomUUID()},${input.organizationId},${input.propertyId},${input.resourceType},${input.resourceId},${revision},${JSON.stringify(input.scope)}::jsonb,${input.userId}) ON CONFLICT ("organizationId","propertyId","resourceType","resourceId","resourceRevision") DO UPDATE SET "scope"=EXCLUDED."scope", "status"='APPROVED', "approvedByUserId"=EXCLUDED."approvedByUserId", "approvedAt"=CURRENT_TIMESTAMP, "revokedAt"=NULL, "revokedByUserId"=NULL, "revokedReason"=NULL`);
  return { resourceType: input.resourceType, resourceId: input.resourceId, resourceRevision: revision, scope: input.scope };
}

export async function revokeHotelPublication(input: { organizationId: string; propertyId: string; resourceType: HotelPublicationResource; resourceId: string; userId: string; role: string; reason?: string }, db: Db = defaultPrisma) {
  await assertApprover(db, input.organizationId, input.userId, input.role);
  await db.$executeRaw(Prisma.sql`UPDATE "HotelPublicationApproval" SET "status"='REVOKED', "revokedAt"=CURRENT_TIMESTAMP, "revokedByUserId"=${input.userId}, "revokedReason"=${input.reason ?? "Revoked by administrator"} WHERE "organizationId"=${input.organizationId} AND "propertyId"=${input.propertyId} AND "resourceType"=${input.resourceType} AND "resourceId"=${input.resourceId} AND "status"='APPROVED'`);
}

export async function resolveHotelTenantForHost(host: string | null | undefined, db: Db = defaultPrisma) {
  const normalizedDomain = normalizeDomainHost(host);
  if (!normalizedDomain) return null;
  const domain = await db.organizationDomain.findUnique({ where: { normalizedDomain }, select: { status: true, organization: { select: { id: true, isActive: true, deletedAt: true, vertical: true, capabilities: { select: { key: true, status: true } } } } } });
  if (!domain || domain.status !== "ACTIVE" || !domain.organization.isActive || domain.organization.deletedAt || domain.organization.vertical !== "HOTEL") return null;
  if (!domain.organization.capabilities.some((capability) => capability.key === "HOTEL_BOOKING" && capability.status === "ACTIVE")) return null;
  return { organizationId: domain.organization.id };
}

export async function isCurrentHotelPublicationApproved(input: { organizationId: string; propertyId: string; resourceType: HotelPublicationResource; resourceId: string; scope: keyof HotelPublicationScope }, db: Db = defaultPrisma) {
  const revision = await resourceRevision(db, input);
  const rows = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "HotelPublicationApproval" WHERE "organizationId"=${input.organizationId} AND "propertyId"=${input.propertyId} AND "resourceType"=${input.resourceType} AND "resourceId"=${input.resourceId} AND "resourceRevision"=${revision} AND "status"='APPROVED' AND COALESCE(("scope"->>${input.scope}), 'false')='true' AND "revokedAt" IS NULL LIMIT 1`);
  return rows.length === 1;
}
