import "server-only";

import { prisma } from "@/lib/db";
import { normalizeDomainHost, isPlatformHost } from "@/lib/custom-domain-routing";
import { resolveActiveTenantForHost } from "@/lib/domains/domain-resolver.server";
import { resolveOrganizationEndpointForTenant } from "@/lib/organization-endpoints.server";
import { resolveTenantPwaBranding, type TenantPwaBranding } from "@/lib/organization-branding";
import { resolveAppBasePath } from "@/lib/app-base-path";

export type TenantPwaRequestContext =
  | { kind: "platform"; organizationId: "platform" }
  | { kind: "tenant"; organizationId: string; branding: TenantPwaBranding; locale: "fa" | "en" | "ar" }
  | { kind: "unknown" };

type HeaderReader = { get(name: string): string | null };

function locale(value: string | null | undefined): "fa" | "en" | "ar" {
  return value === "en" || value === "ar" ? value : "fa";
}

async function loadTenant(organizationId: string, preferredLocale?: string | null): Promise<TenantPwaRequestContext> {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, isActive: true, deletedAt: null, isPlatformOwner: false },
    select: {
      id: true,
      name: true,
      logo: true,
      locale: true,
      branding: true,
    },
  });
  if (!organization) return { kind: "unknown" };
  return {
    kind: "tenant",
    organizationId: organization.id,
    locale: locale(preferredLocale || organization.locale),
    branding: resolveTenantPwaBranding({
      organizationId: organization.id,
      name: organization.name,
      logo: organization.logo,
      branding: organization.branding,
    }),
  };
}

/** Resolve only from the platform Host or the sanitized proxy/DB domain mapping. */
export async function resolveTenantPwaRequestContext(requestHeaders: HeaderReader): Promise<TenantPwaRequestContext> {
  const host = normalizeDomainHost(requestHeaders.get("host"));
  if (!host) return { kind: "unknown" };

  if (isPlatformHost(host)) {
    const isTrustedForward = requestHeaders.get("x-bazar-forwarded-app") === "true";
    const organizationId = isTrustedForward ? requestHeaders.get("x-bazar-tenant-organization-id") : null;
    const forwardedHost = isTrustedForward ? normalizeDomainHost(requestHeaders.get("x-bazar-forwarded-host")) : "";
    if (!organizationId || !forwardedHost) return { kind: "platform", organizationId: "platform" };

    // proxy.ts strips incoming copies of these headers and sets them only after
    // token validation plus APP endpoint/domain ownership checks. Recheck the
    // active organization and endpoint to fail closed if configuration changed.
    const [tenant, endpoint] = await Promise.all([
      loadTenant(organizationId, requestHeaders.get("x-bazar-tenant-public-locale")),
      resolveOrganizationEndpointForTenant({ organizationId, role: "APP" }).catch(() => null),
    ]);
    if (tenant.kind !== "tenant" || !endpoint) return { kind: "unknown" };
    let endpointHost = "";
    try {
      endpointHost = normalizeDomainHost(new URL(endpoint.origin).host);
    } catch {
      return { kind: "unknown" };
    }
    return endpointHost === forwardedHost && endpoint.pathPrefix === resolveAppBasePath()
      ? tenant
      : { kind: "unknown" };
  }

  const tenant = await resolveActiveTenantForHost(prisma, host).catch(() => null);
  if (!tenant) return { kind: "unknown" };
  return loadTenant(tenant.organizationId, requestHeaders.get("x-bazar-tenant-public-locale") || tenant.locale);
}
