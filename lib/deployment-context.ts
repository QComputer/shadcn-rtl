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

export function getDeploymentRevision(): string | null {
  // RunFlare/COMMIT_SHA are intentionally not trusted here until their value
  // is verified as part of that provider's build. APP_BUILD_REVISION is
  // captured from this exact checkout during `next build`.
  const revision = process.env.APP_BUILD_REVISION || process.env.VERCEL_GIT_COMMIT_SHA;
  if (!revision || !/^[0-9a-f]{12}(?:[0-9a-f]{28})?$/i.test(revision)) return null;
  return revision.toLowerCase().slice(0, 12);
}

export function getPlatformHost(): string | null {
  return (
    process.env.RUNFLARE_PLATFORM_HOST ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL ||
    null
  ) ?? null;
}
