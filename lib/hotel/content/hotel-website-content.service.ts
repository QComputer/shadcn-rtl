import "server-only";

import { createHash } from "node:crypto";
import { OrganizationCapabilityKey, Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db-runtime";
import { createHotelWebsiteDraftSchema, type HotelWebsiteContent, type HotelWebsiteMediaAssociationInput } from "@/lib/hotel/content/hotel-website-contract";

type Db = PrismaClient | Prisma.TransactionClient;

export class HotelWebsiteContentAuthorizationError extends Error {}
export class HotelWebsiteContentValidationError extends Error {}

function isPlatformPublicImage(image: { filename: string | null; url: string; mimeType: string | null }) {
  if (!image.filename || !/^[A-Za-z0-9_.-]+$/.test(image.filename)) return false;
  if (!image.mimeType || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(image.mimeType)) return false;
  if (image.url === `/uploads/${image.filename}`) return true;
  try {
    const url = new URL(image.url);
    return url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com") && url.pathname.split("/").at(-1) === image.filename;
  } catch {
    return false;
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export function createHotelWebsiteRevisionHash(content: HotelWebsiteContent, media: readonly HotelWebsiteMediaAssociationInput[]): string {
  const orderedMedia = [...media].sort((left, right) =>
    left.scope.localeCompare(right.scope) ||
    (left.roomTypeId ?? "").localeCompare(right.roomTypeId ?? "") ||
    left.slot.localeCompare(right.slot) ||
    left.sortOrder - right.sortOrder ||
    left.imageId.localeCompare(right.imageId),
  );
  return createHash("sha256").update(canonicalJson({ content, media: orderedMedia })).digest("hex");
}

export async function createHotelWebsiteDraftRevisionInTransaction(tx: Prisma.TransactionClient, input: {
  organizationId: string;
  propertyId: string;
  actorUserId: string;
  content: unknown;
  media: unknown;
}) {
  const parsed = createHotelWebsiteDraftSchema.safeParse({ content: input.content, media: input.media });
  if (!parsed.success) throw new HotelWebsiteContentValidationError(parsed.error.issues[0]?.message ?? "Invalid Hotel website content");

    const organization = await tx.organization.findFirst({
      where: {
        id: input.organizationId,
        isActive: true,
        deletedAt: null,
        vertical: "HOTEL",
        capabilities: { some: { key: OrganizationCapabilityKey.HOTEL_WEBSITE, status: "ACTIVE" } },
      },
      select: { id: true, slug: true },
    });
    if (!organization) throw new HotelWebsiteContentAuthorizationError("Active Hotel website capability is required");

    const actor = await tx.user.findFirst({ where: { id: input.actorUserId, isActive: true, deletedAt: null }, select: { id: true, role: true } });
    if (!actor) throw new HotelWebsiteContentAuthorizationError("Active user is required");
    if (actor.role !== "SUPER_ADMIN") {
      const membership = await tx.organizationMember.findFirst({ where: { organizationId: input.organizationId, userId: input.actorUserId, role: { in: ["ADMIN", "MANAGER"] }, isActive: true }, select: { id: true } });
      if (!membership) throw new HotelWebsiteContentAuthorizationError("Active organization manager membership is required");
    }

    const property = await tx.hotelProperty.findFirst({ where: { id: input.propertyId, organizationId: input.organizationId, isActive: true, deletedAt: null }, select: { id: true } });
    if (!property) throw new HotelWebsiteContentAuthorizationError("Property is outside the active organization scope");

    const imageIds = [...new Set(parsed.data.media.map((media) => media.imageId))];
    if (imageIds.length > 0) {
      const images = await tx.image.findMany({ where: { id: { in: imageIds }, organizationId: input.organizationId, access: "PUBLIC" }, select: { id: true, filename: true, url: true, mimeType: true } });
      if (images.length !== imageIds.length || images.some((image) => !isPlatformPublicImage(image))) throw new HotelWebsiteContentAuthorizationError("Media must be public-serving and owned by this organization");
    }

    const roomTypeIds = [...new Set(parsed.data.media.flatMap((media) => media.roomTypeId ? [media.roomTypeId] : []))];
    if (roomTypeIds.length > 0) {
      const roomTypes = await tx.hotelRoomType.findMany({ where: { id: { in: roomTypeIds }, organizationId: input.organizationId, propertyId: input.propertyId, isActive: true, deletedAt: null }, select: { id: true } });
      if (roomTypes.length !== roomTypeIds.length) throw new HotelWebsiteContentAuthorizationError("Room-category media is outside the active property scope");
    }

    const page = await tx.hotelWebsitePage.upsert({
      where: { organizationId_propertyId_pageKey: { organizationId: input.organizationId, propertyId: input.propertyId, pageKey: "HOME" } },
      create: { organizationId: input.organizationId, propertyId: input.propertyId, pageKey: "HOME" },
      update: {},
      select: { id: true },
    });
    const counter = await tx.hotelWebsitePage.update({
      where: { id: page.id },
      data: { revisionCounter: { increment: 1 } },
      select: { revisionCounter: true },
    });
    const hash = createHotelWebsiteRevisionHash(parsed.data.content, parsed.data.media);
    const revision = await tx.hotelWebsiteContentRevision.create({
      data: {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        pageId: page.id,
        revisionNumber: counter.revisionCounter,
        status: "DRAFT",
        content: parsed.data.content as Prisma.InputJsonValue,
        contentSha256: hash,
        createdByUserId: input.actorUserId,
      },
      select: { id: true, pageId: true, revisionNumber: true, status: true, contentSha256: true, createdAt: true },
    });

    if (parsed.data.media.length > 0) {
      await tx.hotelWebsiteMediaAssociation.createMany({
        data: parsed.data.media.map((media) => ({
          organizationId: input.organizationId,
          propertyId: input.propertyId,
          pageId: page.id,
          revisionId: revision.id,
          imageId: media.imageId,
          scope: media.scope,
          roomTypeId: media.roomTypeId,
          slot: media.slot,
          sortOrder: media.sortOrder,
          altText: media.altText as Prisma.InputJsonValue,
        })),
      });
    }

    await tx.auditLog.create({
      data: {
        action: "CREATE",
        entityType: "HotelWebsiteContentRevision",
        entityId: revision.id,
        description: "Created Hotel website content draft revision",
        newValue: { pageId: page.id, revisionNumber: revision.revisionNumber, contentSha256: hash, mediaCount: parsed.data.media.length },
        userId: input.actorUserId,
        organizationId: organization.id,
        organizationSlug: organization.slug,
      },
    });

  return { ...revision, mediaCount: parsed.data.media.length };
}

export async function createHotelWebsiteDraftRevision(input: {
  organizationId: string;
  propertyId: string;
  actorUserId: string;
  content: unknown;
  media: unknown;
}, db: Db = defaultPrisma) {
  if (!("$transaction" in db)) return createHotelWebsiteDraftRevisionInTransaction(db, input);
  return db.$transaction((tx) => createHotelWebsiteDraftRevisionInTransaction(tx, input), {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}
