import { z } from "zod";

export const updateInotiUssdIntegrationSchema = z.object({
  codeName: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/),
  status: z.enum(["DRAFT", "ACTIVE", "DISABLED", "REVOKED"]),
  credentialProfileKey: z.string().nullable().default(null),
  orderStatusEnabled: z.boolean().default(false),
  paymentEnabled: z.boolean().default(false),
}).strict().superRefine((value, context) => {
  if (value.paymentEnabled && !value.credentialProfileKey) {
    context.addIssue({ code: "custom", path: ["credentialProfileKey"], message: "Payment requires a credential profile" });
  }
});

