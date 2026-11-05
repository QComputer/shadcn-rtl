import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { appCookiePath, appPath } from "@/lib/app-base-path";
import { resolveCustomerAuthContext, resolveCustomerAuthDestination } from "@/lib/customer-auth/context.server";
import { createCustomerSsoVerifier, customerSsoAvailable, customerSsoChallenge } from "@/lib/customer-auth/sso.server";
import { normalizeDomainHost } from "@/lib/custom-domain-routing";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const unavailable = () => NextResponse.json({ error: "CUSTOMER_SSO_UNAVAILABLE" }, { status: 400, headers });

export async function POST(request: Request) {
  try {
    if (!customerSsoAvailable()) return unavailable();
    const target = await resolveCustomerAuthContext(request);
    if (!target || request.headers.get("origin") !== target.origin) return unavailable();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("source" in body) || typeof body.source !== "string" || body.source.length > 128) return unavailable();
    const sourceInput = body.source.trim();
    let sourceId: string | undefined;
    if (sourceInput.includes(".") || sourceInput.includes("://")) {
      const url = new URL(sourceInput.includes("://") ? sourceInput : `https://${sourceInput}`);
      if (url.protocol !== "https:" || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) return unavailable();
      const domain = await prisma.organizationDomain.findFirst({ where: { normalizedDomain: normalizeDomainHost(url.hostname), status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, deletedAt: null, disabledAt: null, removedAt: null }, select: { organizationId: true } });
      if (!domain) return unavailable();
      sourceId = domain.organizationId;
    }
    const sourceOrg = await prisma.organization.findFirst({ where: { ...(sourceId ? { id: sourceId } : { slug: sourceInput }), isActive: true, deletedAt: null, isPlatformOwner: false }, select: { id: true } });
    if (!sourceOrg || sourceOrg.id === target.organizationId) return unavailable();
    const [source, destination] = await Promise.all([resolveCustomerAuthDestination(sourceOrg.id), resolveCustomerAuthDestination(target.organizationId)]);
    // This first version accepts canonical app origins only, never caller-provided URLs.
    if (!source || !destination || target.origin !== destination.origin) return unavailable();
    const verifier = createCustomerSsoVerifier();
    const next = new URL(appPath("/fa/login/sso"), source.origin);
    next.searchParams.set("target", target.slug);
    next.searchParams.set("challenge", customerSsoChallenge(verifier));
    const response = NextResponse.json({ next: next.toString() }, { headers });
    const secure = target.origin.startsWith("https:");
    response.cookies.set(secure ? "__Host-bazar-customer-sso" : "bazar-customer-sso", verifier, { httpOnly: true, secure, sameSite: "lax", path: secure ? "/" : appCookiePath(), maxAge: 120 });
    return response;
  } catch { return unavailable(); }
}

export async function DELETE(request: Request) {
  const context = await resolveCustomerAuthContext(request);
  if (!context || request.headers.get("origin") !== context.origin) return unavailable();
  const response = NextResponse.json({ cleared: true }, { headers });
  const secure = context.origin.startsWith("https:");
  response.cookies.set(secure ? "__Host-bazar-customer-sso" : "bazar-customer-sso", "", { httpOnly: true, secure, sameSite: "lax", path: secure ? "/" : appCookiePath(), maxAge: 0 });
  return response;
}
