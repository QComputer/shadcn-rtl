export type AiMediaEnvIsolationEnvironment = "production" | "preview" | "development" | "test" | "unknown";

export type AiMediaEnvIsolationResult = {
  ok: boolean;
  environment: AiMediaEnvIsolationEnvironment;
  warnings: string[];
  blockers: string[];
  safeSummary: {
    hasDatabaseUrl: boolean;
    hasBlobToken: boolean;
    hasAiMediaServiceUrl: boolean;
    hasAiMediaServiceInternalKey: boolean;
    hasPublicAiMediaSecret: boolean;
    databaseUrlRedacted: string;
    blobTokenRedacted: string;
    aiMediaServiceUrlRedacted: string;
    aiMediaServiceInternalKeyRedacted: string;
    previewAndProdDatabaseMatch: boolean;
    previewAndProdStorageMatch: boolean;
    previewAndProdAiServiceMatch: boolean;
  };
};

type EnvLike = Record<string, string | undefined>;

const SECRET_PATTERNS = [
  /AI_MEDIA_SERVICE_INTERNAL_KEY/,
  /AI_MEDIA_SERVICE_URL/,
  /AI_MEDIA_SERVICE_BASE_URL/,
  /CREATIVE_STUDIO_ORGANIZATION_BRAND_INTERNAL_KEY/,
  /CREATIVE_STUDIO_PROVIDER_RESULTS_INTERNAL_KEY/,
  /BLOB_READ_WRITE_TOKEN/,
  /DATABASE_URL/,
  /DIRECT_URL/,
  /NEXTAUTH_SECRET/,
  /VAPID_PRIVATE_KEY/,
  /SMS_IR_API_KEY/,
  /VERCEL_ACCESS_TOKEN/,
  /VERCEL_API_TOKEN/,
];

function classifyEnvironment(env: EnvLike): AiMediaEnvIsolationEnvironment {
  const vercelEnv = (env.VERCEL_ENV || "").toLowerCase();
  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "preview";
  const nodeEnv = (env.NODE_ENV || "").toLowerCase();
  if (nodeEnv === "production") return "production";
  if (nodeEnv === "test") return "test";
  if (nodeEnv === "development" || nodeEnv === "dev") return "development";
  return "unknown";
}

function redactValue(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length <= 8) return "[redacted]";
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function redactUrl(value: string | undefined): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    return `${url.protocol}//[redacted]`;
  } catch {
    return "[redacted]";
  }
}

function classifyDatabaseUrl(value: string | undefined): "local" | "neon" | "unknown" | "empty" {
  if (!value || !value.trim()) return "empty";
  const lower = value.toLowerCase();
  if (/localhost|127\.0\.0\.1|::1/.test(lower)) return "local";
  if (/neon/.test(lower)) return "neon";
  return "unknown";
}

function classifyStorage(value: string | undefined): "local-test" | "vercel" | "unknown" | "empty" {
  if (!value || !value.trim()) return "empty";
  if (/vercel|blob\.vercel\.com/.test(value)) return "vercel";
  if (/local-test|localhost|127\.0\.0\.1/.test(value)) return "local-test";
  return "unknown";
}

function normalizeUrl(value: string | undefined): string {
  if (!value) return "";
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    return value.trim().toLowerCase();
  }
}

function hasPublicSecretEnv(env: EnvLike): boolean {
  return Object.keys(env).some((key) => {
    const upper = key.toUpperCase();
    return upper.startsWith("NEXT_PUBLIC_") && SECRET_PATTERNS.some((pattern) => pattern.test(upper));
  });
}

