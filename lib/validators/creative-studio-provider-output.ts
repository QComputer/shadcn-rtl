import { createHash } from "node:crypto";

export type CreativeStudioProviderResultStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export type CreativeStudioProviderOutput = {
  providerAssetId?: string;
  assetType: "LOGO" | "COVER";
  url: string;
  mimeType?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  checksum?: string;
  promptUsed?: string;
  seed?: string | number;
  providerMetadata?: Record<string, unknown>;
};

export type CreativeStudioProviderResult = {
  providerJobId: string;
  status: CreativeStudioProviderResultStatus;
  outputs?: CreativeStudioProviderOutput[];
  error?: {
    code?: string;
    message?: string;
  };
  metadata?: Record<string, unknown>;
};

const PRIVATE_IPV4_PATTERNS = [/^10\./, /^127\./, /^0\./, /^192\.168\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[0-1])\./];
const SECRET_KEY_PATTERN = /(secret|token|password|key|credential|authorization)/i;
const MAX_METADATA_JSON_LENGTH = 8000;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

function isPrivateIpv4(hostname: string) {
  return PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(hostname));
}

function isPrivateHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    isPrivateIpv4(normalized)
  );
}

export function assertCreativeStudioProviderOutputUrl(url: string) {
  if (!url || typeof url !== "string") throw new Error("Provider output URL is required");
  if (/^file:\/\//i.test(url)) throw new Error("Provider output URL must not use file://");
  if (/^\/\//.test(url)) throw new Error("Provider output URL must not be protocol-relative");

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Provider output URL is invalid");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Provider output URL must be http(s)");
  }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("Provider output URL must be https in production");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Provider output URL must not include credentials");
  }
  if (isPrivateHostname(parsed.hostname)) {
    throw new Error("Provider output URL must not point to localhost or a private host");
  }

  return parsed.toString();
}

export function sanitizeCreativeStudioProviderMetadata(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeCreativeStudioProviderMetadata(item, depth + 1));
  if (typeof value !== "object") return null;

  const output: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
    output[key] = SECRET_KEY_PATTERN.test(key) ? "[redacted]" : sanitizeCreativeStudioProviderMetadata(nestedValue, depth + 1);
  }

  const json = JSON.stringify(output);
  if (json.length <= MAX_METADATA_JSON_LENGTH) return output;
  return {
    truncated: true,
    sha256: createHash("sha256").update(json).digest("hex"),
  };
}

export function stableCreativeStudioProviderOutputKey(input: {
  providerJobId: string;
  providerAssetId?: string | null;
  checksum?: string | null;
  url: string;
  assetType: "LOGO" | "COVER";
}) {
  return input.providerAssetId?.trim()
    || input.checksum?.trim()
    || createHash("sha256").update(`${input.providerJobId}:${input.assetType}:${input.url}`).digest("hex");
}

export function validateCreativeStudioProviderResult(value: unknown): CreativeStudioProviderResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Provider result must be an object");
  const input = value as Record<string, unknown>;
  const providerJobId = typeof input.providerJobId === "string" ? input.providerJobId.trim() : "";
  if (!providerJobId) throw new Error("Provider result is missing providerJobId");

  const status = input.status;
  if (!["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"].includes(status as string)) {
    throw new Error("Provider result status is unsupported");
  }

  const rawOutputs = Array.isArray(input.outputs) ? input.outputs : [];
  const outputs = rawOutputs.map((rawOutput, index) => {
    if (!rawOutput || typeof rawOutput !== "object" || Array.isArray(rawOutput)) {
      throw new Error(`Provider output ${index + 1} is invalid`);
    }
    const output = rawOutput as Record<string, unknown>;
    if (output.assetType !== "LOGO" && output.assetType !== "COVER") throw new Error("Provider output assetType is unsupported");
    const assetType: "LOGO" | "COVER" = output.assetType;
    const url = assertCreativeStudioProviderOutputUrl(String(output.url || ""));
    const mimeType = typeof output.mimeType === "string" ? output.mimeType.toLowerCase() : undefined;
    if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) throw new Error("Provider output MIME type is unsupported");

    return {
      providerAssetId: typeof output.providerAssetId === "string" ? output.providerAssetId.trim() : undefined,
      assetType,
      url,
      mimeType,
      width: typeof output.width === "number" && Number.isFinite(output.width) ? output.width : undefined,
      height: typeof output.height === "number" && Number.isFinite(output.height) ? output.height : undefined,
      sizeBytes: typeof output.sizeBytes === "number" && Number.isFinite(output.sizeBytes) ? output.sizeBytes : undefined,
      checksum: typeof output.checksum === "string" ? output.checksum.trim() : undefined,
      promptUsed: typeof output.promptUsed === "string" ? output.promptUsed : undefined,
      seed: typeof output.seed === "string" || typeof output.seed === "number" ? output.seed : undefined,
      providerMetadata: sanitizeCreativeStudioProviderMetadata(output.providerMetadata) as Record<string, unknown> | undefined,
    };
  });

  return {
    providerJobId,
    status: status as CreativeStudioProviderResultStatus,
    outputs,
    error: input.error && typeof input.error === "object" && !Array.isArray(input.error)
      ? sanitizeCreativeStudioProviderMetadata(input.error) as CreativeStudioProviderResult["error"]
      : undefined,
    metadata: sanitizeCreativeStudioProviderMetadata(input.metadata) as Record<string, unknown> | undefined,
  };
}
