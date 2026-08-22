import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { slugSchema, phoneSchema, emailSchema } from "@/lib/validators";
import { organizationCapabilityKeys } from "@/lib/validators/tenant-platform";

export const industryKeys = ["RESTAURANT", "PHARMACY", "DENTAL_CLINIC", "FASHION_BOUTIQUE", "RETAIL_SHOP", "OTHER"] as const;
export const acquisitionSourceTypes = ["BAZARBAAZ_TEAM", "SALES_AGENT", "BUSINESS_SELF_SIGNUP", "INVITATION_CODE"] as const;
export const invitationStatuses = ["CREATED", "SENT", "CLAIMED", "EXPIRED", "REVOKED"] as const;
export const claimRequestStatuses = ["REQUESTED", "APPROVED", "REJECTED"] as const;

const jsonValueSchema: z.ZodType<Prisma.InputJsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);
const metadataSchema = z.record(z.string(), jsonValueSchema).optional();

export const createOnboardingDraftSchema = z.object({
  industryKey: z.enum(industryKeys),
  sourceType: z.enum(acquisitionSourceTypes).default("BAZARBAAZ_TEAM"),
  selectedCapabilities: z.array(z.enum(organizationCapabilityKeys)).max(organizationCapabilityKeys.length).optional(),
  metadata: metadataSchema,
});

export const reviewRecommendedCapabilitiesSchema = z.object({
  industryKey: z.enum(industryKeys),
  selectedCapabilities: z.array(z.enum(organizationCapabilityKeys)).max(organizationCapabilityKeys.length).optional(),
});

export const finalizeTeamOrganizationSchema = z.object({
  sourceType: z.enum(acquisitionSourceTypes).default("BAZARBAAZ_TEAM"),
  industryKey: z.enum(industryKeys),
  name: z.string().trim().min(2).max(200),
  slug: slugSchema,
  description: z.string().max(5000).optional(),
  address: z.string().max(500).optional(),
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
  locale: z.string().default("fa").optional(),
  timezone: z.string().default("Asia/Tehran").optional(),
  selectedCapabilities: z.array(z.enum(organizationCapabilityKeys)).min(1).max(organizationCapabilityKeys.length).optional(),
  metadata: metadataSchema,
});

export const createOrganizationInvitationSchema = z.object({
  organizationId: z.string().cuid(),
  invitedRole: z.enum(["ADMIN", "MANAGER", "STAFF", "DRIVER"]),
  expiresAt: z.string().datetime().optional(),
  ttlHours: z.number().int().min(1).max(24 * 90).optional(),
  metadata: metadataSchema,
});

export const createOrganizationClaimRequestSchema = z.object({
  organizationId: z.string().cuid(),
  requesterUserId: z.string().cuid().optional(),
  requesterEmail: emailSchema.optional(),
  requesterPhone: phoneSchema.optional(),
  verificationMetadata: metadataSchema,
});

export type CreateOnboardingDraftInput = z.infer<typeof createOnboardingDraftSchema>;
export type ReviewRecommendedCapabilitiesInput = z.infer<typeof reviewRecommendedCapabilitiesSchema>;
export type FinalizeTeamOrganizationInput = z.infer<typeof finalizeTeamOrganizationSchema>;
export type CreateOrganizationInvitationInput = z.infer<typeof createOrganizationInvitationSchema>;
export type CreateOrganizationClaimRequestInput = z.infer<typeof createOrganizationClaimRequestSchema>;
