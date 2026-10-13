import "server-only";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db";

const cashMode = z.enum(["COUNTER", "PICKUP", "COURIER"]);
const policySchema = z.object({
  bankTransferEnabled: z.boolean(),
  cashEnabled: z.boolean(),
  inotiUssdEnabled: z.boolean(),
  bankCardNumber: z.string().regex(/^\d{16}$/).nullable(),
  bankAccountOwner: z.string().trim().min(2).max(120).nullable(),
  cashModes: z.array(cashMode).min(1),
  cashBeforeConfirmation: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.bankTransferEnabled && (!value.bankCardNumber || !value.bankAccountOwner)) {
    context.addIssue({ code: "custom", path: ["bankCardNumber"], message: "Bank details are required." });
  }
  if (new Set(value.cashModes).size !== value.cashModes.length) {
    context.addIssue({ code: "custom", path: ["cashModes"], message: "Cash modes must be unique." });
  }
  if (value.cashEnabled && value.cashBeforeConfirmation && value.cashModes.some((mode) => mode !== "COUNTER")) {
    context.addIssue({ code: "custom", path: ["cashModes"], message: "Pickup and courier cash require collection after order acceptance." });
  }
});
export const retailPaymentPolicyInput = policySchema;
export type RetailPaymentPolicy = z.infer<typeof policySchema>;

const defaults: RetailPaymentPolicy = {
  bankTransferEnabled: false, cashEnabled: false, inotiUssdEnabled: false,
  bankCardNumber: null, bankAccountOwner: null,
  cashModes: ["COUNTER"], cashBeforeConfirmation: true,
};

function fromSettings(value: Prisma.JsonValue | null): RetailPaymentPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const settings = value as Prisma.JsonObject;
  const parsed = policySchema.safeParse(settings.retailR4);
  return parsed.success ? parsed.data : defaults;
}

export async function getRetailPaymentPolicy(organizationSlug: string) {
  const record = await prisma.paymentSettings.findUnique({ where: { organizationSlug }, select: { settings: true } });
  return fromSettings(record?.settings ?? null);
}

export async function saveRetailPaymentPolicy(organizationSlug: string, organizationId: string, actorUserId: string, policy: RetailPaymentPolicy) {
  return prisma.$transaction(async (tx) => {
    const previous = await tx.paymentSettings.findUnique({ where: { organizationSlug }, select: { settings: true } });
    const current = previous?.settings && typeof previous.settings === "object" && !Array.isArray(previous.settings)
      ? previous.settings as Prisma.JsonObject : {};
    await tx.paymentSettings.upsert({
      where: { organizationSlug },
      create: { organizationSlug, settings: { ...current, retailR4: policy } },
      update: { settings: { ...current, retailR4: policy } },
    });
    const before = fromSettings(previous?.settings ?? null);
    await tx.auditLog.create({ data: {
      action: "UPDATE", entityType: "RetailPaymentPolicy", entityId: organizationId,
      organizationId, organizationSlug, userId: actorUserId,
      description: "Merchant updated retail payment policy",
      previousValue: { bankTransferEnabled: before.bankTransferEnabled, cashEnabled: before.cashEnabled,
        inotiUssdEnabled: before.inotiUssdEnabled },
      newValue: { bankTransferEnabled: policy.bankTransferEnabled, cashEnabled: policy.cashEnabled,
        inotiUssdEnabled: policy.inotiUssdEnabled, cashModes: policy.cashModes,
        cashBeforeConfirmation: policy.cashBeforeConfirmation },
    } });
    return policy;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function requireEnabledRetailPaymentMethod(organizationSlug: string, method: "BANK_TRANSFER" | "CASH" | "INOTI_USSD") {
  const policy = await getRetailPaymentPolicy(organizationSlug);
  if (method === "BANK_TRANSFER" && policy.bankTransferEnabled && policy.bankCardNumber && policy.bankAccountOwner) return policy;
  if (method === "CASH" && policy.cashEnabled) return policy;
  // iNoti also requires tenant-owned active integration and provider readiness,
  // which is checked during initiation. It is never enabled by this switch alone.
  if (method === "INOTI_USSD" && policy.inotiUssdEnabled) throw new ApiError(409, "USSD integration has not been verified for retail checkout.");
  throw new ApiError(409, "Selected payment method is not available.");
}
