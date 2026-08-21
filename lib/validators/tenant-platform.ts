import { z } from "zod";

export const organizationCapabilityKeys = ["SHOP", "APPOINTMENT", "CRM", "USSD", "LOYALTY", "IAM", "ICV", "EBC", "SMS"] as const;
export const collaborationScopeKeys = [
  "CUSTOMER_IDENTITY",
  "CUSTOMER_PROFILE",
  "ORDER_VISIBILITY",
  "LOYALTY",
  "COURIER",
  "EMPLOYEE_SCHEDULE",
  "CONTACT_INFORMATION",
] as const;

export const replaceOrganizationCapabilitiesSchema = z.object({
  organizationId: z.string().cuid(),
  capabilities: z.array(z.enum(organizationCapabilityKeys)).max(organizationCapabilityKeys.length),
});

export const createOrganizationCollaborationSchema = z.object({
  ownerOrgId: z.string().cuid(),
  partnerOrgId: z.string().cuid(),
  direction: z.enum(["ONE_WAY", "TWO_WAY"]).default("TWO_WAY"),
  scopes: z.array(z.object({
    scope: z.enum(collaborationScopeKeys),
    ownerToPartner: z.boolean().default(false),
    partnerToOwner: z.boolean().default(false),
  })).min(1).max(collaborationScopeKeys.length),
  endsAt: z.string().datetime().optional(),
});

export const updateOrganizationCollaborationSchema = z.object({
  collaborationId: z.string().cuid(),
  actingOrganizationId: z.string().cuid(),
  action: z.enum(["ACCEPT", "SUSPEND", "REVOKE"]),
});

export const updateOrderReadyTimeSchema = z.object({
  preparationMinutes: z.number().int().min(1).max(1440),
  reason: z.string().trim().min(3).max(500),
  expectedVersion: z.number().int().min(0),
});
