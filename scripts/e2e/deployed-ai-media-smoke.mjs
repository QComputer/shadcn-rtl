#!/usr/bin/env node

const baseUrl = (process.env.DEPLOYED_URL || process.env.NEXT_PUBLIC_DEPLOYED_APP_URL || "").replace(/\/$/, "");
const aiServiceUrl = (process.env.AI_MEDIA_SERVICE_URL || "").replace(/\/$/, "");
const aiInternalKey = process.env.AI_MEDIA_SERVICE_INTERNAL_KEY || "";

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

async function aiRequest(path, init = {}) {
  if (!aiServiceUrl) throw new Error("AI_MEDIA_SERVICE_URL is required for direct AI service checks");
  return fetch(`${aiServiceUrl}${path}`, {
    ...init,
    headers: {
      "User-Agent": "bazar-ai-media-smoke/1.0",
      ...(aiInternalKey ? { "X-BazarBaz-AI-Key": aiInternalKey } : {}),
      ...(init.headers || {}),
    },
  });
}

function expectStatus(status, allowed) {
  if (!allowed.includes(status)) {
    throw new Error(`expected status ${allowed.join("/")}, got ${status}`);
  }
}

addCheck("Unauthenticated AI media status is blocked", async () => {
  const res = await request("/api/dashboard/ai-media/status");
  expectStatus(res.status, [401]);
});

addCheck("Render AI media service health is green when URL is provided", async () => {
  if (!aiServiceUrl) {
    console.log("skip: AI_MEDIA_SERVICE_URL not provided");
    return;
  }
  const health = await aiRequest("/health");
  expectStatus(health.status, [200]);
  const ready = await aiRequest("/ready");
  expectStatus(ready.status, [200]);
});

addCheck("Render AI media service blocks unauthenticated job creation", async () => {
  if (!aiServiceUrl) {
    console.log("skip: AI_MEDIA_SERVICE_URL not provided");
    return;
  }
  const res = await fetch(`${aiServiceUrl}/v1/product-image-suggestions/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "bazar-ai-media-smoke/1.0",
    },
    body: JSON.stringify({}),
  });
  expectStatus(res.status, [401]);
});

addCheck("Render AI media service can complete a MOCK job when key is provided", async () => {
  if (!aiServiceUrl || !aiInternalKey) {
    console.log("skip: AI_MEDIA_SERVICE_URL or AI_MEDIA_SERVICE_INTERNAL_KEY not provided");
    return;
  }

  const create = await aiRequest("/v1/product-image-suggestions/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organization_id: "smoke-org",
      product_id: "smoke-product",
      requested_by_user_id: "smoke-user",
      product_title: "پیتزا پپرونی",
      category: "پیتزا",
      description: "پیتزا پپرونی با پنیر زیاد و خمیر دست‌ساز",
      seller_prompt: "عکس روشن، اشتهابرانگیز، مناسب منوی آنلاین",
      brand: {
        shop_name: "فروشگاه تست",
        logo_url: null,
        primary_color: null,
      },
      input_images: [],
      count: 3,
      aspect_ratio: "1:1",
      style_preset: "LIGHT_MENU_PHOTO",
    }),
  });
  expectStatus(create.status, [200, 201, 202]);
  const created = await create.json();
  if (!created.job_id) throw new Error("expected job_id from AI media service");

  let job = null;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const poll = await aiRequest(`/v1/product-image-suggestions/jobs/${encodeURIComponent(created.job_id)}`);
    expectStatus(poll.status, [200]);
    job = await poll.json();
    if (["COMPLETED", "FAILED", "CANCELED"].includes(job.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (!job || job.status !== "COMPLETED") {
    throw new Error(`expected completed MOCK job, got ${job?.status || "unknown"}`);
  }

  const outputs = job.outputs || (job.output_images || []).map((url) => ({ url }));
  if (outputs.length < 3) throw new Error(`expected at least 3 outputs, got ${outputs.length}`);
  if (!outputs.every((output) => typeof output.url === "string" && output.url.includes("/local-output/"))) {
    throw new Error("expected MOCK /local-output/ URLs");
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
