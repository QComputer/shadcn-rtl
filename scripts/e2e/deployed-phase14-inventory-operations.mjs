#!/usr/bin/env node
const baseUrl = (process.env.DEPLOYED_URL || "").replace(/\/$/, "");

if (!baseUrl) {
  console.error("DEPLOYED_URL is required");
  process.exit(1);
}

const results = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail || "" });
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
    console.error(`✗ ${name} — ${error.message}`);
  }
}

async function request(path, options) {
  return fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options?.headers || {}),
    },
  });
}

function expectStatus(name, response, allowed) {
  if (!allowed.includes(response.status)) {
    throw new Error(`${name}: expected ${allowed.join("/")}, got ${response.status}`);
  }
  return `status=${response.status}`;
}

await check("homepage is reachable", async () => {
  const response = await request("/fa");
  return expectStatus("homepage", response, [200]);
});

await check("public products list still handles oversized pageSize", async () => {
  const response = await request("/api/products?pageSize=500");
  return expectStatus("products list", response, [200, 401, 403]);
});

await check("product variant create blocks unauthenticated users", async () => {
  const response = await request("/api/products/smoke-product-id/variants", {
    method: "POST",
    body: JSON.stringify({ name: "Smoke", inventory: 10 }),
  });
  return expectStatus("variant create", response, [401, 403]);
});

await check("product variant update blocks unauthenticated users", async () => {
  const response = await request("/api/products/smoke-product-id/variants/smoke-variant-id", {
    method: "PATCH",
    body: JSON.stringify({ inventory: 12 }),
  });
  return expectStatus("variant update", response, [401, 403]);
});

await check("order mutation remains blocked without auth", async () => {
  const response = await request("/api/orders/smoke-order-id", {
    method: "PATCH",
    body: JSON.stringify({ status: "CANCELLED" }),
  });
  return expectStatus("order status mutation", response, [401, 403]);
});

await check("payment mutation remains blocked without auth", async () => {
  const response = await request("/api/orders/smoke-order-id/payment", {
    method: "PATCH",
    body: JSON.stringify({ status: "COMPLETED" }),
  });
  return expectStatus("payment mutation", response, [401, 403, 405]);
});

await check("health endpoint is reachable", async () => {
  const response = await request("/api/health");
  return expectStatus("health", response, [200, 503]);
});

console.table(results.map(({ name, ok }) => ({ name, ok })));
const failed = results.filter((result) => !result.ok);
if (failed.length) process.exit(1);
