#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const configuredBaseUrl = (process.env.DEPLOYED_URL || process.env.NEXT_PUBLIC_DEPLOYED_APP_URL || "").replace(/\/$/, "");
const username = process.env.DEPLOYED_USERNAME || process.env.DEPLOYED_USER || "Amir";
const password = process.env.DEPLOYED_PASSWORD || "123456";
const locale = process.env.DEPLOYED_LOCALE || "fa";
const aiServiceUrl = (process.env.AI_MEDIA_SERVICE_URL || "").replace(/\/$/, "");
const aiInternalKey = process.env.AI_MEDIA_SERVICE_INTERNAL_KEY || "";
const requireBazarReady = process.env.DEPLOYED_AI_MEDIA_REQUIRE_READY === "1";
const selectionProductId = process.env.DEPLOYED_AI_MEDIA_SELECTION_PRODUCT_ID || "";
const requireBlobSelection = process.env.DEPLOYED_AI_MEDIA_REQUIRE_BLOB_SELECTION === "1";
const evidenceDir = process.env.DEPLOYED_AI_MEDIA_EVIDENCE_DIR || "test-results/deployed-ai-media-rollout";

if (!configuredBaseUrl) {
  console.error("DEPLOYED_URL is required, for example: DEPLOYED_URL=https://bazar-baz.ir pnpm run e2e:deployed:ai-media");
  process.exit(1);
}

let baseUrl = configuredBaseUrl;
const results = [];
let latestCostTelemetry = null;

function currentGitCommit() {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

function redactEvidence(value) {
  if (typeof value !== "string") return value;
  let redacted = value.replaceAll(password, "[redacted-password]");
  if (aiInternalKey) redacted = redacted.replaceAll(aiInternalKey, "[redacted-ai-key]");
  return redacted.replace(/(AI_MEDIA_SERVICE_INTERNAL_KEY|BLOB_READ_WRITE_TOKEN|DATABASE_URL)=\S+/g, "$1=[redacted]");
}

function writeEvidence() {
  const output = {
    generatedAt: new Date().toISOString(),
    gitCommit: currentGitCommit(),
    configuredBaseUrl,
    canonicalBaseUrl: baseUrl,
    locale,
    checks: results.map((result) => ({
      name: result.name,
      ok: result.ok,
      detail: redactEvidence(result.detail || ""),
    })),
    summary: {
      total: results.length,
      passed: results.filter((result) => result.ok).length,
      failed: results.filter((result) => !result.ok).length,
      paidGenerationEnabled: false,
      directRenderChecked: Boolean(aiServiceUrl && aiInternalKey),
      selectionProbeRan: Boolean(selectionProductId),
      blobSelectionRequired: requireBlobSelection,
      costTelemetry: latestCostTelemetry,
    },
  };

  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = path.join(evidenceDir, "evidence.json");
  fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`);
  return evidencePath;
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  header() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  store(response) {
    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : splitSetCookieHeader(response.headers.get("set-cookie") || "");

    for (const line of setCookies) {
      const [pair, ...attributes] = line.split(";");
      const index = pair.indexOf("=");
      if (index <= 0) continue;

      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      const deletesCookie = attributes.some((attribute) => /^max-age=0$/i.test(attribute.trim()));

      if (deletesCookie) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
}

function splitSetCookieHeader(header) {
  if (!header) return [];
  return header
    .split(/,(?=\s*[^;,=]+=[^;,]+)/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function absoluteUrl(pathOrUrl) {
  return new URL(pathOrUrl, baseUrl).toString();
}

async function resolveCanonicalBaseUrl() {
  const response = await fetch(baseUrl, {
    redirect: "manual",
    headers: { "User-Agent": "bazar-ai-media-rollout-gate/1.0" },
  });
  const location = response.headers.get("location");
  if ([301, 302, 303, 307, 308].includes(response.status) && location) {
    baseUrl = new URL(location, baseUrl).origin;
    return `base=${baseUrl} redirect=${response.status}`;
  }
  return `base=${baseUrl} status=${response.status}`;
}

function expectStatus(status, allowed) {
  if (!allowed.includes(status)) {
    throw new Error(`expected status ${allowed.join("/")}, got ${status}`);
  }
}

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail || "" });
    console.log(`ok: ${name}${detail ? ` - ${detail}` : ""}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, detail });
    console.error(`fail: ${name} - ${detail}`);
  }
}

