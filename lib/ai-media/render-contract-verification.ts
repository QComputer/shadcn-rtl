import { createHash } from "node:crypto";

import { AI_MEDIA_PINNED_RENDER_CONTRACT } from "@/lib/ai-media/pinned-render-contract";

export type AiMediaRenderContractEvidence = {
  deployedUrl?: string;
  healthStatus: number | null;
  healthBody?: unknown;
  readyStatus: number | null;
  readyBody?: unknown;
  openApiStatus?: number | null;
  openApiJson?: unknown;
  expectedFingerprint?: string;
  expectedPathCount?: number;
  expectedSchemaCount?: number;
  expectedProvider?: string;
  strictCounts?: boolean;
};

export type AiMediaRenderContractSafeSummary = {
  deployedUrl: string;
  healthOk: boolean;
  readyOk: boolean;
  openApiOk: boolean;
  fingerprint: string | null;
  expectedFingerprint: string;
  pathCount: number;
  schemaCount: number;
  provider: string | null;
  databaseOk: boolean | null;
  cudaRequired: boolean | null;
  gpuWorkerOffline: boolean | null;
  realGenerationReady: boolean;
  p07Status: typeof AI_MEDIA_PINNED_RENDER_CONTRACT.p07Status;
};

export type AiMediaRenderContractVerificationResult = {
  ok: boolean;
  blockers: string[];
  warnings: string[];
  safeSummary: AiMediaRenderContractSafeSummary;
};

