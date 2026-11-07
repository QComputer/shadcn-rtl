import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { customerAuthSmsRuntimeAvailable, createCustomerAuthSmsRuntimeTransport, runCustomerAuthSmsOutboxBatch } from "../../lib/customer-auth/sms-runtime.server";
import { processCustomerAuthSmsOutbox, type CustomerAuthSmsTransport } from "../../lib/customer-auth/sms-outbox.server";
import { encryptCustomerAuthPayload } from "../../lib/customer-auth/crypto";

const names = ["INOTI_PLATFORM_SMS_TOKEN", "INOTI_PLATFORM_SMS_LINE_NO", "INOTI_ALLOW_LIVE_SMS", "INOTI_RUNTIME_MUTATIONS_APPROVED", "CUSTOMER_PHONE_AUTH_ENABLED", "CUSTOMER_AUTH_SMS_WORKER_ENABLED", "NEXTAUTH_SECRET"] as const;

test("platform SMS runtime requires every explicit gate; availability checks never contact provider", async () => {
  const previous = names.map(name => process.env[name]);
  const fetcher = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; throw new Error("NETWORK_FORBIDDEN_IN_TEST"); };
    names.forEach(name => { delete process.env[name]; });
    assert.equal(customerAuthSmsRuntimeAvailable(), false);
    const db = { customerAuthSmsOutbox: { findFirst: () => assert.fail("disabled runner cannot query") } } as unknown as PrismaClient;
    assert.deepEqual(await runCustomerAuthSmsOutboxBatch({ db }), { available: false, processed: 0 });
    Object.assign(process.env, {
      INOTI_PLATFORM_SMS_TOKEN: "synthetic-platform-token", INOTI_PLATFORM_SMS_LINE_NO: "0",
      INOTI_ALLOW_LIVE_SMS: "true", INOTI_RUNTIME_MUTATIONS_APPROVED: "true",
      CUSTOMER_PHONE_AUTH_ENABLED: "1", CUSTOMER_AUTH_SMS_WORKER_ENABLED: "1",
      NEXTAUTH_SECRET: "synthetic-runtime-secret-at-least-32-characters",
    });
    assert.equal(customerAuthSmsRuntimeAvailable(), true);
    assert.equal(createCustomerAuthSmsRuntimeTransport().available(), true);
    for (const name of names) {
      const value = process.env[name]; delete process.env[name];
      assert.equal(customerAuthSmsRuntimeAvailable(), false, `requires ${name}`);
      process.env[name] = value;
    }
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = fetcher;
    names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; });
  }
});

const runtimeSecret = "synthetic-runtime-secret-at-least-32-characters";

function enableRuntimeGates() {
  Object.assign(process.env, {
    INOTI_PLATFORM_SMS_TOKEN: "synthetic-platform-token", INOTI_PLATFORM_SMS_LINE_NO: "0",
    INOTI_ALLOW_LIVE_SMS: "true", INOTI_RUNTIME_MUTATIONS_APPROVED: "true",
    CUSTOMER_PHONE_AUTH_ENABLED: "1", CUSTOMER_AUTH_SMS_WORKER_ENABLED: "1",
    NEXTAUTH_SECRET: runtimeSecret,
  });
}

function restoreEnv(previous: (string | undefined)[]) {
  names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; });
}

function makeRow(phone: string, status: "PENDING" = "PENDING", id = "outbox-" + phone, linkId = "link-" + phone) {
  return {
    id, linkId, attempts: 0, status, leaseId: null as string | null, createdAt: new Date(),
    encryptedPayload: encryptCustomerAuthPayload({ phone, url: `OTP:1234` }, runtimeSecret, linkId),
    link: { organizationId: "org-a", phone, origin: "https://shop.example.test", expiresAt: new Date(Date.now() + 300_000), consumedAt: null },
  };
}

function makeDb(rows: Record<string, any>[]) {
  const byId = new Map(rows.map(r => [r.id, r]));
  return {
    organization: { findFirst: async () => ({ id: "org-a" }) },
    organizationDomain: { findFirst: async () => ({ id: "domain-a" }) },
    customerAuthSmsOutbox: {
      findFirst: async ({ where, orderBy }: { where: Record<string, any>; orderBy?: any }) => {
        const candidates = rows.filter(r => r.status === "PENDING" && r.attempts < 3);
        const sorted = candidates.sort((a, b) => {
          if (orderBy?.createdAt === "desc") return b.createdAt.getTime() - a.createdAt.getTime();
          return a.createdAt.getTime() - b.createdAt.getTime();
        });
        let match: Record<string, any> | null = null;
        if (where.link?.phone) {
          match = sorted.find(r => r.link.phone === where.link.phone) ?? null;
        } else {
          match = sorted[0] ?? null;
        }
        return match ? structuredClone(match) : null;
      },
      updateMany: async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
        const row = byId.get(where.id);
        if (!row) return { count: 0 };
        if (where.status !== undefined && row.status !== where.status) return { count: 0 };
        if (where.leaseId && where.leaseId !== row.leaseId) return { count: 0 };
        const { attempts, ...rest } = data;
        Object.assign(row, rest);
        if (attempts) row.attempts += attempts.increment;
        return { count: 1 };
      },
    },
  } as unknown as PrismaClient;
}

