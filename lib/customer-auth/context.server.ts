import "server-only";
import { prisma } from "@/lib/db";
import { normalizeDomainHost, isPlatformHost } from "@/lib/custom-domain-routing";
import { resolveTenantPwaRequestContext } from "@/lib/tenant-pwa-context.server";
import { resolveOrganizationEndpointForTenant } from "@/lib/organization-endpoints.server";

export type CustomerAuthContext = {
  organizationId: string; slug: string; name: string; logo: string | null;
  origin: string; homePath: string;
};
const domainWhere = { status: "ACTIVE" as const, providerVerified: true, dnsConfigured: true,
  sslReady: true, deletedAt: null, disabledAt: null, removedAt: null };

function publicOrigin(rawHost: string | null, requestUrl: string): string | null {
  if (!rawHost || !/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(rawHost)) return null;
  try {
    const host = new URL(`https://${rawHost.toLowerCase()}`);
    const local = host.hostname === "localhost" || host.hostname === "127.0.0.1" || host.hostname.endsWith(".localhost");
    if (process.env.NODE_ENV !== "production" && local && new URL(requestUrl).protocol === "http:") return `http://${host.host}`;
    return host.port ? null : host.origin;
  } catch { return null; }
}

async function loadOrganization(id: string) {
  return prisma.organization.findFirst({ where: { id, isActive: true, deletedAt: null, isPlatformOwner: false },
    select: { id: true, slug: true, name: true, logo: true, locale: true,
      branding: { select: { displayName: true, logoUrl: true } },
      capabilities: { where: { key: "SHOP", status: "ACTIVE", enabledAt: { not: null } }, select: { id: true }, take: 1 } } });
}
function context(org: NonNullable<Awaited<ReturnType<typeof loadOrganization>>>, origin: string): CustomerAuthContext {
  const locale = ["fa", "en", "ar"].includes(org.locale) ? org.locale : "fa";
  return { organizationId: org.id, slug: org.slug, name: org.branding?.displayName || org.name,
    logo: org.branding?.logoUrl || org.logo, origin,
    homePath: org.capabilities.length ? "/shop" : `/${locale}/${encodeURIComponent(org.slug)}` };
}

/** Server-owned SMS destination. No request Host, returnTo, or client URL is used. */
export async function resolveCustomerAuthDestination(organizationId: string): Promise<CustomerAuthContext | null> {
  const org = await loadOrganization(organizationId);
  if (!org) return null;
  const endpoint = await resolveOrganizationEndpointForTenant({ organizationId, role: "APP" }).catch(() => null);
  if (endpoint) {
    // A prefixed app needs a separately reviewed link/cookie contract.
    if (endpoint.pathPrefix) return null;
    const url = new URL(endpoint.origin);
    const owned = await prisma.organizationDomain.findFirst({ where: { organizationId, normalizedDomain: normalizeDomainHost(url.hostname), ...domainWhere }, select: { id: true } });
    return owned ? context(org, endpoint.origin) : null;
  }
  const domain = await prisma.organizationDomain.findFirst({ where: { organizationId, ...domainWhere }, orderBy: { createdAt: "asc" }, select: { normalizedDomain: true } });
  if (!domain || isPlatformHost(domain.normalizedDomain)) return null;
  // Isolated development uses verified fixture .localhost hosts on the same
  // server-owned port. Never accept a request-supplied port or weaken production TLS.
  if (process.env.NODE_ENV === "development" && domain.normalizedDomain.endsWith(".localhost")) {
    try {
      const local = new URL(process.env.NEXTAUTH_URL ?? "");
      if (local.protocol === "http:" && ["localhost", "127.0.0.1"].includes(local.hostname)) {
        return context(org, `http://${domain.normalizedDomain}${local.port ? `:${local.port}` : ""}`);
      }
    } catch { /* normal HTTPS destination below */ }
  }
  return context(org, `https://${domain.normalizedDomain}`);
}

/** Trusted proxy/domain resolver supplies tenant identity; an optional slug can only narrow it. */
export async function resolveCustomerAuthContext(request: Request, organizationIdentifier?: string | null): Promise<CustomerAuthContext | null> {
  try {
    const tenant = await resolveTenantPwaRequestContext(request.headers);
    if (tenant.kind !== "tenant") return null;
    const org = await loadOrganization(tenant.organizationId);
    if (!org || organizationIdentifier && organizationIdentifier !== org.slug) return null;
    const host = normalizeDomainHost(request.headers.get("host"));
    let rawPublicHost = request.headers.get("host");
    if (isPlatformHost(host)) {
      rawPublicHost = request.headers.get("x-bazar-forwarded-app") === "true"
        ? request.headers.get("x-bazar-forwarded-host")
        : request.headers.get("x-bazar-tenant-domain");
    }
    const publicHost = normalizeDomainHost(rawPublicHost);
    if (!publicHost || isPlatformHost(publicHost)) return null;
    const origin = publicOrigin(rawPublicHost, request.url);
    if (!origin) return null;
    const domain = await prisma.organizationDomain.findFirst({ where: { organizationId: org.id, normalizedDomain: publicHost, ...domainWhere }, select: { id: true } });
    return domain ? context(org, origin) : null;
  } catch { return null; }
}
