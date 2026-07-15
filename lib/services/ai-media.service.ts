import { prisma } from "@/lib/db";
import { createHash, randomUUID } from "node:crypto";
import {
  AiMediaServiceError,
  type AiMediaCreateJobRequest,
  type AiMediaJob,
  type AiMediaJobOutput,
  createAiMediaJob,
  getAiMediaJob,
  cancelAiMediaJob,
} from "@/lib/services/ai-media-service-client";
import { ApiError } from "@/lib/api-guards";
import { supportedLocales } from "@/lib/i18n";
import type { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/types";
import { revalidatePath, revalidateTag } from "next/cache";
import { getAiMediaPaidProviderStatus } from "@/lib/services/ai-media-paid-provider";
import {
  compensateFailedAssetImport,
  storeCreativeStudioAssetFromRemote,
} from "@/lib/storage/application-storage";

type AiSelectedImageStorageStatus = "application-storage";
type AiMediaUsageAction = "JOB_CREATED" | "JOB_COMPLETED" | "JOB_FAILED" | "JOB_CANCELED" | "IMAGE_SELECTED";

const DEFAULT_DAILY_AI_MEDIA_JOB_LIMIT = 25;
const DEFAULT_DAILY_AI_MEDIA_SELECTION_LIMIT = 50;

export type AiMediaLocalJob = {
  id: string;
  jobId: string;
  organizationId: string;
  productId: string;
  requestedByUserId: string;
  status: string;
  provider: string;
  errorMessage: string | null;
  inputs: Record<string, unknown> | null;
  outputs: AiMediaJobOutput[];
  createdAt: Date;
  updatedAt: Date;
};

export type AiMediaUsageSummary = {
  dateStart: Date;
  dailyJobLimit: number;
  dailySelectionLimit: number;
  jobCreateCount: number;
  imageSelectionCount: number;
  remainingDailyJobs: number;
  remainingDailySelections: number;
  paidGenerationEnabled: boolean;
  paidProvider: ReturnType<typeof getAiMediaPaidProviderStatus>;
  costTelemetry: {
    mode: "disabled" | "estimate";
    dailyEstimatedCostCents: number;
    monthlyEstimatedCostCents: number;
    dailyCostLimitCents: number | null;
    monthlyBudgetCents: number | null;
    remainingDailyCostCents: number | null;
    remainingMonthlyBudgetCents: number | null;
    rollbackPaused: boolean;
  };
  canCreateJob: boolean;
  events: Array<{
    id: string;
    action: string;
    jobId: string | null;
    productId: string | null;
    provider: string | null;
    status: string | null;
    units: number;
    createdAt: Date;
  }>;
};

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getAiMediaUsageQuota() {
  return {
    dailyJobLimit: parsePositiveInt(process.env.AI_MEDIA_DAILY_JOB_LIMIT, DEFAULT_DAILY_AI_MEDIA_JOB_LIMIT),
    dailySelectionLimit: parsePositiveInt(process.env.AI_MEDIA_DAILY_SELECTION_LIMIT, DEFAULT_DAILY_AI_MEDIA_SELECTION_LIMIT),
  };
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function estimatedCostFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return 0;
  const estimatedCostCents = (metadata as Record<string, unknown>).estimatedCostCents;
  return typeof estimatedCostCents === "number" && Number.isFinite(estimatedCostCents) && estimatedCostCents > 0
    ? estimatedCostCents
    : 0;
}

function getImportedProductAiMediaPrompt(sourceMetadata: unknown) {
  if (!sourceMetadata || typeof sourceMetadata !== "object" || Array.isArray(sourceMetadata)) return null;
  const aiMediaSuggestion = (sourceMetadata as Record<string, unknown>).aiMediaSuggestion;
  if (!aiMediaSuggestion || typeof aiMediaSuggestion !== "object" || Array.isArray(aiMediaSuggestion)) return null;
  const promptDefault = (aiMediaSuggestion as Record<string, unknown>).promptDefault;
  return typeof promptDefault === "string" && promptDefault.trim().length > 0 ? promptDefault : null;
}

function revalidateAiSelectedProductImage(organizationSlug: string, productSlugOrId: string) {
  try {
    for (const locale of supportedLocales) {
      revalidatePath(`/${locale}/shop/${organizationSlug}`);
      revalidatePath(`/${locale}/shop/${organizationSlug}/product/${productSlugOrId}`);
    }
    revalidateTag("home-page", "max");
  } catch {
    // revalidatePath requires a Next.js request context; ignore in tests
  }
}

function normalizeOutputs(job: AiMediaJob) {
  return job.outputs ?? job.output_images?.map((url) => ({ url })) ?? [];
}

function normalizeStoredOutputs(outputs: unknown): AiMediaJobOutput[] {
  if (!Array.isArray(outputs)) return [];
  return outputs
    .filter((output): output is Record<string, unknown> => Boolean(output) && typeof output === "object")
    .filter((output) => typeof output.url === "string")
    .map((output) => ({
      ...output,
      url: String(output.url),
    })) as AiMediaJobOutput[];
}

export function localAiMediaJobToRemoteJob(job: AiMediaLocalJob): AiMediaJob {
  return {
    job_id: job.jobId,
    status: job.status as AiMediaJob["status"],
    provider: job.provider,
    organization_id: job.organizationId,
    product_id: job.productId,
    requested_by_user_id: job.requestedByUserId,
    created_at: job.createdAt.toISOString(),
    updated_at: job.updatedAt.toISOString(),
    error_message: job.errorMessage ?? undefined,
    inputs: job.inputs ?? undefined,
    outputs: job.outputs,
  };
}

export class AiMediaService {
  private async recordUsageEvent(input: {
    organizationId: string;
    productId?: string | null;
    jobId?: string | null;
    requestedByUserId?: string | null;
    action: AiMediaUsageAction;
    provider?: string | null;
    status?: string | null;
    units?: number;
    metadata?: Record<string, unknown> | null;
    dedupeByJobAndAction?: boolean;
  }) {
    if (input.dedupeByJobAndAction && input.jobId) {
      const existing = await prisma.aiMediaUsageEvent.findFirst({
        where: {
          organizationId: input.organizationId,
          jobId: input.jobId,
          action: input.action,
        },
        select: { id: true },
      });

      if (existing) return existing;
    }

    return prisma.aiMediaUsageEvent.create({
      data: {
        organizationId: input.organizationId,
        productId: input.productId ?? null,
        jobId: input.jobId ?? null,
        requestedByUserId: input.requestedByUserId ?? null,
        action: input.action,
        provider: input.provider ?? null,
        status: input.status ?? null,
        units: input.units ?? 1,
        metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
      },
    });
  }

  private async getDailyUsageCounts(organizationId: string) {
    const dateStart = startOfUtcDay();
    const [jobCreateCount, imageSelectionCount] = await Promise.all([
      prisma.aiMediaUsageEvent.count({
        where: {
          organizationId,
          action: "JOB_CREATED",
          createdAt: { gte: dateStart },
        },
      }),
      prisma.aiMediaUsageEvent.count({
        where: {
          organizationId,
          action: "IMAGE_SELECTED",
          createdAt: { gte: dateStart },
        },
      }),
    ]);

    return { dateStart, jobCreateCount, imageSelectionCount };
  }

  private async getCostTelemetry(organizationId: string, paidProvider: ReturnType<typeof getAiMediaPaidProviderStatus>) {
    const [dailyEvents, monthlyEvents] = await Promise.all([
      prisma.aiMediaUsageEvent.findMany({
        where: {
          organizationId,
          action: "JOB_CREATED",
          createdAt: { gte: startOfUtcDay() },
        },
        select: { metadata: true },
      }),
      prisma.aiMediaUsageEvent.findMany({
        where: {
          organizationId,
          action: "JOB_CREATED",
          createdAt: { gte: startOfUtcMonth() },
        },
        select: { metadata: true },
      }),
    ]);
    const dailyEstimatedCostCents = dailyEvents.reduce((sum, event) => sum + estimatedCostFromMetadata(event.metadata), 0);
    const monthlyEstimatedCostCents = monthlyEvents.reduce((sum, event) => sum + estimatedCostFromMetadata(event.metadata), 0);

    return {
      mode: paidProvider.telemetryMode,
      dailyEstimatedCostCents,
      monthlyEstimatedCostCents,
      dailyCostLimitCents: paidProvider.dailyCostLimitCents,
      monthlyBudgetCents: paidProvider.monthlyBudgetCents,
      remainingDailyCostCents: paidProvider.dailyCostLimitCents === null
        ? null
        : Math.max(0, paidProvider.dailyCostLimitCents - dailyEstimatedCostCents),
      remainingMonthlyBudgetCents: paidProvider.monthlyBudgetCents === null
        ? null
        : Math.max(0, paidProvider.monthlyBudgetCents - monthlyEstimatedCostCents),
      rollbackPaused: paidProvider.rollback.paused,
    };
  }

  async getUsageSummary(organizationId: string): Promise<AiMediaUsageSummary> {
    const quota = getAiMediaUsageQuota();
    const counts = await this.getDailyUsageCounts(organizationId);
    const events = await prisma.aiMediaUsageEvent.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        action: true,
        jobId: true,
        productId: true,
        provider: true,
        status: true,
        units: true,
        createdAt: true,
      },
    });

    const paidProvider = getAiMediaPaidProviderStatus();
    const costTelemetry = await this.getCostTelemetry(organizationId, paidProvider);

    return {
      dateStart: counts.dateStart,
      dailyJobLimit: quota.dailyJobLimit,
      dailySelectionLimit: quota.dailySelectionLimit,
      jobCreateCount: counts.jobCreateCount,
      imageSelectionCount: counts.imageSelectionCount,
      remainingDailyJobs: Math.max(0, quota.dailyJobLimit - counts.jobCreateCount),
      remainingDailySelections: Math.max(0, quota.dailySelectionLimit - counts.imageSelectionCount),
      paidGenerationEnabled: paidProvider.enabled,
      paidProvider,
      costTelemetry,
      canCreateJob: counts.jobCreateCount < quota.dailyJobLimit,
      events,
    };
  }

  async assertCanCreateJob(organizationId: string) {
    const summary = await this.getUsageSummary(organizationId);
    if (!summary.canCreateJob) {
      throw new ApiError(429, "AI media daily generation quota exceeded");
    }
    if (summary.paidProvider.rollback.paused) {
      throw new ApiError(503, "AI media paid provider rollout is paused");
    }
    if (summary.paidProvider.enabled && summary.costTelemetry.remainingDailyCostCents !== null && summary.costTelemetry.remainingDailyCostCents <= 0) {
      throw new ApiError(429, "AI media daily cost limit exceeded");
    }
    if (summary.paidProvider.enabled && summary.costTelemetry.remainingMonthlyBudgetCents !== null && summary.costTelemetry.remainingMonthlyBudgetCents <= 0) {
      throw new ApiError(429, "AI media monthly budget exceeded");
    }
    return summary;
  }

  private async getImportedProductAiMediaContext(productId: string, organizationId: string) {
    const draft = await prisma.importedProductDraft.findFirst({
      where: {
        organizationId,
        importedProductId: productId,
        status: "IMPORTED",
      },
      orderBy: { importedAt: "desc" },
      select: {
        id: true,
        sourceUrl: true,
        sourceExternalId: true,
        sourceMetadata: true,
      },
    });

    if (!draft) return null;

    return {
      draftId: draft.id,
      sourceUrl: draft.sourceUrl,
      sourceExternalId: draft.sourceExternalId,
      promptDefault: getImportedProductAiMediaPrompt(draft.sourceMetadata),
    };
  }

  async createJob(
    productId: string,
    organizationId: string,
    requestedByUserId: string,
    userRole: UserRole,
    options: {
      count?: number;
      aspect_ratio?: string;
      style_preset?: string;
      seller_prompt?: string | null;
      idempotencyKey?: string | null;
    } = {},
  ): Promise<{ job: AiMediaJob; localJobId: string }> {
    if (!hasPermission(userRole, "product:update")) {
      throw new ApiError(403, "Forbidden");
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        organizationId: true,
        organizationSlug: true,
        category: { select: { id: true, name: true } },
        organization: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    if (product.organizationId !== organizationId) {
      throw new ApiError(403, "Forbidden");
    }

    await this.assertCanCreateJob(product.organizationId);
    const paidProvider = getAiMediaPaidProviderStatus();
    const importedAiMediaContext = await this.getImportedProductAiMediaContext(product.id, product.organizationId);
    const sellerPrompt = options.seller_prompt?.trim() || importedAiMediaContext?.promptDefault || null;

    const remoteRequest: AiMediaCreateJobRequest = {
      organization_id: product.organizationId,
      product_id: product.id,
      requested_by_user_id: requestedByUserId,
      product_title: product.name,
      category: product.category?.name || "unknown",
      description: product.description || undefined,
      seller_prompt: sellerPrompt,
      brand: {
        shop_name: product.organization?.name ?? null,
        logo_url: null,
        primary_color: null,
      },
      input_images: [],
      count: options.count ?? 3,
      aspect_ratio: options.aspect_ratio ?? "1:1",
      style_preset: options.style_preset ?? "LIGHT_MENU_PHOTO",
    };
    const idempotencyKey = options.idempotencyKey?.trim()
      || createHash("sha256")
        .update(JSON.stringify({
          phase: "BB-AI-MEDIA-P02-P03",
          organizationId: product.organizationId,
          productId: product.id,
          requestedByUserId,
          sellerPrompt,
          count: remoteRequest.count,
          aspect_ratio: remoteRequest.aspect_ratio,
          style_preset: remoteRequest.style_preset,
        }))
        .digest("hex");
    const correlationId = `bb-ai-${randomUUID()}`;
    remoteRequest.idempotency_key = idempotencyKey;
    remoteRequest.correlation_id = correlationId;

    const recentJobs = await prisma.aiMediaJob.findMany({
      where: {
        organizationId: product.organizationId,
        productId: product.id,
        requestedByUserId,
        status: { in: ["QUEUED", "PROCESSING"] },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    const duplicate = recentJobs.find((job) => {
      const inputs = job.inputs && typeof job.inputs === "object" && !Array.isArray(job.inputs)
        ? job.inputs as Record<string, unknown>
        : {};
      const p02 = inputs.p02ProductImageLifecycle && typeof inputs.p02ProductImageLifecycle === "object"
        ? inputs.p02ProductImageLifecycle as Record<string, unknown>
        : {};
      return p02.idempotencyKey === idempotencyKey;
    });

    if (duplicate) {
      return {
        job: localAiMediaJobToRemoteJob({
          id: duplicate.id,
          jobId: duplicate.jobId,
          organizationId: duplicate.organizationId,
          productId: duplicate.productId,
          requestedByUserId: duplicate.requestedByUserId,
          status: duplicate.status,
          provider: duplicate.provider,
          errorMessage: duplicate.errorMessage,
          inputs: (duplicate.inputs as Record<string, unknown>) ?? null,
          outputs: normalizeStoredOutputs(duplicate.outputs),
          createdAt: duplicate.createdAt,
          updatedAt: duplicate.updatedAt,
        }),
        localJobId: duplicate.id,
      };
    }

    const localJob = await prisma.aiMediaJob.create({
      data: {
        jobId: `local-${randomUUID()}`,
        organizationId: product.organizationId,
        productId: product.id,
        requestedByUserId,
        status: "QUEUED",
        provider: "AI_MEDIA_SERVICE",
        inputs: {
          ...JSON.parse(JSON.stringify(remoteRequest)),
          p02ProductImageLifecycle: {
            phase: "BB-AI-MEDIA-P02-P03",
            idempotencyKey,
            correlationId,
            localCreatedBeforeProviderSubmission: true,
            contract: "ai-media-product-image-suggestions-v1",
          },
        },
      },
    });

    let remoteResponse;
    try {
      remoteResponse = await createAiMediaJob(remoteRequest);
    } catch (error) {
      if (error instanceof AiMediaServiceError) {
        await prisma.aiMediaJob.update({
          where: { id: localJob.id },
          data: {
            status: "FAILED",
            errorMessage: error.code || "AI_MEDIA_PROVIDER_ERROR",
          },
        }).catch(() => null);
        await this.recordUsageEvent({
          organizationId: product.organizationId,
          productId: product.id,
          jobId: localJob.jobId,
          requestedByUserId,
          action: "JOB_FAILED",
          provider: "AI_MEDIA_SERVICE",
          status: "FAILED",
          metadata: {
            idempotencyKey,
            correlationId,
            retryable: [429, 502, 503, 504].includes(error.status),
            errorCode: error.code ?? "AI_MEDIA_PROVIDER_ERROR",
          },
          dedupeByJobAndAction: true,
        });
        throw new ApiError(error.status, "AI media service submission failed");
      }
      throw new ApiError(502, "Failed to create AI media job");
    }

    await prisma.aiMediaJob.update({
      where: { id: localJob.id },
      data: {
        jobId: remoteResponse.job_id,
        status: remoteResponse.status,
        provider: remoteResponse.provider,
        outputs: normalizeOutputs(remoteResponse) as unknown as object,
        inputs: {
          ...JSON.parse(JSON.stringify(remoteRequest)),
          p02ProductImageLifecycle: {
            phase: "BB-AI-MEDIA-P02-P03",
            idempotencyKey,
            correlationId,
            localAiMediaJobId: localJob.id,
            providerJobId: remoteResponse.job_id,
            localCreatedBeforeProviderSubmission: true,
            contract: "ai-media-product-image-suggestions-v1",
          },
        },
      },
    });

    await this.recordUsageEvent({
      organizationId: product.organizationId,
      productId: product.id,
      jobId: remoteResponse.job_id,
      requestedByUserId,
      action: "JOB_CREATED",
      provider: remoteResponse.provider,
      status: remoteResponse.status,
      metadata: {
        count: remoteRequest.count,
        aspect_ratio: remoteRequest.aspect_ratio,
        style_preset: remoteRequest.style_preset,
        idempotencyKey,
        correlationId,
        localCreatedBeforeProviderSubmission: true,
        estimatedCostCents: paidProvider.enabled ? paidProvider.estimatedJobCostCents : 0,
        costTelemetryMode: paidProvider.telemetryMode,
        paidProviderEnabled: paidProvider.enabled,
        rollbackPaused: paidProvider.rollback.paused,
        importedProductDraftId: importedAiMediaContext?.draftId ?? null,
        importedSourceUrl: importedAiMediaContext?.sourceUrl ?? null,
        importedSourceExternalId: importedAiMediaContext?.sourceExternalId ?? null,
        sellerPromptSource: options.seller_prompt?.trim() ? "seller" : importedAiMediaContext?.promptDefault ? "imported-product-draft" : "none",
      },
    });

    return {
      job: await this.getJobById(remoteResponse.job_id),
      localJobId: localJob.id,
    };
  }

  async getJobById(jobId: string): Promise<AiMediaJob> {
    const localJob = await prisma.aiMediaJob.findFirst({
      where: { jobId },
      select: { id: true, organizationId: true, productId: true, requestedByUserId: true },
    });

    if (!localJob) {
      throw new ApiError(404, "Job not found");
    }

    try {
      const remoteJob = await getAiMediaJob(jobId);
      await prisma.aiMediaJob.update({
        where: { id: localJob.id },
        data: {
          status: remoteJob.status,
          provider: remoteJob.provider,
          errorMessage: remoteJob.error_message ?? null,
          outputs: normalizeOutputs(remoteJob) as unknown as object,
        },
      });
      if (remoteJob.status === "COMPLETED" || remoteJob.status === "FAILED" || remoteJob.status === "CANCELED") {
        await this.recordUsageEvent({
          organizationId: localJob.organizationId,
          productId: localJob.productId,
          jobId,
          requestedByUserId: localJob.requestedByUserId,
          action: remoteJob.status === "COMPLETED" ? "JOB_COMPLETED" : remoteJob.status === "FAILED" ? "JOB_FAILED" : "JOB_CANCELED",
          provider: remoteJob.provider,
          status: remoteJob.status,
          units: 1,
          dedupeByJobAndAction: true,
        });
      }
      return remoteJob;
    } catch (error) {
      if (error instanceof AiMediaServiceError) {
        throw new ApiError(error.status, error.message);
      }
      throw new ApiError(502, "Failed to fetch AI media job");
    }
  }

  async getJobStatus(jobId: string): Promise<{
    job: AiMediaJob;
    local: AiMediaLocalJob;
    remoteUnavailable: boolean;
    remoteError?: string;
  }> {
    const localJob = await this.getLocalJob(jobId);
    if (!localJob) {
      throw new ApiError(404, "Job not found");
    }

    try {
      const remoteJob = await this.getJobById(jobId);
      const refreshedLocalJob = await this.getLocalJob(jobId);
      return {
        job: remoteJob,
        local: refreshedLocalJob ?? localJob,
        remoteUnavailable: false,
      };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        throw error;
      }

      return {
        job: localAiMediaJobToRemoteJob(localJob),
        local: localJob,
        remoteUnavailable: true,
        remoteError: error instanceof Error ? error.message : "AI media service is temporarily unavailable",
      };
    }
  }

  async getLocalJob(jobId: string): Promise<AiMediaLocalJob | null> {
    const job = await prisma.aiMediaJob.findFirst({
      where: { jobId },
      select: {
        id: true,
        jobId: true,
        organizationId: true,
        productId: true,
        requestedByUserId: true,
        status: true,
        provider: true,
        errorMessage: true,
        inputs: true,
        outputs: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!job) return null;

    return {
      ...job,
      inputs: (job.inputs as Record<string, unknown>) ?? null,
      outputs: normalizeStoredOutputs(job.outputs),
    };
  }

  async getLatestProductJob(productId: string, organizationId: string): Promise<AiMediaLocalJob | null> {
    const job = await prisma.aiMediaJob.findFirst({
      where: { productId, organizationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        jobId: true,
        organizationId: true,
        productId: true,
        requestedByUserId: true,
        status: true,
        provider: true,
        errorMessage: true,
        inputs: true,
        outputs: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!job) return null;

    return {
      ...job,
      inputs: (job.inputs as Record<string, unknown>) ?? null,
      outputs: normalizeStoredOutputs(job.outputs),
    };
  }

  async selectImage(
    organizationId: string,
    productId: string,
    jobId: string | undefined,
    imageUrl: string,
    outputIndex: number,
  ): Promise<{
    success: boolean;
    imageUrl: string;
    storedDurably: boolean;
    storageStatus: AiSelectedImageStorageStatus;
  }> {
    let job;

    if (jobId) {
      job = await prisma.aiMediaJob.findFirst({
        where: { jobId, organizationId, productId },
        select: { id: true, status: true, provider: true, outputs: true },
      });
      if (!job) throw new ApiError(404, "AI media job not found");
      if (job.status !== "COMPLETED") {
        throw new ApiError(400, "Only completed AI media jobs can be selected");
      }
    } else {
      job = await prisma.aiMediaJob.findFirst({
        where: { organizationId, productId, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        select: { id: true, jobId: true, status: true, provider: true, outputs: true },
      });
      if (!job) throw new ApiError(404, "No completed AI media job found for this product");
    }

    const outputs = Array.isArray(job.outputs) ? job.outputs : [];
    if (outputIndex < 0 || outputIndex >= outputs.length) {
      throw new ApiError(400, "Invalid output index");
    }

    const selected = outputs[outputIndex] as Record<string, unknown> | null;
    const selectedUrl = selected && typeof selected === "object" && "url" in selected
      ? String(selected.url)
      : null;

    if (!selectedUrl || selectedUrl !== imageUrl) {
      throw new ApiError(400, "Selected image must match a generated output from this job");
    }

    const stored = await storeCreativeStudioAssetFromRemote({
      organizationId,
      resultUrl: imageUrl,
      purpose: `ai-media-product-${productId}`,
      access: "public",
    });
    const durableUrl = stored.url;
    const storageStatus: AiSelectedImageStorageStatus = "application-storage";

    let product;
    try {
      product = await prisma.product.update({
        where: { id: productId },
        data: { image: durableUrl },
        select: { id: true, slug: true, organizationSlug: true },
      });
    } catch (error) {
      await compensateFailedAssetImport({ organizationId, key: stored.key });
      throw error;
    }

    await this.recordUsageEvent({
      organizationId,
      productId,
      jobId: jobId ?? ("jobId" in job ? job.jobId : null),
      action: "IMAGE_SELECTED",
      provider: job.provider,
      status: storageStatus,
      metadata: {
        outputIndex,
        storedDurably: true,
        storageStatus,
        storageProvider: stored.provider,
        storageKey: stored.key,
        checksumSha256: stored.checksumSha256,
        byteSize: stored.sizeBytes,
      },
    });

    revalidateAiSelectedProductImage(product.organizationSlug, product.slug || product.id);

    return { success: true, imageUrl: durableUrl, storedDurably: true, storageStatus };
  }

  async cancelJob(jobId: string, organizationId: string): Promise<AiMediaJob> {
    const localJob = await prisma.aiMediaJob.findFirst({
      where: { jobId },
    });

    if (!localJob) {
      throw new ApiError(404, "Job not found");
    }

    if (localJob.organizationId !== organizationId) {
      throw new ApiError(403, "Forbidden");
    }

    if (!["QUEUED", "PROCESSING"].includes(localJob.status)) {
      throw new ApiError(400, "Only queued or processing AI media jobs can be canceled");
    }

    try {
      const result = await cancelAiMediaJob(jobId);
      await prisma.aiMediaJob.update({
        where: { id: localJob.id },
        data: { status: "CANCELED" },
      });
      await this.recordUsageEvent({
        organizationId: localJob.organizationId,
        productId: localJob.productId,
        jobId,
        requestedByUserId: localJob.requestedByUserId,
        action: "JOB_CANCELED",
        provider: localJob.provider,
        status: "CANCELED",
        dedupeByJobAndAction: true,
      });
      return result.job;
    } catch (error) {
      if (error instanceof AiMediaServiceError) {
        throw new ApiError(error.status, error.message);
      }
      throw new ApiError(502, "Failed to cancel AI media job");
    }
  }
}

export const aiMediaService = new AiMediaService();
