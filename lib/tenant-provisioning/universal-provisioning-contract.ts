import { z } from "zod";
import { BUSINESS_VERTICALS } from "@/lib/business-verticals";
import { organizationCapabilityKeys } from "@/lib/validators/tenant-platform";
import { isReservedOrganizationSlug } from "@/lib/organization-slugs";
import { issueBoundInvitationSchema } from "@/lib/organization-onboarding/contract";

/** These are provisioning-safe grants, not subscription/package entitlements.
 * Provider/financial/booking capabilities require their separate operational approval. */
export const provisioningSafeCapabilities = ["SHOP", "APPOINTMENT", "CRM", "LOYALTY", "IAM", "HOTEL_WEBSITE"] as const;
const safe = new Set<string>(provisioningSafeCapabilities);
const text = z.string().trim().min(2).max(200).refine((value) => !/[<>\u0000-\u001f]/.test(value));
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(48).refine((value) => !isReservedOrganizationSlug(value));
export const universalProvisioningConfigurationSchema = z.object({
  name: text, slug, locale: z.enum(["fa", "en", "ar"]).default("fa"),
  vertical: z.enum(BUSINESS_VERTICALS).nullable(), type: z.enum(["SHOP", "APPOINTMENT"]),
  entitledCapabilities: z.array(z.enum(organizationCapabilityKeys)).min(1).max(organizationCapabilityKeys.length),
  enabledCapabilities: z.array(z.enum(organizationCapabilityKeys)).min(1).max(organizationCapabilityKeys.length),
  property: z.object({ name: text, slug }).strict().optional(),
  recipients: z.array(issueBoundInvitationSchema.omit({ organizationId: true })).min(1).max(5),
}).strict().superRefine((value, context) => {
  const issue = (message: string) => context.addIssue({ code: "custom", message });
  if ([...value.entitledCapabilities, ...value.enabledCapabilities].some((key) => !safe.has(key))) issue("قابلیت عملیاتی نیازمند تأیید جداگانه است");
  if (value.enabledCapabilities.some((key) => !value.entitledCapabilities.includes(key))) issue("قابلیت فعال باید در دسترسی تأییدشده باشد");
  if (!value.recipients.some((recipient) => recipient.invitedRole === "ADMIN")) issue("حداقل یک مدیر سازمان دعوت کنید");
  if (new Set(value.recipients.map((recipient) => recipient.recipientUserId)).size !== value.recipients.length) issue("گیرنده تکراری است");
  if (value.vertical === "HOTEL") {
    if (!value.property || !value.enabledCapabilities.includes("HOTEL_WEBSITE") || value.type !== "SHOP") issue("هتل به اطلاعات ملک و وب‌سایت مستقل نیاز دارد");
  } else if (value.property || value.entitledCapabilities.includes("HOTEL_WEBSITE")) issue("ملک و وب‌سایت هتل فقط برای حوزه هتل است");
  if (value.type === "APPOINTMENT" && !value.enabledCapabilities.includes("APPOINTMENT")) issue("نوع خدمات به قابلیت نوبت‌دهی نیاز دارد");
  if (value.type === "SHOP" && value.vertical !== "HOTEL" && !value.enabledCapabilities.includes("SHOP")) issue("نوع فروشگاهی به قابلیت فروشگاه نیاز دارد");
}).transform((value) => ({ ...value,
  entitledCapabilities: [...new Set(value.entitledCapabilities)].sort(),
  enabledCapabilities: [...new Set(value.enabledCapabilities)].sort(),
  recipients: [...value.recipients].sort((a, b) => a.recipientUserId.localeCompare(b.recipientUserId)),
}));
export type UniversalProvisioningConfiguration = z.infer<typeof universalProvisioningConfigurationSchema>;
export const executionRequestSchema = z.object({ approvedSha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
