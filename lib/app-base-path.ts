export const SUPPORTED_APP_BASE_PATH = "/app" as const;

export function resolveAppBasePath(value = process.env.APP_BASE_PATH ?? process.env.NEXT_PUBLIC_APP_BASE_PATH): "" | typeof SUPPORTED_APP_BASE_PATH {
  if (value === undefined || value.trim() === "") return "";
  const trimmed = value.trim();
  if (trimmed === SUPPORTED_APP_BASE_PATH) return SUPPORTED_APP_BASE_PATH;
  throw new Error(`Unsupported APP_BASE_PATH: "${trimmed}". Only unset or "/app" are valid for Bazarbaaz builds.`);
}

export function appPath(path: string, basePath = resolveAppBasePath()): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("Application path must be an absolute same-origin path");
  }
  if (!basePath || path === basePath || path.startsWith(`${basePath}/`)) return path;
  return `${basePath}${path}`;
}

export function stripAppBasePath(path: string, basePath = resolveAppBasePath()): string {
  if (!basePath) return path;
  if (path === basePath) return "/";
  return path.startsWith(`${basePath}/`) ? path.slice(basePath.length) : path;
}

/** A drop-in fetch wrapper for application-owned same-origin paths. */
export const appFetch: typeof fetch = (input, init) => {
  if (typeof input === "string" && input.startsWith("/") && !input.startsWith("//")) {
    return fetch(appPath(input), init);
  }
  return fetch(input, init);
};

export function appCookiePath(basePath = resolveAppBasePath()) {
  return basePath ? `${basePath}/` : "/";
}

/** Prefixes application-owned asset URLs while leaving remote/data URLs intact. */
export function appResourceUrl(value: string, basePath = resolveAppBasePath()): string {
  return value.startsWith("/") && !value.startsWith("//") ? appPath(value, basePath) : value;
}
