import { isPlatformHost, normalizeDomainHost } from "@/lib/custom-domain-routing";

export const ORGANIZATION_ENDPOINT_SETTINGS_KEY = "organizationEndpoints";
export const ORGANIZATION_ENDPOINT_ROLES = ["PUBLIC", "APP", "API", "CALLBACK"] as const;

export type OrganizationEndpointRole = (typeof ORGANIZATION_ENDPOINT_ROLES)[number];

export type OrganizationEndpointDefinition = {
  role: OrganizationEndpointRole;
  origin?: string;
  organizationDomainId?: string;
  pathPrefix?: string;
};

export type OrganizationEndpointDomain = {
  id: string;
  organizationId: string;
  normalizedDomain: string;
  status: string;
  providerVerified: boolean;
  dnsConfigured: boolean;
  sslReady: boolean;
  deletedAt?: Date | string | null;
};

export type ResolvedOrganizationEndpoint = {
  organizationId: string;
  role: OrganizationEndpointRole;
  origin: string;
  pathPrefix: string;
  baseUrl: string;
  source: "ORGANIZATION_DOMAIN" | "EXPLICIT_ORIGIN";
  organizationDomainId: string | null;
};

const endpointRoleSet = new Set<string>(ORGANIZATION_ENDPOINT_ROLES);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePathPrefix(value: unknown): string {
  if (value === undefined || value === null || value === "" || value === "/") return "";
  if (typeof value !== "string") throw new Error("Organization endpoint pathPrefix must be a string");
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || /[?#\\]/.test(trimmed)) {
    throw new Error("Organization endpoint pathPrefix must be an absolute path without query or fragment");
  }
  const segments = trimmed.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("Organization endpoint pathPrefix cannot contain dot segments");
  }
  return segments.length ? `/${segments.join("/")}` : "";
}

function normalizeEndpointOrigin(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Organization endpoint origin is required");
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Organization endpoint origin must be a valid absolute URL");
  }
  if (url.protocol !== "https:") throw new Error("Organization endpoint origin must use HTTPS");
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("Organization endpoint origin must not contain credentials, path, query, or fragment");
  }
  const host = normalizeDomainHost(url.host);
  if (!host || isPlatformHost(host)) throw new Error("Platform hosts cannot be configured as tenant endpoints");
  return `https://${host}`;
}

export function readOrganizationEndpointDefinitions(settings: unknown): OrganizationEndpointDefinition[] {
  if (!isObject(settings)) return [];
  const raw = settings[ORGANIZATION_ENDPOINT_SETTINGS_KEY];
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error("Organization endpoint settings must be an array");

  const definitions = raw.map((entry): OrganizationEndpointDefinition => {
    if (!isObject(entry) || typeof entry.role !== "string" || !endpointRoleSet.has(entry.role)) {
      throw new Error("Organization endpoint role is invalid");
    }
    const hasOrigin = typeof entry.origin === "string" && Boolean(entry.origin.trim());
    const hasDomain = typeof entry.organizationDomainId === "string" && Boolean(entry.organizationDomainId.trim());
    if (hasOrigin === hasDomain) {
      throw new Error("Organization endpoint must define exactly one of origin or organizationDomainId");
    }
    return {
      role: entry.role as OrganizationEndpointRole,
      ...(hasOrigin ? { origin: entry.origin as string } : { organizationDomainId: entry.organizationDomainId as string }),
      pathPrefix: normalizePathPrefix(entry.pathPrefix),
    };
  });

  if (new Set(definitions.map((definition) => definition.role)).size !== definitions.length) {
    throw new Error("Organization endpoint roles must be unique per organization");
  }
  return definitions;
}

export function resolveOrganizationEndpoint(input: {
  organizationId: string;
  role: OrganizationEndpointRole;
  settings: unknown;
  domains?: readonly OrganizationEndpointDomain[];
}): ResolvedOrganizationEndpoint | null {
  const definition = readOrganizationEndpointDefinitions(input.settings)
    .find((candidate) => candidate.role === input.role);
  if (!definition) return null;

  const pathPrefix = normalizePathPrefix(definition.pathPrefix);
  if (definition.organizationDomainId) {
    const domain = (input.domains ?? []).find((candidate) => candidate.id === definition.organizationDomainId);
    if (!domain || domain.organizationId !== input.organizationId) {
      throw new Error("Organization endpoint domain does not belong to the organization");
    }
    if (
      domain.status !== "ACTIVE" ||
      !domain.providerVerified ||
      !domain.dnsConfigured ||
      !domain.sslReady ||
      domain.deletedAt
    ) {
      throw new Error("Organization endpoint domain is not active and verified");
    }
    const host = normalizeDomainHost(domain.normalizedDomain);
    if (!host || isPlatformHost(host)) throw new Error("Platform hosts cannot be tenant organization domains");
    const origin = `https://${host}`;
    return {
      organizationId: input.organizationId,
      role: input.role,
      origin,
      pathPrefix,
      baseUrl: `${origin}${pathPrefix}`,
      source: "ORGANIZATION_DOMAIN",
      organizationDomainId: domain.id,
    };
  }

  const origin = normalizeEndpointOrigin(definition.origin);
  return {
    organizationId: input.organizationId,
    role: input.role,
    origin,
    pathPrefix,
    baseUrl: `${origin}${pathPrefix}`,
    source: "EXPLICIT_ORIGIN",
    organizationDomainId: null,
  };
}

export function joinOrganizationEndpointPath(
  endpoint: Pick<ResolvedOrganizationEndpoint, "origin" | "pathPrefix">,
  path = "/",
): string {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Organization endpoint path must be an absolute same-origin path");
  }
  if (path.includes("\\") || path.split(/[?#]/, 1)[0].split("/").some((segment) => segment === "." || segment === "..")) {
    throw new Error("Organization endpoint path cannot contain backslashes or dot segments");
  }
  const parsed = new URL(path, "https://endpoint.invalid");
  if (parsed.origin !== "https://endpoint.invalid") throw new Error("Organization endpoint path must remain same-origin");
  const pathname = parsed.pathname === "/" ? "" : `/${parsed.pathname.split("/").filter(Boolean).join("/")}`;
  return `${endpoint.origin}${endpoint.pathPrefix}${pathname}${parsed.search}${parsed.hash}`;
}

export const resolveOrganizationPublicEndpoint = (input: Omit<Parameters<typeof resolveOrganizationEndpoint>[0], "role">) =>
  resolveOrganizationEndpoint({ ...input, role: "PUBLIC" });
export const resolveOrganizationAppEndpoint = (input: Omit<Parameters<typeof resolveOrganizationEndpoint>[0], "role">) =>
  resolveOrganizationEndpoint({ ...input, role: "APP" });
export const resolveOrganizationApiEndpoint = (input: Omit<Parameters<typeof resolveOrganizationEndpoint>[0], "role">) =>
  resolveOrganizationEndpoint({ ...input, role: "API" });
export const resolveOrganizationCallbackEndpoint = (input: Omit<Parameters<typeof resolveOrganizationEndpoint>[0], "role">) =>
  resolveOrganizationEndpoint({ ...input, role: "CALLBACK" });
