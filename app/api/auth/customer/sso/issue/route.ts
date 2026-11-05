import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { appPath } from "@/lib/app-base-path";
import { resolveCustomerAuthContext, resolveCustomerAuthDestination } from "@/lib/customer-auth/context.server";
import { customerSsoAvailable, customerSsoService } from "@/lib/customer-auth/sso.server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", Vary: "Cookie, Host" };
const unavailable = () => Response.json({ error: "CUSTOMER_SSO_UNAVAILABLE" }, { status: 400, headers });

async function destination(slug: string) {
  if (!slug || slug.length > 128) return null;
  const org = await prisma.organization.findFirst({ where: { slug, isActive: true, deletedAt: null, isPlatformOwner: false }, select: { id: true } });
  return org ? resolveCustomerAuthDestination(org.id) : null;
}

export async function GET(request: Request) {
  try {
    const [source, target, session] = await Promise.all([
      resolveCustomerAuthContext(request), destination(new URL(request.url).searchParams.get("target") ?? ""), auth(),
    ]);
    const ready = Boolean(customerSsoAvailable() && source && target && source.organizationId !== target.organizationId && session?.user?.role === "CUSTOMER" && session.user.organizationId === source.organizationId && session.user.phoneSessionId);
    return Response.json({ available: ready, target: target ? { name: target.name, slug: target.slug } : null }, { headers });
  } catch { return unavailable(); }
}

export async function POST(request: Request) {
  try {
    if (!customerSsoAvailable()) return unavailable();
    const [source, session] = await Promise.all([resolveCustomerAuthContext(request), auth()]);
    if (!source || request.headers.get("origin") !== source.origin || !session?.user?.id || session.user.role !== "CUSTOMER" || session.user.isTeamMember || session.user.organizationId !== source.organizationId || !session.user.phoneSessionId) return unavailable();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("target" in body) || typeof body.target !== "string" || !("challenge" in body) || typeof body.challenge !== "string") return unavailable();
    const target = await destination(body.target);
    if (!target) return unavailable();
    const { ticket } = await customerSsoService.issue({ userId: session.user.id, sourceSessionId: session.user.phoneSessionId, sourceOrganizationId: source.organizationId, targetOrganizationId: target.organizationId, targetOrigin: target.origin, challenge: body.challenge });
    const next = new URL(appPath("/fa/login/sso"), target.origin);
    next.searchParams.set("organization", target.slug);
    next.hash = new URLSearchParams({ ticket }).toString();
    return Response.json({ next: next.toString() }, { headers });
  } catch { return unavailable(); }
}
