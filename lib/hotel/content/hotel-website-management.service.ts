import "server-only";
import { isEligibleWebsiteImage as isEligibleImage } from "@/lib/website-studio/core";

import { createHash } from "node:crypto";
import { Prisma, type AuditAction, type PrismaClient, type UserRole } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db-runtime";
import {
  createHotelWebsiteDraftRevisionInTransaction,
  HotelWebsiteContentAuthorizationError,
  HotelWebsiteContentValidationError,
} from "@/lib/hotel/content/hotel-website-content.service";
import { createHotelWebsiteDraftSchema } from "@/lib/hotel/content/hotel-website-contract";

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;
type Operation = "CREATE_DRAFT" | "SUBMIT" | "APPROVE" | "REJECT" | "PUBLISH" | "REVOKE";
type Principal = { userId: string; role: UserRole; organizationId?: string | null };
type Scope = { organizationId: string; propertyId: string };

export class HotelWebsiteManagementConflictError extends Error {}
export class HotelWebsiteManagementNotFoundError extends Error {}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}

function sha256(value: unknown) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function hotelWebsiteRequestFingerprint(value: unknown) {
  return sha256(value);
}

export function assertIndependentHotelWebsiteReviewer(creatorUserId: string, reviewerUserId: string) {
  if (creatorUserId === reviewerUserId) throw new HotelWebsiteContentAuthorizationError("The revision creator cannot review their own content");
}

export function assertHotelWebsiteIdempotencyActor(operationActorId: string, requestingActorId: string) {
  if (operationActorId !== requestingActorId) throw new HotelWebsiteManagementConflictError("Idempotency-Key belongs to a different actor");
}

export function assertHotelWebsiteTransition(current: string, expected: string) {
  if (current !== expected) throw new HotelWebsiteManagementConflictError(`Expected ${expected} revision state`);
}

function assertKey(key: string) {
  if (key.length < 8 || key.length > 128 || key.trim() !== key) throw new HotelWebsiteContentValidationError("A valid idempotency key is required");
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}


export class HotelWebsiteManagementService {
  constructor(private readonly db: Db = defaultPrisma) {}

  private async authorize(principal: Principal, scope: Scope, tx: Tx, minimum: "EDITOR" | "ADMIN" = "EDITOR") {
    if (!principal.userId || !scope.organizationId || !scope.propertyId) throw new HotelWebsiteContentAuthorizationError("Authenticated Hotel organization scope is required");
    if (principal.role !== "SUPER_ADMIN" && principal.organizationId !== scope.organizationId) throw new HotelWebsiteContentAuthorizationError("Tenant context mismatch");

    const [user, organization, property] = await Promise.all([
      tx.user.findFirst({ where: { id: principal.userId, isActive: true, deletedAt: null }, select: { id: true, role: true } }),
      tx.organization.findFirst({ where: { id: scope.organizationId, vertical: "HOTEL", isActive: true, deletedAt: null, capabilities: { some: { key: "HOTEL_WEBSITE", status: "ACTIVE" } } }, select: { id: true } }),
      tx.hotelProperty.findFirst({ where: { id: scope.propertyId, organizationId: scope.organizationId, isActive: true, deletedAt: null }, select: { id: true } }),
    ]);
    if (!user || !organization || !property) throw new HotelWebsiteContentAuthorizationError("Active Hotel website scope is required");
    if (principal.role === "SUPER_ADMIN") {
      if (user.role !== "SUPER_ADMIN") throw new HotelWebsiteContentAuthorizationError("Active platform administrator role is required");
      return { membershipRole: "SUPER_ADMIN" as const };
    }

    const membership = await tx.organizationMember.findFirst({
      where: { organizationId: scope.organizationId, userId: principal.userId, isActive: true, role: { in: minimum === "ADMIN" ? ["ADMIN"] : ["ADMIN", "MANAGER"] } },
      select: { role: true },
    });
    if (!membership) throw new HotelWebsiteContentAuthorizationError(minimum === "ADMIN" ? "Organization administrator membership is required" : "Organization administrator or manager membership is required");
    return { membershipRole: membership.role };
  }

