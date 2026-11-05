import assert from "node:assert/strict";
import { test } from "node:test";

const bearer = "A".repeat(43);
const token = "T".repeat(43);
const authUrl = `https://shop.example.test/fa/login/phone?organization=tenant-slug#token=${bearer}`;
const defaults = { token, lineNo: "12345678" };

function payload(resultCode: number, status = 1, mobile = "09123456789") {
  return { ResultCode: resultCode, BatchID: "123456789", deliveryLists: [{ Mobile: mobile, Status: status, LastDeliverDateTime: "2026-01-01T00:00:00" }] };
}

test("iNoti token transport sends only one fixed, encoded authentication SMS", async () => {
  let requested: { url: URL; init: RequestInit } | undefined;
  const transport = new (await import("@/lib/customer-auth/inoti-token-transport.server")).InotiTokenSmsTransport({
    ...defaults,
    fetcher: async (input, init) => {
      requested = { url: new URL(String(input)), init: init ?? {} };
      return Response.json(payload(1));
    },
  });
  assert.equal(transport.available(), true);
  assert.deepEqual(await transport.send({ phone: "09123456789", url: authUrl, idempotencyKey: "link-id", signal: new AbortController().signal, organizationName: "Cafe\nNorth" }), { status: "ACCEPTED", providerMessageId: "123456789" });
  assert.ok(requested);
  assert.equal(requested.url.origin + requested.url.pathname, "https://restful.inoti.com/api/SMSAPI/SendSMS");
  assert.equal(requested.url.searchParams.get("Token"), token);
  assert.equal(requested.url.searchParams.get("LineNo"), "12345678");
  assert.equal(requested.url.searchParams.get("MobileNumbers"), "09123456789");
  const message = requested.url.searchParams.get("Message")!;
  assert.match(message, /^Cafe North \| برای ورود امن به حساب خود، این پیوند را باز کنید:/);
  assert.ok(message.includes(authUrl));
  assert.equal(requested.init.method, "GET");
  assert.equal(requested.init.cache, "no-store");
  assert.equal(requested.init.redirect, "error");
  assert.equal((requested.init.headers as Record<string, string>).authorization, undefined);
});

test("only documented definitive provider rejection codes are rejected; unknown outcomes stay uncertain", async () => {
  const Transport = (await import("@/lib/customer-auth/inoti-token-transport.server")).InotiTokenSmsTransport;
  for (const code of [-1, -2, -4, -5, -6, -20, -21]) {
    const transport = new Transport({ ...defaults, fetcher: async () => Response.json({ ResultCode: code }) });
    assert.equal(await transport.send({ phone: "09123456789", url: authUrl, idempotencyKey: "id", signal: new AbortController().signal }), "REJECTED", `code ${code}`);
  }
  for (const result of [
    { ResultCode: 88 },
    { ResultCode: 1 },
    { ResultCode: 1, BatchID: "batch-safe-id" },
    { ...payload(1), BatchID: "" },
    { ...payload(1), BatchID: "unsafe-batch-id" },
    { ResultCode: 1, deliveryLists: [{ Mobile: "09111111111", Status: 1 }] },
    { ResultCode: 1, deliveryLists: [{ Mobile: "09123456789", Status: 99 }] },
  ]) {
    const transport = new Transport({ ...defaults, fetcher: async () => Response.json(result) });
    await assert.rejects(transport.send({ phone: "09123456789", url: authUrl, idempotencyKey: "id", signal: new AbortController().signal }), /^Error: INOTI_SEND_UNCERTAIN$/);
  }
  for (const status of [3, 5, 6]) {
    const transport = new Transport({ ...defaults, fetcher: async () => Response.json(payload(1, status)) });
    assert.equal(await transport.send({ phone: "09123456789", url: authUrl, idempotencyKey: "id", signal: new AbortController().signal }), "REJECTED", `delivery status ${status}`);
  }
  for (const status of [1, 2, 4, 7]) {
    const transport = new Transport({ ...defaults, fetcher: async () => Response.json(payload(1, status)) });
    assert.deepEqual(await transport.send({ phone: "09123456789", url: authUrl, idempotencyKey: "id", signal: new AbortController().signal }), { status: "ACCEPTED", providerMessageId: "123456789" }, `delivery status ${status}`);
  }
});

