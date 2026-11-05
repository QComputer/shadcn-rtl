import { resolveCustomerAuthContext } from "@/lib/customer-auth/context.server";
import { CustomerPhoneAuthError, customerPhoneAuthAvailable, customerPhoneAuthService } from "@/lib/customer-auth/core.server";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, private" };
const accepted = () => Response.json({ accepted: true }, { status: 202, headers: noStore });

function requestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  return (forwarded || real || "unknown").slice(0, 256);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return Response.json({ accepted: true }, { status: 403, headers: noStore });
  let body: unknown;
  try { body = await request.json(); } catch { return accepted(); }
  if (!body || typeof body !== "object") return accepted();
  const input = body as Record<string, unknown>;
  if (typeof input.phone !== "string" || input.phone.length > 64 || (input.organization !== undefined && (typeof input.organization !== "string" || input.organization.length > 128))) return accepted();

  const context = await resolveCustomerAuthContext(request, typeof input.organization === "string" ? input.organization : null);
  if (!context || !await customerPhoneAuthAvailable()) return accepted();
  if (origin !== context.origin) return Response.json({ accepted: true }, { status: 403, headers: noStore });
  try {
    await customerPhoneAuthService.request({ phone: input.phone, organizationId: context.organizationId, origin: context.origin, ip: requestIp(request), source: "WEB" });
  } catch (error) {
    if (!(error instanceof CustomerPhoneAuthError)) return accepted();
  }
  return accepted();
}
