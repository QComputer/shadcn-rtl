import { z } from "zod";
import { isReservedOrganizationSlug } from "@/lib/organization-slugs";

const slug = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/);
const name = z.string().trim().min(2).max(200).refine((value) => !/[<>\u0000-\u001f]/.test(value), "Plain text is required");
export const onboardingIdempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/);
export const bootstrapHotelOrganizationSchema = z.object({
  name,
  slug: slug.refine((value) => !isReservedOrganizationSlug(value), "Reserved organization slug"),
  property: z.object({ name, slug }).strict(),
  locale: z.enum(["fa", "en", "ar"]).default("fa"),
}).strict();
export const issueBoundInvitationSchema = z.object({
  organizationId: z.string().cuid(),
  recipientUserId: z.string().cuid(),
  recipientEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  recipientUsername: z.string().regex(/^[a-z0-9][a-z0-9-]{2,63}$/),
  invitedRole: z.enum(["ADMIN", "MANAGER"]),
  ttlHours: z.number().int().min(1).max(72).default(24),
}).strict();
export const redeemOrganizationInvitationSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();
export const revokeOrganizationInvitationSchema = z.object({ invitationId: z.string().cuid() }).strict();

export type BootstrapHotelOrganizationInput = z.infer<typeof bootstrapHotelOrganizationSchema>;
export type IssueBoundInvitationInput = z.infer<typeof issueBoundInvitationSchema>;
