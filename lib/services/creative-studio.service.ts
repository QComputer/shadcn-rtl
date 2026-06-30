import { ApiError } from "@/lib/api-guards";
import { writeAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/db";
import {
  revalidateCreativeStudioPublicTarget,
  type CreativeStudioApplyTargetField,
  type CreativeStudioRevalidationInput,
  type CreativeStudioRevalidationResult,
} from "@/lib/services/creative-studio-cache-revalidation";
import { getAiMediaPaidProviderStatus } from "@/lib/services/ai-media-paid-provider";
import type {
  ApplyCreativeStudioAssetInput,
  CreateCreativeStudioJobInput,
  CreativeStudioJobFilterInput,
} from "@/lib/validators";
import type {
  CreativeStudioAssetType,
  CreativeStudioJobStatus,
  CreativeStudioTargetType,
  Prisma,
  UserRole,
} from "@prisma/client";
import { hasPermission } from "@/lib/types";

const DEFAULT_DAILY_CREATIVE_STUDIO_JOB_LIMIT = 25;
const PRIVATE_IPV4_PATTERNS = [/^10\./, /^127\./, /^0\./, /^192\.168\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[0-1])\./];

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getDailyJobLimit() {
  return parsePositiveInt(process.env.CREATIVE_STUDIO_DAILY_JOB_LIMIT, DEFAULT_DAILY_CREATIVE_STUDIO_JOB_LIMIT);
}

function compactMetadata(metadata: unknown): Prisma.InputJsonObject {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonObject;
}

function metadataObject(metadata: unknown): Prisma.InputJsonObject {
  return compactMetadata(metadata);
}

function getPublicAssetUrl(asset: { storedUrl?: string | null; draftUrl?: string | null; sourceUrl?: string | null }) {
  return asset.storedUrl || asset.draftUrl || asset.sourceUrl || null;
}

function isPrivateIpv4(hostname: string) {
  return PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(hostname));
}

function assertPublicSafeAssetUrl(url: string | null) {
  if (!url) throw new ApiError(400, "Creative Studio asset does not have a public URL to apply");

  if (url.startsWith("/uploads/")) return url;
  if (url.startsWith("//")) throw new ApiError(400, "Protocol-relative asset URLs are not allowed");
  if (url.startsWith("/")) throw new ApiError(400, "Only /uploads relative asset URLs can be applied");

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ApiError(400, "Creative Studio asset URL is invalid");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ApiError(400, "Creative Studio asset URL must be public http(s)");
  }
  if (parsed.username || parsed.password) {
    throw new ApiError(400, "Creative Studio asset URL must not include credentials");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    isPrivateIpv4(hostname)
  ) {
    throw new ApiError(400, "Creative Studio asset URL must not point to a private host");
  }

  return url;
}

function resolveCreativeStudioApplyTarget(
  targetType: CreativeStudioTargetType,
  assetType: CreativeStudioAssetType,
  targetField: CreativeStudioApplyTargetField | undefined,
) {
  if (!targetField) throw new ApiError(400, "Creative Studio apply target field is required");

  if (targetType === "PRODUCT" && assetType === "PRODUCT_IMAGE" && targetField === "product.image") return targetField;
  if (targetType === "ORGANIZATION_BRAND" && assetType === "LOGO" && targetField === "organization.logo") return targetField;
  if (targetType === "ORGANIZATION_BRAND" && assetType === "COVER" && targetField === "organization.coverImage") return targetField;
  if (targetType === "FANPAGE_POST" && assetType === "FANPAGE_IMAGE" && targetField === "fanpagePost.image") return targetField;

  throw new ApiError(400, "Unsupported Creative Studio apply target");
}

export class CreativeStudioService {
  async getStatus(organizationId: string) {
    const usage = await this.getUsageSummary(organizationId);
    const paidProvider = getAiMediaPaidProviderStatus();

    return {
      enabled: true,
      provider: "MOCK",
      realProviderEnabled: false,
      planningGate: "P107",
      serverFoundation: "P108",
      paidProvider,
      canCreateJob: usage.canCreateJob && !paidProvider.rollback.paused,
      limits: {
        dailyJobLimit: usage.dailyJobLimit,
        remainingDailyJobs: usage.remainingDailyJobs,
      },
      policy: {
        sellerInitiated: true,
        draftOnly: true,
        applyEndpointRecordsOnly: false,
        noPublicAssetMutation: false,
      },
    };
  }