export function getAiMediaEnvironmentSummary(env: EnvLike): AiMediaEnvIsolationResult {
  const environment = classifyEnvironment(env);
  const warnings: string[] = [];
  const blockers: string[] = [];

  const databaseUrl = env.DATABASE_URL || env.DIRECT_URL || env.DATABASE_URL_UNPOOLED || "";
  const blobToken = env.BLOB_READ_WRITE_TOKEN || "";
  const aiMediaServiceUrl = env.AI_MEDIA_SERVICE_URL || env.AI_MEDIA_SERVICE_BASE_URL || "";
  const aiMediaServiceInternalKey = env.AI_MEDIA_SERVICE_INTERNAL_KEY || "";
  const hasPublicSecret = hasPublicSecretEnv(env);

  const databaseUrlRedacted = redactUrl(databaseUrl);
  const blobTokenRedacted = redactValue(blobToken);
  const aiMediaServiceUrlRedacted = redactUrl(aiMediaServiceUrl);
  const aiMediaServiceInternalKeyRedacted = redactValue(aiMediaServiceInternalKey);

  if (environment === "production") {
    if (!databaseUrl) blockers.push("Production requires DATABASE_URL.");
    if (!aiMediaServiceInternalKey && env.AI_MEDIA_SERVICE_ENABLED === "true") {
      blockers.push("Production AI media service requires AI_MEDIA_SERVICE_INTERNAL_KEY when enabled.");
    }
  }

  if (environment === "preview") {
    if (hasPublicSecret) {
      blockers.push("Preview environment must not expose AI media secrets via NEXT_PUBLIC_* variables.");
    }

    const dbClass = classifyDatabaseUrl(databaseUrl);
    if (dbClass === "neon" || dbClass === "unknown") {
      warnings.push("Preview database URL is not local; verify it does not point to Production.");
    }

    const storageClass = classifyStorage(blobToken);
    if (storageClass === "vercel") {
      warnings.push("Preview Blob token looks like Vercel production Blob; verify Preview isolation.");
    }

    const normalizedPreviewAiUrl = normalizeUrl(aiMediaServiceUrl);
    if (normalizedPreviewAiUrl && /bazar-baz-ai-media-service\.onrender\.com/.test(normalizedPreviewAiUrl)) {
      warnings.push("Preview is using Production AI media service URL; use a Preview-specific identity.");
    }
  }

  const safeSummary = {
    hasDatabaseUrl: Boolean(databaseUrl),
    hasBlobToken: Boolean(blobToken),
    hasAiMediaServiceUrl: Boolean(aiMediaServiceUrl),
    hasAiMediaServiceInternalKey: Boolean(aiMediaServiceInternalKey),
    hasPublicAiMediaSecret: hasPublicSecret,
    databaseUrlRedacted,
    blobTokenRedacted,
    aiMediaServiceUrlRedacted,
    aiMediaServiceInternalKeyRedacted,
    previewAndProdDatabaseMatch: false,
    previewAndProdStorageMatch: false,
    previewAndProdAiServiceMatch: false,
  };

  return {
    ok: blockers.length === 0,
    environment,
    warnings,
    blockers,
    safeSummary,
  };
}

export function validateAiMediaPreviewIsolation(env: EnvLike): AiMediaEnvIsolationResult {
  const summary = getAiMediaEnvironmentSummary(env);
  const environment = summary.environment;

  if (environment === "preview") {
    const dbClass = classifyDatabaseUrl(env.DATABASE_URL || env.DIRECT_URL || env.DATABASE_URL_UNPOOLED || "");
    if (dbClass !== "local" && dbClass !== "empty") {
      summary.blockers.push("Preview must not share Production database identity.");
      summary.ok = false;
      summary.safeSummary.previewAndProdDatabaseMatch = true;
    }

    const storageClass = classifyStorage(env.BLOB_READ_WRITE_TOKEN || "");
    if (storageClass === "vercel") {
      summary.blockers.push("Preview must not use Production Blob/storage identity.");
      summary.ok = false;
      summary.safeSummary.previewAndProdStorageMatch = true;
    }

    const normalizedPreviewAiUrl = normalizeUrl(env.AI_MEDIA_SERVICE_URL || env.AI_MEDIA_SERVICE_BASE_URL || "");
    if (/bazar-baz-ai-media-service\.onrender\.com/.test(normalizedPreviewAiUrl)) {
      summary.blockers.push("Preview must not use Production AI media service identity.");
      summary.ok = false;
      summary.safeSummary.previewAndProdAiServiceMatch = true;
    }
  }

  return summary;
}

export function assertNoPublicAiMediaSecrets(env: EnvLike): void {
  const summary = getAiMediaEnvironmentSummary(env);
  if (summary.safeSummary.hasPublicAiMediaSecret) {
    throw new Error("AI media secrets must not be exposed via NEXT_PUBLIC_* environment variables.");
  }
}

export function getProcessEnvIsolationSummary(strict = false): AiMediaEnvIsolationResult {
  const result = validateAiMediaPreviewIsolation(process.env);
  if (strict && !result.ok) {
    throw new Error(`AI media environment isolation failed: ${result.blockers.join("; ")}`);
  }
  return result;
}
