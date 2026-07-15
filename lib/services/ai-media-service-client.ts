import "server-only";
import {
  validateCreativeStudioProviderResult,
  type CreativeStudioProviderResult,
} from "@/lib/validators/creative-studio-provider-output";

export type AiMediaProvider = "MOCK" | "OPENAI" | "STABILITY" | string;

export interface AiMediaBrand {
  shop_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
}

export interface AiMediaCreateJobRequest {
  organization_id: string;
  product_id: string;
  requested_by_user_id: string;
  product_title: string;
  category: string;
  description?: string | null;
  seller_prompt?: string | null;
  brand?: AiMediaBrand | null;
  input_images?: string[];
  count?: number;
  aspect_ratio?: string;
  style_preset?: string;
}

export interface AiMediaOrganizationBrandJobRequest {
  requestType: "ORGANIZATION_BRAND";
  organizationId: string;
  requestedByUserId: string;
  target: {
    type: "ORGANIZATION_BRAND";
    assetType: "LOGO" | "COVER";
  };
  locale: "fa" | "en" | "ar";
  prompt?: string | null;
  brandContext: {
    organizationName: string;
    organizationSlug: string;
    businessType: string;
    locale: "fa" | "en" | "ar";
  };
  mode: "DRAFT_ONLY";
  count?: number;
  aspect_ratio?: string;
  style_preset?: string;
  metadata: {
    source: "bazar-baz";
    phase: "P118";
    publicAutoApply: false;
    [key: string]: unknown;
  };
}

export interface AiMediaJobOutput {
  url: string;
  mime_type?: string;
  width?: number;
  height?: number;
  prompt_used?: string;
  seed?: number;
}

export interface AiMediaJob {
  job_id: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELED";
  provider: AiMediaProvider;
  organization_id: string;
  product_id: string;
  requested_by_user_id: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  canceled_at?: string;
  error_message?: string;
  inputs?: Record<string, unknown>;
  outputs?: AiMediaJobOutput[];
  output_images?: string[];
}

export interface AiMediaCreateJobResponse {
  job_id: string;
  status: string;
  provider: string;
  outputs?: AiMediaJobOutput[];
  output_images?: string[];
}

export class AiMediaServiceError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type AiMediaServiceConfigStatus = {
  enabled: boolean;
  configured: boolean;
  ready: boolean;
  urlConfigured: boolean;
  internalKeyConfigured: boolean;
  timeoutMs: number;
};

export type AiMediaReadinessCheck = {
  endpoint: "/health" | "/ready";
  ok: boolean;
  status: number | null;
  code?: string;
};

export type AiMediaServiceReadiness = {
  ok: boolean;
  checked: boolean;
  config: AiMediaServiceConfigStatus;
  checks: AiMediaReadinessCheck[];
};

export type AiMediaContractOperationSummary = {
  method: string;
  operationId: string | null;
  requestContentTypes: string[];
  requestSchemaRefs: string[];
  responseStatuses: string[];
  responseSchemaRefs: string[];
};

export type AiMediaContractPathSummary = {
  path: string;
  operations: AiMediaContractOperationSummary[];
};

export type AiMediaServiceContractSummary = {
  inspected: true;
  openapi: string | null;
  title: string | null;
  version: string | null;
  paths: AiMediaContractPathSummary[];
  securitySchemes: string[];
  schemas: string[];
};

