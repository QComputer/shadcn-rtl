import { randomUUID } from "node:crypto";
import { resolveCustomerAuthContext } from "@/lib/customer-auth/context.server";
import { customerPhoneAuthAvailable, customerPhoneAuthService } from "@/lib/customer-auth/core.server";
import { parseProgressiveRequest, progressiveCustomerEnrollmentEnabled } from "@/lib/customer-auth/progressive-contract";
import { readBoundedJson } from "@/lib/security/bounded-json";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", Vary: "Host, Origin, Cookie" };
const rejected = (status: number) => Response.json({ accepted: false }, { status, headers });
const accepted = (challengeId: string = randomUUID()) => Response.json({ accepted: true, challengeId }, { status: 202, headers });

export async function POST(request: Request) {
  if (!progressiveCustomerEnrollmentEnabled()) return rejected(404);
  const origin = request.headers.get("origin");
  if (!origin) return rejected(403);
  let body: unknown;
  try { body = await readBoundedJson(request, { maxBytes: 4096 }); } catch { return rejected(400); }
  const input = parseProgressiveRequest(body);
  if (!input) return rejected(400);
  const context = await resolveCustomerAuthContext(request, input.organization);
  if (!context || origin !== context.origin) return rejected(403);
  // The current ingress has no verified client-IP contract for this endpoint.
  // Share a conservative untrusted bucket instead of accepting spoofable XFF.
  // Review availability and trusted proxy limits before real activation.
  try {
    if (!customerPhoneAuthAvailable()) return accepted();
    const result = await customerPhoneAuthService.requestVerification({
      phone: input.phone, organizationId: context.organizationId, origin: context.origin, ip: "unknown",
    }, input.purpose);
    return accepted(result.challengeId);
  } catch { return accepted(); }
}
