import { ApiError } from "@/lib/api-guards";
import { writeAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/db";
import {
  revalidateCreativeStudioPublicTarget,
  type CreativeStudioApplyTargetField,
  type CreativeStudioRevalidationInput,
  type CreativeStudioRevalidationResult,
} from "@/lib/services/creative-studio-cache-revalidation";
import { getCreativeStudioGenerationReadiness } from "@/lib/services/creative-studio-generation-readiness";
import { getAiMediaPaidProviderStatus } from "@/lib/services/ai-media-paid-provider";
import { aiMediaService } from "@/lib/services/ai-media.service";
import type { AiMediaJobOutput } from "@/lib/services/ai-media-service-client";
import type {
  ApplyCreativeStudioAssetInput,
  CreateCreativeStudioJobInput,
  CreativeStudioJobFilterInput,
  SelectCreativeStudioAssetInput,
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

function metadataRecord(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

function getStringMetadata(metadata: unknown, key: string) {
  const value = metadataRecord(metadata)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getNestedMetadataRecord(metadata: unknown, key: string) {
  const value = metadataRecord(metadata)[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getSelectedTargetField(metadata: unknown) {
  const selection = getNestedMetadataRecord(metadata, "p113Selection");
  return typeof selection.targetField === "string" ? selection.targetField : null;
}

function getRemoteJobIdFromInputs(inputs: unknown) {
  return getStringMetadata(metadataRecord(inputs).p112Generation, "remoteJobId");
}

function normalizeAiMediaOutputs(job: { outputs?: AiMediaJobOutput[] | null; output_images?: string[] | null }): AiMediaJobOutput[] {
  if (Array.isArray(job.outputs) && job.outputs.length > 0) {
    return job.outputs.filter((output) => output && typeof output.url === "string");
  }
  if (Array.isArray(job.output_images)) {
    return job.output_images.filter((url) => typeof url === "string").map((url) => ({ url }));
  }
  return [];
}

function isProductImageGenerationInput(input: CreateCreativeStudioJobInput) {
  return input.targetType === "PRODUCT" && input.assetType === "PRODUCT_IMAGE" && Boolean(input.targetId);
}

function isOrganizationBrandGenerationInput(input: CreateCreativeStudioJobInput) {
  return input.targetType === "ORGANIZATION_BRAND" && ["LOGO", "COVER"].includes(input.assetType);
}

function getOrganizationBrandTargetField(assetType: CreateCreativeStudioJobInput["assetType"]) {
  return assetType === "LOGO" ? "organization.logo" : "organization.coverImage";
}

function getOrganizationBrandAspectRatio(assetType: CreateCreativeStudioJobInput["assetType"], metadata: unknown, inputAspectRatio?: string | null) {
  return inputAspectRatio || getStringMetadata(metadata, "aspect_ratio") || (assetType === "LOGO" ? "1:1" : "16:9");
}

function isProductImageGenerationJob(job: {
  targetType: CreativeStudioTargetType;
  provider: string;
  inputs: Prisma.JsonValue | null;
}) {
  return job.targetType === "PRODUCT" && job.provider !== "MOCK" && Boolean(getRemoteJobIdFromInputs(job.inputs));
}

async function createUsageEventOnce(input: {
  organizationId: string;
  jobId: string;
  requestedByUserId?: string | null;
  action: "JOB_CREATED" | "JOB_CANCELED" | "ASSET_DRAFTED" | "ASSET_SELECTED";
  provider?: string | null;
  targetType?: CreativeStudioTargetType | null;
  targetId?: string | null;
  assetId?: string | null;
  metadata?: Prisma.InputJsonObject;
}) {
  const existing = await prisma.creativeStudioUsageEvent.findFirst({
    where: {
      organizationId: input.organizationId,
      jobId: input.jobId,
      action: input.action,
      ...(input.assetId ? { assetId: input.assetId } : {}),
    },
    select: { id: true },
  });

  if (existing) return existing;

  return prisma.creativeStudioUsageEvent.create({
    data: {
      organizationId: input.organizationId,
      jobId: input.jobId,
      requestedByUserId: input.requestedByUserId ?? null,
      action: input.action,
      provider: input.provider ?? null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      assetId: input.assetId ?? null,
      metadata: input.metadata,
    },
  });
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
  async getStatus(organizationId: string, options: { checkGenerationReadiness?: boolean } = {}) {
    const usage = await this.getUsageSummary(organizationId);
    const paidProvider = getAiMediaPaidProviderStatus();
    const generationReadiness = await getCreativeStudioGenerationReadiness({
      checkRemote: options.checkGenerationReadiness,
    });

    return {
      enabled: true,
      provider: "MOCK",
      realProviderEnabled: false,
      planningGate: "P107",
      serverFoundation: "P108",
      paidProvider,
      generationReadiness,
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

    const syncableJobs = jobs.filter((job) => ["QUEUED", "PROCESSING"].includes(job.status) && isProductImageGenerationJob(job));
    if (syncableJobs.length > 0) {
      await Promise.all(syncableJobs.map((job) => this.syncProductImageGenerationJob(job.id, organizationId).catch(() => null)));
      const refreshedJobs = await prisma.creativeStudioJob.findMany({
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
      });
      return {
        jobs: refreshedJobs,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }

    return {
      jobs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getJob(jobId: string, organizationId: string) {
    let job = await prisma.creativeStudioJob.findFirst({
      where: { id: jobId, organizationId },
      include: {
        assets: { orderBy: { createdAt: "desc" } },
        usageEvents: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!job) throw new ApiError(404, "Creative Studio job not found");
    if (["QUEUED", "PROCESSING"].includes(job.status) && isProductImageGenerationJob(job)) {
      await this.syncProductImageGenerationJob(job.id, organizationId);
      job = await prisma.creativeStudioJob.findFirst({
        where: { id: jobId, organizationId },
        include: {
          assets: { orderBy: { createdAt: "desc" } },
          usageEvents: { orderBy: { createdAt: "desc" }, take: 20 },
        },
      });
      if (!job) throw new ApiError(404, "Creative Studio job not found");
    }
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
    if (isProductImageGenerationInput(input)) {
      return this.createProductImageGenerationJob(organizationId, requestedByUserId, role, input);
    }
    if (isOrganizationBrandGenerationInput(input)) {
      return this.createOrganizationBrandGenerationRequest(organizationId, requestedByUserId, role, input);
    }

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

  private async createOrganizationBrandGenerationRequest(
    organizationId: string,
    requestedByUserId: string,
    role: UserRole,
    input: CreateCreativeStudioJobInput,
  ) {
    await this.assertTargetAccess(organizationId, role, input);
    const { paidProvider } = await this.assertCanCreate(organizationId);
    const prompt = input.prompt?.trim() || null;
    const metadata = compactMetadata(input.metadata);
    const targetField = getOrganizationBrandTargetField(input.assetType);
    const aspectRatio = getOrganizationBrandAspectRatio(input.assetType, metadata, input.aspect_ratio);
    const stylePreset = input.style_preset || getStringMetadata(metadata, "style_preset") || "BRAND_CLEAN";

    const sourceMetadata = {
      ...metadata,
      p115BrandGeneration: {
        contract: "creative-studio-organization-brand-v1",
        requestControlsOnly: true,
        providerExecutionEnabled: false,
        providerContractReady: false,
        draftOnly: true,
        publicMutation: false,
        targetField,
        aspect_ratio: aspectRatio,
        style_preset: stylePreset,
        applyStillRequiresConfirmation: true,
      },
    } satisfies Prisma.InputJsonObject;

    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.creativeStudioJob.create({
        data: {
          organizationId,
          targetType: "ORGANIZATION_BRAND",
          targetId: null,
          requestedByUserId,
          status: "COMPLETED",
          provider: "MOCK",
          prompt,
          inputs: {
            assetType: input.assetType,
            count: input.count,
            aspect_ratio: aspectRatio,
            style_preset: stylePreset,
            metadata,
            p115BrandGeneration: sourceMetadata.p115BrandGeneration,
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
            targetType: "ORGANIZATION_BRAND",
            targetId: null,
            metadata: {
              assetType: input.assetType,
              count: input.count,
              targetField,
              aspect_ratio: aspectRatio,
              style_preset: stylePreset,
              p115BrandGeneration: true,
              providerExecutionEnabled: false,
            },
          },
          {
            organizationId,
            jobId: job.id,
            assetId: asset.id,
            requestedByUserId,
            action: "ASSET_DRAFTED",
            provider: "MOCK",
            targetType: "ORGANIZATION_BRAND",
            targetId: null,
            metadata: {
              targetField,
              requestControlsOnly: true,
              publicMutation: false,
              applyStillRequiresConfirmation: true,
            },
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
        assetType: result.asset.assetType,
        assetId: result.asset.id,
        provider: "MOCK",
        targetField,
        requestControlsOnly: true,
        providerExecutionEnabled: false,
        publicMutation: false,
      },
    });

    return result;
  }

  private async createProductImageGenerationJob(
    organizationId: string,
    requestedByUserId: string,
    role: UserRole,
    input: CreateCreativeStudioJobInput,
  ) {
    await this.assertTargetAccess(organizationId, role, input);
    const { paidProvider } = await this.assertCanCreate(organizationId);
    const prompt = input.prompt?.trim() || null;
    const metadata = compactMetadata(input.metadata);
    const aspectRatio = input.aspect_ratio || getStringMetadata(metadata, "aspect_ratio") || "1:1";
    const stylePreset = input.style_preset || getStringMetadata(metadata, "style_preset") || "LIGHT_MENU_PHOTO";

    const aiResult = await aiMediaService.createJob(
      input.targetId!,
      organizationId,
      requestedByUserId,
      role,
      {
        count: input.count,
        aspect_ratio: aspectRatio,
        style_preset: stylePreset,
        seller_prompt: prompt,
      },
    );

    const remoteJob = aiResult.job;
    const sourceMetadata = {
      ...metadata,
      p112Generation: {
        contract: "ai-media-product-image-suggestions-v1",
        remoteJobId: remoteJob.job_id,
        localAiMediaJobId: aiResult.localJobId,
        createEndpoint: "/v1/product-image-suggestions/jobs",
        draftOnly: true,
        publicMutation: false,
      },
    } satisfies Prisma.InputJsonObject;

    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.creativeStudioJob.create({
        data: {
          organizationId,
          targetType: "PRODUCT",
          targetId: input.targetId,
          requestedByUserId,
          status: remoteJob.status as CreativeStudioJobStatus,
          provider: remoteJob.provider,
          prompt,
          inputs: {
            assetType: "PRODUCT_IMAGE",
            count: input.count,
            aspect_ratio: aspectRatio,
            style_preset: stylePreset,
            metadata,
            p112Generation: sourceMetadata.p112Generation,
          } satisfies Prisma.InputJsonObject,
          outputCount: 0,
          costEstimateCents: paidProvider.enabled ? paidProvider.estimatedJobCostCents : 0,
          paidProviderEnabled: paidProvider.enabled,
          rollbackPaused: paidProvider.rollback.paused,
          completedAt: remoteJob.status === "COMPLETED" ? new Date() : null,
          canceledAt: remoteJob.status === "CANCELED" ? new Date() : null,
        },
      });

      await tx.creativeStudioUsageEvent.create({
        data: {
          organizationId,
          jobId: job.id,
          requestedByUserId,
          action: "JOB_CREATED",
          provider: remoteJob.provider,
          targetType: "PRODUCT",
          targetId: input.targetId,
          metadata: {
            assetType: "PRODUCT_IMAGE",
            count: input.count,
            aspect_ratio: aspectRatio,
            style_preset: stylePreset,
            remoteJobId: remoteJob.job_id,
            p112Generation: true,
          },
        },
      });

      return { job, asset: null };
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
        provider: result.job.provider,
        remoteJobId: remoteJob.job_id,
        publicMutation: false,
      },
    });

    await this.syncProductImageGenerationJob(result.job.id, organizationId).catch(() => null);

    return result;
  }

  private async syncProductImageGenerationJob(jobId: string, organizationId: string) {
    const localJob = await prisma.creativeStudioJob.findFirst({
      where: { id: jobId, organizationId },
      include: { assets: true },
    });
    if (!localJob) throw new ApiError(404, "Creative Studio job not found");

    const remoteJobId = getRemoteJobIdFromInputs(localJob.inputs);
    if (!remoteJobId) return localJob;

    const status = await aiMediaService.getJobStatus(remoteJobId);
    const remoteJob = status.job;
    const outputs = normalizeAiMediaOutputs(remoteJob);
    const nextStatus = remoteJob.status as CreativeStudioJobStatus;
    const now = new Date();

    const updated = await prisma.creativeStudioJob.update({
      where: { id: localJob.id },
      data: {
        status: nextStatus,
        provider: remoteJob.provider,
        errorMessage: remoteJob.error_message ?? null,
        outputCount: outputs.length,
        completedAt: nextStatus === "COMPLETED" ? localJob.completedAt ?? now : localJob.completedAt,
        canceledAt: nextStatus === "CANCELED" ? localJob.canceledAt ?? now : localJob.canceledAt,
      },
      include: { assets: true },
    });

    if (nextStatus === "COMPLETED" && outputs.length > 0) {
      for (const [index, output] of outputs.entries()) {
        const existing = await prisma.creativeStudioAsset.findFirst({
          where: { jobId: localJob.id, sourceUrl: output.url },
          select: { id: true },
        });
        if (existing) continue;

        const asset = await prisma.creativeStudioAsset.create({
          data: {
            organizationId,
            jobId: localJob.id,
            assetType: "PRODUCT_IMAGE",
            status: "DRAFT",
            sourceUrl: output.url,
            draftUrl: output.url,
            mimeType: output.mime_type ?? null,
            width: output.width ?? null,
            height: output.height ?? null,
            sourceMetadata: {
              p112Generation: {
                remoteJobId,
                outputIndex: index,
                promptUsed: output.prompt_used ?? null,
                seed: output.seed ?? null,
                draftOnly: true,
                publicMutation: false,
              },
            } satisfies Prisma.InputJsonObject,
          },
        });

        await createUsageEventOnce({
          organizationId,
          jobId: localJob.id,
          assetId: asset.id,
          requestedByUserId: localJob.requestedByUserId,
          action: "ASSET_DRAFTED",
          provider: remoteJob.provider,
          targetType: localJob.targetType,
          targetId: localJob.targetId,
          metadata: {
            remoteJobId,
            outputIndex: index,
            sourceUrl: output.url,
            p112Generation: true,
            publicMutation: false,
          },
        });
      }
    }

    if (nextStatus === "CANCELED") {
      await createUsageEventOnce({
        organizationId,
        jobId: localJob.id,
        requestedByUserId: localJob.requestedByUserId,
        action: "JOB_CANCELED",
        provider: remoteJob.provider,
        targetType: localJob.targetType,
        targetId: localJob.targetId,
        metadata: { remoteJobId, p112Generation: true },
      });
    }

    return updated;
  }

  async cancelJob(jobId: string, organizationId: string, requestedByUserId: string) {
    const job = await prisma.creativeStudioJob.findFirst({ where: { id: jobId, organizationId } });
    if (!job) throw new ApiError(404, "Creative Studio job not found");
    if (["COMPLETED", "FAILED", "CANCELED"].includes(job.status)) {
      throw new ApiError(400, "Only queued or processing Creative Studio jobs can be canceled");
    }

    const remoteJobId = getRemoteJobIdFromInputs(job.inputs);
    if (remoteJobId) {
      await aiMediaService.cancelJob(remoteJobId, organizationId);
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

  async selectAsset(
    assetId: string,
    organizationId: string,
    requestedByUserId: string,
    role: UserRole,
    input: SelectCreativeStudioAssetInput = {},
  ) {
    const asset = await prisma.creativeStudioAsset.findFirst({
      where: { id: assetId, organizationId },
      include: { job: true },
    });
    if (!asset) throw new ApiError(404, "Creative Studio asset not found");
    if (asset.status === "APPLIED") throw new ApiError(400, "Applied Creative Studio assets cannot be re-selected");
    if (!getPublicAssetUrl(asset)) throw new ApiError(400, "Creative Studio asset does not have a public URL to select");

    if (asset.job.targetType === "PRODUCT" && !hasPermission(role, "product:update")) throw new ApiError(403, "Forbidden");
    if (asset.job.targetType === "ORGANIZATION_BRAND" && !hasPermission(role, "settings:manage")) throw new ApiError(403, "Forbidden");
    if (asset.job.targetType === "FANPAGE_POST" && !["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role)) throw new ApiError(403, "Forbidden");

    const targetField = input.targetField
      ? resolveCreativeStudioApplyTarget(asset.job.targetType, asset.assetType, input.targetField)
      : null;
    const selectedAt = new Date();
    const baseMetadata = metadataObject(asset.sourceMetadata);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.creativeStudioAsset.updateMany({
        where: {
          organizationId,
          jobId: asset.jobId,
          status: "SELECTED",
          id: { not: asset.id },
        },
        data: { status: "DRAFT" },
      });

      const selected = await tx.creativeStudioAsset.update({
        where: { id: asset.id },
        data: {
          status: "SELECTED",
          sourceMetadata: {
            ...baseMetadata,
            p113Selection: {
              selectedAt: selectedAt.toISOString(),
              selectedByUserId: requestedByUserId,
              targetField,
              publicMutation: false,
              applyStillRequiresConfirmation: true,
            },
          } satisfies Prisma.InputJsonObject,
        },
      });

      await tx.creativeStudioUsageEvent.create({
        data: {
          organizationId,
          jobId: asset.jobId,
          assetId: asset.id,
          requestedByUserId,
          action: "ASSET_SELECTED",
          provider: asset.job.provider,
          targetType: asset.job.targetType,
          targetId: asset.job.targetId,
          metadata: {
            targetField,
            publicMutation: false,
            p113Selection: true,
          },
        },
      });

      return selected;
    });

    await writeAuditLog({
      action: "UPDATE",
      entityType: "CreativeStudioAsset",
      entityId: asset.id,
      userId: requestedByUserId,
      organizationId,
      previousValue: { status: asset.status },
      newValue: {
        status: updated.status,
        targetField,
        publicMutation: false,
        applyStillRequiresConfirmation: true,
      },
    });

    return {
      asset: updated,
      selected: true,
      publicMutation: false,
      targetField,
    };
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
    if (asset.job.targetType === "ORGANIZATION_BRAND") {
      if (asset.status !== "SELECTED") {
        throw new ApiError(400, "Organization logo and cover assets must be selected before public apply");
      }
      const selectedTargetField = getSelectedTargetField(baseMetadata);
      if (selectedTargetField !== targetField) {
        throw new ApiError(400, "Selected organization brand target does not match the requested apply target");
      }
    }
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
            p116OrganizationBrandAcceptance: asset.job.targetType === "ORGANIZATION_BRAND",
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
      ...(asset.job.targetType === "ORGANIZATION_BRAND"
        ? {
            p116OrganizationBrandAcceptance: {
              selectedBeforeApply: true,
              targetField,
              publicMutation: true,
            },
          }
        : {}),
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