test("invalid inputs, HTTP failures, redirect and network exceptions never trigger retries", async () => {
  const Transport = (await import("@/lib/customer-auth/inoti-token-transport.server")).InotiTokenSmsTransport;
  let calls = 0;
  const fetcher = async () => { calls++; return Response.json(payload(1)); };
  const transport = new Transport({ ...defaults, fetcher });
  const base = { url: authUrl, idempotencyKey: "id", signal: new AbortController().signal };
  assert.equal(await transport.send({ ...base, phone: "+989123456789" }), "REJECTED");
  assert.equal(await transport.send({ ...base, phone: "09123456789", url: `http://evil.example.test/fa/login/phone?organization=x#token=${bearer}` }), "REJECTED");
  for (const invalidUrl of [
    `https://shop.example.test/fa/login/phone?organization=tenant&token=${bearer}`,
    "https://shop.example.test/fr/login/phone?organization=tenant#token=" + bearer,
    "https://shop.example.test/fa/login/phone?organization=tenant#token=short",
    `https://shop.example.test/fa/login/phone?organization=tenant&extra=x#token=${bearer}`,
  ]) assert.equal(await transport.send({ ...base, phone: "09123456789", url: invalidUrl }), "REJECTED");
  assert.equal(new Transport({ token: "guid-like-token", lineNo: "12345678901234567890", fetcher }).available(), true);
  assert.equal(calls, 0);
  for (const failing of [
    async () => new Response("unavailable", { status: 503 }),
    async () => new Response(null, { status: 302, headers: { location: "https://evil.example.test" } }),
    async () => { throw new Error(`secret=${token}`); },
  ]) {
    const uncertain = new Transport({ ...defaults, fetcher: failing });
    await assert.rejects(uncertain.send({ ...base, phone: "09123456789" }), (error: Error) => error.message === "INOTI_SEND_UNCERTAIN" && !error.message.includes(token));
  }
});

test("global fetch remains unavailable unless explicitly enabled with all live gates", async () => {
  const Transport = (await import("@/lib/customer-auth/inoti-token-transport.server")).InotiTokenSmsTransport;
  const gateNames = ["INOTI_ALLOW_LIVE_SMS", "INOTI_RUNTIME_MUTATIONS_APPROVED", "CUSTOMER_PHONE_AUTH_ENABLED"] as const;
  const previous = gateNames.map((name) => process.env[name]);
  const previousFetch = globalThis.fetch;
  try {
    gateNames.forEach((name) => { delete process.env[name]; });
    let calls = 0;
    globalThis.fetch = (async () => { calls++; return Response.json(payload(1)); }) as typeof fetch;
    const blocked = new Transport({ ...defaults, allowNetwork: true });
    assert.equal(blocked.available(), false);
    assert.equal(await blocked.send({ phone: "09123456789", url: authUrl, idempotencyKey: "id", signal: new AbortController().signal }), "REJECTED");
    assert.equal(calls, 0);
    process.env.INOTI_ALLOW_LIVE_SMS = "true";
    process.env.INOTI_RUNTIME_MUTATIONS_APPROVED = "true";
    process.env.CUSTOMER_PHONE_AUTH_ENABLED = "1";
    assert.equal(blocked.available(), true);
    assert.deepEqual(await blocked.send({ phone: "09123456789", url: authUrl, idempotencyKey: "id", signal: new AbortController().signal }), { status: "ACCEPTED", providerMessageId: "123456789" });
    assert.equal(calls, 1);
  } finally {
    gateNames.forEach((name, index) => { if (previous[index] === undefined) delete process.env[name]; else process.env[name] = previous[index]!; });
    globalThis.fetch = previousFetch;
  }
});
