import { prisma } from "@/lib/db";
import {
  AiMediaServiceError,
  type AiMediaCreateJobRequest,
  type AiMediaJob,
  createAiMediaJob,
  getAiMediaJob,
  cancelAiMediaJob,
} from "@/lib/services/ai-media-service-client";
import { ApiError } from "@/lib/api-guards";
import { supportedLocales } from "@/lib/i18n";
import type { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/types";
import { revalidatePath, revalidateTag } from "next/cache";
import { copyRemoteImageToBlob } from "@/lib/media-storage";
import { shouldUseVercelBlob } from "@/lib/blob-storage";
import type { AiMediaJobOutput } from "@/lib/services/ai-media-service-client";

type AiSelectedImageStorageStatus = "blob" | "remote-unconfigured" | "remote-fallback";

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

    const remoteRequest: AiMediaCreateJobRequest = {
      organization_id: product.organizationId,
      product_id: product.id,
      requested_by_user_id: requestedByUserId,
      product_title: product.name,
      category: product.category?.name || "unknown",
      description: product.description || undefined,
      seller_prompt: options.seller_prompt ?? null,
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

    let remoteResponse;
    try {
      remoteResponse = await createAiMediaJob(remoteRequest);
    } catch (error) {
      if (error instanceof AiMediaServiceError) {
        throw new ApiError(error.status, error.message);
      }
      throw new ApiError(502, "Failed to create AI media job");
    }

    const localJob = await prisma.aiMediaJob.create({
      data: {
        jobId: remoteResponse.job_id,
        organizationId: product.organizationId,
        productId: product.id,
        requestedByUserId,
        status: remoteResponse.status,
        provider: remoteResponse.provider,
        inputs: JSON.parse(JSON.stringify(remoteRequest)),
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
      select: { id: true, organizationId: true },
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
        select: { id: true, status: true, outputs: true },
      });
      if (!job) throw new ApiError(404, "AI media job not found");
      if (job.status !== "COMPLETED") {
        throw new ApiError(400, "Only completed AI media jobs can be selected");
      }
    } else {
      job = await prisma.aiMediaJob.findFirst({
        where: { organizationId, productId, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, outputs: true },
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

    let durableUrl = imageUrl;
    let storedDurably = false;
    let storageStatus: AiSelectedImageStorageStatus = "remote-unconfigured";

    if (shouldUseVercelBlob()) {
      try {
        const result = await copyRemoteImageToBlob(imageUrl, `ai-media-${productId}`);
        durableUrl = result.url;
        storedDurably = true;
        storageStatus = "blob";
      } catch (error) {
        console.error("[AiMediaService] Failed to copy remote image to blob, falling back to remote URL:", error);
        durableUrl = imageUrl;
        storedDurably = false;
        storageStatus = "remote-fallback";
      }
    } else {
      console.warn("[AiMediaService] BLOB_READ_WRITE_TOKEN is not configured; selected AI image will use the remote service URL.");
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: { image: durableUrl },
      select: { id: true, slug: true, organizationSlug: true },
    });

    revalidateAiSelectedProductImage(product.organizationSlug, product.slug || product.id);

    return { success: true, imageUrl: durableUrl, storedDurably, storageStatus };
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
