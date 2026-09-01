import "server-only";

import { prisma } from "@/lib/db";
import { normalizeDomainHost } from "@/lib/custom-domain-routing";
import {
  resolveOrganizationEndpoint,
  type ResolvedOrganizationEndpoint,
} from "@/lib/organization-endpoints";

export type ResolvedForwardedAppTenant = {
  organizationId: string;
  slug: string;
  endpoint: ResolvedOrganizationEndpoint;
};

export type ForwardedAppResolutionInput = {
  forwardedHost: string;
  proxyCredential: string;
  appBasePath: "" | "/app";
  pathname: string;
};

export type ForwardedAppResolutionResult =
  | { status: "resolved"; tenant: ResolvedForwardedAppTenant }
  | { status: "unauthorized" }
  | { status: "no-tenant" };

function getExpectedProxyCredential(): string | null {
  const value = process.env.BAZARBAAZ_APP_PROXY_TOKEN;
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length >= 32 ? trimmed : null;
}

function isTrustedProxyEnabled(): boolean {
  return getExpectedProxyCredential() !== null;
}

function credentialsMatch(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let result = 0;
  for (let i = 0; i < provided.length; i++) {
    result |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}

function pathIsUnderPrefix(pathname: string, pathPrefix: string): boolean {
  if (!pathPrefix) return true;
  if (pathname === pathPrefix) return true;
  return pathname.startsWith(`${pathPrefix}/`);
}

export async function resolveTrustedForwardedAppTenant(
  input: ForwardedAppResolutionInput,
): Promise<ForwardedAppResolutionResult> {
  if (!isTrustedProxyEnabled()) {
    return { status: "unauthorized" };
  }

  const expectedCredential = getExpectedProxyCredential();
  if (!expectedCredential || !credentialsMatch(input.proxyCredential, expectedCredential)) {
    return { status: "unauthorized" };
  }

  const normalizedHost = normalizeDomainHost(input.forwardedHost);
  if (!normalizedHost) {
    return { status: "no-tenant" };
  }

  const organizations = await prisma.organization.findMany({
    where: { isActive: true, deletedAt: null },
    select: {
      id: true,
      slug: true,
      settings: { select: { settings: true } },
    },
  });

  for (const org of organizations) {
    const endpoint = resolveOrganizationEndpoint({
      organizationId: org.id,
      role: "APP",
      settings: org.settings?.settings,
    });

    if (!endpoint) continue;

    const endpointHost = normalizeDomainHost(new URL(endpoint.origin).host);
    if (endpointHost !== normalizedHost) continue;

    if (endpoint.pathPrefix !== input.appBasePath) continue;

    if (!pathIsUnderPrefix(input.pathname, endpoint.pathPrefix)) continue;

    return {
      status: "resolved",
      tenant: {
        organizationId: org.id,
        slug: org.slug,
        endpoint,
      },
    };
  }

  return { status: "no-tenant" };
}

export function extractProxyCredential(request: { headers: { get(name: string): string | null } }): string | null {
  const value = request.headers.get("x-bazarbaaz-proxy-token");
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
