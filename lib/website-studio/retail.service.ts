import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/db-runtime";
import { ApiError } from "@/lib/api-guards";
import { retailWebsiteMedia } from "./brand-media";
import { initialRetailContent, referencedWebsiteImages, retailContentSchema, saveRetailDraftSchema, type WebsiteMedia, type WebsiteRevision } from "./retail-contract";
import { changeRetailHeroPublicationSchema, readRetailHeroPublication } from "./retail-hero-contract";
import { readTenantDiskImage } from "@/lib/storage/tenant-image-storage.server";
import { RETAIL_MEDIA_PAGE_SIZE } from "./retail-media-gallery.server";

export type StudioPrincipal = { userId: string; role: UserRole; organizationId?: string | null };
type Tx = Prisma.TransactionClient;
type RevisionRow = { id: string; content: Prisma.JsonValue; createdAt: Date; requestId: string; createdBy: string };

// Website editing is gated by the active SHOP capability, not by taxonomy.
// This keeps legacy organizations and future SHOP verticals usable without
// guessing or rewriting their business classification.
export const retailWebsiteScope: Prisma.OrganizationWhereInput = {
  isActive: true, deletedAt: null,
  capabilities: { some: { key: "SHOP", status: "ACTIVE", enabledAt: { not: null } } },
};

