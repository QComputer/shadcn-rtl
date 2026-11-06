import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { processCustomerAuthSmsOutbox, type CustomerAuthSmsTransport } from "../../lib/customer-auth/sms-outbox.server";
import { InotiTokenSmsTransport } from "../../lib/customer-auth/inoti-token-transport.server";
import { encryptCustomerAuthPayload } from "../../lib/customer-auth/crypto";

const secret = "test-only-customer-auth-secret-32-bytes-minimum";
const now = new Date("2026-11-04T00:00:00Z");
const origin = "https://shop.example.test";
function fixture() {
  const domains: string[] = [];
  const row = {
    id: "outbox-a", linkId: "link-a", attempts: 0, status: "PENDING", leaseId: null as string | null,
    encryptedPayload: encryptCustomerAuthPayload({ phone: "09123456789", url: `${origin}/customer-auth/consume#token=test` }, secret, "link-a"),
    link: { organizationId: "org-a", phone: "09123456789", origin, expiresAt: new Date(now.getTime() + 300_000), consumedAt: null },
  };
  const db = {
    organization: { findFirst: async () => ({ id: "org-a" }) },
    organizationDomain: { findFirst: async ({ where }: { where: { normalizedDomain: string } }) => { domains.push(where.normalizedDomain); return { id: "domain-a" }; } },
    customerAuthSmsOutbox: {
      findFirst: async () => row.status === "PENDING" ? structuredClone(row) : null,
      updateMany: async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
        if (!where.id || where.status !== row.status || (where.leaseId && where.leaseId !== row.leaseId)) return { count: 0 };
        const { attempts, ...rest } = data;
        Object.assign(row, rest);
        if (attempts) row.attempts += attempts.increment;
        return { count: 1 };
      },
    },
  } as unknown as PrismaClient;
  return { row, db, domains };
}
function options(db: PrismaClient, transport: CustomerAuthSmsTransport) { return { db, secret, enabled: true, transport, now: () => now, platformOrigins: [origin] }; }

test("concurrent workers atomically lease one delivery and purge secret after send", async () => {
  const { db, row } = fixture();
  let sends = 0;
  const transport: CustomerAuthSmsTransport = { reviewedForAuthentication: true, available: () => true, send: async input => { sends++; assert.equal(input.phone, "09123456789"); assert.equal(input.idempotencyKey, "link-a"); return "SENT"; } };
  await Promise.all([processCustomerAuthSmsOutbox(options(db, transport)), processCustomerAuthSmsOutbox(options(db, transport))]);
  assert.equal(sends, 1);
  assert.equal(row.status, "SENT");
  assert.equal(row.encryptedPayload, "");
});
test("ambiguous transport error quarantines and cannot automatically resend", async () => {
  const { db, row } = fixture();
  let sends = 0;
  const transport: CustomerAuthSmsTransport = { reviewedForAuthentication: true, available: () => true, send: async () => { sends++; throw new Error("network after dispatch"); } };
  await processCustomerAuthSmsOutbox(options(db, transport));
  await processCustomerAuthSmsOutbox(options(db, transport));
  assert.equal(sends, 1);
  assert.equal(row.status, "UNCERTAIN");
  assert.equal(row.encryptedPayload, "");
});
test("known retryable rejection stops after three bounded attempts", async () => {
  const { db, row } = fixture();
  let sends = 0;
  const transport: CustomerAuthSmsTransport = { reviewedForAuthentication: true, available: () => true, send: async () => { sends++; return "RETRYABLE"; } };
  for (let i = 0; i < 4; i++) await processCustomerAuthSmsOutbox(options(db, transport));
  assert.equal(sends, 3);
  assert.equal(row.status, "FAILED");
  assert.equal(row.encryptedPayload, "");
});

test("worker resolves www through canonical domain and rejects production HTTP", async () => {
  const environment = process.env as Record<string, string | undefined>;
  const previousMode = environment.NODE_ENV;
  try {
    environment.NODE_ENV = "production";
    const www = fixture();
    www.row.link.origin = "https://www.shop.example.test";
    www.row.encryptedPayload = encryptCustomerAuthPayload({ phone: www.row.link.phone, url: `${www.row.link.origin}/customer-auth/consume#token=test` }, secret, www.row.linkId);
    let sends = 0;
    const transport: CustomerAuthSmsTransport = { reviewedForAuthentication: true, available: () => true, send: async () => { sends++; return "SENT"; } };
    await processCustomerAuthSmsOutbox(options(www.db, transport));
    assert.deepEqual(www.domains, ["shop.example.test"]);
    assert.equal(sends, 1);
    const local = fixture();
    local.row.link.origin = "http://phone-auth.localhost:3028";
    await processCustomerAuthSmsOutbox(options(local.db, transport));
    assert.equal(sends, 1, "production HTTP must not dispatch");
    assert.equal(local.row.status, "CANCELLED");
  } finally {
    if (previousMode === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = previousMode;
  }
});

test("OTP outbox chain delivers a Persian four-digit code with no URL via mocked iNoti HTTP", async () => {
  const secret = "test-only-customer-auth-secret-32-bytes-minimum";
  const now = new Date("2026-11-04T00:00:00Z");
  const otp = "7421";
  const row = {
    id: "outbox-a", linkId: "link-a", attempts: 0, status: "PENDING", leaseId: null as string | null,
    providerMessageId: null as string | null,
    encryptedPayload: encryptCustomerAuthPayload({ phone: "09123456789", url: `OTP:${otp}` }, secret, "link-a"),
    link: { organizationId: "org-a", phone: "09123456789", origin: "https://shop.example.test", expiresAt: new Date(now.getTime() + 300_000), consumedAt: null },
  };
  const fetched: Array<{ url: URL; params: URLSearchParams }> = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    fetched.push({ url, params: new URLSearchParams(url.search) });
    return new Response(JSON.stringify({ ResultCode: 1, BatchID: "555", deliveryLists: [{ Mobile: "09123456789", Status: 1 }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const transport = new InotiTokenSmsTransport({ token: "tok", lineNo: "0", fetcher });
  const db = {
    organization: { findFirst: async () => ({ id: "org-a", name: "نمونه", branding: { displayName: null } }) },
    organizationDomain: { findFirst: async () => ({ id: "domain-a" }) },
    customerAuthSmsOutbox: {
      findFirst: async () => row.status === "PENDING" ? structuredClone(row) : null,
      updateMany: async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
        if (!where.id || where.status !== row.status) return { count: 0 };
        Object.assign(row, data);
        if (data.attempts) row.attempts += (data.attempts as { increment: number }).increment;
        return { count: 1 };
      },
    },
  } as unknown as PrismaClient;
  const result = await processCustomerAuthSmsOutbox({ db, secret, enabled: true, transport, now: () => now, platformOrigins: ["https://shop.example.test"] });
  assert.equal(result.processed, true);
  assert.equal(fetched.length, 1);
  assert.equal(fetched[0].url.origin, "https://restful.inoti.com");
  assert.equal(fetched[0].url.pathname, "/api/SMSAPI/SendSMS");
  const params = fetched[0].params;
  assert.equal(params.get("MobileNumbers"), "09123456789");
  assert.equal(params.get("Message"), `نمونه | کد تأیید شما: ${otp}\nاین کد تا ۲ دقیقه معتبر است.`);
  assert.ok(!params.get("Message")?.includes("http"), "no external URL in SMS");
  assert.equal(row.status, "ACCEPTED");
  assert.equal(row.providerMessageId, "555");
  assert.equal(row.encryptedPayload, "");
});
