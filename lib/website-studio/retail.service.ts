import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/db-runtime";
import { ApiError } from "@/lib/api-guards";
import { isEligibleWebsiteImage } from "./core";
import { initialRetailContent, referencedWebsiteImages, retailContentSchema, saveRetailDraftSchema, type WebsiteRevision } from "./retail-contract";

export type StudioPrincipal = { userId: string; role: UserRole; organizationId?: string | null };
type Tx = Prisma.TransactionClient;
type RevisionRow = { id: string; content: Prisma.JsonValue; createdAt: Date; requestId: string; createdBy: string };

// Existing retailers (including Aka Shoes) may be unclassified. SHOP grants
// the capability; the optional business taxonomy is never changed by editing.
export const retailWebsiteScope: Prisma.OrganizationWhereInput = {
  isActive: true, deletedAt: null,
  OR: [{ vertical: null }, { vertical: { in: ["SHOE_STORE", "CLOTHING_STORE", "PHARMACY", "SUPERMARKET", "FLORIST"] } }],
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

  private async media(tx: Tx, organizationId: string) {
    const images = await tx.image.findMany({ where: { organizationId, access: "PUBLIC" }, select: { id: true, url: true, filename: true, mimeType: true }, orderBy: [{ createdAt: "desc" }, { id: "asc" }] });
    return images.filter(isEligibleWebsiteImage);
  }

  async load(principal: StudioPrincipal, organizationId: string, revisionId?: string) {
    return this.db.$transaction(async (tx) => {
      const organization = await this.authorize(tx, principal, organizationId);
      const rows = revisionId
        ? await tx.$queryRaw<RevisionRow[]>`SELECT * FROM "TenantWebsiteRevision" WHERE "organizationId"=${organizationId} AND id=${revisionId} LIMIT 1`
        : await tx.$queryRaw<RevisionRow[]>`SELECT * FROM "TenantWebsiteRevision" WHERE "organizationId"=${organizationId} ORDER BY "createdAt" DESC, id DESC LIMIT 1`;
      if (revisionId && !rows[0]) throw new ApiError(404, "نسخه در دسترس نیست.");
      const media = await this.media(tx, organizationId);
      const row = rows[0];
      const revision: WebsiteRevision | null = row ? { id: row.id, createdAt: row.createdAt.toISOString(), content: retailContentSchema.parse(row.content) } : null;
      const content = revision?.content ?? initialRetailContent(organization);
      // Revoked/private/deleted/foreign images never reach a private preview either.
      return { organization, revision, content, media: media.filter((image) => !revisionId || referencedWebsiteImages(content).includes(image.id)) };
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
      const media = await this.media(tx, organizationId);
      if (referencedWebsiteImages(parsed.content).some((id) => !media.some((image) => image.id === id))) throw new ApiError(422, "تصویر باید عمومی و متعلق به همین سازمان باشد.");
      const id = randomUUID();
      const [row] = await tx.$queryRaw<RevisionRow[]>`INSERT INTO "TenantWebsiteRevision" (id,"organizationId",content,"createdBy","requestId","createdAt") VALUES (${id},${organizationId},${JSON.stringify(parsed.content)}::jsonb,${principal.userId},${parsed.requestId},GREATEST(clock_timestamp(),COALESCE((SELECT MAX("createdAt") + INTERVAL '1 millisecond' FROM "TenantWebsiteRevision" WHERE "organizationId"=${organizationId}),clock_timestamp()))) RETURNING *`;
      await tx.auditLog.create({ data: { action: "CREATE", entityType: "TenantWebsiteRevision", entityId: id, organizationId, organizationSlug: org.slug, userId: principal.userId, description: "Private Retail website draft saved" } });
      return { id, createdAt: row.createdAt.toISOString(), content: parsed.content };
    });
  }
}
