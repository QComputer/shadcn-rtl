import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ApiError, requireAuthSession, requireCustomerRequestContext } from "@/lib/api-guards";
import { appCookiePath } from "@/lib/app-base-path";
import { prisma } from "@/lib/db";
import { requireActiveOrganizationCapability } from "@/lib/organization-capabilities.server";
import { resolveTenantPwaRequestContext } from "@/lib/tenant-pwa-context.server";

const cookieName = () => process.env.SESSION_COOKIE_NAME || "guest_session_id";
// Match the existing random cart UUID and the appointment UUID when the deployment
// intentionally shares SESSION_COOKIE_NAME. Never accept a session from a body or URL.
const guestPattern = /^(?:appointment-)?[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type CartPrincipal = { customerId: string | null; sessionId: string | null; issueCookie: boolean };
export async function requireCartStore(request: NextRequest, slug: string) {
  if (!slug || slug.length > 120) throw new ApiError(400, "Organization is required.");
  const tenant = await resolveTenantPwaRequestContext(request.headers);
  if (tenant.kind === "unknown") throw new ApiError(404, "Storefront is unavailable.");
  const organization = await prisma.organization.findFirst({ where: {
    slug, isActive: true, deletedAt: null, isPlatformOwner: false,
    ...(tenant.kind === "tenant" ? { id: tenant.organizationId } : {}),
  }, select: { id: true, slug: true, branding: { select: { retailPreviewOnly: true } } } });
  if (!organization || organization.branding?.retailPreviewOnly) throw new ApiError(404, "Storefront is unavailable.");
  await requireActiveOrganizationCapability({ organizationId: organization.id, capability: "SHOP" });
  return organization;
}
export async function cartPrincipal(request: NextRequest, organization: { id: string; slug: string }, allowIssue: boolean): Promise<CartPrincipal> {
  const raw = request.cookies.get(cookieName())?.value;
  const existing = raw && guestPattern.test(raw) ? raw : null;
  let session;
  try { session = await requireAuthSession(); }
  catch (error) { if (!(error instanceof ApiError) || error.status !== 401) throw error; }
  if (session) {
    if (session.user.role === "CUSTOMER") {
      const context = await requireCustomerRequestContext(request, session);
      if (context.organizationId !== organization.id) throw new ApiError(403, "Cart access unavailable.");
    }
    // Preserve existing account carts for signed-in staff, without importing guest items
    // into privileged accounts. Customer merge is scoped to a verified tenant session.
    return { customerId: session.user.id, sessionId: session.user.role === "CUSTOMER" ? existing : null, issueCookie: false };
  }
  if (existing) return { customerId: null, sessionId: existing, issueCookie: false };
  if (!allowIssue) throw new ApiError(404, "Cart item not found.");
  return { customerId: null, sessionId: randomUUID(), issueCookie: true };
}
export function privateCartJson(principal: CartPrincipal, body: unknown, status = 200, mergePending = false) {
  const response = NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie", ...(mergePending ? { "X-Bazarbaaz-Cart-Merge": "required" } : {}) } });
  if (principal.issueCookie && principal.sessionId) response.cookies.set(cookieName(), principal.sessionId, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 24 * 60 * 60, path: appCookiePath(),
  });
  return response;
}
export async function hasGuestCart(slug: string, principal: CartPrincipal) {
  if (!principal.customerId || !principal.sessionId) return false;
  return Boolean(await prisma.shopCart.findFirst({ where: { organizationSlug: slug, sessionId: principal.sessionId, customerId: null, items: { some: {} } }, select: { id: true } }));
}
export async function requireCartItem(slug: string, itemId: string, principal: CartPrincipal) {
  const owner = principal.customerId ? { customerId: principal.customerId } : { customerId: null, sessionId: principal.sessionId };
  const item = await prisma.shopCartItem.findFirst({ where: { id: itemId, cart: { organizationSlug: slug, ...owner } }, select: { id: true } });
  if (!item) throw new ApiError(404, "Cart item not found.");
}
