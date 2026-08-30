import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  getDurablePaymentVerificationHealth,
  processDuePaymentVerifications,
} from "@/lib/integrations/inoti-ussd/durable-verification";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function configuredSecret() {
  return process.env.INOTI_PAYMENT_WORKER_SECRET || process.env.INTERNAL_API_SECRET || "";
}

function sameSecret(actual: string | null, expected: string) {
  const left = Buffer.from(actual ?? "", "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorized(request: NextRequest) {
  const secret = configuredSecret();
  if (!secret) return false;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  return sameSecret(bearer, secret) || sameSecret(request.headers.get("x-internal-secret"), secret);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getDurablePaymentVerificationHealth());
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await processDuePaymentVerifications({ limit: 10 });
  return NextResponse.json(result);
}