export class RetailWebsiteService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async authorize(tx: Tx, principal: StudioPrincipal, organizationId: string) {
    if (!principal.userId || (principal.role !== "SUPER_ADMIN" && principal.organizationId !== organizationId)) throw new ApiError(403, "دسترسی به این سازمان مجاز نیست.");
    const [user, org] = await Promise.all([
      tx.user.findFirst({ where: { id: principal.userId, isActive: true, deletedAt: null }, select: { role: true } }),
      tx.organization.findFirst({ where: { ...retailWebsiteScope, id: organizationId }, select: { id: true, name: true, slug: true, description: true, phone: true, email: true, address: true } }),
    ]);
    if (!user || !org) throw new ApiError(403, "سازمان فروشگاهی فعال در دسترس نیست.");
    if (principal.role === "SUPER_ADMIN") {
      if (user.role !== "SUPER_ADMIN") throw new ApiError(403, "دسترسی مدیریت معتبر نیست.");
    } else {
      // Same editor roles as Hotel; role comes from current membership, never the payload.
      const member = await tx.organizationMember.findFirst({ where: { userId: principal.userId, organizationId, isActive: true, role: { in: ["ADMIN", "MANAGER"] } }, select: { id: true } });
      if (!member) throw new ApiError(403, "عضویت مدیریت سازمان لازم است.");
    }
    return org;
  }

  async authorizeOrganization(principal: StudioPrincipal, organizationId: string) {
    return this.db.$transaction((tx) => this.authorize(tx, principal, organizationId));
  }

  private async media(tx: Tx, organizationId: string, retainedIds: string[] = [], includeFirstPage = true) {
    const where = { organizationId, access: "PUBLIC" as const, mimeType: { in: ["image/jpeg", "image/png", "image/webp", "image/gif"] } };
    const [page, retained] = await Promise.all([
      includeFirstPage ? tx.image.findMany({ where, select: { id: true, url: true, filename: true, mimeType: true, sizeBytes: true, organizationId: true }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: RETAIL_MEDIA_PAGE_SIZE }) : Promise.resolve([]),
      retainedIds.length ? tx.image.findMany({ where: { ...where, id: { in: [...new Set(retainedIds)] } }, select: { id: true, url: true, filename: true, mimeType: true, sizeBytes: true, organizationId: true } }) : Promise.resolve([]),
    ]);
    const unique = new Map([...page, ...retained].map((image) => [image.id, image]));
    return retailWebsiteMedia(organizationId, [...unique.values()]);
  }

  private async assertMediaDeliverable(organizationId: string, media: WebsiteMedia[], ids: string[]) {
    for (const image of media) {
      if (!ids.includes(image.id) || !image.url.startsWith("/api/media/")) continue;
      if (!image.filename) throw new ApiError(422, "تصویر هیرو در دسترس نیست یا متعلق به این فروشگاه نیست.");
      const asset = await readTenantDiskImage(organizationId, image.filename);
      if (!asset || asset.metadata.organizationId !== organizationId || asset.metadata.access !== "public" || asset.metadata.mimeType !== image.mimeType) {
        throw new ApiError(422, "تصویر هیرو در دسترس نیست یا متعلق به این فروشگاه نیست.");
      }
    }
  }

  private async currentMedia(organizationId: string, media: WebsiteMedia[]) {
    const checked = await Promise.all(media.map(async (image) => {
      if (!image.url.startsWith("/api/media/")) return image;
      if (!image.filename) return null;
      const asset = await readTenantDiskImage(organizationId, image.filename);
      if (!asset || asset.metadata.organizationId !== organizationId || asset.metadata.access !== "public" || asset.metadata.mimeType !== image.mimeType) return null;
      return image;
    }));
    return checked.filter((image): image is WebsiteMedia => image !== null);
  }

  async filterDeliverableMedia(organizationId: string, media: WebsiteMedia[]) {
    return this.currentMedia(organizationId, media);
  }

  async load(principal: StudioPrincipal, organizationId: string, revisionId?: string) {
    return this.db.$transaction(async (tx) => {
      const organization = await this.authorize(tx, principal, organizationId);
      const rows = revisionId
        ? await tx.$queryRaw<RevisionRow[]>`SELECT * FROM "TenantWebsiteRevision" WHERE "organizationId"=${organizationId} AND id=${revisionId} LIMIT 1`
        : await tx.$queryRaw<RevisionRow[]>`SELECT * FROM "TenantWebsiteRevision" WHERE "organizationId"=${organizationId} ORDER BY "createdAt" DESC, id DESC LIMIT 1`;
      if (revisionId && !rows[0]) throw new ApiError(404, "نسخه در دسترس نیست.");
      const row = rows[0];
      const revision: WebsiteRevision | null = row ? { id: row.id, createdAt: row.createdAt.toISOString(), content: retailContentSchema.parse(row.content) } : null;
      const content = revision?.content ?? initialRetailContent(organization);
      const media = await this.currentMedia(organizationId, await this.media(tx, organizationId, referencedWebsiteImages(content), !revisionId));
      // Revoked/private/deleted/foreign images never reach a private preview either.
      const settings = await tx.organizationSettings.findUnique({ where: { organizationSlug: organization.slug }, select: { settings: true } });
      const publication = readRetailHeroPublication(settings?.settings);
      const publishedRevision = publication?.revisionId ? await tx.tenantWebsiteRevision.findFirst({ where: { id: publication.revisionId, organizationId }, select: { content: true } }) : null;
      const hasLegacyHeroReference = (value: unknown) => {
        const parsedContent = retailContentSchema.safeParse(value);
        return parsedContent.success && [parsedContent.data.hero?.desktopImageId, parsedContent.data.hero?.mobileImageId, parsedContent.data.hero?.darkDesktopImageId, parsedContent.data.hero?.darkMobileImageId].some((id) => Boolean(id?.startsWith("brand:")));
      };
      const legacyHeroNeedsReplacement = hasLegacyHeroReference(content) || hasLegacyHeroReference(publishedRevision?.content);
      return { organization, revision, content, publication, legacyHeroNeedsReplacement, media };
    });
  }

  async save(principal: StudioPrincipal, organizationId: string, input: unknown) {
    const parsed = saveRetailDraftSchema.parse(input);
    return this.db.$transaction(async (tx) => {
      const org = await this.authorize(tx, principal, organizationId);
      // Serialize saves per organization, including first save; preserve immutable revisions.
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${organizationId} FOR UPDATE`;
      const previous = await tx.$queryRaw<RevisionRow[]>`SELECT * FROM "TenantWebsiteRevision" WHERE "organizationId"=${organizationId} AND "requestId"=${parsed.requestId} LIMIT 1`;
      if (previous[0]) {
        if (previous[0].createdBy !== principal.userId || JSON.stringify(retailContentSchema.parse(previous[0].content)) !== JSON.stringify(parsed.content)) throw new ApiError(409, "شناسه ذخیره قبلاً استفاده شده است.");
        return { id: previous[0].id, createdAt: previous[0].createdAt.toISOString(), content: parsed.content };
      }
      const latest = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "TenantWebsiteRevision" WHERE "organizationId"=${organizationId} ORDER BY "createdAt" DESC, id DESC LIMIT 1`;
      if ((latest[0]?.id ?? null) !== parsed.baseRevisionId) throw new ApiError(409, "نسخه جدیدتری ذخیره شده است. صفحه را بازخوانی کنید.");
      const imageIds = referencedWebsiteImages(parsed.content);
      const media = await this.media(tx, organizationId, imageIds, false);
      if (imageIds.some((id) => !media.some((image) => image.id === id))) throw new ApiError(422, "تصویر باید عمومی و متعلق به همین سازمان باشد.");
      await this.assertMediaDeliverable(organizationId, media, imageIds);
      const id = randomUUID();
      const [row] = await tx.$queryRaw<RevisionRow[]>`INSERT INTO "TenantWebsiteRevision" (id,"organizationId",content,"createdBy","requestId","createdAt") VALUES (${id},${organizationId},${JSON.stringify(parsed.content)}::jsonb,${principal.userId},${parsed.requestId},GREATEST(clock_timestamp(),COALESCE((SELECT MAX("createdAt") + INTERVAL '1 millisecond' FROM "TenantWebsiteRevision" WHERE "organizationId"=${organizationId}),clock_timestamp()))) RETURNING *`;
      await tx.auditLog.create({ data: { action: "CREATE", entityType: "TenantWebsiteRevision", entityId: id, organizationId, organizationSlug: org.slug, userId: principal.userId, description: "Private Retail website draft saved" } });
      return { id, createdAt: row.createdAt.toISOString(), content: parsed.content };
    });
  }

  async changePublication(principal: StudioPrincipal, organizationId: string, input: unknown) {
    const parsed = changeRetailHeroPublicationSchema.parse(input);
    return this.db.$transaction(async tx => {
      const org = await this.authorize(tx, principal, organizationId);
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${organizationId} FOR UPDATE`;
      const settings = await tx.organizationSettings.findUnique({ where: { organizationSlug: org.slug }, select: { settings: true } });
      const current = readRetailHeroPublication(settings?.settings);
      if ((current?.revisionId ?? null) !== parsed.basePublishedRevisionId) throw new ApiError(409, "نسخهٔ منتشرشده تغییر کرده است. بازخوانی کنید.");
      const alreadyPublished = parsed.action === "publish" && current?.revisionId === parsed.revisionId;
      let target: string | null = parsed.revisionId;
      if (parsed.action === "rollback") {
        if (!current || current.revisionId !== parsed.revisionId) throw new ApiError(409, "نسخهٔ بازگشت معتبر نیست.");
        target = current.previousRevisionId;
      }
      if (target) {
        const row = await tx.tenantWebsiteRevision.findFirst({ where: { id: target, organizationId }, select: { content: true } });
        if (!row) throw new ApiError(404, "نسخهٔ این فروشگاه پیدا نشد.");
        const content = retailContentSchema.parse(row.content);
        if (!content.hero) throw new ApiError(422, "ابتدا تنظیمات هیرو را ذخیره کنید.");
        const imageIds = [content.hero.desktopImageId, content.hero.mobileImageId, content.hero.darkDesktopImageId, content.hero.darkMobileImageId].filter(Boolean);
        const media = await this.media(tx, organizationId, imageIds, false);
        if (imageIds.some(id => !media.some(image => image.id === id))) throw new ApiError(422, "تصویر هیرو در دسترس نیست یا متعلق به این فروشگاه نیست.");
        await this.assertMediaDeliverable(organizationId, media, imageIds);
        if (content.hero.enabled && content.hero.mode === "PRODUCTS") {
          const products = await tx.product.findMany({ where: { id: { in: content.hero.productIds }, organizationId, isActive: true, deletedAt: null, category: { organizationId, isActive: true, deletedAt: null } }, select: { id: true } });
          if (products.length !== content.hero.productIds.length) throw new ApiError(422, "محصولات منتخب باید منتشرشده و متعلق به همین فروشگاه باشند.");
        }
      }
      if (alreadyPublished) return current;
      const publication = { revisionId: target, previousRevisionId: current?.revisionId ?? null, publishedAt: new Date().toISOString() };
      // Preserve unrelated commerce/settings keys atomically; no schema migration needed.
      await tx.$executeRaw`INSERT INTO "OrganizationSettings" (id,"organizationSlug",settings,"updatedAt") VALUES (${randomUUID()},${org.slug},jsonb_build_object('retailHeroPublication',${JSON.stringify(publication)}::jsonb),NOW()) ON CONFLICT ("organizationSlug") DO UPDATE SET settings=COALESCE("OrganizationSettings".settings,'{}'::jsonb) || jsonb_build_object('retailHeroPublication',${JSON.stringify(publication)}::jsonb),"updatedAt"=NOW()`;
      await tx.auditLog.create({ data: { action: "UPDATE", entityType: "RetailHeroPublication", entityId: target ?? organizationId, organizationId, organizationSlug: org.slug, userId: principal.userId, description: parsed.action === "publish" ? "Published Retail hero revision" : "Restored previous Retail hero", newValue: publication } });
      return publication;
    });
  }
}
