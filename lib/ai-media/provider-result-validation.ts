import "server-only";

import { createHash } from "node:crypto";

import type { AiMediaJobMirrorState } from "@/lib/ai-media/job-mirror";

export type AiMediaProviderResultOutput = {
  id: string;
  url: string;
  width: number;
  height: number;
  mimeType: string;
  variant?: string | null;
  provider?: string | null;
  model?: string | null;
};

export type AiMediaProviderResultEvidence = {
  provider: string | null;
  providerJobId: string | null;
  mirrorProviderJobId: string | null;
  state: AiMediaJobMirrorState;
  jobType: string | null;
  canonicalStatus: string | null;
  outputs: AiMediaProviderResultOutput[];
};

export type AiMediaProviderResultValidation = {
  valid: boolean;
  normalized: {
    provider: string;
    providerJobId: string;
    outputIndex: number;
    outputId: string;
    url: string;
    mimeType: string;
    width: number | null;
    height: number | null;
    resultFingerprint: string;
  } | null;
  blockers: string[];
  warnings: string[];
  safeSummary: {
    provider: string | null;
    supportedProvider: boolean;
    resultReady: boolean;
    completed: boolean;
    jobIdMatches: boolean;
    outputCount: number;
    risk: "LOW" | "REVIEW" | "BLOCK";
  };
};

const SUPPORTED_PROVIDERS = new Set(["MOCK"]);
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const FORBIDDEN_MIME_HINTS = ["svg", "html", "xml", "script", "text/"];
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const MAX_OUTPUTS = 6;

function isSupportedProvider(provider: string | null) {
  return typeof provider === "string" && SUPPORTED_PROVIDERS.has(provider.toUpperCase());
}

function isAllowedMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase().split(";")[0]?.trim() || "";
  if (!ALLOWED_MIME_TYPES.has(normalized)) return false;
  if (FORBIDDEN_MIME_HINTS.some((hint) => normalized.includes(hint))) return false;
  return true;
}

function isSafeOutputUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  // Never accept filesystem paths or non-http schemes.
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  // Reject any embedded credentials.
  if (parsed.username || parsed.password) return false;
  // Reject local/private/loopback hosts for non-localtest (server-side gateway also enforces this).
  if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1") {
    return false;
  }
  if (/^10\.|^127\.|^0\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(parsed.hostname)) {
    return false;
  }
  if (parsed.hostname.endsWith(".localhost") || parsed.hostname.endsWith(".local")) return false;
  return true;
}

function isLoopbackOutputUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  if (parsed.username || parsed.password) return false;
  return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
}

function classifyRisk(blockers: string[], outputBlockers: string[]): "LOW" | "REVIEW" | "BLOCK" {
  const all = [...blockers, ...outputBlockers];
  if (all.some((b) => ["PRIVATE_IP", "INVALID_MIME", "UNSAFE_URL", "OVERSIZED", "UNSUPPORTED_PROVIDER", "ID_MISMATCH"].includes(b))) {
    return "BLOCK";
  }
  if (all.length > 0) return "REVIEW";
  return "LOW";
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function validateAiMediaProviderResult(
  evidence: AiMediaProviderResultEvidence,
  options: { allowLocalTestOutputUrl?: boolean } = {},
): AiMediaProviderResultValidation {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!isSupportedProvider(evidence.provider)) {
    blockers.push("UNSUPPORTED_PROVIDER");
  }
  if (evidence.state !== "RESULT_READY") {
    blockers.push("RESULT_NOT_READY");
  }
  if (evidence.canonicalStatus && evidence.canonicalStatus !== "RESULT_READY" && evidence.canonicalStatus !== "IMPORTED_BY_BAZAR_BAZ") {
    blockers.push("PROVIDER_NOT_COMPLETED");
  }
  if (evidence.providerJobId && evidence.mirrorProviderJobId && evidence.providerJobId !== evidence.mirrorProviderJobId) {
    blockers.push("ID_MISMATCH");
  }

  const outputs = Array.isArray(evidence.outputs) ? evidence.outputs : [];
  if (outputs.length === 0) {
    blockers.push("NO_OUTPUTS");
  }
  if (outputs.length > MAX_OUTPUTS) {
    blockers.push("TOO_MANY_OUTPUTS");
  }

  const outputBlockers: string[] = [];
  let selectedIndex = -1;
  let selected: AiMediaProviderResultOutput | null = null;
  for (let index = 0; index < outputs.length; index += 1) {
    const output = outputs[index];
    if (!isAllowedMimeType(output.mimeType)) {
      outputBlockers.push("INVALID_MIME");
      continue;
    }
    const urlAllowed = options.allowLocalTestOutputUrl
      ? output.url.startsWith("/") || isSafeOutputUrl(output.url) || isLoopbackOutputUrl(output.url)
      : isSafeOutputUrl(output.url);
    if (!urlAllowed) {
      outputBlockers.push("UNSAFE_URL");
      continue;
    }
    if (typeof output.width === "number" && output.width > 10000) outputBlockers.push("OVERSIZED");
    if (typeof output.height === "number" && output.height > 10000) outputBlockers.push("OVERSIZED");
    selectedIndex = index;
    selected = output;
    break;
  }

  const valid = blockers.length === 0 && outputBlockers.length === 0 && selected !== null;
  const risk = classifyRisk(blockers, outputBlockers);

  const normalized = valid && selected && selectedIndex >= 0
    ? {
        provider: (evidence.provider || "MOCK").toUpperCase(),
        providerJobId: evidence.providerJobId || "",
        outputIndex: selectedIndex,
        outputId: selected.id,
        url: selected.url,
        mimeType: selected.mimeType.toLowerCase().split(";")[0]?.trim() || selected.mimeType,
        width: typeof selected.width === "number" ? selected.width : null,
        height: typeof selected.height === "number" ? selected.height : null,
        resultFingerprint: stableHash({
          providerJobId: evidence.providerJobId,
          outputId: selected.id,
          mimeType: selected.mimeType,
          width: selected.width,
          height: selected.height,
        }),
      }
    : null;

  if (!valid) {
    warnings.push(`import failures: ${[...blockers, ...outputBlockers].join(", ")}`);
  }

  return {
    valid,
    normalized,
    blockers: [...blockers, ...outputBlockers],
    warnings,
    safeSummary: {
      provider: evidence.provider,
      supportedProvider: isSupportedProvider(evidence.provider),
      resultReady: evidence.state === "RESULT_READY",
      completed: evidence.canonicalStatus === "RESULT_READY" || evidence.canonicalStatus === "IMPORTED_BY_BAZAR_BAZ",
      jobIdMatches: evidence.providerJobId === evidence.mirrorProviderJobId,
      outputCount: outputs.length,
      risk,
    },
  };
}

export const AI_MEDIA_IMPORT_MAX_OUTPUT_BYTES = MAX_OUTPUT_BYTES;
export const AI_MEDIA_IMPORT_ALLOWED_MIME_TYPES = ALLOWED_MIME_TYPES;
