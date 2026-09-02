import { z } from "zod";
import { joinOrganizationEndpointPath, type ResolvedOrganizationEndpoint } from "@/lib/organization-endpoints";

export const PURCHASE_INTENT_VERSION = "v1" as const;
export const PURCHASE_ATTRIBUTION_MAX_LENGTH = 80;

const attributionToken = z.string().trim().min(1).max(PURCHASE_ATTRIBUTION_MAX_LENGTH)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N}._~-]*$/u, "Attribution must be a safe token");

export const purchaseAttributionSchema = z.object({
  source: attributionToken.optional(),
  campaign: attributionToken.optional(),
}).strict();

export type PurchaseAttribution = z.infer<typeof purchaseAttributionSchema>;
export type PurchaseIntent = {
  version: typeof PURCHASE_INTENT_VERSION;
  organizationIdentifier: string;
  productId: string;
  attribution?: PurchaseAttribution;
};

function safeSegment(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "." || trimmed === ".." || /[/?#\\]/.test(trimmed)) {
    throw new Error(`${label} is invalid`);
  }
  return encodeURIComponent(trimmed);
}

export function buildProductPurchaseHandoff(input: {
  productId: string;
  appEndpoint: ResolvedOrganizationEndpoint | null;
  attribution?: PurchaseAttribution;
}): { href: string; productId: string } | null {
  if (!input.appEndpoint) return null;
  if (input.appEndpoint.role !== "APP") throw new Error("Purchase handoff requires an APP endpoint");
  const attribution = purchaseAttributionSchema.parse(input.attribution ?? {});
  const product = safeSegment(input.productId, "Product ID");
  const query = new URLSearchParams();
  if (attribution.source) query.set("source", attribution.source);
  if (attribution.campaign) query.set("campaign", attribution.campaign);
  const suffix = query.size ? `?${query}` : "";
  return {
    href: joinOrganizationEndpointPath(input.appEndpoint, `/purchase/product/${product}${suffix}`),
    productId: input.productId,
  };
}
