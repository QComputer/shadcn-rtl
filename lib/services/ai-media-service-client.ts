import "server-only";

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

function getAiMediaConfig() {
  return {
    enabled: process.env.AI_MEDIA_SERVICE_ENABLED === "true",
    url: process.env.AI_MEDIA_SERVICE_URL?.replace(/\/$/, "") || null,
    internalKey: process.env.AI_MEDIA_SERVICE_INTERNAL_KEY || null,
    timeoutMs: Number.parseInt(process.env.AI_MEDIA_SERVICE_TIMEOUT_MS || "60000", 10),
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
    timeoutMs: Number.isFinite(config.timeoutMs) ? config.timeoutMs : 60000,
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
        "Content-Type": "application/json",
        "X-BazarBaz-AI-Key": config.internalKey,
        ...(init.headers || {}),
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
    const text = await response.text().catch(() => "Unknown error");
    throw new AiMediaServiceError(response.status, `AI media service returned ${response.status}: ${text}`);
  }

  return response.json();
}

export async function getAiMediaJob(jobId: string): Promise<AiMediaJob> {
  const config = assertConfigured();
  const response = await aiMediaFetch(`${config.url}/v1/product-image-suggestions/jobs/${encodeURIComponent(jobId)}`, {
    method: "GET",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
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
    const text = await response.text().catch(() => "Unknown error");
    throw new AiMediaServiceError(response.status, `AI media service returned ${response.status}: ${text}`);
  }

  return response.json();
}
