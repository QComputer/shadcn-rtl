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
  snappPayInstallmentsEnabled: z.boolean().default(false),
  installmentMarkupPercent: z.string().regex(/^(?:0|[1-9]\d{0,3})(?:\.\d{1,4})?$/).default("0"),
  installmentPricingPolicyVersion: z.number().int().nonnegative().default(0),
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
  if (new Prisma.Decimal(value.installmentMarkupPercent).gt(1000)) {
    context.addIssue({ code: "custom", path: ["installmentMarkupPercent"], message: "Installment markup percentage is out of range." });
  }
  if (value.cashEnabled && value.cashBeforeConfirmation && value.cashModes.some((mode) => mode !== "COUNTER")) {
    context.addIssue({ code: "custom", path: ["cashModes"], message: "Pickup and courier cash require collection after order acceptance." });
  }
});
export const retailPaymentPolicyInput = policySchema;
export type RetailPaymentPolicy = z.infer<typeof policySchema>;

const defaults: RetailPaymentPolicy = {
  bankTransferEnabled: false, cashEnabled: false, inotiUssdEnabled: false, snappPayInstallmentsEnabled: false,
  installmentMarkupPercent: "0", installmentPricingPolicyVersion: 0,
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
  const [record, pricing] = await Promise.all([
    prisma.paymentSettings.findUnique({ where: { organizationSlug }, select: { settings: true } }),
    prisma.retailInstallmentPricingPolicy.findFirst({ where: { organization: { slug: organizationSlug } }, select: { markupPercent: true, version: true } }),
  ]);
  const base = fromSettings(record?.settings ?? null);
  return { ...base, installmentMarkupPercent: pricing?.markupPercent.toString() ?? "0", installmentPricingPolicyVersion: pricing?.version ?? 0 };
}

export async function saveRetailPaymentPolicy(organizationSlug: string, organizationId: string, actorUserId: string, policy: RetailPaymentPolicy) {
  if (policy.snappPayInstallmentsEnabled) {
    throw new ApiError(409, "SnappPay installments remain unavailable until Self API validation and Stage acceptance are complete.");
  }
  if (policy.inotiUssdEnabled && !await getRetailInotiReadiness(organizationId)) {
    throw new ApiError(409, "A verified tenant iNoti integration and payment rollout are required before enabling USSD.");
  }
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} AND "slug" = ${organizationSlug} FOR UPDATE`;
    const previousPricing = await tx.retailInstallmentPricingPolicy.findUnique({ where: { organizationId }, select: { id: true, markupPercent: true, version: true } });
    const previousMarkup = previousPricing?.markupPercent ?? new Prisma.Decimal(0);
    const requestedMarkup = new Prisma.Decimal(policy.installmentMarkupPercent);
    const pricingChanged = previousMarkup.comparedTo(requestedMarkup) !== 0;
    const version = previousPricing ? previousPricing.version + (pricingChanged ? 1 : 0) : 1;
    const pricing = await tx.retailInstallmentPricingPolicy.upsert({
      where: { organizationId },
      create: { organizationId, markupPercent: requestedMarkup, version, updatedByUserId: actorUserId },
      update: { markupPercent: requestedMarkup, version, updatedByUserId: actorUserId },
      select: { markupPercent: true, version: true },
    });
    const savedPolicy = { ...policy, installmentMarkupPercent: pricing.markupPercent.toString(), installmentPricingPolicyVersion: pricing.version };
    const previous = await tx.paymentSettings.findUnique({ where: { organizationSlug }, select: { settings: true } });
    const current = previous?.settings && typeof previous.settings === "object" && !Array.isArray(previous.settings)
      ? previous.settings as Prisma.JsonObject : {};
    await tx.paymentSettings.upsert({
      where: { organizationSlug },
      create: { organizationSlug, settings: { ...current, retailR4: savedPolicy } },
      update: { settings: { ...current, retailR4: savedPolicy } },
    });
    const before = fromSettings(previous?.settings ?? null);
    await tx.auditLog.create({ data: {
      action: "UPDATE", entityType: "RetailPaymentPolicy", entityId: organizationId,
      organizationId, organizationSlug, userId: actorUserId,
      description: "Merchant updated retail payment policy",
      previousValue: { bankTransferEnabled: before.bankTransferEnabled, cashEnabled: before.cashEnabled,
        inotiUssdEnabled: before.inotiUssdEnabled, snappPayInstallmentsEnabled: before.snappPayInstallmentsEnabled,
        installmentMarkupPercent: previousMarkup.toString(), installmentPricingPolicyVersion: previousPricing?.version ?? 0 },
      newValue: { bankTransferEnabled: policy.bankTransferEnabled, cashEnabled: policy.cashEnabled,
        inotiUssdEnabled: policy.inotiUssdEnabled, snappPayInstallmentsEnabled: policy.snappPayInstallmentsEnabled, cashModes: policy.cashModes,
        installmentMarkupPercent: savedPolicy.installmentMarkupPercent, installmentPricingPolicyVersion: savedPolicy.installmentPricingPolicyVersion,
        cashBeforeConfirmation: policy.cashBeforeConfirmation,
        paymentDeadlinesMinutes: policy.paymentDeadlinesMinutes },
    } });
    return savedPolicy;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function requireEnabledRetailPaymentMethod(organizationSlug: string, organizationId: string, method: "BANK_TRANSFER" | "CASH" | "INOTI_USSD" | "SNAPPPAY_INSTALLMENT") {
  const policy = await getRetailPaymentPolicy(organizationSlug);
  if (method === "BANK_TRANSFER" && policy.bankTransferEnabled && policy.bankCardNumber && policy.bankAccountOwner) return policy;
  if (method === "CASH" && policy.cashEnabled) return policy;
  if (method === "INOTI_USSD" && policy.inotiUssdEnabled && await getRetailInotiReadiness(organizationId)) return policy;
  if (method === "SNAPPPAY_INSTALLMENT" && policy.snappPayInstallmentsEnabled) {
    throw new ApiError(409, "SnappPay installments remain unavailable until Self API validation and Stage acceptance are complete.");
  }
  throw new ApiError(409, "Selected payment method is not available.");
}
