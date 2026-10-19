import "server-only";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { getRetailInotiReadiness } from "@/lib/retail/inoti-readiness.server";

const cashMode = z.enum(["COUNTER", "PICKUP", "COURIER"]);
const paymentDeadlineMinutesSchema = z.object({
  bankTransfer: z.number().int().min(5).max(43_200),
  cash: z.number().int().min(5).max(43_200),
  inotiUssd: z.number().int().min(5).max(43_200),
}).strict();
export const defaultRetailPaymentDeadlinesMinutes = { bankTransfer: 1_440, cash: 2_880, inotiUssd: 15 } as const;
const policySchema = z.object({
  bankTransferEnabled: z.boolean(),
  cashEnabled: z.boolean(),
  inotiUssdEnabled: z.boolean(),
  bankCardNumber: z.string().regex(/^\d{16}$/).nullable(),
  bankAccountOwner: z.string().trim().min(2).max(120).nullable(),
  cashModes: z.array(cashMode).min(1),
  cashBeforeConfirmation: z.boolean(),
  paymentDeadlinesMinutes: paymentDeadlineMinutesSchema.default(defaultRetailPaymentDeadlinesMinutes),
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
  paymentDeadlinesMinutes: defaultRetailPaymentDeadlinesMinutes,
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
  if (policy.inotiUssdEnabled && !await getRetailInotiReadiness(organizationId)) {
    throw new ApiError(409, "A verified tenant iNoti integration and payment rollout are required before enabling USSD.");
  }
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
        cashBeforeConfirmation: policy.cashBeforeConfirmation,
        paymentDeadlinesMinutes: policy.paymentDeadlinesMinutes },
    } });
    return policy;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function requireEnabledRetailPaymentMethod(organizationSlug: string, organizationId: string, method: "BANK_TRANSFER" | "CASH" | "INOTI_USSD") {
  const policy = await getRetailPaymentPolicy(organizationSlug);
  if (method === "BANK_TRANSFER" && policy.bankTransferEnabled && policy.bankCardNumber && policy.bankAccountOwner) return policy;
  if (method === "CASH" && policy.cashEnabled) return policy;
  if (method === "INOTI_USSD" && policy.inotiUssdEnabled && await getRetailInotiReadiness(organizationId)) return policy;
  throw new ApiError(409, "Selected payment method is not available.");
}
