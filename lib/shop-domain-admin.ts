import { z } from "zod";
import { ApiError, requireRole, type SessionWithUser } from "@/lib/api-guards";
import { normalizeDomainHost } from "@/lib/custom-domain-routing";

export const shopDomainStatusSchema = z.enum([
  "PENDING",
  "DNS_REQUIRED",
  "VERIFYING",
  "ACTIVE",
  "FAILED",
  "DISABLED",
]);

export const createShopDomainSchema = z.object({
  organizationId: z.string().min(1, "Shop is required"),
  domain: z.string().trim().min(3).max(255),
  status: shopDomainStatusSchema.optional().default("DNS_REQUIRED"),
  isPrimary: z.boolean().optional().default(false),
  failureReason: z.string().trim().max(500).optional().nullable(),
});

export const updateShopDomainSchema = z.object({
  id: z.string().min(1, "Domain id is required"),
  organizationId: z.string().min(1).optional(),
  domain: z.string().trim().min(3).max(255).optional(),
  status: shopDomainStatusSchema.optional(),
  isPrimary: z.boolean().optional(),
  failureReason: z.string().trim().max(500).optional().nullable(),
});

export const deleteShopDomainSchema = z.object({
  id: z.string().min(1, "Domain id is required"),
});

export function requireSuperAdmin(session: SessionWithUser) {
  requireRole(session, ["SUPER_ADMIN"]);
}

export function validateShopDomainInput(domain: string) {
  const normalizedDomain = normalizeDomainHost(domain);

  if (!normalizedDomain || normalizedDomain === "localhost" || normalizedDomain.endsWith(".localhost")) {
    throw new ApiError(400, "Invalid custom domain");
  }

  if (/^https?:\/\//i.test(normalizedDomain) || normalizedDomain.includes("/") || normalizedDomain.includes(":")) {
    throw new ApiError(400, "Domain must be a hostname only, such as example.ir");
  }

  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(normalizedDomain)) {
    throw new ApiError(400, "Domain must be a valid hostname, such as example.ir");
  }

  const tld = normalizedDomain.split(".").pop() || "";
  if (tld.length < 2 || /^\d+$/.test(tld)) {
    throw new ApiError(400, "Domain must include a valid top-level domain");
  }

  return normalizedDomain;
}

export function displayDomainInput(domain: string) {
  return validateShopDomainInput(domain);
}
