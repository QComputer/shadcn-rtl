#!/usr/bin/env node

const baseUrl = (process.env.DEPLOYED_URL || process.env.NEXT_PUBLIC_DEPLOYED_APP_URL || "").replace(/\/$/, "");

if (!baseUrl) {
  console.error("DEPLOYED_URL is required. Example: DEPLOYED_URL=https://example.com npm run e2e:deployed:phase2");
  process.exit(1);
}

const checks = [];

async function request(path, init = {}) {
  return fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
}

function okStatus(actual, allowed) {
  return allowed.includes(actual);
}

async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    checks.push({ name, ok: false, error: error.message });
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
  }
}

function assertStatus(name, response, allowed) {
  if (!okStatus(response.status, allowed)) {
    throw new Error(`${name}: expected one of ${allowed.join(", ")}, got ${response.status}`);
  }
}

const fakeCuid = "ckphase2resource000000000000000";

await check("homepage is reachable", async () => {
  const res = await request("/fa");
  assertStatus("homepage", res, [200]);
});

await check("public search remains reachable", async () => {
  const res = await request("/api/public/search?q=test");
  assertStatus("public search", res, [200]);
});

await check("product create is blocked without auth", async () => {
  const res = await request("/api/products", {
    method: "POST",
    body: JSON.stringify({ name: "Denied", basePrice: 1000, categoryId: fakeCuid, organizationId: fakeCuid }),
  });
  assertStatus("product create", res, [401, 403]);
});

await check("product update is blocked without auth", async () => {
  const res = await request(`/api/products/${fakeCuid}`, {
    method: "PATCH",
    body: JSON.stringify({ name: "Denied" }),
  });
  assertStatus("product update", res, [401, 403]);
});

await check("product variant create is blocked without auth", async () => {
  const res = await request(`/api/products/${fakeCuid}/variants`, {
    method: "POST",
    body: JSON.stringify({ name: "Denied", price: 1000, inventory: 1 }),
  });
  assertStatus("variant create", res, [401, 403]);
});

await check("product category create is blocked without auth", async () => {
  const res = await request("/api/product-categories", {
    method: "POST",
    body: JSON.stringify({ name: "Denied" }),
  });
  assertStatus("product category create", res, [401, 403]);
});

await check("service create is blocked without auth", async () => {
  const res = await request("/api/services", {
    method: "POST",
    body: JSON.stringify({ name: "Denied", price: 1000, duration: 30, categoryId: fakeCuid }),
  });
  assertStatus("service create", res, [401, 403]);
});

await check("service category create is blocked without auth", async () => {
  const res = await request("/api/service-categories", {
    method: "POST",
    body: JSON.stringify({ name: "Denied" }),
  });
  assertStatus("service category create", res, [401, 403]);
});

await check("order mutation is blocked without auth", async () => {
  const res = await request(`/api/orders/${fakeCuid}`, {
    method: "PUT",
    body: JSON.stringify({ status: "ACCEPTED" }),
  });
  assertStatus("order mutation", res, [401, 403]);
});

await check("appointment mutation is blocked without auth", async () => {
  const res = await request(`/api/appointments/${fakeCuid}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "CONFIRMED" }),
  });
  assertStatus("appointment mutation", res, [401, 403]);
});

const failed = checks.filter((item) => !item.ok);
console.log(`\nPhase 2 deployed E2E summary: ${checks.length - failed.length}/${checks.length} passed`);

if (failed.length > 0) {
  process.exit(1);
}
