import { z } from "zod";

export const organizationAccountRoleSchema = z.enum(["ADMIN", "MANAGER", "STAFF", "CUSTOMER"]);

const usernameSchema = z.string().trim().min(3).max(50)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
  .transform((value) => value.toLowerCase());

export const provisionOrganizationAccountSchema = z.object({
  username: usernameSchema,
  password: z.string().min(6).max(128),
  role: organizationAccountRoleSchema,
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional()
    .transform((value) => value ? value.toLowerCase() : undefined),
}).strict();

export const resetOrganizationAccountPasswordSchema = z.object({
  password: z.string().min(6).max(128),
}).strict();

export type ProvisionOrganizationAccountInput = z.infer<typeof provisionOrganizationAccountSchema>;