async function request(session, path, init = {}) {
  const headers = new Headers(init.headers || {});
  const cookieHeader = session?.jar?.header();
  if (cookieHeader) headers.set("Cookie", cookieHeader);
  if (!headers.has("User-Agent")) headers.set("User-Agent", "bazar-ai-media-rollout-gate/1.0");

  const response = await fetch(absoluteUrl(path), {
    ...init,
    headers,
    redirect: init.redirect || "follow",
  });
  session?.jar?.store(response);
  return response;
}

async function requestJson(session, path, init = {}) {
  const response = await request(session, path, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${path}: expected JSON, got status=${response.status} body=${text.slice(0, 300)}`);
  }
  if (!response.ok) {
    throw new Error(`${path}: status=${response.status} body=${text.slice(0, 500)}`);
  }
  return json;
}

async function expectPathStatus(name, path, init, allowedStatuses) {
  await check(name, async () => {
    const response = await fetch(absoluteUrl(path), {
      redirect: "manual",
      ...init,
      headers: {
        "User-Agent": "bazar-ai-media-rollout-gate/1.0",
        ...(init?.headers || {}),
      },
    });
    if (!allowedStatuses.includes(response.status)) {
      const text = await response.text().catch(() => "");
      throw new Error(`expected ${allowedStatuses.join("/")}, got ${response.status}. Body: ${text.slice(0, 300)}`);
    }
    return `status=${response.status}`;
  });
}

async function aiRequest(path, init = {}) {
  if (!aiServiceUrl) throw new Error("AI_MEDIA_SERVICE_URL is required for direct AI service checks");
  return fetch(`${aiServiceUrl}${path}`, {
    ...init,
    headers: {
      "User-Agent": "bazar-ai-media-rollout-gate/1.0",
      ...(aiInternalKey ? { "X-BazarBaz-AI-Key": aiInternalKey } : {}),
      ...(init.headers || {}),
    },
  });
}

async function login() {
  const session = { jar: new CookieJar(), username };
  const csrf = await requestJson(session, "/api/auth/csrf");
  const body = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    username,
    password,
    redirect: "false",
    callbackUrl: `${baseUrl}/${locale}/dashboard`,
  });

  const response = await request(session, "/api/auth/callback/credentials?json=true", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    redirect: "manual",
  });
  const text = await response.text();
  const location = response.headers.get("location") || "";
  const loginRedirectSucceeded = [302, 303].includes(response.status) && !/CredentialsSignin|error=/i.test(location);
  const loginJsonSucceeded = response.ok && !/CredentialsSignin|error/i.test(text);

  if (!loginRedirectSucceeded && !loginJsonSucceeded) {
    throw new Error(`login failed for ${username}: status=${response.status} body=${text.slice(0, 300)}`);
  }

  const authSession = await requestJson(session, "/api/auth/session");
  if (!authSession?.user?.id) throw new Error(`login did not establish a session for ${username}`);
  session.user = authSession.user;
  return session;
}

async function resolveOrganizationId(session) {
  const membershipData = await requestJson(session, "/api/users/me/membership");
  const membership = membershipData.membership || membershipData.memberships?.[0];
  if (membership?.organizationId) return membership.organizationId;

  if (session.user?.organizationId) return session.user.organizationId;

  if (session.user?.role !== "SUPER_ADMIN") {
    throw new Error("authenticated user has no active organization membership");
  }

  const organizations = await requestJson(session, "/api/organizations?pageSize=100");
  const organization = (organizations.data || organizations.organizations || []).find((item) => item?.id);
  if (!organization?.id) throw new Error("SUPER_ADMIN has no organization available for deployed AI media smoke");
  return organization.id;
}

async function createDirectMockJob() {
  const create = await aiRequest("/v1/product-image-suggestions/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organization_id: "smoke-org",
      product_id: "smoke-product",
      requested_by_user_id: "smoke-user",
      product_title: "پیتزا پپرونی",
      category: "پیتزا",
      description: "پیتزا پپرونی با پنیر زیاد و خمیر دست ساز",
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

  return { job, outputs };
}

let session;
let organizationId;

await check("canonical deployment URL resolves", resolveCanonicalBaseUrl);
await expectPathStatus("unauthenticated AI media status is blocked", "/api/dashboard/ai-media/status", {}, [401, 403]);
await expectPathStatus("unauthenticated AI media usage is blocked", "/api/dashboard/ai-media/usage", {}, [401, 403]);
await expectPathStatus("unauthenticated AI job creation is blocked", "/api/dashboard/products/non-existent-product-id/ai-image-suggestions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ count: 3 }),
}, [401, 403]);
await expectPathStatus("unauthenticated AI job poll is blocked", "/api/dashboard/ai-image-suggestions/non-existent-job-id", {}, [401, 403]);
await expectPathStatus("unauthenticated AI job cancel is blocked", "/api/dashboard/ai-image-suggestions/non-existent-job-id/cancel", {
  method: "POST",
}, [401, 403]);
await expectPathStatus("unauthenticated AI image select is blocked", "/api/dashboard/products/non-existent-product-id/ai-image-suggestions/select", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ job_id: "non-existent-job-id", image_url: "https://example.com/img.png", output_index: 0 }),
}, [401, 403]);

await check("login succeeds", async () => {
  session = await login();
  return `user=${session.user?.role || "unknown"}`;
});

await check("organization context resolves", async () => {
  organizationId = await resolveOrganizationId(session);
  return `organizationId=${organizationId}`;
});

await check("dashboard AI media status is secret-safe", async () => {
  const status = await requestJson(session, "/api/dashboard/ai-media/status?check=1");
  if (typeof status.enabled !== "boolean") throw new Error("status.enabled must be boolean");
  if (typeof status.configured !== "boolean") throw new Error("status.configured must be boolean");
  if (typeof status.ready !== "boolean") throw new Error("status.ready must be boolean");
  if (!status.checks || typeof status.checks.internalKeyConfigured !== "boolean") {
    throw new Error("status checks missing internalKeyConfigured boolean");
  }
  const serialized = JSON.stringify(status);
  if (/AI_MEDIA_SERVICE_INTERNAL_KEY|BLOB_READ_WRITE_TOKEN|123456/.test(serialized)) {
    throw new Error("status response appears to expose secret material");
  }
  if (requireBazarReady && !status.ready) throw new Error("Bazar Baz AI media status is not ready");
  if (!status.paidProvider || status.paidProvider.enabled !== false) {
    throw new Error("paid provider must remain disabled in status response");
  }
  return `ready=${status.ready} remote=${status.remote?.ok ?? "not-checked"} paid=${status.paidProvider.enabled}`;
});

await check("dashboard AI media usage is quota-shaped and paid generation disabled", async () => {
  const data = await requestJson(session, `/api/dashboard/ai-media/usage?organizationId=${encodeURIComponent(organizationId)}`);
  const usage = data.usage;
  if (!usage) throw new Error("missing usage summary");
  for (const key of ["dailyJobLimit", "dailySelectionLimit", "jobCreateCount", "imageSelectionCount", "remainingDailyJobs", "remainingDailySelections"]) {
    if (typeof usage[key] !== "number") throw new Error(`usage.${key} must be number`);
  }
  if (usage.paidGenerationEnabled !== false) throw new Error("paid generation must remain disabled in rollout gate");
  if (!usage.paidProvider || usage.paidProvider.enabled !== false) throw new Error("paid provider policy must remain disabled in usage response");
  if (!usage.costTelemetry || typeof usage.costTelemetry.dailyEstimatedCostCents !== "number") {
    throw new Error("usage response must include AI media cost telemetry");
  }
  if (usage.costTelemetry.rollbackPaused !== false) throw new Error("paid provider rollback should not be paused in default rollout gate");
  if (!Array.isArray(usage.events)) throw new Error("usage.events must be an array");
  latestCostTelemetry = usage.costTelemetry;
  return `jobs=${usage.jobCreateCount}/${usage.dailyJobLimit} selections=${usage.imageSelectionCount}/${usage.dailySelectionLimit}`;
});

await check("Render AI media service health is green when URL is provided", async () => {
  if (!aiServiceUrl) return "skip: AI_MEDIA_SERVICE_URL not provided";
  const health = await aiRequest("/health");
  expectStatus(health.status, [200]);
  const ready = await aiRequest("/ready");
  expectStatus(ready.status, [200]);
  return "health=200 ready=200";
});

await check("Render AI media service blocks unauthenticated job creation", async () => {
  if (!aiServiceUrl) return "skip: AI_MEDIA_SERVICE_URL not provided";
  const res = await fetch(`${aiServiceUrl}/v1/product-image-suggestions/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "bazar-ai-media-rollout-gate/1.0",
    },
    body: JSON.stringify({}),
  });
  expectStatus(res.status, [401]);
  return `status=${res.status}`;
});

