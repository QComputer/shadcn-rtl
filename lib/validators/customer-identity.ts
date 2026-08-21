import { z } from "zod";

export const resolveCustomerIdentitySchema = z.object({
  phone: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  userId: z.string().trim().min(1).optional(),
  guestCustomerId: z.string().trim().min(1).optional(),
  externalIdentifiers: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const listCustomerInteractionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
