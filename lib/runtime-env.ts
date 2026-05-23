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
    },
  };
}