const MUTATION_METHODS = new Set(["post", "put", "patch", "delete"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringifyPythonOpenApiCanonical(value: unknown, key = ""): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "null";
    if ((key === "minimum" || key === "maximum") && Number.isInteger(value)) return `${value}.0`;
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyPythonOpenApiCanonical(item)).join(",")}]`;
  }
  if (!isRecord(value)) return "null";
  return `{${Object.entries(value)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([entryKey, nested]) => `${JSON.stringify(entryKey)}:${stringifyPythonOpenApiCanonical(nested, entryKey)}`)
    .join(",")}}`;
}

export function normalizeOpenApiForFingerprint(openApiJson: unknown): string {
  return stringifyPythonOpenApiCanonical(openApiJson);
}

export function computeOpenApiFingerprint(openApiJson: unknown): string {
  return createHash("sha256").update(normalizeOpenApiForFingerprint(openApiJson)).digest("hex");
}

function pathCount(openApiJson: unknown): number {
  const paths = isRecord(openApiJson) && isRecord(openApiJson.paths) ? openApiJson.paths : {};
  return Object.keys(paths).length;
}

function schemaCount(openApiJson: unknown): number {
  const components = isRecord(openApiJson) && isRecord(openApiJson.components) ? openApiJson.components : {};
  const schemas = isRecord(components.schemas) ? components.schemas : {};
  return Object.keys(schemas).length;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function getNestedRecord(input: unknown, ...keys: string[]): Record<string, unknown> {
  let current: unknown = input;
  for (const key of keys) {
    if (!isRecord(current)) return {};
    current = current[key];
  }
  return isRecord(current) ? current : {};
}

function extractReadyProvider(readyBody: unknown): string | null {
  if (!isRecord(readyBody)) return null;
  return getString(readyBody.provider)
    ?? getString(readyBody.active_provider)
    ?? getString(readyBody.activeProvider)
    ?? getString(getNestedRecord(readyBody, "provider").name)
    ?? getString(getNestedRecord(readyBody, "readiness").provider);
}

function extractDatabaseOk(readyBody: unknown): boolean | null {
  if (!isRecord(readyBody)) return null;
  const databaseString = getString(readyBody.database)?.toLowerCase();
  if (databaseString === "ok" || databaseString === "ready") return true;
  if (databaseString === "error" || databaseString === "failed" || databaseString === "unavailable") return false;
  return getBoolean(readyBody.database_ok)
    ?? getBoolean(readyBody.databaseOk)
    ?? getBoolean(getNestedRecord(readyBody, "database").ok)
    ?? getBoolean(getNestedRecord(readyBody, "checks", "database").ok);
}

function extractCudaRequired(readyBody: unknown): boolean | null {
  if (!isRecord(readyBody)) return null;
  return getBoolean(readyBody.cuda_required)
    ?? getBoolean(readyBody.cudaRequired)
    ?? getBoolean(getNestedRecord(readyBody, "gpu").cuda_required)
    ?? getBoolean(getNestedRecord(readyBody, "worker").cuda_required)
    ?? getBoolean(getNestedRecord(readyBody, "providerReadiness").cudaRequired)
    ?? getBoolean(getNestedRecord(readyBody, "provider_readiness").cuda_required);
}

function extractGpuWorkerOffline(readyBody: unknown): boolean | null {
  if (!isRecord(readyBody)) return null;
  const worker = getNestedRecord(readyBody, "worker");
  const gpu = getNestedRecord(readyBody, "gpu");
  const status = [
    getString(readyBody.gpu_worker_status),
    getString(readyBody.gpuWorkerStatus),
    getString(worker.status),
    getString(worker.gpu_status),
    getString(gpu.worker_status),
    getString(gpu.status),
  ].find(Boolean)?.toLowerCase();
  if (status) return ["offline", "unavailable", "disconnected"].includes(status);
  return getBoolean(readyBody.gpu_worker_offline) ?? getBoolean(readyBody.gpuWorkerOffline);
}

function hasRealGenerationReadyMarker(readyBody: unknown): boolean {
  if (!isRecord(readyBody)) return false;
  const realGenerationKeys = [
    readyBody.real_generation_ready,
    readyBody.realGenerationReady,
    readyBody.real_generation_enabled,
    readyBody.realGenerationEnabled,
    readyBody.generation_enabled,
    readyBody.generationEnabled,
  ];
  if (realGenerationKeys.some((value) => value === true)) return true;

  const mode = getString(readyBody.mode)?.toLowerCase() ?? "";
  const generationMode = getString(readyBody.generation_mode)?.toLowerCase() ?? getString(readyBody.generationMode)?.toLowerCase() ?? "";
  return mode === "real" || generationMode === "real";
}

function hasMutationOperation(openApiJson: unknown): boolean {
  const paths = isRecord(openApiJson) && isRecord(openApiJson.paths) ? openApiJson.paths : {};
  return Object.values(paths).some((pathValue) => {
    if (!isRecord(pathValue)) return false;
    return Object.keys(pathValue).some((method) => MUTATION_METHODS.has(method.toLowerCase()));
  });
}

export function verifyPinnedRenderContractEvidence(
  evidence: AiMediaRenderContractEvidence,
): AiMediaRenderContractVerificationResult {
  const expectedFingerprint = evidence.expectedFingerprint ?? AI_MEDIA_PINNED_RENDER_CONTRACT.openApiFingerprintSha256;
  const expectedPathCount = evidence.expectedPathCount ?? AI_MEDIA_PINNED_RENDER_CONTRACT.pathCount;
  const expectedSchemaCount = evidence.expectedSchemaCount ?? AI_MEDIA_PINNED_RENDER_CONTRACT.schemaCount;
  const expectedProvider = evidence.expectedProvider ?? AI_MEDIA_PINNED_RENDER_CONTRACT.expectedProvider;
  const strictCounts = evidence.strictCounts !== false;
  const blockers: string[] = [];
  const warnings: string[] = [];

  const openApiOk = isRecord(evidence.openApiJson);
  const fingerprint = openApiOk ? computeOpenApiFingerprint(evidence.openApiJson) : null;
  const actualPathCount = openApiOk ? pathCount(evidence.openApiJson) : 0;
  const actualSchemaCount = openApiOk ? schemaCount(evidence.openApiJson) : 0;
  const provider = extractReadyProvider(evidence.readyBody);
  const databaseOk = extractDatabaseOk(evidence.readyBody);
  const cudaRequired = extractCudaRequired(evidence.readyBody);
  const gpuWorkerOffline = extractGpuWorkerOffline(evidence.readyBody);
  const realGenerationReady = hasRealGenerationReadyMarker(evidence.readyBody);

  if (evidence.healthStatus !== 200) blockers.push(`Render /health returned ${evidence.healthStatus ?? "no status"}.`);
  if (evidence.readyStatus !== 200) blockers.push(`Render /ready returned ${evidence.readyStatus ?? "no status"}.`);
  if (evidence.openApiStatus !== undefined && evidence.openApiStatus !== 200) {
    blockers.push(`Render /openapi.json returned ${evidence.openApiStatus ?? "no status"}.`);
  }
  if (!openApiOk) blockers.push("Render /openapi.json did not return a JSON object.");
  if (fingerprint && fingerprint !== expectedFingerprint) {
    blockers.push(`OpenAPI fingerprint mismatch: expected ${expectedFingerprint}, got ${fingerprint}.`);
  }

  const pathMessage = `OpenAPI path count mismatch: expected ${expectedPathCount}, got ${actualPathCount}.`;
  const schemaMessage = `OpenAPI schema count mismatch: expected ${expectedSchemaCount}, got ${actualSchemaCount}.`;
  if (actualPathCount !== expectedPathCount) (strictCounts ? blockers : warnings).push(pathMessage);
  if (actualSchemaCount !== expectedSchemaCount) (strictCounts ? blockers : warnings).push(schemaMessage);
  if (provider !== expectedProvider) blockers.push(`Render provider mismatch: expected ${expectedProvider}, got ${provider ?? "unknown"}.`);
  if (cudaRequired === true) blockers.push("Render /ready reports CUDA as required; this phase expects MOCK-only readiness.");
  if (realGenerationReady) blockers.push("Render /ready reports real generation as ready/enabled.");
  if (hasMutationOperation(evidence.openApiJson)) warnings.push("OpenAPI includes mutation operations; this checker did not call them.");

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    safeSummary: {
      deployedUrl: evidence.deployedUrl ?? AI_MEDIA_PINNED_RENDER_CONTRACT.deployedServiceUrl,
      healthOk: evidence.healthStatus === 200,
      readyOk: evidence.readyStatus === 200,
      openApiOk,
      fingerprint,
      expectedFingerprint,
      pathCount: actualPathCount,
      schemaCount: actualSchemaCount,
      provider,
      databaseOk,
      cudaRequired,
      gpuWorkerOffline,
      realGenerationReady,
      p07Status: AI_MEDIA_PINNED_RENDER_CONTRACT.p07Status,
    },
  };
}
