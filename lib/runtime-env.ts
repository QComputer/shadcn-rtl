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
    aiMediaServiceEnabled: boolean;
    aiMediaServiceUrlConfigured: boolean;
    aiMediaServiceInternalKeyConfigured: boolean;
    aiMediaPaidProviderRequested: boolean;
    aiMediaPaidProviderConfigured: boolean;
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
  const aiMediaPaidProviderHasDailyLimit = Number.isFinite(aiMediaPaidProviderDailyLimit) && aiMediaPaidProviderDailyLimit > 0;
  const aiMediaPaidProviderHasMonthlyBudget = Number.isFinite(aiMediaPaidProviderMonthlyBudget) && aiMediaPaidProviderMonthlyBudget > 0;
  const aiMediaPaidProviderConfigured = aiMediaPaidProviderApproved
    && aiMediaPaidProviderApprovedBy
    && aiMediaPaidProviderApprovedAt
    && aiMediaPaidProviderHasDailyLimit
    && aiMediaPaidProviderHasMonthlyBudget;

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
      aiMediaServiceEnabled,
      aiMediaServiceUrlConfigured,
      aiMediaServiceInternalKeyConfigured,
      aiMediaPaidProviderRequested,
      aiMediaPaidProviderConfigured,
    },
  };
}
