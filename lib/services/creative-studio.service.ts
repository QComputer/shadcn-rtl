import { ApiError } from "@/lib/api-guards";
import { writeAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/db";
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
        applyEndpointRecordsOnly: true,
        noPublicAssetMutation: true,
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
    input: ApplyCreativeStudioAssetInput,
  ) {
    if (input.applyToTarget !== false) {
      throw new ApiError(400, "P108 records Creative Studio application intent only");
    }

    const asset = await prisma.creativeStudioAsset.findFirst({
      where: { id: assetId, organizationId },
      include: { job: true },
    });
    if (!asset) throw new ApiError(404, "Creative Studio asset not found");

    const updated = await prisma.creativeStudioAsset.update({
      where: { id: asset.id },
      data: {
        status: "APPLIED",
        appliedAt: new Date(),
        sourceMetadata: {
          ...(asset.sourceMetadata && typeof asset.sourceMetadata === "object" && !Array.isArray(asset.sourceMetadata)
            ? asset.sourceMetadata as Prisma.InputJsonObject
            : {}),
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

    return { asset: updated, recordedOnly: true };
  }
}

export const creativeStudioService = new CreativeStudioService();