function hasValue(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function isHttpUrl(value: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeTimeoutMs(value: string | undefined) {
  const timeoutMs = Number.parseInt(value || "60000", 10);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60000;
}

function getAiMediaConfig() {
  const serviceUrl = process.env.AI_MEDIA_SERVICE_BASE_URL || process.env.AI_MEDIA_SERVICE_URL;
  return {
    enabled: process.env.AI_MEDIA_SERVICE_ENABLED === "true",
    url: serviceUrl?.replace(/\/$/, "") || null,
    internalKey: process.env.AI_MEDIA_SERVICE_INTERNAL_KEY || null,
    timeoutMs: normalizeTimeoutMs(process.env.AI_MEDIA_SERVICE_TIMEOUT_MS),
  };
}

export function getAiMediaServiceConfigStatus(): AiMediaServiceConfigStatus {
  const config = getAiMediaConfig();
  const urlConfigured = isHttpUrl(config.url);
  const internalKeyConfigured = hasValue(config.internalKey);
  const configured = urlConfigured && internalKeyConfigured;

  return {
    enabled: config.enabled,
    configured,
    ready: config.enabled && configured,
    urlConfigured,
    internalKeyConfigured,
    timeoutMs: config.timeoutMs,
  };
}

function assertConfigured(): { enabled: true; url: string; internalKey: string; timeoutMs: number } {
  const config = getAiMediaConfig();

  if (!config.enabled) {
    throw new AiMediaServiceError(503, "AI media service is disabled");
  }
  if (!config.url) {
    throw new AiMediaServiceError(503, "AI media service URL is not configured");
  }
  if (!config.internalKey) {
    throw new AiMediaServiceError(503, "AI media service internal key is not configured");
  }

  return {
    enabled: true,
    url: config.url,
    internalKey: config.internalKey,
    timeoutMs: config.timeoutMs,
  };
}

async function aiMediaFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const config = assertConfigured();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      headers: {
        ...(init.headers || {}),
        "Content-Type": "application/json",
        "X-BazarBaz-AI-Key": config.internalKey,
      },
      signal: controller.signal,
    });

    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiMediaServiceError(504, "AI media service request timed out", "TIMEOUT");
    }
    throw new AiMediaServiceError(502, "Failed to reach AI media service", "NETWORK_ERROR");
  } finally {
    clearTimeout(timeoutId);
  }
}

async function sanitizedErrorText(response: Response) {
  const text = await response.text().catch(() => "Unknown error");
  return text
    .replace(/(x-bazarbaz-ai-key|internal[_-]?key|api[_-]?key|token|secret|password)["':=\s]+[^"',\s}]+/gi, "$1=[redacted]")
    .slice(0, 300);
}

function collectSchemaRefs(value: unknown, refs = new Set<string>(), depth = 0) {
  if (!value || depth > 8) return refs;
  if (Array.isArray(value)) {
    value.forEach((item) => collectSchemaRefs(item, refs, depth + 1));
    return refs;
  }
  if (typeof value !== "object") return refs;

  const record = value as Record<string, unknown>;
  const ref = record.$ref;
  if (typeof ref === "string" && ref.startsWith("#/components/schemas/")) {
    refs.add(ref.replace("#/components/schemas/", ""));
  }

  Object.values(record).forEach((nested) => collectSchemaRefs(nested, refs, depth + 1));
  return refs;
}

function summarizeOpenApiContract(raw: unknown): AiMediaServiceContractSummary {
  const input = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const info = input.info && typeof input.info === "object" ? input.info as Record<string, unknown> : {};
  const components = input.components && typeof input.components === "object"
    ? input.components as Record<string, unknown>
    : {};
  const paths = input.paths && typeof input.paths === "object" ? input.paths as Record<string, unknown> : {};
  const schemas = components.schemas && typeof components.schemas === "object"
    ? Object.keys(components.schemas as Record<string, unknown>).sort()
    : [];
  const securitySchemes = components.securitySchemes && typeof components.securitySchemes === "object"
    ? Object.keys(components.securitySchemes as Record<string, unknown>).sort()
    : [];

  const pathSummaries = Object.entries(paths)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, pathValue]) => {
      const pathRecord = pathValue && typeof pathValue === "object" ? pathValue as Record<string, unknown> : {};
      const operations = Object.entries(pathRecord)
        .filter(([method, operation]) => /^(get|post|put|patch|delete)$/i.test(method) && operation && typeof operation === "object")
        .map(([method, operation]) => {
          const operationRecord = operation as Record<string, unknown>;
          const requestBody = operationRecord.requestBody && typeof operationRecord.requestBody === "object"
            ? operationRecord.requestBody as Record<string, unknown>
            : {};
          const requestContent = requestBody.content && typeof requestBody.content === "object"
            ? requestBody.content as Record<string, unknown>
            : {};
          const responses = operationRecord.responses && typeof operationRecord.responses === "object"
            ? operationRecord.responses as Record<string, unknown>
            : {};

          return {
            method: method.toUpperCase(),
            operationId: typeof operationRecord.operationId === "string" ? operationRecord.operationId : null,
            requestContentTypes: Object.keys(requestContent).sort(),
            requestSchemaRefs: Array.from(collectSchemaRefs(requestContent)).sort(),
            responseStatuses: Object.keys(responses).sort(),
            responseSchemaRefs: Array.from(collectSchemaRefs(responses)).sort(),
          } satisfies AiMediaContractOperationSummary;
        })
        .sort((a, b) => a.method.localeCompare(b.method));

      return { path, operations };
    });

  return {
    inspected: true,
    openapi: typeof input.openapi === "string" ? input.openapi : null,
    title: typeof info.title === "string" ? info.title : null,
    version: typeof info.version === "string" ? info.version : null,
    paths: pathSummaries,
    securitySchemes,
    schemas,
  };
}

