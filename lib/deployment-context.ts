export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || (process.env.VERCEL_ENV ?? "") === "production";
}

export function isPreviewRuntime(): boolean {
  return (process.env.VERCEL_ENV ?? "").toLowerCase() === "preview";
}

export function getDeploymentCommit(): string | null {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.RUNFLARE_GIT_COMMIT_SHA ||
    process.env.COMMIT_SHA ||
    null
  )?.slice(0, 8) ?? null;
}

export function getPlatformHost(): string | null {
  return (
    process.env.RUNFLARE_PLATFORM_HOST ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL ||
    null
  ) ?? null;
}
