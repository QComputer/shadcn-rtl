import { createHash } from "node:crypto";

import type { AiMediaPlatformTargetType } from "@/lib/ai-media/platform-domain";
import type { AiMediaJobPrivacyLevel } from "@/lib/ai-media/job-mirror";

type PreviewMockRenderRequestInput = {
  organizationId: string;
  requestedByUserId: string;
  targetType: AiMediaPlatformTargetType;
  targetId?: string | null;
  locale?: "fa" | "en" | "ar";
  privacyLevel?: AiMediaJobPrivacyLevel;
  idempotencyKey?: string | null;
  payload: Record<string, unknown>;
  prompt?: string | null;
  productTitle?: string | null;
  category?: string | null;
};

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function fallbackIdempotencyKey(input: PreviewMockRenderRequestInput) {
  return stableHash({
    scope: "ai-media-preview-render-request",
    organizationId: input.organizationId,
    requestedByUserId: input.requestedByUserId,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    payload: input.payload,
  });
}

export function buildPreviewMockRenderJobRequest(input: PreviewMockRenderRequestInput, correlationId: string) {
  const payload = input.payload || {};
  const productId = asString(input.targetId, "preview-product-image");
  const productTitle = asString(input.productTitle ?? payload.productTitle, "Preview MOCK product image");
  const sellerPrompt = asString(input.prompt ?? payload.prompt, "Preview MOCK product-image request");

  return {
    organization_id: input.organizationId,
    product_id: productId,
    requested_by_user_id: input.requestedByUserId,
    product_title: productTitle,
    category: asString(input.category ?? payload.category, "preview"),
    description: typeof payload.description === "string" ? payload.description : null,
    seller_prompt: sellerPrompt,
    input_images: [],
    count: 1,
    aspect_ratio: "1:1",
    style_preset: "LIGHT_MENU_PHOTO",
    idempotency_key: input.idempotencyKey ?? fallbackIdempotencyKey(input),
    correlation_id: correlationId,
  };
}