export async function getAiMediaServiceContractSummary(): Promise<AiMediaServiceContractSummary> {
  const config = assertConfigured();
  const response = await aiMediaFetch(`${config.url}/openapi.json`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new AiMediaServiceError(response.status, "AI media service contract is unavailable");
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new AiMediaServiceError(502, "AI media service contract is not JSON", "INVALID_CONTRACT_CONTENT_TYPE");
  }

  const raw = await response.json();
  return summarizeOpenApiContract(raw);
}

async function probeAiMediaEndpoint(endpoint: "/health" | "/ready", expectedText: string): Promise<AiMediaReadinessCheck> {
  try {
    const config = assertConfigured();
    const response = await aiMediaFetch(`${config.url}${endpoint}`, { method: "GET" });
    const text = await response.text().catch(() => "");
    return {
      endpoint,
      ok: response.ok && text.trim().toLowerCase().includes(expectedText),
      status: response.status,
    };
  } catch (error) {
    if (error instanceof AiMediaServiceError) {
      return {
        endpoint,
        ok: false,
        status: error.status,
        code: error.code || "AI_MEDIA_SERVICE_ERROR",
      };
    }
    return {
      endpoint,
      ok: false,
      status: null,
      code: "UNKNOWN_ERROR",
    };
  }
}

export async function checkAiMediaServiceReadiness(): Promise<AiMediaServiceReadiness> {
  const config = getAiMediaServiceConfigStatus();
  if (!config.ready) {
    return {
      ok: false,
      checked: false,
      config,
      checks: [],
    };
  }

  const checks = await Promise.all([
    probeAiMediaEndpoint("/health", "ok"),
    probeAiMediaEndpoint("/ready", "ready"),
  ]);

  return {
    ok: checks.every((check) => check.ok),
    checked: true,
    config,
    checks,
  };
}

export async function createAiMediaJob(request: AiMediaCreateJobRequest): Promise<AiMediaCreateJobResponse> {
  const config = assertConfigured();
  const response = await aiMediaFetch(`${config.url}/v1/product-image-suggestions/jobs`, {
    method: "POST",
    body: JSON.stringify({
      ...request,
      count: request.count ?? 3,
      aspect_ratio: request.aspect_ratio ?? "1:1",
      style_preset: request.style_preset ?? "LIGHT_MENU_PHOTO",
      input_images: request.input_images ?? [],
      brand: request.brand ?? {
        shop_name: null,
        logo_url: null,
        primary_color: null,
      },
    }),
  });

  if (!response.ok) {
    const text = await sanitizedErrorText(response);
    throw new AiMediaServiceError(response.status, `AI media service returned ${response.status}: ${text}`);
  }

  return response.json();
}

export async function createOrganizationBrandGenerationJob(request: AiMediaOrganizationBrandJobRequest): Promise<AiMediaCreateJobResponse> {
  const config = assertConfigured();
  const response = await aiMediaFetch(`${config.url}/v1/organization-brand/jobs`, {
    method: "POST",
    body: JSON.stringify({
      ...request,
      count: request.count ?? 1,
      aspect_ratio: request.aspect_ratio ?? (request.target.assetType === "LOGO" ? "1:1" : "16:9"),
      style_preset: request.style_preset ?? "BRAND_CLEAN",
      metadata: {
        ...request.metadata,
        publicAutoApply: false,
      },
    }),
  });

  if (!response.ok) {
    const text = await sanitizedErrorText(response);
    throw new AiMediaServiceError(response.status, `AI media service returned ${response.status}: ${text}`);
  }

  return response.json();
}

