import { createHmac, timingSafeEqual } from "node:crypto";

export type HotelSandboxPaymentTicket = { readonly paymentId: string; readonly reservationId: string; readonly organizationId: string; readonly expiresAt: number };

function secret() {
  const value = process.env.HOTEL_SANDBOX_PAYMENT_SECRET;
  if (!value || value.length < 32) throw new Error("Hotel sandbox payment secret is not configured");
  return value;
}

export function hotelSandboxPaymentsEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.HOTEL_PAYMENT_OPERATIONAL_ENABLED !== "1" && process.env.HOTEL_PAYMENT_SIMULATOR_ENABLED === "1";
}

export function issueHotelSandboxPaymentTicket(payload: HotelSandboxPaymentTicket) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyHotelSandboxPaymentTicket(token: string, now = Date.now(), allowExpired = false): HotelSandboxPaymentTicket | null {
  if (token.length > 2048) return null;
  const [encoded, supplied, ...rest] = token.split(".");
  if (!encoded || !supplied || rest.length) return null;
  let expected: Buffer;
  try { expected = createHmac("sha256", secret()).update(encoded).digest(); } catch { return null; }
  let actual: Buffer;
  try { actual = Buffer.from(supplied, "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const value = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<HotelSandboxPaymentTicket>;
    if (typeof value.paymentId !== "string" || typeof value.reservationId !== "string" || typeof value.organizationId !== "string" || typeof value.expiresAt !== "number" || (!allowExpired && value.expiresAt <= now)) return null;
    return { paymentId: value.paymentId, reservationId: value.reservationId, organizationId: value.organizationId, expiresAt: value.expiresAt };
  } catch { return null; }
}
