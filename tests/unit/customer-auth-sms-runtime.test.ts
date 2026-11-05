import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { customerAuthSmsRuntimeAvailable, createCustomerAuthSmsRuntimeTransport, runCustomerAuthSmsOutboxBatch } from "../../lib/customer-auth/sms-runtime.server";

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

test("runner batch limits reject before configuration/database/provider access", async () => {
  for (const limit of [0, -1, 101, 1.2, NaN]) await assert.rejects(runCustomerAuthSmsOutboxBatch({ limit }), /INVALID_CUSTOMER_SMS_BATCH_LIMIT/);
});
