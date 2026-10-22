import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, requireSameOriginMutation } from "@/lib/api-guards";
import { getClientIp, checkRateLimit } from "@/lib/rate-limit";
import { AccountSecurityError } from "@/lib/security/password.server";
import { passwordRecoveryService, RECOVERY_ACKNOWLEDGEMENT, RECOVERY_UNAVAILABLE } from "@/lib/security/recovery.server";

const requestSchema = z.object({ identifier: z.string().trim().min(1).max(254) }).strict();
const consumeSchema = z.object({ token: z.string().max(100), newPassword: z.string().min(8).max(200), confirmPassword: z.string().max(200) })
  .strict().refine(input => input.newPassword === input.confirmPassword, "رمزها یکسان نیستند.");

export function GET() {
  return NextResponse.json({ available: passwordRecoveryService.available,
    message: passwordRecoveryService.available ? RECOVERY_ACKNOWLEDGEMENT : RECOVERY_UNAVAILABLE });
}

async function handle(request: NextRequest, consume: boolean) {
  try {
    requireSameOriginMutation(request);
    const ip = getClientIp(request.headers);
    const limit = checkRateLimit({ key: `account-recovery:${consume ? "consume" : "request"}:${ip}`, limit: 10, windowMs: 15 * 60_000 });
    if (!limit.allowed) return NextResponse.json({ error: "تلاش‌های زیادی انجام شده است؛ بعداً دوباره امتحان کنید." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    if (!passwordRecoveryService.available) return NextResponse.json({ available: false, error: RECOVERY_UNAVAILABLE }, { status: 503 });
    const body: unknown = await request.json();
    if (consume) {
      const data = consumeSchema.parse(body);
      await passwordRecoveryService.consume(data.token, data.newPassword, ip);
      return NextResponse.json({ success: true, signInRequired: true, message: "رمز بازیابی شد. تمام نشست‌های قبلی پایان یافتند؛ دوباره وارد شوید." });
    }
    const data = requestSchema.parse(body);
    await passwordRecoveryService.request(data.identifier, ip);
    return NextResponse.json({ message: RECOVERY_ACKNOWLEDGEMENT }, { status: 202 });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof AccountSecurityError) return NextResponse.json({ error: error.message }, { status: error.status, ...(error.status === 429 ? { headers: { "Retry-After": "900" } } : {}) });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "اطلاعات بازیابی معتبر نیست." }, { status: 400 });
    return NextResponse.json({ error: "درخواست بازیابی قابل انجام نیست." }, { status: 400 });
  }
}

export const POST = (request: NextRequest) => handle(request, false);
export const PUT = (request: NextRequest) => handle(request, true);
