import "server-only";

type OrganizationBrandProviderIssue =
  | "not-requested"
  | "execution-not-requested"
  | "dry-run-enabled"
  | "service-url-missing"
  | "internal-key-missing"
  | "approval-missing"
  | "approval-metadata-missing"
  | "daily-limit-missing"
  | "estimated-cost-missing"
  | "rollback-paused";

function hasValue(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function parsePositiveInt(value: string | undefined) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isValidDate(value: string | undefined) {
  return hasValue(value) && !Number.isNaN(new Date(value as string).getTime());
}

function isProbablyUrl(value: string | undefined) {
  if (!hasValue(value)) return false;
  try {
    const parsed = new URL(value as string);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function getServiceUrl() {
  return process.env.CREATIVE_STUDIO_ORGANIZATION_BRAND_SERVICE_URL
    || process.env.AI_MEDIA_SERVICE_BASE_URL
    || process.env.AI_MEDIA_SERVICE_URL;
}

function getInternalKey() {
  return process.env.CREATIVE_STUDIO_ORGANIZATION_BRAND_INTERNAL_KEY
    || process.env.AI_MEDIA_SERVICE_INTERNAL_KEY;
}

export type OrganizationBrandProviderStatus = {
  phase: "P117";
  providerContract: "creative-studio-organization-brand-v1";
  executionMode: "disabled" | "dry-run" | "provider-requested";
  requested: boolean;
  enabled: boolean;
  configured: boolean;
  executionRequested: boolean;
  dryRun: boolean;
  dryRunSupported: true;
  providerExecutionEnabled: boolean;
  providerContractReady: boolean;
  serviceUrlConfigured: boolean;
  internalKeyConfigured: boolean;
  approvalRequired: true;
  approved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  dailyJobLimit: number | null;
  estimatedJobCostCents: number | null;
  rollback: {
    paused: boolean;
    reason: string | null;
    by: string | null;
    at: string | null;
  };
  issues: OrganizationBrandProviderIssue[];
};

export function getOrganizationBrandProviderStatus(): OrganizationBrandProviderStatus {
  const requested = process.env.CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_ENABLED === "true";
  const executionRequested = process.env.CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_EXECUTION_ENABLED === "true";
  const dryRun = process.env.CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_DRY_RUN !== "false";
  const serviceUrlConfigured = isProbablyUrl(getServiceUrl());
  const internalKeyConfigured = hasValue(getInternalKey());
  const approved = process.env.CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_APPROVED === "true";
  const approvedBy = hasValue(process.env.CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_APPROVED_BY)
    ? process.env.CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_APPROVED_BY!.trim()
    : null;
  const approvedAt = isValidDate(process.env.CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_APPROVED_AT)
    ? process.env.CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_APPROVED_AT!.trim()
    : null;
  const dailyJobLimit = parsePositiveInt(process.env.CREATIVE_STUDIO_ORGANIZATION_BRAND_DAILY_JOB_LIMIT);
  const estimatedJobCostCents = parsePositiveInt(process.env.CREATIVE_STUDIO_ORGANIZATION_BRAND_ESTIMATED_JOB_COST_CENTS);
  const rollbackPaused = process.env.CREATIVE_STUDIO_ORGANIZATION_BRAND_ROLLBACK_PAUSED === "true";
  const rollbackReason = hasValue(process.env.CREATIVE_STUDIO_ORGANIZATION_BRAND_ROLLBACK_REASON)
    ? process.env.CREATIVE_STUDIO_ORGANIZATION_BRAND_ROLLBACK_REASON!.trim()
    : null;
  const rollbackBy = hasValue(process.env.CREATIVE_STUDIO_ORGANIZATION_BRAND_ROLLBACK_BY)
    ? process.env.CREATIVE_STUDIO_ORGANIZATION_BRAND_ROLLBACK_BY!.trim()
    : null;
  const rollbackAt = isValidDate(process.env.CREATIVE_STUDIO_ORGANIZATION_BRAND_ROLLBACK_AT)
    ? process.env.CREATIVE_STUDIO_ORGANIZATION_BRAND_ROLLBACK_AT!.trim()
    : null;

  const issues: OrganizationBrandProviderIssue[] = [];
  if (!requested) issues.push("not-requested");
  if (requested && !executionRequested) issues.push("execution-not-requested");
  if (requested && executionRequested && dryRun) issues.push("dry-run-enabled");
  if (requested && !serviceUrlConfigured) issues.push("service-url-missing");
  if (requested && !internalKeyConfigured) issues.push("internal-key-missing");
  if (requested && !approved) issues.push("approval-missing");
  if (requested && (!approvedBy || !approvedAt)) issues.push("approval-metadata-missing");
  if (requested && !dailyJobLimit) issues.push("daily-limit-missing");
  if (requested && !estimatedJobCostCents) issues.push("estimated-cost-missing");
  if (requested && rollbackPaused) issues.push("rollback-paused");

  const configured = serviceUrlConfigured
    && internalKeyConfigured
    && approved
    && Boolean(approvedBy)
    && Boolean(approvedAt)
    && Boolean(dailyJobLimit)
    && Boolean(estimatedJobCostCents);
  const enabled = requested && configured && !rollbackPaused;
  const providerExecutionEnabled = enabled && executionRequested && !dryRun;

  return {
    phase: "P117",
    providerContract: "creative-studio-organization-brand-v1",
    executionMode: providerExecutionEnabled ? "provider-requested" : requested && executionRequested && dryRun ? "dry-run" : "disabled",
    requested,
    enabled,
    configured,
    executionRequested,
    dryRun,
    dryRunSupported: true,
    providerExecutionEnabled,
    providerContractReady: enabled,
    serviceUrlConfigured,
    internalKeyConfigured,
    approvalRequired: true,
    approved,
    approvedBy,
    approvedAt,
    dailyJobLimit,
    estimatedJobCostCents,
    rollback: {
      paused: rollbackPaused,
      reason: rollbackReason,
      by: rollbackBy,
      at: rollbackAt,
    },
    issues,
  };
}
