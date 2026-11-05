import "server-only";

import { normalizeDigits, normalizeIranianMobile } from "@/lib/integrations/inoti-ussd/parser";
import { customerAuthDigest } from "./crypto";
import {
  customerPhoneAuthAvailable,
  customerPhoneAuthService,
} from "./core.server";

const SESSION_NUMERIC = /^\d{1,64}$/;
const SESSION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIAL_PATH = /^6655(?:\*[0-9]{1,16}){1,5}$/;
const NO_STORE = { "Cache-Control": "no-store, private", Pragma: "no-cache" };

export type CustomerAuthDestination = {
  organizationId: string;
  origin: string;
};

export type CustomerUssdEnrollmentRoute = {
  id: string;
  organizationId: string;
  publicId: string;
  dialPath: string;
  enabled: boolean;
};

export type ParsedCustomerEnrollmentRequest = {
  mobile: string;
  sessionId: string;
  call: string;
};

export function isCanonicalCustomerUssdDialPath(value: string): boolean {
  return DIAL_PATH.test(value);
}

function singleParameter(searchParams: URLSearchParams, name: string, maxLength: number): string | null {
  const values = [...searchParams.entries()]
    .filter(([key]) => key.toLowerCase() === name)
    .map(([, value]) => value);
  if (values.length !== 1) return null;
  const value = values[0]?.trim() ?? "";
  return value && value.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(value) ? value : null;
}

export function parseCustomerUssdEnrollmentRequest(
  searchParams: URLSearchParams,
  expectedDialPath: string,
): ParsedCustomerEnrollmentRequest | null {
  if (!isCanonicalCustomerUssdDialPath(expectedDialPath)) return null;
  if ([...searchParams.keys()].some((key) => ["rrn", "ref", "factorid", "payment"].includes(key.toLowerCase()))) return null;

  const rawMobile = singleParameter(searchParams, "mobile", 32);
  const rawSession = singleParameter(searchParams, "sessionid", 64);
  const rawCall = singleParameter(searchParams, "call", 256);
  if (!rawMobile || !rawSession || !rawCall) return null;

  const mobile = normalizeIranianMobile(rawMobile);
  const normalizedSession = normalizeDigits(rawSession);
  if (!mobile || !(SESSION_NUMERIC.test(normalizedSession) || SESSION_UUID.test(normalizedSession))) return null;
  const sessionId = SESSION_UUID.test(normalizedSession) ? normalizedSession.toLowerCase() : normalizedSession;

  const call = normalizeDigits(rawCall).trim();
  const canonicalCall = call.startsWith("*") ? call.slice(1) : call;
  const withoutTerminator = canonicalCall.endsWith("#") ? canonicalCall.slice(0, -1) : canonicalCall;
  if (withoutTerminator !== expectedDialPath) return null;
  return { mobile, sessionId, call: expectedDialPath };
}

export type CustomerUssdEnrollmentDependencies = {
  findEnabledRoute(publicId: string): Promise<CustomerUssdEnrollmentRoute | null>;
  resolveDestination(organizationId: string): Promise<CustomerAuthDestination | null>;
  available(): boolean;
  request(input: {
    phone: string;
    organizationId: string;
    origin: string;
    ip: string;
    source: "USSD";
    idempotencyKey: string;
  }): Promise<{ accepted: true }>;
  secret: string;
};

const productionDependencies: CustomerUssdEnrollmentDependencies = {
  findEnabledRoute: async (publicId) => {
    const { prisma } = await import("@/lib/db");
    return prisma.customerUssdEnrollmentRoute.findFirst({
      where: { publicId, enabled: true, organization: { isActive: true, deletedAt: null } },
      select: { id: true, organizationId: true, publicId: true, dialPath: true, enabled: true },
    });
  },
  resolveDestination: async (organizationId) => {
    const { resolveCustomerAuthDestination } = await import("./context.server");
    return resolveCustomerAuthDestination(organizationId);
  },
  available: customerPhoneAuthAvailable,
  request: (input) => customerPhoneAuthService.request(input),
  secret: process.env.NEXTAUTH_SECRET ?? "",
};

export async function processCustomerUssdEnrollmentRequest(input: {
  publicId: string;
  searchParams: URLSearchParams;
  ip: string;
}, dependencies: CustomerUssdEnrollmentDependencies = productionDependencies): Promise<string> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.publicId)) {
    return "درخواست نامعتبر است";
  }
  const route = await dependencies.findEnabledRoute(input.publicId);
  if (!route || !route.enabled || !isCanonicalCustomerUssdDialPath(route.dialPath)) return "این سرویس در دسترس نیست";
  const parsed = parseCustomerUssdEnrollmentRequest(input.searchParams, route.dialPath);
  if (!parsed) return "درخواست نامعتبر است";
  if (!dependencies.available() || dependencies.secret.length < 32 || !input.ip || input.ip.length > 256) {
    return "این سرویس اکنون فعال نیست";
  }
  const destination = await dependencies.resolveDestination(route.organizationId);
  if (!destination || destination.organizationId !== route.organizationId) return "این سرویس در دسترس نیست";

  const idempotencyKey = customerAuthDigest(
    `USSD:${route.id}:${parsed.sessionId}:${parsed.mobile}`,
    dependencies.secret,
  );
  await dependencies.request({
    phone: parsed.mobile,
    organizationId: route.organizationId,
    origin: destination.origin,
    ip: input.ip,
    source: "USSD",
    idempotencyKey,
  });
  // Generic and conditional: the adapter never claims that a message was sent.
  return "درخواست ثبت شد؛ در صورت امکان پیوند ورود ارسال می‌شود";
}

export const customerUssdEnrollmentNoStoreHeaders = NO_STORE;
