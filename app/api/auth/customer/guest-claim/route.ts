import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireAuthSession } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { appointmentGuestCookieName, appointmentGuestSessionPattern } from "@/lib/appointments/guest-scope";
import { customerPhoneAuthAvailable, customerPhoneAuthService } from "@/lib/customer-auth/core.server";
import { guestClaimHttpEnabled, parseGuestClaimInput } from "@/lib/customer-auth/guest-claim-http.contract";
import { listGuestClaimCandidates } from "@/lib/customer-auth/guest-claim.server";
import { checkRateLimit } from "@/lib/rate-limit";
import { readBoundedJson } from "@/lib/security/bounded-json";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Host, Origin" };
const reply = (data: unknown, status: number) => Response.json(data, { status, headers });
const unavailable = (status: number) => reply({ accepted: false }, status);
export async function POST(request: NextRequest) {
  if (!guestClaimHttpEnabled()) return unavailable(404);
  if (!request.headers.get("origin")) return unavailable(403);
  let body: unknown;
  try { body = await readBoundedJson(request, { maxBytes: 4096 }); } catch { return unavailable(400); }
  const input = parseGuestClaimInput(body);
  if (!input) return unavailable(400);
  try {
    const session = await requireAuthSession(request);
    const context = session.customerContext;
    if (session.user.role !== "CUSTOMER" || session.user.isTeamMember || !context || !session.user.phoneSessionId || request.headers.get("origin") !== context.origin) return unavailable(403);
    const name = input.kind === "ORDER" ? process.env.SESSION_COOKIE_NAME || "guest_session_id" : appointmentGuestCookieName();
    // Do not accept ambiguous duplicate bearer cookies; never issue a new one here.
    const cookies = request.cookies.getAll(name);
    const rawNames = (request.headers.get("cookie") ?? "").split(";").map(part => part.trim().split("=", 1)[0]);
    const browser = cookies.length === 1 && rawNames.filter(key => key === name).length === 1 ? cookies[0].value : "";
    if (!appointmentGuestSessionPattern.test(browser)) return unavailable(403);
    // Per-process authenticated defense in depth; distributed ingress limits remain an activation gate.
    const limit = input.action === "LIST" ? 20 : input.action === "REQUEST" ? 10 : 12;
    if (!checkRateLimit({ key: `guest-claim:${context.organizationId}:${session.user.id}:${input.action}`, limit, windowMs: 60_000 }).allowed) return unavailable(429);
    const identity = await prisma.customerPhoneIdentity.findUnique({ where: { userId: session.user.id }, select: { phone: true, verifiedAt: true } });
    if (!identity || identity.verifiedAt > new Date()) return unavailable(403);
    const scope = { kind: input.kind, userId: session.user.id, sessionId: session.user.phoneSessionId, organizationId: context.organizationId, origin: context.origin, phone: identity.phone, guestSessionId: browser, claimConfirmed: true as const };
    if (input.action === "LIST") return reply({ items: await prisma.$transaction(tx => listGuestClaimCandidates(tx, scope, new Date()), { isolationLevel: "RepeatableRead" }) }, 200);
    const bound = { ...scope, recordId: input.recordId };
    if (input.action === "REQUEST") {
      // Same generic response for eligible, ineligible, throttled or disabled delivery.
      try { if (customerPhoneAuthAvailable()) return reply(await customerPhoneAuthService.requestGuestClaim(bound, "unknown"), 202); } catch { /* suppress details */ }
      return reply({ accepted: true, challengeId: randomUUID() }, 202);
    }
    const result = await customerPhoneAuthService.claimGuestRecord(bound, input.challengeId, input.otp);
    return reply(result, 200);
  } catch { return unavailable(403); }
}