await check("Render AI media service can complete a MOCK job when key is provided", async () => {
  if (!aiServiceUrl || !aiInternalKey) return "skip: AI_MEDIA_SERVICE_URL or AI_MEDIA_SERVICE_INTERNAL_KEY not provided";
  const { job, outputs } = await createDirectMockJob();
  return `job=${job.job_id} outputs=${outputs.length}`;
});

await check("optional Bazar Baz product selection probe returns durable image status", async () => {
  if (!selectionProductId) return "skip: DEPLOYED_AI_MEDIA_SELECTION_PRODUCT_ID not provided";

  const created = await requestJson(session, `/api/dashboard/products/${encodeURIComponent(selectionProductId)}/ai-image-suggestions`, {
    method: "POST",
    body: JSON.stringify({
      count: 1,
      seller_prompt: "عکس محصول واضح برای بررسی rollout هوش مصنوعی",
    }),
  });
  const jobId = created.job?.job_id;
  if (!jobId) throw new Error("Bazar Baz job creation did not return job_id");

  let job = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const data = await requestJson(session, `/api/dashboard/ai-image-suggestions/${encodeURIComponent(jobId)}`);
    job = data.job;
    if (["COMPLETED", "FAILED", "CANCELED"].includes(job?.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (job?.status !== "COMPLETED") throw new Error(`expected completed Bazar Baz job, got ${job?.status || "unknown"}`);

  const outputs = job.outputs || (job.output_images || []).map((url) => ({ url }));
  const selectedUrl = outputs[0]?.url;
  if (!selectedUrl) throw new Error("completed Bazar Baz job did not return an output URL");

  const selected = await requestJson(session, `/api/dashboard/products/${encodeURIComponent(selectionProductId)}/ai-image-suggestions/select`, {
    method: "POST",
    body: JSON.stringify({
      job_id: jobId,
      image_url: selectedUrl,
      output_index: 0,
    }),
  });

  if (selected.success !== true) throw new Error("image selection did not succeed");
  if (requireBlobSelection && selected.storedDurably !== true) {
    throw new Error(`expected durable Blob selection, got storageStatus=${selected.storageStatus}`);
  }
  return `storageStatus=${selected.storageStatus || "unknown"} storedDurably=${selected.storedDurably}`;
});

console.table(results);
const evidencePath = writeEvidence();
console.log(`Operator-safe evidence written to ${evidencePath}`);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`\n${failed.length} check(s) failed`);
  process.exit(1);
}

console.log(`\nAll ${results.length} deployed AI media rollout checks passed`);
