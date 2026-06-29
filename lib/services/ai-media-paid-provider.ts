import "server-only";

type AiMediaPaidProviderStatus = {
  requested: boolean;
  enabled: boolean;
  configured: boolean;
  approvalRequired: true;
  approved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  dailyCostLimitCents: number | null;
  monthlyBudgetCents: number | null;
  issues: string[];
};

function hasValue(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveInt(value: string | undefined) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizedDate(value: string | undefined) {
  if (!hasValue(value)) return null;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function getAiMediaPaidProviderStatus(): AiMediaPaidProviderStatus {
  const requested = process.env.AI_MEDIA_PAID_PROVIDER_ENABLED === "true";
  const approved = process.env.AI_MEDIA_PAID_PROVIDER_APPROVED === "true";
  const approvedBy = hasValue(process.env.AI_MEDIA_PAID_PROVIDER_APPROVED_BY)
    ? process.env.AI_MEDIA_PAID_PROVIDER_APPROVED_BY!.trim()
    : null;
  const approvedAt = normalizedDate(process.env.AI_MEDIA_PAID_PROVIDER_APPROVED_AT);
  const dailyCostLimitCents = positiveInt(process.env.AI_MEDIA_PAID_PROVIDER_DAILY_COST_LIMIT_CENTS);
  const monthlyBudgetCents = positiveInt(process.env.AI_MEDIA_PAID_PROVIDER_MONTHLY_BUDGET_CENTS);
  const issues: string[] = [];

  if (requested) {
    if (!approved) issues.push("AI_MEDIA_PAID_PROVIDER_APPROVED must be true");
    if (!approvedBy) issues.push("AI_MEDIA_PAID_PROVIDER_APPROVED_BY is required");
    if (!approvedAt) issues.push("AI_MEDIA_PAID_PROVIDER_APPROVED_AT must be a valid date");
    if (!dailyCostLimitCents) issues.push("AI_MEDIA_PAID_PROVIDER_DAILY_COST_LIMIT_CENTS must be positive");
    if (!monthlyBudgetCents) issues.push("AI_MEDIA_PAID_PROVIDER_MONTHLY_BUDGET_CENTS must be positive");
  }

  const configured = approved && Boolean(approvedBy && approvedAt && dailyCostLimitCents && monthlyBudgetCents);

  return {
    requested,
    enabled: requested && configured,
    configured,
    approvalRequired: true,
    approved,
    approvedBy,
    approvedAt,
    dailyCostLimitCents,
    monthlyBudgetCents,
    issues,
  };
}
