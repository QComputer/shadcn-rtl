import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { expireDueRetailPaymentOrders } from "@/lib/retail/payment-expiration.server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function authorized(request: NextRequest) {
  const expected = process.env.RETAIL_PAYMENT_EXPIRATION_SECRET || process.env.INTERNAL_API_SECRET || "";
  if (!expected) return false;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.headers.get("x-internal-secret") ?? "";
  const left = Buffer.from(supplied, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rawLimit = Number(new URL(request.url).searchParams.get("limit") ?? 50);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
    return NextResponse.json({ error: "Invalid batch size" }, { status: 400 });
  }
  const result = await expireDueRetailPaymentOrders({ limit: rawLimit });
  return NextResponse.json({ scanned: result.scanned, expired: result.expired }, { headers: { "cache-control": "no-store" } });
}