  async getUsageSummary(organizationId: string) {
    const dateStart = startOfUtcDay();
    const dailyJobLimit = getDailyJobLimit();
    const [jobCreateCount, assetDraftCount, assetAppliedCount, events] = await Promise.all([
      prisma.creativeStudioUsageEvent.count({
        where: { organizationId, action: "JOB_CREATED", createdAt: { gte: dateStart } },
      }),
      prisma.creativeStudioUsageEvent.count({
        where: { organizationId, action: "ASSET_DRAFTED", createdAt: { gte: dateStart } },
      }),
      prisma.creativeStudioUsageEvent.count({
        where: { organizationId, action: "ASSET_APPLIED", createdAt: { gte: dateStart } },
      }),
      prisma.creativeStudioUsageEvent.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          action: true,
          provider: true,
          targetType: true,
          targetId: true,
          jobId: true,
          assetId: true,
          units: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      dateStart,
      dailyJobLimit,
      jobCreateCount,
      assetDraftCount,
      assetAppliedCount,
      remainingDailyJobs: Math.max(0, dailyJobLimit - jobCreateCount),
      canCreateJob: jobCreateCount < dailyJobLimit,
      events,
    };
  }

  async listJobs(organizationId: string, filter: CreativeStudioJobFilterInput) {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const where = {
      organizationId,
      ...(filter.status ? { status: filter.status as CreativeStudioJobStatus } : {}),
    };
    const [jobs, total] = await Promise.all([
      prisma.creativeStudioJob.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          assets: {
            orderBy: { createdAt: "desc" },
            take: 6,
          },
        },
      }),
      prisma.creativeStudioJob.count({ where }),
    ]);

    return {
      jobs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getJob(jobId: string, organizationId: string) {
    const job = await prisma.creativeStudioJob.findFirst({
      where: { id: jobId, organizationId },
      include: {
        assets: { orderBy: { createdAt: "desc" } },
        usageEvents: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!job) throw new ApiError(404, "Creative Studio job not found");
    return job;
  }

  private async assertCanCreate(organizationId: string) {
    const usage = await this.getUsageSummary(organizationId);
    const paidProvider = getAiMediaPaidProviderStatus();

    if (!usage.canCreateJob) {
      throw new ApiError(429, "Creative Studio daily generation quota exceeded");
    }
    if (paidProvider.rollback.paused) {
      throw new ApiError(503, "Creative Studio provider rollout is paused");
    }

    return { usage, paidProvider };
  }

  private async assertTargetAccess(organizationId: string, role: UserRole, input: CreateCreativeStudioJobInput) {
    if (input.targetType === "PRODUCT") {
      if (!input.targetId) throw new ApiError(400, "Product target is required");
      if (!hasPermission(role, "product:update")) throw new ApiError(403, "Forbidden");
      const product = await prisma.product.findFirst({
        where: { id: input.targetId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!product) throw new ApiError(404, "Product not found");
      return;
    }

    if (input.targetType === "CAMPAIGN") {
      if (!input.targetId) throw new ApiError(400, "Campaign target is required");
      const campaign = await prisma.campaign.findFirst({
        where: { id: input.targetId, organizationId },
        select: { id: true },
      });
      if (!campaign) throw new ApiError(404, "Campaign not found");
      return;
    }

    if (input.targetType === "FANPAGE_POST") {
      if (!input.targetId) throw new ApiError(400, "Fanpage post target is required");
      const post = await prisma.fanpagePost.findFirst({
        where: { id: input.targetId, organizationId },
        select: { id: true },
      });
      if (!post) throw new ApiError(404, "Fanpage post not found");
      return;
    }

    if (input.targetType === "IMPORTED_MEDIA") {
      if (!input.targetId) throw new ApiError(400, "Imported media target is required");
      const importedDraft = await prisma.importedContentDraft.findFirst({
        where: { id: input.targetId, organizationId },
        select: { id: true },
      });
      if (!importedDraft) throw new ApiError(404, "Imported content draft not found");
      return;
    }

    if (input.targetType === "ORGANIZATION_BRAND") {
      if (!hasPermission(role, "settings:manage")) throw new ApiError(403, "Forbidden");
      return;
    }

    throw new ApiError(400, "Unsupported Creative Studio target");
  }

  async createJob(
    organizationId: string,
    requestedByUserId: string,
    role: UserRole,
    input: CreateCreativeStudioJobInput,
  ) {
    await this.assertTargetAccess(organizationId, role, input);
    const { paidProvider } = await this.assertCanCreate(organizationId);

    const metadata = compactMetadata(input.metadata);
    const sourceMetadata = {
      ...metadata,
      sourceUrl: input.sourceUrl ?? null,
      p108: {
        mockOnly: true,
        publicMutation: false,
      },
    } satisfies Prisma.InputJsonObject;

    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.creativeStudioJob.create({
        data: {
          organizationId,
          targetType: input.targetType as CreativeStudioTargetType,
          targetId: input.targetId ?? null,
          requestedByUserId,
          status: "COMPLETED",
          provider: "MOCK",
          prompt: input.prompt?.trim() || null,
          inputs: {
            assetType: input.assetType,
            count: input.count,
            sourceUrl: input.sourceUrl ?? null,
            metadata,
          } satisfies Prisma.InputJsonObject,
          outputCount: 1,
          costEstimateCents: 0,
          paidProviderEnabled: paidProvider.enabled,
          rollbackPaused: paidProvider.rollback.paused,
          completedAt: new Date(),
        },
      });

      const asset = await tx.creativeStudioAsset.create({
        data: {
          organizationId,
          jobId: job.id,
          assetType: input.assetType as CreativeStudioAssetType,
          status: "DRAFT",
          sourceUrl: input.sourceUrl ?? null,
          sourceMetadata,
        },
      });

      await tx.creativeStudioUsageEvent.createMany({
        data: [
          {
            organizationId,
            jobId: job.id,
            requestedByUserId,
            action: "JOB_CREATED",
            provider: "MOCK",
            targetType: input.targetType as CreativeStudioTargetType,
            targetId: input.targetId ?? null,
            metadata: { assetType: input.assetType, count: input.count },
          },
          {
            organizationId,
            jobId: job.id,
            assetId: asset.id,
            requestedByUserId,
            action: "ASSET_DRAFTED",
            provider: "MOCK",
            targetType: input.targetType as CreativeStudioTargetType,
            targetId: input.targetId ?? null,
            metadata: { publicMutation: false },
          },
        ],
      });

      return { job, asset };
    });

    await writeAuditLog({
      action: "CREATE",
      entityType: "CreativeStudioJob",
      entityId: result.job.id,
      userId: requestedByUserId,
      organizationId,
      newValue: {
        targetType: result.job.targetType,
        targetId: result.job.targetId,
        assetId: result.asset.id,
        provider: "MOCK",
        publicMutation: false,
      },
    });

    return result;
  }

  async cancelJob(jobId: string, organizationId: string, requestedByUserId: string) {
    const job = await prisma.creativeStudioJob.findFirst({ where: { id: jobId, organizationId } });
    if (!job) throw new ApiError(404, "Creative Studio job not found");
    if (["COMPLETED", "FAILED", "CANCELED"].includes(job.status)) {
      throw new ApiError(400, "Only queued or processing Creative Studio jobs can be canceled");
    }

    const updated = await prisma.creativeStudioJob.update({
      where: { id: job.id },
      data: { status: "CANCELED", canceledAt: new Date() },
    });

    await prisma.creativeStudioUsageEvent.create({
      data: {
        organizationId,
        jobId: job.id,
        requestedByUserId,
        action: "JOB_CANCELED",
        provider: job.provider,
        targetType: job.targetType,
        targetId: job.targetId,
      },
    });

    return updated;
  }

  async recordAssetApplication(
    assetId: string,
    organizationId: string,
    requestedByUserId: string,
    role: UserRole,
    input: ApplyCreativeStudioAssetInput,
  ) {
    const asset = await prisma.creativeStudioAsset.findFirst({
      where: { id: assetId, organizationId },
      include: { job: true },
    });
    if (!asset) throw new ApiError(404, "Creative Studio asset not found");

    if (!input.applyToTarget) {
      const updated = await prisma.creativeStudioAsset.update({
        where: { id: asset.id },
        data: {
          status: "APPLIED",
          appliedAt: new Date(),
          sourceMetadata: {
            ...metadataObject(asset.sourceMetadata),
            p108Application: {
              recordedOnly: true,
              publicMutation: false,
            },
          } satisfies Prisma.InputJsonObject,
        },
      });

      await prisma.creativeStudioUsageEvent.create({
        data: {
          organizationId,
          jobId: asset.jobId,
          assetId: asset.id,
          requestedByUserId,
          action: "ASSET_APPLIED",
          provider: asset.job.provider,
          targetType: asset.job.targetType,
          targetId: asset.job.targetId,
          metadata: { recordedOnly: true, publicMutation: false },
        },
      });

      await writeAuditLog({
        action: "UPDATE",
        entityType: "CreativeStudioAsset",
        entityId: asset.id,
        userId: requestedByUserId,
        organizationId,
        previousValue: { status: asset.status },
        newValue: { status: updated.status, recordedOnly: true, publicMutation: false },
      });

      return {
        asset: updated,
        applied: false,
        recordedOnly: true,
        publicMutation: false,
      };
    }

    const targetField = resolveCreativeStudioApplyTarget(asset.job.targetType, asset.assetType, input.targetField);
    const publicAssetUrl = assertPublicSafeAssetUrl(getPublicAssetUrl(asset));
    const appliedAt = new Date();
    const baseMetadata = metadataObject(asset.sourceMetadata);
    let target:
      | {
          entityType: "Product";
          id: string;
          previousValue: string | null;
          organizationSlug: string;
          revalidationInput: CreativeStudioRevalidationInput;
        }
      | {
          entityType: "Organization";
          id: string;
          previousValue: string | null;
          organizationSlug: string;
          revalidationInput: CreativeStudioRevalidationInput;
        }
      | {
          entityType: "FanpagePost";
          id: string;
          previousValue: string | null;
          organizationSlug: string;
          revalidationInput: CreativeStudioRevalidationInput;
        };

    if (targetField === "product.image") {
      if (!hasPermission(role, "product:update")) throw new ApiError(403, "Forbidden");
      if (!asset.job.targetId) throw new ApiError(400, "Creative Studio product target is required");
      const product = await prisma.product.findFirst({
        where: { id: asset.job.targetId, organizationId, deletedAt: null },
        select: {
          id: true,
          slug: true,
          image: true,
          organizationSlug: true,
          category: { select: { id: true, slug: true } },
        },
      });
      if (!product) throw new ApiError(404, "Product target not found");
      target = {
        entityType: "Product",
        id: product.id,
        previousValue: product.image,
        organizationSlug: product.organizationSlug,
        revalidationInput: {
          targetField,
          organizationSlug: product.organizationSlug,
          productSlugOrId: product.slug || product.id,
          categorySlugOrId: product.category?.slug || product.category?.id || null,
        },
      };
    } else if (targetField === "organization.logo" || targetField === "organization.coverImage") {
      if (!hasPermission(role, "settings:manage")) throw new ApiError(403, "Forbidden");
      const organization = await prisma.organization.findFirst({
        where: { id: organizationId, deletedAt: null },
        select: { id: true, slug: true, logo: true, coverImage: true },
      });
      if (!organization) throw new ApiError(404, "Organization target not found");
      target = {
        entityType: "Organization",
        id: organization.id,
        previousValue: targetField === "organization.logo" ? organization.logo : organization.coverImage,
        organizationSlug: organization.slug,
        revalidationInput: { targetField, organizationSlug: organization.slug },
      };
    } else {
      if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role)) throw new ApiError(403, "Forbidden");
      if (!asset.job.targetId) throw new ApiError(400, "Creative Studio fanpage post target is required");
      const post = await prisma.fanpagePost.findFirst({
        where: { id: asset.job.targetId, organizationId, deletedAt: null },
        select: {
          id: true,
          image: true,
          organization: { select: { slug: true } },
        },
      });
      if (!post) throw new ApiError(404, "Fanpage post target not found");
      target = {
        entityType: "FanpagePost",
        id: post.id,
        previousValue: post.image,
        organizationSlug: post.organization.slug,
        revalidationInput: { targetField, organizationSlug: post.organization.slug },
      };
    }

    const applicationMetadata = {
      publicMutation: true,
      targetField,
      targetId: target.id,
      previousValue: target.previousValue,
      appliedUrl: publicAssetUrl,
      appliedAt: appliedAt.toISOString(),
      rollbackHint: {
        targetField,
        previousValue: target.previousValue,
      },
      cacheRevalidation: {
        attempted: false,
        paths: [],
        warnings: [],
      },
    } satisfies Prisma.InputJsonObject;

    const updated = await prisma.$transaction(async (tx) => {
      if (targetField === "product.image") {
        await tx.product.update({ where: { id: target.id }, data: { image: publicAssetUrl } });
      } else if (targetField === "organization.logo") {
        await tx.organization.update({ where: { id: target.id }, data: { logo: publicAssetUrl } });
      } else if (targetField === "organization.coverImage") {
        await tx.organization.update({ where: { id: target.id }, data: { coverImage: publicAssetUrl } });
      } else {
        await tx.fanpagePost.update({ where: { id: target.id }, data: { image: publicAssetUrl } });
      }

      const appliedAsset = await tx.creativeStudioAsset.update({
        where: { id: asset.id },
        data: {
          status: "APPLIED",
          appliedAt,
          sourceMetadata: {
            ...baseMetadata,
            p110Application: applicationMetadata,
          } satisfies Prisma.InputJsonObject,
        },
      });

      await tx.creativeStudioUsageEvent.create({
        data: {
          organizationId,
          jobId: asset.jobId,
          assetId: asset.id,
          requestedByUserId,
          action: "ASSET_APPLIED",
          provider: asset.job.provider,
          targetType: asset.job.targetType,
          targetId: asset.job.targetId,
          metadata: {
            publicMutation: true,
            targetField,
            targetId: target.id,
            previousValuePresent: Boolean(target.previousValue),
            cacheRevalidation: {
              attempted: true,
              paths: [],
            },
          },
        },
      });

      return appliedAsset;
    });

    const revalidation = revalidateCreativeStudioPublicTarget(target.revalidationInput);
    const finalMetadata = {
      ...baseMetadata,
      p110Application: {
        ...applicationMetadata,
        cacheRevalidation: revalidation,
      },
    } satisfies Prisma.InputJsonObject;
    const finalAsset = await prisma.creativeStudioAsset.update({
      where: { id: updated.id },
      data: { sourceMetadata: finalMetadata },
    });

    await writeAuditLog({
      action: "UPDATE",
      entityType: target.entityType,
      entityId: target.id,
      userId: requestedByUserId,
      organizationId,
      organizationSlug: target.organizationSlug,
      previousValue: { [targetField]: target.previousValue },
      newValue: { [targetField]: publicAssetUrl, assetId: asset.id, publicMutation: true },
    });

    await writeAuditLog({
      action: "UPDATE",
      entityType: "CreativeStudioAsset",
      entityId: asset.id,
      userId: requestedByUserId,
      organizationId,
      organizationSlug: target.organizationSlug,
      previousValue: { status: asset.status },
      newValue: {
        status: finalAsset.status,
        targetField,
        appliedUrl: publicAssetUrl,
        publicMutation: true,
      },
    });

    return {
      asset: finalAsset,
      applied: true,
      recordedOnly: false,
      publicMutation: true,
      target: {
        type: asset.job.targetType,
        id: target.id,
        field: targetField,
      },
      appliedUrl: publicAssetUrl,
      previousValue: target.previousValue,
      revalidation: revalidation satisfies CreativeStudioRevalidationResult,
    };
  }
}

export const creativeStudioService = new CreativeStudioService();