export async function getOrganizationBrandGenerationJob(jobId: string): Promise<AiMediaJob> {
  const config = assertConfigured();
  const response = await aiMediaFetch(`${config.url}/v1/organization-brand/jobs/${encodeURIComponent(jobId)}`, {
    method: "GET",
  });

  if (!response.ok) {
    const text = await sanitizedErrorText(response);
    throw new AiMediaServiceError(response.status, `AI media service returned ${response.status}: ${text}`);
  }

  return response.json();
}

function mapOrganizationBrandJobToProviderResult(job: AiMediaJob): CreativeStudioProviderResult {
  const status = job.status === "COMPLETED"
    ? "SUCCEEDED"
    : job.status === "FAILED"
      ? "FAILED"
      : job.status === "CANCELED"
        ? "CANCELLED"
        : job.status === "PROCESSING"
          ? "RUNNING"
          : "PENDING";

  return validateCreativeStudioProviderResult({
    providerJobId: job.job_id,
    status,
    outputs: normalizeAiMediaJobOutputs(job).map((output) => ({
      assetType: job.inputs?.assetType === "COVER" || job.inputs?.asset_type === "COVER" ? "COVER" : "LOGO",
      url: output.url,
      mimeType: output.mime_type,
      width: output.width,
      height: output.height,
      promptUsed: output.prompt_used,
      seed: output.seed,
    })),
    error: job.error_message ? { message: job.error_message } : undefined,
    metadata: {
      provider: job.provider,
      source: "ai-media-service",
    },
  });
}

function normalizeAiMediaJobOutputs(job: { outputs?: AiMediaJobOutput[] | null; output_images?: string[] | null }): AiMediaJobOutput[] {
  if (Array.isArray(job.outputs) && job.outputs.length > 0) {
    return job.outputs.filter((output) => output && typeof output.url === "string");
  }
  if (Array.isArray(job.output_images)) {
    return job.output_images.filter((url): url is string => typeof url === "string").map((url) => ({ url }));
  }
  return [];
}

export async function getOrganizationBrandGenerationResult(providerJobId: string): Promise<CreativeStudioProviderResult> {
  if (!providerJobId?.trim()) {
    throw new AiMediaServiceError(400, "Provider job id is required");
  }

  const resultsEnabled = process.env.CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_RESULTS_ENABLED === "true";
  const dryRun = process.env.CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_RESULT_DRY_RUN !== "false";
  if (!resultsEnabled) {
    return validateCreativeStudioProviderResult({
      providerJobId,
      status: dryRun ? "PENDING" : "PENDING",
      outputs: [],
      metadata: {
        resultsEnabled: false,
        dryRun,
        publicAutoApply: false,
      },
    });
  }

  if (dryRun) {
    return validateCreativeStudioProviderResult({
      providerJobId,
      status: "SUCCEEDED",
      outputs: [],
      metadata: {
        dryRun: true,
        resultsEnabled: true,
        publicAutoApply: false,
      },
    });
  }

  const config = assertConfigured();
  const response = await aiMediaFetch(`${config.url}/v1/organization-brand/jobs/${encodeURIComponent(providerJobId)}/result`, {
    method: "GET",
  });

  if (!response.ok) {
    const text = await sanitizedErrorText(response);
    throw new AiMediaServiceError(response.status, `AI media service returned ${response.status}: ${text}`);
  }

  const raw = await response.json();
  if (raw?.providerJobId) return validateCreativeStudioProviderResult(raw);
  if (raw?.job) return mapOrganizationBrandJobToProviderResult(raw.job as AiMediaJob);
  return validateCreativeStudioProviderResult(raw);
}

export async function getAiMediaJob(jobId: string): Promise<AiMediaJob> {
  const config = assertConfigured();
  const response = await aiMediaFetch(`${config.url}/v1/product-image-suggestions/jobs/${encodeURIComponent(jobId)}`, {
    method: "GET",
  });

  if (!response.ok) {
    const text = await sanitizedErrorText(response);
    throw new AiMediaServiceError(response.status, `AI media service returned ${response.status}: ${text}`);
  }

  return response.json();
}

export async function cancelAiMediaJob(jobId: string): Promise<{ job: AiMediaJob }> {
  const config = assertConfigured();
  const response = await aiMediaFetch(`${config.url}/v1/product-image-suggestions/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: "POST",
  });

  if (!response.ok) {
    const text = await sanitizedErrorText(response);
    throw new AiMediaServiceError(response.status, `AI media service returned ${response.status}: ${text}`);
  }

  return response.json();
}