  private async runIdempotent<T>(input: {
    principal: Principal;
    scope: Scope;
    operation: Operation;
    idempotencyKey: string;
    request: unknown;
    callback: (tx: Tx) => Promise<T>;
  }): Promise<{ result: T; replayed: boolean }> {
    assertKey(input.idempotencyKey);
    const requestSha256 = hotelWebsiteRequestFingerprint(input.request);
    const unique = { organizationId_propertyId_operation_idempotencyKey: { ...input.scope, operation: input.operation, idempotencyKey: input.idempotencyKey } };
    const replay = async (existing: { actorUserId: string; requestSha256: string; response: Prisma.JsonValue | null } | null) => {
      if (!existing) return null;
      assertHotelWebsiteIdempotencyActor(existing.actorUserId, input.principal.userId);
      if (existing.requestSha256 !== requestSha256) throw new HotelWebsiteManagementConflictError("Idempotency-Key was already used for a different request");
      if (existing.response === null) throw new HotelWebsiteManagementConflictError("The original operation has no durable result");
      return { result: existing.response as T, replayed: true };
    };

    try {
      return await this.db.$transaction(async (tx) => {
        await this.authorize(input.principal, input.scope, tx, input.operation === "APPROVE" || input.operation === "REJECT" || input.operation === "PUBLISH" || input.operation === "REVOKE" ? "ADMIN" : "EDITOR");
        const existing = await tx.hotelWebsiteOperation.findUnique({ where: unique, select: { actorUserId: true, requestSha256: true, response: true } });
        const prior = await replay(existing);
        if (prior) return prior;

        await tx.hotelWebsiteOperation.create({ data: { ...input.scope, actorUserId: input.principal.userId, operation: input.operation, idempotencyKey: input.idempotencyKey, requestSha256 } });
        const result = await input.callback(tx);
        await tx.hotelWebsiteOperation.update({ where: unique, data: { response: safeJson(result) } });
        return { result, replayed: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) {
        const prior = await this.db.$transaction(async (tx) => {
          await this.authorize(input.principal, input.scope, tx, input.operation === "APPROVE" || input.operation === "REJECT" || input.operation === "PUBLISH" || input.operation === "REVOKE" ? "ADMIN" : "EDITOR");
          const existing = await tx.hotelWebsiteOperation.findUnique({ where: unique, select: { actorUserId: true, requestSha256: true, response: true } });
          return replay(existing);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        if (prior) return prior;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") throw new HotelWebsiteManagementConflictError("Concurrent content change; retry with the same idempotency key");
      throw error;
    }
  }

  private async lockRevision(tx: Tx, scope: Scope, revisionId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "HotelWebsiteContentRevision" WHERE "id"=${revisionId} AND "organizationId"=${scope.organizationId} AND "propertyId"=${scope.propertyId} FOR UPDATE`;
    if (rows.length !== 1) throw new HotelWebsiteManagementNotFoundError("Content revision not found");
    return tx.hotelWebsiteContentRevision.findFirstOrThrow({ where: { id: revisionId, organizationId: scope.organizationId, propertyId: scope.propertyId } });
  }

  private async verifyMedia(tx: Tx, scope: Scope, revisionId: string) {
    const associations = await tx.hotelWebsiteMediaAssociation.findMany({ where: { organizationId: scope.organizationId, propertyId: scope.propertyId, revisionId }, orderBy: [{ scope: "asc" }, { roomTypeId: "asc" }, { slot: "asc" }, { sortOrder: "asc" }, { id: "asc" }] });
    const ids = [...new Set(associations.map((item) => item.imageId))];
    const images = ids.length ? await tx.image.findMany({ where: { id: { in: ids }, organizationId: scope.organizationId, access: "PUBLIC" }, select: { id: true, filename: true, url: true, mimeType: true } }) : [];
    const eligible = new Map(images.filter(isEligibleImage).map((image) => [image.id, image]));
    if (eligible.size !== ids.length) throw new HotelWebsiteContentAuthorizationError("Revision contains media that is no longer eligible for Hotel website publication");
    for (const association of associations) {
      if (association.scope === "ROOM_CATEGORY") {
        if (!association.roomTypeId) throw new HotelWebsiteContentAuthorizationError("Room media has no room category");
        const room = await tx.hotelRoomType.findFirst({ where: { id: association.roomTypeId, organizationId: scope.organizationId, propertyId: scope.propertyId, isActive: true, deletedAt: null }, select: { id: true } });
        if (!room) throw new HotelWebsiteContentAuthorizationError("Revision references an inactive or foreign room category");
      }
      if (!eligible.has(association.imageId)) throw new HotelWebsiteContentAuthorizationError("Revision media is no longer eligible");
    }
    return associations.map((association) => ({ association, image: eligible.get(association.imageId)! }));
  }

  private async audit(tx: Tx, input: { scope: Scope; principal: Principal; action: AuditAction; entityType: string; entityId: string; description: string; previousValue?: Prisma.InputJsonValue; newValue?: Prisma.InputJsonValue }) {
    const organization = await tx.organization.findUniqueOrThrow({ where: { id: input.scope.organizationId }, select: { slug: true } });
    await tx.auditLog.create({ data: { action: input.action, entityType: input.entityType, entityId: input.entityId, description: input.description, previousValue: input.previousValue, newValue: input.newValue, userId: input.principal.userId, organizationId: input.scope.organizationId, organizationSlug: organization.slug } });
  }

  async createDraft(principal: Principal, scope: Scope, input: unknown, idempotencyKey: string) {
    const parsed = createHotelWebsiteDraftSchema.parse(input);
    return this.runIdempotent({ principal, scope, operation: "CREATE_DRAFT", idempotencyKey, request: parsed, callback: async (tx) => {
      const revision = await createHotelWebsiteDraftRevisionInTransaction(tx, { ...scope, actorUserId: principal.userId, ...parsed });
      return revision;
    } });
  }

  /** Returns only media that the same organization may attach to a website
   * revision. Private, foreign, malformed, and non-public storage URLs never
   * enter the editor's picker. */
  async listAvailableMedia(principal: Principal, scope: Scope) {
    return this.db.$transaction(async (tx) => {
      await this.authorize(principal, scope, tx);
      const images = await tx.image.findMany({
        where: { organizationId: scope.organizationId, access: "PUBLIC" },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 100,
        select: { id: true, filename: true, url: true, mimeType: true, createdAt: true },
      });
      return images.filter(isEligibleImage).map((image) => ({
        imageId: image.id,
        src: image.url,
        filename: image.filename!,
        mimeType: image.mimeType!,
        createdAt: image.createdAt.toISOString(),
      }));
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async listRevisions(principal: Principal, scope: Scope) {
    return this.db.$transaction(async (tx) => {
      await this.authorize(principal, scope, tx);
      const revisions = await tx.hotelWebsiteContentRevision.findMany({ where: scope, orderBy: [{ revisionNumber: "desc" }], include: { reviews: { orderBy: { createdAt: "asc" }, select: { action: true, note: true, createdAt: true, actorUserId: true } }, publications: { orderBy: { publishedAt: "desc" }, select: { id: true, publishedAt: true, revokedAt: true, revocationReason: true } } } });
      return revisions.map((revision) => ({ revisionId: revision.id, pageId: revision.pageId, revisionNumber: revision.revisionNumber, status: revision.status, content: revision.content, contentSha256: revision.contentSha256, createdAt: revision.createdAt, reviews: revision.reviews, publications: revision.publications }));
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async preview(principal: Principal, scope: Scope, revisionId: string, locale: "fa" | "en" | "ar") {
    return this.db.$transaction(async (tx) => {
      await this.authorize(principal, scope, tx);
      const revision = await tx.hotelWebsiteContentRevision.findFirst({ where: { id: revisionId, ...scope }, include: { page: { select: { pageKey: true } } } });
      if (!revision) throw new HotelWebsiteManagementNotFoundError("Content revision not found");
      const media = await this.verifyMedia(tx, scope, revisionId);
      return { mode: "PREVIEW" as const, locale, revisionId: revision.id, revisionNumber: revision.revisionNumber, status: revision.status, pageKey: revision.page.pageKey, content: revision.content, media: media.map(({ association, image }) => ({ imageId: image.id, src: image.url, scope: association.scope, roomTypeId: association.roomTypeId, slot: association.slot, sortOrder: association.sortOrder, altText: association.altText })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async submit(principal: Principal, scope: Scope, revisionId: string, note: string | undefined, key: string) {
    return this.runIdempotent({ principal, scope, operation: "SUBMIT", idempotencyKey: key, request: { revisionId, note: note ?? null }, callback: async (tx) => {
      const revision = await this.lockRevision(tx, scope, revisionId);
      assertHotelWebsiteTransition(revision.status, "DRAFT");
      await tx.hotelWebsiteContentRevision.update({ where: { id: revisionId }, data: { status: "IN_REVIEW" } });
      const review = await tx.hotelWebsiteContentReview.create({ data: { ...scope, pageId: revision.pageId, revisionId, actorUserId: principal.userId, action: "SUBMITTED", note: note ?? null } });
      await this.audit(tx, { scope, principal, action: "UPDATE", entityType: "HotelWebsiteContentRevision", entityId: revisionId, description: "Submitted Hotel website revision for review", previousValue: { status: revision.status }, newValue: { status: "IN_REVIEW", reviewId: review.id } });
      return { revisionId, status: "IN_REVIEW", reviewId: review.id };
    } });
  }

  async decide(principal: Principal, scope: Scope, revisionId: string, decision: "APPROVED" | "REJECTED", note: string | undefined, key: string) {
    return this.runIdempotent({ principal, scope, operation: decision === "APPROVED" ? "APPROVE" : "REJECT", idempotencyKey: key, request: { revisionId, decision, note: note ?? null }, callback: async (tx) => {
      const revision = await this.lockRevision(tx, scope, revisionId);
      assertHotelWebsiteTransition(revision.status, "IN_REVIEW");
      assertIndependentHotelWebsiteReviewer(revision.createdByUserId, principal.userId);
      if (decision === "APPROVED") await this.verifyMedia(tx, scope, revisionId);
      await tx.hotelWebsiteContentRevision.update({ where: { id: revisionId }, data: { status: decision } });
      const review = await tx.hotelWebsiteContentReview.create({ data: { ...scope, pageId: revision.pageId, revisionId, actorUserId: principal.userId, action: decision, note: note ?? null } });
      await this.audit(tx, { scope, principal, action: "UPDATE", entityType: "HotelWebsiteContentRevision", entityId: revisionId, description: decision === "APPROVED" ? "Approved Hotel website revision" : "Rejected Hotel website revision", previousValue: { status: "IN_REVIEW" }, newValue: { status: decision, reviewId: review.id } });
      return { revisionId, status: decision, reviewId: review.id };
    } });
  }

  async publish(principal: Principal, scope: Scope, revisionId: string, key: string) {
    return this.runIdempotent({ principal, scope, operation: "PUBLISH", idempotencyKey: key, request: { revisionId }, callback: async (tx) => {
      const revision = await this.lockRevision(tx, scope, revisionId);
      assertHotelWebsiteTransition(revision.status, "APPROVED");
      await this.verifyMedia(tx, scope, revisionId);
      const existing = await tx.hotelWebsitePublication.findFirst({ where: { ...scope, pageId: revision.pageId, revokedAt: null }, select: { id: true } });
      if (existing) throw new HotelWebsiteManagementConflictError("Revoke the current publication before publishing a replacement revision");
      const publication = await tx.hotelWebsitePublication.create({ data: { ...scope, pageId: revision.pageId, revisionId, publishedByUserId: principal.userId } });
      await this.audit(tx, { scope, principal, action: "CREATE", entityType: "HotelWebsitePublication", entityId: publication.id, description: "Published approved Hotel website revision", newValue: { revisionId, publishedAt: publication.publishedAt.toISOString() } });
      return { publicationId: publication.id, revisionId, publishedAt: publication.publishedAt };
    } });
  }

  async revoke(principal: Principal, scope: Scope, publicationId: string, reason: string | undefined, key: string) {
    return this.runIdempotent({ principal, scope, operation: "REVOKE", idempotencyKey: key, request: { publicationId, reason: reason ?? null }, callback: async (tx) => {
      const publication = await tx.hotelWebsitePublication.findFirst({ where: { id: publicationId, ...scope, revokedAt: null } });
      if (!publication) throw new HotelWebsiteManagementNotFoundError("Active publication not found");
      const updated = await tx.hotelWebsitePublication.updateMany({ where: { id: publicationId, ...scope, revokedAt: null }, data: { revokedAt: new Date(), revokedByUserId: principal.userId, revocationReason: reason ?? "Revoked by administrator" } });
      if (updated.count !== 1) throw new HotelWebsiteManagementConflictError("Publication changed concurrently");
      await this.audit(tx, { scope, principal, action: "UPDATE", entityType: "HotelWebsitePublication", entityId: publicationId, description: "Revoked Hotel website publication", previousValue: { revisionId: publication.revisionId, revokedAt: null }, newValue: { revisionId: publication.revisionId, revocationReason: reason ?? "Revoked by administrator" } });
      return { publicationId, revisionId: publication.revisionId, revoked: true };
    } });
  }

  async history(principal: Principal, scope: Scope) {
    return this.db.$transaction(async (tx) => {
      await this.authorize(principal, scope, tx);
      const reviews = await tx.hotelWebsiteContentReview.findMany({ where: scope, orderBy: { createdAt: "desc" }, select: { id: true, pageId: true, revisionId: true, action: true, note: true, actorUserId: true, createdAt: true } });
      const publications = await tx.hotelWebsitePublication.findMany({ where: scope, orderBy: { publishedAt: "desc" }, select: { id: true, pageId: true, revisionId: true, publishedAt: true, publishedByUserId: true, revokedAt: true, revokedByUserId: true, revocationReason: true } });
      return { reviews, publications };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
