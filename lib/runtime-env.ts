export type RuntimeEnvIssueSeverity = "error" | "warning";

export type RuntimeEnvIssue = {
  name: string;
  severity: RuntimeEnvIssueSeverity;
  message: string;
};

export type RuntimeEnvValidation = {
  ok: boolean;
  issues: RuntimeEnvIssue[];
  summary: {
    nodeEnv: string;
    hasDatabaseUrl: boolean;
    hasNextAuthSecret: boolean;
    publicAppUrlConfigured: boolean;
    deployedAppUrlConfigured: boolean;
    authTrustHost: string | null;
    googleOAuthConfigured: boolean;
    webPushProvider: string;
    webPushDryRun: boolean;
    webPushPublicKeyConfigured: boolean;
    webPushRealSendEnabled: boolean;
    smsProvider: string;
    smsDryRun: boolean;
    smsIrConfigured: boolean;
    smsRealSendEnabled: boolean;
    aiMediaServiceEnabled: boolean;
    aiMediaServiceUrlConfigured: boolean;
    aiMediaServiceInternalKeyConfigured: boolean;
    aiMediaPaidProviderRequested: boolean;
    aiMediaPaidProviderConfigured: boolean;
    aiMediaPaidProviderRollbackPaused: boolean;
  };
};

function hasValue(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function isProbablyUrl(value: string | undefined) {
  if (!hasValue(value)) return false;
  try {
    const url = new URL(value as string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateRuntimeEnvironment(): RuntimeEnvValidation {
  const nodeEnv = process.env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";
  const issues: RuntimeEnvIssue[] = [];

  if (!hasValue(process.env.DATABASE_URL)) {
    issues.push({
      name: "DATABASE_URL",
      severity: "error",
      message: "DATABASE_URL is required for database-backed runtime routes.",
    });
  } else if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || "")) {
    issues.push({
      name: "DATABASE_URL",
      severity: "warning",
      message: "DATABASE_URL is configured but does not look like a PostgreSQL URL.",
    });
  }

  if (isProduction && !hasValue(process.env.NEXTAUTH_SECRET)) {
    issues.push({
      name: "NEXTAUTH_SECRET",
      severity: "error",
      message: "NEXTAUTH_SECRET is required in production.",
    });
  }

  if (!isProbablyUrl(process.env.NEXT_PUBLIC_DEPLOYED_APP_URL) && !isProbablyUrl(process.env.NEXT_PUBLIC_APP_URL)) {
    issues.push({
      name: "NEXT_PUBLIC_DEPLOYED_APP_URL",
      severity: "warning",
      message: "Configure NEXT_PUBLIC_DEPLOYED_APP_URL or NEXT_PUBLIC_APP_URL for canonical URLs and metadata.",
    });
  }

  const hasGoogleClientId = hasValue(process.env.GOOGLE_CLIENT_ID);
  const hasGoogleClientSecret = hasValue(process.env.GOOGLE_CLIENT_SECRET);
  if (hasGoogleClientId !== hasGoogleClientSecret) {
    issues.push({
      name: "GOOGLE_OAUTH",
      severity: "warning",
      message: "Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither.",
    });
  }

  if (isProduction && process.env.AUTH_TRUST_HOST !== "true") {
    issues.push({
      name: "AUTH_TRUST_HOST",
      severity: "warning",
      message: "AUTH_TRUST_HOST=true is recommended when NextAuth runs behind a reverse proxy/platform router.",
    });
  }

  const webPushProvider = process.env.WEB_PUSH_PROVIDER || "dry_run";
  const webPushDryRun = process.env.WEB_PUSH_DRY_RUN !== "false";
  const webPushRealSendEnabled = process.env.WEB_PUSH_REAL_SEND_ENABLED === "true";

  if (!["dry_run", "web_push"].includes(webPushProvider)) {
    issues.push({
      name: "WEB_PUSH_PROVIDER",
      severity: "error",
      message: "WEB_PUSH_PROVIDER must be either dry_run or web_push.",
    });
  }

  if (!hasValue(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY)) {
    issues.push({
      name: "NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY",
      severity: "warning",
      message: "Set NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY before enabling browser Web Push opt-in.",
    });
  }

  if (webPushProvider === "web_push" && webPushRealSendEnabled && !webPushDryRun) {
    if (!hasValue(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY)) {
      issues.push({
        name: "NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY",
        severity: "error",
        message: "NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY is required when real Web Push is enabled.",
      });
    }

    if (!hasValue(process.env.WEB_PUSH_VAPID_PRIVATE_KEY)) {
      issues.push({
        name: "WEB_PUSH_VAPID_PRIVATE_KEY",
        severity: "error",
        message: "WEB_PUSH_VAPID_PRIVATE_KEY is required when real Web Push is enabled.",
      });
    }

    if (!hasValue(process.env.WEB_PUSH_VAPID_SUBJECT)) {
      issues.push({
        name: "WEB_PUSH_VAPID_SUBJECT",
        severity: "error",
        message: "WEB_PUSH_VAPID_SUBJECT is required when real Web Push is enabled.",
      });
    }
  }

  const smsProvider = (process.env.SMS_PROVIDER || "dry_run").trim().toLowerCase().replaceAll("-", "_");
  const smsDryRun = process.env.SMS_DRY_RUN !== "false";
  const smsIrLineConfigured = hasValue(process.env.SMS_IR_LINE_NUMBER) || hasValue(process.env.SMS_IR_LINE);
  const smsIrConfigured = hasValue(process.env.SMS_IR_API_KEY) && smsIrLineConfigured;
  const smsRealSendEnabled = smsProvider === "sms_ir" && !smsDryRun;

  if (!["dry_run", "sms_ir"].includes(smsProvider)) {
    issues.push({
      name: "SMS_PROVIDER",
      severity: "error",
      message: "SMS_PROVIDER must be either dry_run or sms_ir.",
    });
  }

  if (smsRealSendEnabled) {
    if (!hasValue(process.env.SMS_IR_API_KEY)) {
      issues.push({
        name: "SMS_IR_API_KEY",
        severity: "error",
        message: "SMS_IR_API_KEY is required when real SMS.ir sending is enabled.",
      });
    }

    if (!smsIrLineConfigured) {
      issues.push({
        name: "SMS_IR_LINE_NUMBER",
        severity: "error",
        message: "SMS_IR_LINE_NUMBER or SMS_IR_LINE is required when real SMS.ir sending is enabled.",
      });
    }

    if (!isProduction) {
      issues.push({
        name: "SMS_DRY_RUN",
        severity: "warning",
        message: "Real SMS sending is enabled outside production. Keep SMS_DRY_RUN=true for local, test, CI, and deployed smoke tests.",
      });
    }
  }

  const aiMediaServiceEnabled = process.env.AI_MEDIA_SERVICE_ENABLED === "true";
  const aiMediaServiceUrlConfigured = isProbablyUrl(process.env.AI_MEDIA_SERVICE_URL);
  const aiMediaServiceInternalKeyConfigured = hasValue(process.env.AI_MEDIA_SERVICE_INTERNAL_KEY);
  const aiMediaPaidProviderRequested = process.env.AI_MEDIA_PAID_PROVIDER_ENABLED === "true";
  const aiMediaPaidProviderApproved = process.env.AI_MEDIA_PAID_PROVIDER_APPROVED === "true";
  const aiMediaPaidProviderApprovedBy = hasValue(process.env.AI_MEDIA_PAID_PROVIDER_APPROVED_BY);
  const aiMediaPaidProviderApprovedAt = hasValue(process.env.AI_MEDIA_PAID_PROVIDER_APPROVED_AT)
    && !Number.isNaN(new Date(process.env.AI_MEDIA_PAID_PROVIDER_APPROVED_AT as string).getTime());
  const aiMediaPaidProviderDailyLimit = Number.parseInt(process.env.AI_MEDIA_PAID_PROVIDER_DAILY_COST_LIMIT_CENTS || "", 10);
  const aiMediaPaidProviderMonthlyBudget = Number.parseInt(process.env.AI_MEDIA_PAID_PROVIDER_MONTHLY_BUDGET_CENTS || "", 10);
  const aiMediaPaidProviderEstimatedJobCost = Number.parseInt(process.env.AI_MEDIA_PAID_PROVIDER_ESTIMATED_JOB_COST_CENTS || "", 10);
  const aiMediaPaidProviderHasDailyLimit = Number.isFinite(aiMediaPaidProviderDailyLimit) && aiMediaPaidProviderDailyLimit > 0;
  const aiMediaPaidProviderHasMonthlyBudget = Number.isFinite(aiMediaPaidProviderMonthlyBudget) && aiMediaPaidProviderMonthlyBudget > 0;
  const aiMediaPaidProviderHasEstimatedJobCost = Number.isFinite(aiMediaPaidProviderEstimatedJobCost) && aiMediaPaidProviderEstimatedJobCost > 0;
  const aiMediaPaidProviderRollbackPaused = process.env.AI_MEDIA_PAID_PROVIDER_ROLLBACK_PAUSED === "true";
  const aiMediaPaidProviderRollbackReasonConfigured = hasValue(process.env.AI_MEDIA_PAID_PROVIDER_ROLLBACK_REASON);
  const aiMediaPaidProviderConfigured = aiMediaPaidProviderApproved
    && aiMediaPaidProviderApprovedBy
    && aiMediaPaidProviderApprovedAt
    && aiMediaPaidProviderHasDailyLimit
    && aiMediaPaidProviderHasMonthlyBudget
    && aiMediaPaidProviderHasEstimatedJobCost;

  if (aiMediaServiceEnabled) {
    if (!aiMediaServiceUrlConfigured) {
      issues.push({
        name: "AI_MEDIA_SERVICE_URL",
        severity: "error",
        message: "AI_MEDIA_SERVICE_URL is required when AI_MEDIA_SERVICE_ENABLED is true.",
      });
    }
    if (!aiMediaServiceInternalKeyConfigured) {
      issues.push({
        name: "AI_MEDIA_SERVICE_INTERNAL_KEY",
        severity: "error",
        message: "AI_MEDIA_SERVICE_INTERNAL_KEY is required when AI_MEDIA_SERVICE_ENABLED is true.",
      });
    }
  }

  if (aiMediaPaidProviderRequested && !aiMediaPaidProviderConfigured) {
    issues.push({
      name: "AI_MEDIA_PAID_PROVIDER_ENABLED",
      severity: "error",
      message: "Paid AI media requires approval metadata and positive daily/monthly cost guardrails.",
    });
  }

  if (aiMediaPaidProviderRequested && aiMediaPaidProviderRollbackPaused && !aiMediaPaidProviderRollbackReasonConfigured) {
    issues.push({
      name: "AI_MEDIA_PAID_PROVIDER_ROLLBACK_REASON",
      severity: "error",
      message: "A rollback reason is required when the paid AI media provider is paused.",
    });
  }

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    issues,
    summary: {
      nodeEnv,
      hasDatabaseUrl: hasValue(process.env.DATABASE_URL),
      hasNextAuthSecret: hasValue(process.env.NEXTAUTH_SECRET),
      publicAppUrlConfigured: isProbablyUrl(process.env.NEXT_PUBLIC_APP_URL),
      deployedAppUrlConfigured: isProbablyUrl(process.env.NEXT_PUBLIC_DEPLOYED_APP_URL),
      authTrustHost: process.env.AUTH_TRUST_HOST || null,
      googleOAuthConfigured: hasGoogleClientId && hasGoogleClientSecret,
      webPushProvider,
      webPushDryRun,
      webPushPublicKeyConfigured: hasValue(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY),
      webPushRealSendEnabled,
      smsProvider,
      smsDryRun,
      smsIrConfigured,
      smsRealSendEnabled,
      aiMediaServiceEnabled,
      aiMediaServiceUrlConfigured,
      aiMediaServiceInternalKeyConfigured,
      aiMediaPaidProviderRequested,
      aiMediaPaidProviderConfigured,
      aiMediaPaidProviderRollbackPaused,
    },
  };
}
