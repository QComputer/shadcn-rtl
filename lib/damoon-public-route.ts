const DAMOON_HOST = /^(?:www\.)?damoon-hotel\.ir\.?(:\d{1,5})?$/i;

const PUBLIC_PATHS = new Set([
  "/",
  "/rooms",
  "/rooms/single",
  "/rooms/double",
  "/rooms/suite-3-bed",
  "/rooms/suite-4-5-bed",
  "/restaurant",
  "/cafe",
  "/facilities",
  "/gallery",
  "/about",
  "/contact",
  "/policies",
  "/virtual-tour",
]);

export type DamoonPublicRoute =
  | { kind: "rewrite"; pathname: "/damoon-front/index.html" }
  | { kind: "redirect"; pathname: "/" }
  | { kind: "robots"; body: string }
  | { kind: "not-found" }
  | { kind: "no-content" };

function isDamoonHost(rawHost: string | null | undefined): boolean {
  if (!rawHost || /[\s/@?#\\]/.test(rawHost)) return false;
  const match = rawHost.match(DAMOON_HOST);
  if (!match) return false;
  const portText = match[1]?.slice(1);
  if (portText && (Number(portText) < 1 || Number(portText) > 65535)) return false;
  return true;
}

function normalizedPath(pathname: string): string | null {
  if (!pathname.startsWith("/") || /[%\\?#]/.test(pathname)) return null;
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (trimmed === "/fa") return "/";
  return trimmed.startsWith("/fa/") ? trimmed.slice(3) : trimmed;
}

/** Matches only public, read-only routes on an actual Damoon Host header. */
export function resolveDamoonPublicRoute(input: {
  hostHeader: string | null | undefined;
  pathname: string;
  method: string;
}): DamoonPublicRoute | null {
  if (!isDamoonHost(input.hostHeader)) return null;

  const method = input.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return null;

  if (!input.pathname.startsWith("/") || /[%\\?#]/.test(input.pathname)) return null;
  const rawPath = input.pathname.length > 1 ? input.pathname.replace(/\/+$/, "") : input.pathname;
  if (rawPath === "/fa/damoon-hotel") return { kind: "redirect", pathname: "/" };
  if (rawPath === "/robots.txt") {
    return { kind: "robots", body: "User-agent: *\nDisallow: /\n" };
  }
  if (rawPath === "/sitemap.xml") return { kind: "not-found" };
  if (rawPath === "/favicon.ico") return { kind: "no-content" };
  const path = normalizedPath(rawPath);
  if (!path) return null;
  if (!PUBLIC_PATHS.has(path)) return null;

  return { kind: "rewrite", pathname: "/damoon-front/index.html" };
}