test("canary allowedRecipient is wired through to processCustomerAuthSmsOutbox and isolates dispatch", async () => {
  const previous = names.map(name => process.env[name]);
  let sawAllowedRecipient: string | undefined;
  try {
    enableRuntimeGates();
    const canaryPhone = "09123456789";
    const otherPhone = "09987654321";
    const canaryRow = makeRow(canaryPhone);
    const otherRow = makeRow(otherPhone);
    const canaryRow2 = makeRow(canaryPhone, "PENDING", "outbox-canary-2", "link-canary-2");
    canaryRow.createdAt = new Date(Date.now() - 60000);
    canaryRow2.createdAt = new Date();
    const db = makeDb([canaryRow, otherRow, canaryRow2]);
    const transport: CustomerAuthSmsTransport = {
      reviewedForAuthentication: true,
      available: () => true,
      send: async input => {
        sawAllowedRecipient = input.phone;
        assert.equal(input.phone, canaryPhone);
        return { status: "ACCEPTED", providerMessageId: "batch-1" };
      },
    };
    // Monkeypatch process import path is fixed; instead verify through worker behavior with real processCustomerAuthSmsOutbox.
    const result = await runCustomerAuthSmsOutboxBatch({ db, allowedRecipient: canaryPhone, transport });
    assert.equal(result.available, true);
    assert.equal(result.processed, 1, "exactly one record processed in canary mode");
    assert.equal(sawAllowedRecipient, canaryPhone, "allowedRecipient reached transport as recipient phone");
    // Older pending record for same recipient must not be selected: most recent (canaryRow2) chosen.
    assert.equal(canaryRow2.status, "ACCEPTED", "most recent pending record for recipient is dispatched");
    assert.equal(canaryRow.status, "PENDING", "older pending record for same recipient untouched");
    assert.equal(otherRow.status, "PENDING", "unrelated recipient record untouched");
  } finally {
    restoreEnv(previous);
  }
});

test("canary rejects invalid or missing recipient and fails closed", async () => {
  const previous = names.map(name => process.env[name]);
  try {
    enableRuntimeGates();
    for (const bad of ["not-a-phone", "0912", "", "   "]) {
      await assert.rejects(runCustomerAuthSmsOutboxBatch({ allowedRecipient: bad }), /INVALID_CANARY_RECIPIENT/);
    }
    // allowedRecipient undefined means normal production mode (no canary), not an error.
    const db = makeDb([]);
    const result = await runCustomerAuthSmsOutboxBatch({ db });
    assert.equal(result.available, true);
    assert.equal(result.processed, 0);
  } finally {
    restoreEnv(previous);
  }
});

test("canary mode permits exactly one send attempt; no second dispatch or retry", async () => {
  const previous = names.map(name => process.env[name]);
  let sends = 0;
  try {
    enableRuntimeGates();
    const canaryPhone = "09123456789";
    const canaryRow = makeRow(canaryPhone);
    canaryRow.createdAt = new Date(Date.now() - 60000);
    const canaryRow2 = makeRow(canaryPhone, "PENDING", "outbox-canary-2", "link-canary-2");
    canaryRow2.createdAt = new Date();
    const db = makeDb([canaryRow, canaryRow2]);
    const transport: CustomerAuthSmsTransport = {
      reviewedForAuthentication: true,
      available: () => true,
      send: async () => { sends++; return "RETRYABLE"; },
    };
    const result = await runCustomerAuthSmsOutboxBatch({ db, allowedRecipient: canaryPhone, transport });
    assert.equal(result.available, true);
    assert.equal(result.processed, 1, "canary stops after one processed record regardless of RETRYABLE");
    assert.equal(sends, 1, "exactly one provider send attempt in canary mode");
    assert.equal(canaryRow2.status, "FAILED", "most recent record becomes FAILED in canary mode (no retry)");
    assert.equal(canaryRow.status, "PENDING", "older pending record for same recipient never selected");
  } finally {
    restoreEnv(previous);
  }
});

test("normal production mode (no allowedRecipient) preserves multi-record queue processing", async () => {
  const previous = names.map(name => process.env[name]);
  let sends = 0;
  try {
    enableRuntimeGates();
    const row1 = makeRow("09123456789");
    const row2 = makeRow("09987654321");
    const db = makeDb([row1, row2]);
    const transport: CustomerAuthSmsTransport = {
      reviewedForAuthentication: true,
      available: () => true,
      send: async () => { sends++; return "SENT"; },
    };
    const result = await runCustomerAuthSmsOutboxBatch({ db, limit: 5, transport });
    assert.equal(result.available, true);
    assert.equal(result.processed, 2, "normal mode processes multiple queued records");
    assert.equal(sends, 2);
    assert.equal(row1.status, "SENT");
    assert.equal(row2.status, "SENT");
  } finally {
    restoreEnv(previous);
  }
});

test("runner batch limits reject before configuration/database/provider access", async () => {
  for (const limit of [0, -1, 101, 1.2, NaN]) await assert.rejects(runCustomerAuthSmsOutboxBatch({ limit }), /INVALID_CUSTOMER_SMS_BATCH_LIMIT/);
});
