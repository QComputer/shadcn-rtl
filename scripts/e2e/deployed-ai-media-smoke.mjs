#!/usr/bin/env node

const baseUrl = (process.env.DEPLOYED_URL || process.env.NEXT_PUBLIC_DEPLOYED_APP_URL || "").replace(/\/$/, "");

if (!baseUrl) {
  console.error("DEPLOYED_URL is required, for example: DEPLOYED_URL=https://example.com pnpm run quality:ai-media-deployed-smoke");
  process.exit(2);
}

const checks = [];

function addCheck(name, fn) {
  checks.push({ name, fn });
}

async function request(path, init = {}) {
  return fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...init,
    headers: {
      "User-Agent": "bazar-ai-media-smoke/1.0",
      ...(init.headers || {}),
    },
  });
}

function expectStatus(status, allowed) {
  if (!allowed.includes(status)) {
    throw new Error(`expected status ${allowed.join("/")}, got ${status}`);
  }
}

addCheck("AI media status endpoint returns enabled=false when feature is off", async () => {
  const res = await request("/api/dashboard/ai-media/status");
  expectStatus(res.status, [200]);
  const data = await res.json();
  if (typeof data.enabled !== "boolean") {
    throw new Error(`expected enabled to be boolean, got ${typeof data.enabled}`);
  }
});

addCheck("Unauthenticated AI job creation is blocked", async () => {
  const res = await request("/api/dashboard/products/non-existent-product-id/ai-image-suggestions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count: 3 }),
  });
  expectStatus(res.status, [401]);
});

addCheck("Unauthenticated AI job poll is blocked", async () => {
  const res = await request("/api/dashboard/ai-image-suggestions/non-existent-job-id");
  expectStatus(res.status, [401]);
});

addCheck("Unauthenticated AI image select is blocked", async () => {
  const res = await request("/api/dashboard/products/non-existent-product-id/ai-image-suggestions/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: "https://example.com/img.png", output_index: 0 }),
  });
  expectStatus(res.status, [401]);
});

async function main() {
  let failed = 0;
  for (const check of checks) {
    try {
      await check.fn();
      console.log(`✓ ${check.name}`);
    } catch (error) {
      failed++;
      console.error(`✗ ${check.name}: ${error.message}`);
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }

  console.log(`\nAll ${checks.length} checks passed`);
  process.exit(0);
}

main();
