import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { onboardingIdempotencyKeySchema } from "./contract";
import { OrganizationOnboardingError, type OnboardingActor } from "./service";

const headers = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };

export async function readOnboardingBody(request: Request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) throw new ApiError(400, "JSON_REQUIRED");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "INVALID_JSON");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new ApiError(413, "REQUEST_TOO_LARGE"); }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "INVALID_JSON");
  } finally { reader.releaseLock(); }
}

export async function onboardingMutation(request: Request, policy: { platformOnly: boolean; idempotency?: boolean }, handler: (actor: OnboardingActor, body: unknown, key: string) => Promise<unknown>) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    if (policy.platformOnly && session.user.role !== "SUPER_ADMIN") throw new ApiError(403, "PLATFORM_ADMIN_REQUIRED");
    const key = policy.idempotency ? onboardingIdempotencyKeySchema.parse(request.headers.get("idempotency-key")) : "";
    const body = await readOnboardingBody(request);
    return NextResponse.json(await handler({ userId: session.user.id, role: session.user.role }, body, key), { headers });
  } catch (error) {
    if (error instanceof OrganizationOnboardingError) return NextResponse.json({ error: error.code }, { status: error.status, headers });
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    if (error instanceof ZodError) return NextResponse.json({ error: "INVALID_ONBOARDING_REQUEST" }, { status: 400, headers });
    return NextResponse.json({ error: "ONBOARDING_REQUEST_FAILED" }, { status: 500, headers });
  }
}
