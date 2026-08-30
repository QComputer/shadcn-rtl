import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getPublicPaymentStatus } from "@/lib/payments/payment-operations.service";

const PUBLIC_PAYMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicPaymentId: string }> },
) {
  const { publicPaymentId } = await params;
  const clientIp = getClientIp(request.headers);
  const limited = checkRateLimit({
    key: `public-payment-status:${clientIp}:${publicPaymentId}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many payment status requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }
  if (!PUBLIC_PAYMENT_ID.test(publicPaymentId)) {
    return NextResponse.json({ error: "Payment status not found" }, { status: 404 });
  }
  try {
    const payment = await getPublicPaymentStatus(publicPaymentId);
    if (!payment) return NextResponse.json({ error: "Payment status not found" }, { status: 404 });
    return NextResponse.json(payment, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ error: "Payment status is temporarily unavailable" }, { status: 503 });
  }
}
