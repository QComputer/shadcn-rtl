import { z } from "zod";
import { organizationCapabilityKeys } from "@/lib/validators/tenant-platform";

export const integrationProviders = [
  "INOTI_USSD",
  "INOTI_IMENU",
  "INOTI_ICV",
  "INOTI_IAM",
  "INOTI_EBC",
  "PAYMENT",
  "SMS",
  "OTHER",
] as const;

export const integrationTypes = [
  "IMENU",
  "ICV",
  "IAM",
  "EBC",
  "USSD",
  "PAYMENT",
  "SMS",
  "OTHER",
] as const;

export const integrationStatuses = ["DRAFT", "ACTIVE", "DISABLED", "REVOKED"] as const;

export const createOrganizationIntegrationSchema = z.object({
  provider: z.enum(integrationProviders),
  type: z.enum(integrationTypes).optional(),
  status: z.enum(integrationStatuses).default("DRAFT"),
  codeName: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/),
  displayName: z.string().trim().min(1).max(120).nullable().optional(),
  externalAccountId: z.string().trim().min(1).max(160).nullable().optional(),
  credentialProfileKey: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9_:-]+$/).nullable().optional(),
  configuration: z.record(z.string(), z.unknown()).default({}),
  capabilityKeys: z.array(z.enum(organizationCapabilityKeys)).optional(),
}).strict();

export const updateOrganizationIntegrationStatusSchema = z.object({
  status: z.enum(integrationStatuses),
}).strict();
