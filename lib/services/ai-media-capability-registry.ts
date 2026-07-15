import "server-only";

import { createHash } from "node:crypto";
import { getAiMediaServiceConfigStatus } from "@/lib/services/ai-media-service-client";

export type AiMediaCapability =
  | "PRODUCT_IMAGE"
  | "ORGANIZATION_LOGO"
  | "ORGANIZATION_COVER"
  | "GENERAL_CREATIVE";

export type CapabilityStatus =
  | "AVAILABLE"
  | "AVAILABLE_WITH_ADAPTER"
  | "UNAVAILABLE"
  | "UNKNOWN";

export type AiMediaCapabilityRecord = {
  capability: AiMediaCapability;
  status: CapabilityStatus;
  endpoint: string | null;
  method: "GET" | "POST" | null;
  requestSchema: string | null;
  responseSchema: string | null;
  auth: "X-BazarBaz-AI-Key";
  idempotency: "header-supported-by-bazar-baz-policy" | "not-declared";
  terminalStates: string[];
  resultForm: string;
  cancellation: "SUPPORTED" | "UNSUPPORTED" | "UNKNOWN";
  retry: "LOCAL_ONLY" | "UNSUPPORTED" | "UNKNOWN";
  mapping: string;
  blockers: string[];
};

export type AiMediaCapabilitySummary = {
  contractTitle: "Bazar Baz AI Media Service";
  contractVersion: "0.1.0";
  openapi: "3.1.0";
  fingerprint: string;
  generatedFrom: "docs/ai-media/RENDER_SERVICE_CONTRACT.md";
  serviceReady: boolean;
  records: AiMediaCapabilityRecord[];
};

const PRODUCT_ENDPOINT = "/v1/product-image-suggestions/jobs";
const PRODUCT_STATUS_ENDPOINT = "/v1/product-image-suggestions/jobs/{job_id}";
const PRODUCT_CANCEL_ENDPOINT = "/v1/product-image-suggestions/jobs/{job_id}/cancel";

export const AI_MEDIA_ABSENT_LEGACY_RENDER_PATHS = [
  "/v1/organization-brand/jobs",
  "/v1/organization-brand/jobs/{jobId}",
  "/v1/organization-brand/jobs/{jobId}/result",
] as const;

const contractBasis = [
  "Bazar Baz AI Media Service",
  "0.1.0",
  "3.1.0",
  PRODUCT_ENDPOINT,
  PRODUCT_STATUS_ENDPOINT,
  PRODUCT_CANCEL_ENDPOINT,
  ...AI_MEDIA_ABSENT_LEGACY_RENDER_PATHS,
].join("|");

export const AI_MEDIA_CONTRACT_FINGERPRINT = createHash("sha256")
  .update(contractBasis)
  .digest("hex")
  .slice(0, 16);

const PRODUCT_RECORD: AiMediaCapabilityRecord = {
  capability: "PRODUCT_IMAGE",
  status: "AVAILABLE",
  endpoint: PRODUCT_ENDPOINT,
  method: "POST",
  requestSchema: "ProductImageSuggestionRequest",
  responseSchema: "CreateJobResponse / JobStatusResponse",
  auth: "X-BazarBaz-AI-Key",
  idempotency: "header-supported-by-bazar-baz-policy",
  terminalStates: ["COMPLETED", "FAILED", "CANCELED"],
  resultForm: "JobStatusResponse.outputs[] or output_images[] image URLs",
  cancellation: "SUPPORTED",
  retry: "LOCAL_ONLY",
  mapping: "CreativeStudioJob PRODUCT/PRODUCT_IMAGE plus AiMediaJob provider mirror",
  blockers: [],
};

const ORGANIZATION_LOGO_RECORD: AiMediaCapabilityRecord = {
  capability: "ORGANIZATION_LOGO",
  status: "UNAVAILABLE",
  endpoint: null,
  method: null,
  requestSchema: null,
  responseSchema: null,
  auth: "X-BazarBaz-AI-Key",
  idempotency: "not-declared",
  terminalStates: [],
  resultForm: "No compatible live operation confirmed",
  cancellation: "UNSUPPORTED",
  retry: "UNSUPPORTED",
  mapping: "Keep request/draft planning only; do not call Render",
  blockers: [
    "Historical /v1/organization-brand endpoints are absent from live OpenAPI",
    "/v1/creative schemas have not been proven compatible with logo prompt/aspect/result semantics",
  ],
};

const ORGANIZATION_COVER_RECORD: AiMediaCapabilityRecord = {
  ...ORGANIZATION_LOGO_RECORD,
  capability: "ORGANIZATION_COVER",
  mapping: "Keep request/draft planning only; do not call Render",
};

const GENERAL_CREATIVE_RECORD: AiMediaCapabilityRecord = {
  capability: "GENERAL_CREATIVE",
  status: "UNKNOWN",
  endpoint: "/v1/creative/campaign-packs/{pack_id}/generate",
  method: "POST",
  requestSchema: "Not proven for Bazar Baz tenant image generation",
  responseSchema: "Not mapped",
  auth: "X-BazarBaz-AI-Key",
  idempotency: "not-declared",
  terminalStates: [],
  resultForm: "Unknown for tenant-facing asset ingestion",
  cancellation: "UNKNOWN",
  retry: "UNKNOWN",
  mapping: "Diagnostics/documentation only until schemas and lifecycle are mapped",
  blockers: ["/v1/creative compatibility needs deterministic adapter tests before tenant exposure"],
};

export function getAiMediaCapabilitySummary(): AiMediaCapabilitySummary {
  const service = getAiMediaServiceConfigStatus();

  return {
    contractTitle: "Bazar Baz AI Media Service",
    contractVersion: "0.1.0",
    openapi: "3.1.0",
    fingerprint: AI_MEDIA_CONTRACT_FINGERPRINT,
    generatedFrom: "docs/ai-media/RENDER_SERVICE_CONTRACT.md",
    serviceReady: service.ready,
    records: [
      {
        ...PRODUCT_RECORD,
        status: service.ready ? "AVAILABLE" : "UNAVAILABLE",
        blockers: service.ready ? [] : ["AI media service is not enabled/configured"],
      },
      ORGANIZATION_LOGO_RECORD,
      ORGANIZATION_COVER_RECORD,
      GENERAL_CREATIVE_RECORD,
    ],
  };
}

export function getAiMediaCapability(capability: AiMediaCapability) {
  return getAiMediaCapabilitySummary().records.find((record) => record.capability === capability) ?? null;
}

export function isAiMediaCapabilityAvailable(capability: AiMediaCapability) {
  const record = getAiMediaCapability(capability);
  return record?.status === "AVAILABLE" || record?.status === "AVAILABLE_WITH_ADAPTER";
}
