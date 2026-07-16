#!/usr/bin/env node

const REQUIRED_TRUE_FLAGS = [
  "AI_MEDIA_PREVIEW_WRITE_E2E",
  "AI_MEDIA_PREVIEW_MOCK_WRITES_ENABLED",
  "AI_MEDIA_PREVIEW_ISOLATION_VERIFIED",
  "AI_MEDIA_RENDER_PINNED_CONTRACT_VERIFIED",
  "AI_MEDIA_PREVIEW_DB_IDENTITY_VERIFIED",
];

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function requireTrueFlag(name) {
  if (process.env[name] !== "1" && process.env[name] !== "true") {
    fail(`${name} must be explicitly enabled for Preview live E2E.`);
    return false;
  }
  return true;
}

function assertNoProductionTarget(url) {
  const parsed = new URL(url);
  if (/bazar-baz\.ir$/i.test(parsed.hostname) || parsed.hostname === "www.bazar-baz.ir") {
    throw new Error("Preview live E2E refuses Production host.");
  }
}

function assertNoSecretLeak(value) {
  if (/DATABASE_URL|DIRECT_URL|BLOB_READ_WRITE_TOKEN|AI_MEDIA_SERVICE_INTERNAL_KEY|Bearer\s+[A-Za-z0-9_.-]+/i.test(value)) {
    throw new Error("Preview live E2E response contained secret-like text.");
  }
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Cookie: process.env.AI_MEDIA_PREVIEW_SESSION_COOKIE,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  assertNoSecretLeak(text);
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Expected JSON response, got status ${response.status}.`);
  }
  return { response, json };
}

async function main() {
  const flagsOk = REQUIRED_TRUE_FLAGS.every(requireTrueFlag);
  if (!flagsOk) return;

  const baseUrl = process.env.AI_MEDIA_PREVIEW_BASE_URL;
  if (!baseUrl) return fail("AI_MEDIA_PREVIEW_BASE_URL is required.");
  if (!process.env.AI_MEDIA_PREVIEW_SESSION_COOKIE) return fail("AI_MEDIA_PREVIEW_SESSION_COOKIE is required.");

  assertNoProductionTarget(baseUrl);
  const base = new URL(baseUrl);
  const idempotencyKey = `preview-mock-e2e-${Date.now()}`;
  const createUrl = new URL("/api/dashboard/ai-media/preview/jobs", base);
  const create = await requestJson(createUrl, {
    method: "POST",
    body: JSON.stringify({
      dryRun: false,
      targetType: "PRODUCT_IMAGE",
      targetId: "preview-product-image",
      idempotencyKey,
      payload: {
        prompt: "Preview MOCK E2E product image",
        productTitle: "Preview product",
        category: "preview",
      },
    }),
  });

  if (!create.response.ok) {
    return fail(`Preview MOCK create failed with status ${create.response.status}.`);
  }
  if (!create.json?.mirror?.id || !create.json?.provider?.jobId) {
    return fail("Preview MOCK create response did not include safe app mirror/provider ids.");
  }
  if (create.json.safety?.blobWrite !== false || create.json.safety?.realGeneration !== false) {
    return fail("Preview MOCK create response did not preserve Blob/real-generation safety flags.");
  }

  const syncUrl = new URL(`/api/dashboard/ai-media/preview/jobs/${encodeURIComponent(create.json.mirror.id)}`, base);
  const sync = await requestJson(syncUrl, { method: "POST" });
  if (!sync.response.ok) {
    return fail(`Preview MOCK status sync failed with status ${sync.response.status}.`);
  }

  console.log(JSON.stringify({
    ok: true,
    mirrorId: create.json.mirror.id,
    providerJobId: create.json.provider.jobId,
    createState: create.json.mirror.state,
    syncState: sync.json.state,
    blobWrite: false,
    realGeneration: false,
  }));
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "Unknown Preview live E2E failure.");
});
