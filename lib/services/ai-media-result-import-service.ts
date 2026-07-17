import "server-only";
import { createHash } from "node:crypto";

import { prisma } from "@/lib/db";
import { getAiMediaJob, type AiMediaJob, type AiMediaJobOutput } from "@/lib/services/ai-media-service-client";
import {
  appendAiMediaJobEvent,
} from "@/lib/services/ai-media-job-mirror-service";
import {
  storeCreativeStudioAsset,
  storeCreativeStudioAssetFromRemote,
  compensateFailedAssetImport,
} from "@/lib/storage/application-storage";
import {
  validateAiMediaProviderResult,
  type AiMediaProviderResultOutput,
} from "@/lib/ai-media/provider-result-validation";
import { planAiMediaResultImport } from "@/lib/ai-media/import-planning";
import type { AiMediaJobMirrorState } from "@/lib/ai-media/job-mirror";

type AiMediaDbClient = typeof prisma;

export class AiMediaImportError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function toProviderOutput(output: AiMediaJobOutput, index: number): AiMediaProviderResultOutput {
  return {
    id: output.url ? `${index}` : `${index}`,
    url: output.url,
    width: typeof output.width === "number" ? output.width : 0,
    height: typeof output.height === "number" ? output.height : 0,
    mimeType: output.mime_type || "application/octet-stream",
    variant: null,
    provider: null,
    model: null,
  };
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function resultFingerprintForJob(job: AiMediaJob, index: number) {
  return stableHash({
    jobId: job.job_id,
    status: job.status,
    outputIndex: index,
    outputUrl: job.outputs?.[index]?.url ?? null,
  });
}

type ImportRuntime = {
  getProviderResult: (providerJobId: string) => Promise<AiMediaJob>;
  storeRemote: (input: { organizationId: string; resultUrl: string; purpose: string; access?: "public" | "private" }) => Promise<{ key: string; checksumSha256: string; provider: string; mimeType: string; sizeBytes: number; width: number | null; height: number | null }>;
  storeBuffer: (input: { organizationId: string; buffer: Buffer; mimeType: string; purpose: string; access?: "public" | "private" }) => Promise<{ key: string; checksumSha256: string; provider: string; mimeType: string; sizeBytes: number; width: number | null; height: number | null }>;
};

function defaultRuntime(): ImportRuntime {
  return {
    async getProviderResult(providerJobId) {
      return getAiMediaJob(providerJobId);
    },
    async storeRemote(input) {
      const stored = await storeCreativeStudioAssetFromRemote(input);
      return {
        key: stored.key,
        checksumSha256: stored.checksumSha256,
        provider: stored.provider,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        width: stored.width,
        height: stored.height,
      };
    },
    async storeBuffer(input) {
      const validated = await import("@/lib/storage/image-validation").then((m) => m.validateApplicationImageBuffer(input.buffer, input.mimeType));
      const stored = await storeCreativeStudioAsset({
        organizationId: input.organizationId,
        buffer: input.buffer,
        mimeType: input.mimeType,
        purpose: input.purpose,
        access: input.access ?? "public",
      });
      return {
        key: stored.key,
        checksumSha256: stored.checksumSha256 || validated.checksumSha256,
        provider: stored.provider,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        width: stored.width,
        height: stored.height,
      };
    },
  };
}

export type ImportResultReadyInput = {
  organizationId: string;
  requestId: string;
  mirrorId: string;
  requestedByUserId: string;
  idempotencyKey: string;
  outputIndex?: number;
  purpose?: string;
  access?: "public" | "private";
  syntheticBuffer?: Buffer | null;
  runtime?: ImportRuntime;
};

export type ImportResult = {
  importId: string;
  assetId: string;
  storageKey: string;
  storageProvider: string;
  mimeType: string;
  checksumSha256: string;
  byteSize: number;
  state: AiMediaJobMirrorState;
  requestStatus: string;
  reused: boolean;
  safety: {
    blobWrite: boolean;
    renderMutation: boolean;
    realGeneration: boolean;
    walletSettlement: boolean;
    rawProviderUrlExposed: boolean;
  };
};

export async function importResultReadyOutput(
  input: ImportResultReadyInput,
  db: AiMediaDbClient = prisma,
): Promise<ImportResult> {
  const client = db as any;
  const runtime = input.runtime ?? defaultRuntime();
  const outputIndex = input.outputIndex ?? 0;
  const purpose = input.purpose ?? "ai-media-import";
  const access = input.access ?? "private";

  const mirror = await client.aiMediaJobMirror.findFirst({
    where: { id: input.mirrorId, organizationId: input.organizationId },
    include: { request: true },
  });
  if (!mirror) throw new AiMediaImportError(404, "MIRROR_NOT_FOUND", "AI media job mirror not found");

  const existingImport = await client.aiMediaImport.findUnique({
    where: { mirrorId_outputIndex: { mirrorId: input.mirrorId, outputIndex } },
    include: { acceptedAsset: true },
  });

  if (existingImport && existingImport.status === "IMPORTED" && existingImport.acceptedAssetId) {
    const asset = await client.aiMediaAsset.findUnique({ where: { id: existingImport.acceptedAssetId } });
    if (asset && (asset.storageKey || asset.storageKeyFingerprint)) {
      return buildImportResult(existingImport, asset, mirror, "IMPORTED", "SUBMITTED", true);
    }
  }

  if (mirror.state !== "RESULT_READY") {
    throw new AiMediaImportError(409, "NOT_RESULT_READY", "Import requires RESULT_READY mirror state");
  }

  const providerJobId = mirror.providerJobId;
  if (!providerJobId) {
    throw new AiMediaImportError(409, "PROVIDER_JOB_MISSING", "Mirror has no provider job id to import");
  }

  let job: AiMediaJob;
  try {
    job = await runtime.getProviderResult(providerJobId);
  } catch (error) {
    await markImportFailed(client, input, outputIndex, "PROVIDER_READ_FAILED", "Failed to read provider result");
    throw new AiMediaImportError(502, "PROVIDER_READ_FAILED", "Failed to read provider result");
  }

  const validation = validateAiMediaProviderResult({
    provider: job.provider || mirror.provider,
    providerJobId: job.job_id,
    mirrorProviderJobId: providerJobId,
    state: "RESULT_READY",
    jobType: "PRODUCT_IMAGE",
    canonicalStatus: job.canonical_status || "RESULT_READY",
    outputs: (job.outputs ?? []).map(toProviderOutput),
  }, { allowLocalTestOutputUrl: Boolean(input.syntheticBuffer) });

  if (!validation.valid || !validation.normalized) {
    await markImportFailed(client, input, outputIndex, "VALIDATION_FAILED", validation.blockers.join(", "));
    throw new AiMediaImportError(422, "VALIDATION_FAILED", `Provider result validation failed: ${validation.blockers.join(", ")}`);
  }

  const normalized = validation.normalized;
  const resultFingerprint = resultFingerprintForJob(job, normalized.outputIndex);

  let stored: Awaited<ReturnType<ImportRuntime["storeBuffer"]>>;
  let orphanCompensated = true;
  try {
    if (input.syntheticBuffer && input.syntheticBuffer.length > 0) {
      stored = await runtime.storeBuffer({
        organizationId: input.organizationId,
        buffer: input.syntheticBuffer,
        mimeType: normalized.mimeType,
        purpose,
        access,
      });
    } else {
      stored = await runtime.storeRemote({
        organizationId: input.organizationId,
        resultUrl: normalized.url,
        purpose,
        access,
      });
    }
  } catch (error) {
    await markImportFailed(client, input, outputIndex, "STORAGE_FAILED", "Failed to store imported asset");
    throw new AiMediaImportError(502, "STORAGE_FAILED", "Failed to store imported asset");
  }

  try {
    const importRecord = await client.aiMediaImport.upsert({
      where: { mirrorId_outputIndex: { mirrorId: input.mirrorId, outputIndex } },
      create: {
        organizationId: input.organizationId,
        requestId: input.requestId,
        mirrorId: input.mirrorId,
        status: "VALIDATING",
        outputIndex,
        resultFingerprint,
        validationRisk: validation.safeSummary.risk,
        validationErrors: validation.blockers,
      },
      update: { status: "VALIDATING", validationRisk: validation.safeSummary.risk, validationErrors: validation.blockers },
    });

    const storageKeyFingerprint = stableHash(stored.key);
    const asset = await client.aiMediaAsset.create({
      data: {
        organizationId: input.organizationId,
        requestId: input.requestId,
        mirrorId: input.mirrorId,
        importId: importRecord.id,
        requestedByUserId: input.requestedByUserId,
        visibilityScope: "OWNER_ONLY",
        mimeType: stored.mimeType,
        width: stored.width,
        height: stored.height,
        storageProvider: stored.provider,
        storageKeyFingerprint,
        checksumSha256: stored.checksumSha256,
        byteSize: stored.sizeBytes,
        safeMetadata: {
          phase: "BAZAR-BAZ-AI-MEDIA-APP-MANAGED-IMPORT-01",
          appOwned: true,
          provider: normalized.provider,
          providerJobId: normalized.providerJobId,
          outputId: normalized.outputId,
          blobWrite: false,
          realGeneration: false,
        },
      },
    });

    await client.aiMediaImport.update({
      where: { id: importRecord.id },
      data: {
        status: "IMPORTED",
        acceptedAssetId: asset.id,
        importedAt: new Date(),
        validationErrors: validation.blockers,
      },
    });

    await client.aiMediaJobMirror.updateMany({
      where: { id: input.mirrorId, organizationId: input.organizationId },
      data: { state: "IMPORTED", importedAt: new Date() },
    });

    await appendAiMediaJobEvent({
      organizationId: input.organizationId,
      requestId: input.requestId,
      mirrorId: input.mirrorId,
      actorUserId: input.requestedByUserId,
      action: "ASSET_ACCEPTED",
      state: "IMPORTED",
      dedupeKey: stableHash({
        scope: "ai-media-asset-accepted",
        mirrorId: input.mirrorId,
        outputIndex,
        assetId: asset.id,
      }),
      safeMetadata: {
        assetId: asset.id,
        storageKeyFingerprint,
        provider: normalized.provider,
        blobWrite: false,
        realGeneration: false,
        walletSettlement: false,
      },
    }, db);

    return buildImportResult(importRecord, asset, mirror, "IMPORTED", "SUBMITTED", false);
  } catch (error) {
    orphanCompensated = (await compensateFailedAssetImport({ organizationId: input.organizationId, key: stored.key })).compensated;
    await markImportFailed(client, input, outputIndex, "DB_PERSIST_FAILED", "Stored asset but failed to persist import record");
    throw new AiMediaImportError(500, "DB_PERSIST_FAILED", "Stored asset but failed to persist import record");
  }
}

function buildImportResult(
  importRecord: any,
  asset: any,
  mirror: any,
  state: AiMediaJobMirrorState,
  requestStatus: string,
  reused: boolean,
): ImportResult {
  return {
    importId: importRecord.id,
    assetId: asset.id,
    storageKey: asset.storageKey ?? asset.storageKeyFingerprint ?? "",
    storageProvider: asset.storageProvider ?? "APPLICATION_STORAGE",
    mimeType: asset.mimeType ?? "application/octet-stream",
    checksumSha256: asset.checksumSha256 ?? "",
    byteSize: asset.byteSize ?? 0,
    state,
    requestStatus,
    reused,
    safety: {
      blobWrite: false,
      renderMutation: false,
      realGeneration: false,
      walletSettlement: false,
      rawProviderUrlExposed: false,
    },
  };
}

async function markImportFailed(
  client: any,
  input: ImportResultReadyInput,
  outputIndex: number,
  code: string,
  message: string,
) {
  const mirror = await client.aiMediaJobMirror.findFirst({
    where: { id: input.mirrorId, organizationId: input.organizationId },
    select: { state: true, providerJobId: true },
  });
  const keepResultReady = mirror && mirror.state === "RESULT_READY";

  await client.aiMediaImport.upsert({
    where: { mirrorId_outputIndex: { mirrorId: input.mirrorId, outputIndex } },
    create: {
      organizationId: input.organizationId,
      requestId: input.requestId,
      mirrorId: input.mirrorId,
      status: "FAILED",
      outputIndex,
      errorCode: code,
      errorMessage: message,
      rolledBackAt: new Date(),
    },
    update: {
      status: "FAILED",
      errorCode: code,
      errorMessage: message,
      rolledBackAt: new Date(),
    },
  });

  if (keepResultReady) {
    await client.aiMediaJobMirror.updateMany({
      where: { id: input.mirrorId, organizationId: input.organizationId },
      data: { state: "RESULT_READY", errorCode: code, errorMessage: message },
    });
  } else {
    await client.aiMediaJobMirror.updateMany({
      where: { id: input.mirrorId, organizationId: input.organizationId },
      data: { state: "FAILED_FINAL", errorCode: code, errorMessage: message },
    });
  }
}
