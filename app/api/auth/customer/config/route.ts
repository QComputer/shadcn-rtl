import { resolveCustomerAuthContext } from "@/lib/customer-auth/context.server";
import { customerPhoneAuthAvailable } from "@/lib/customer-auth/core.server";
import { customerSsoAvailable } from "@/lib/customer-auth/sso.server";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, private", Vary: "Cookie, Host" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const identifier = url.searchParams.get("organization");
  const context = await resolveCustomerAuthContext(request, identifier);
  const available = Boolean(context && await customerPhoneAuthAvailable());
  return Response.json({
    available,
    ssoAvailable: Boolean(context && customerSsoAvailable()),
    organization: context ? { id: context.organizationId, slug: context.slug, name: context.name, logo: context.logo } : null,
    homePath: context?.homePath ?? null,
  }, { headers: noStore });
}
