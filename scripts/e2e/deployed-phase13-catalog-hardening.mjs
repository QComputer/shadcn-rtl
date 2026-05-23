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

await check("public search still responds", async () => {
  const response = await request("/api/public/search?q=test");
  return expectStatus("public search", response, [200, 429]);
});

await check("public products list handles oversized pageSize without server error", async () => {
  const response = await request("/api/products?pageSize=500");
  return expectStatus("products list", response, [200, 401, 403]);
});

await check("product create blocks unauthenticated users", async () => {
  const response = await request("/api/products", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return expectStatus("product create", response, [401, 403]);
});

await check("product category create blocks unauthenticated users", async () => {
  const response = await request("/api/product-categories", {
    method: "POST",
    body: JSON.stringify({ name: "Smoke Category" }),
  });
  return expectStatus("product category create", response, [401, 403]);
});

await check("service list blocks unauthenticated users", async () => {
  const response = await request("/api/services?pageSize=500");
  return expectStatus("service list", response, [401, 403]);
});

await check("service create blocks unauthenticated users", async () => {
  const response = await request("/api/services", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return expectStatus("service create", response, [401, 403]);
});

await check("service category create blocks unauthenticated users", async () => {
  const response = await request("/api/service-categories", {
    method: "POST",
    body: JSON.stringify({ name: "Smoke Service Category" }),
  });
  return expectStatus("service category create", response, [401, 403]);
});

console.table(results.map(({ name, ok }) => ({ name, ok })));
const failed = results.filter((result) => !result.ok);
if (failed.length) process.exit(1);
