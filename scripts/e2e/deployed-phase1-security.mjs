#!/usr/bin/env node

const baseUrl = (process.env.DEPLOYED_URL || process.env.NEXT_PUBLIC_DEPLOYED_APP_URL || "").replace(/\/$/, "");

if (!baseUrl) {
  console.error("DEPLOYED_URL is required, for example: DEPLOYED_URL=https://example.com npm run e2e:deployed:phase1");
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
      "User-Agent": "bazar-phase1-security-smoke/1.0",
      ...(init.headers || {}),
    },
  });
}

function expectStatus(status, allowed) {
  if (!allowed.includes(status)) {
    throw new Error(`expected status ${allowed.join("/")}, got ${status}`);
  }
}

addCheck("Unauthenticated users API is blocked", async () => {
  const res = await request("/api/users");
  expectStatus(res.status, [401, 403]);
});

addCheck("Unauthenticated upload is blocked", async () => {
  const body = new FormData();
  body.append("file", new Blob(["not really an image"], { type: "text/plain" }), "x.txt");
  const res = await request("/api/upload", { method: "POST", body });
  expectStatus(res.status, [401, 403]);
});

addCheck("Unauthenticated saved QR creation is blocked", async () => {
  const res = await request("/api/qrcode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: `${baseUrl}/fa` }),
  });
  expectStatus(res.status, [401, 403]);
});

addCheck("Public QR image generation still works", async () => {
  const res = await request(`/api/qrcode?url=${encodeURIComponent(`${baseUrl}/fa`)}`);
  if (res.status !== 200) {
    throw new Error(`expected 200, got ${res.status}`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("image/png")) {
    throw new Error(`expected image/png response, got ${contentType}`);
  }
});

addCheck("Unauthenticated image delete is blocked or not found", async () => {
  const res = await request("/api/images/non-existent-image-id", { method: "DELETE" });
  expectStatus(res.status, [401, 403, 404]);
});


addCheck("Public appointment detail requires phone or reference", async () => {
  const res = await request("/api/public/appointments/not-a-real-id");
  expectStatus(res.status, [400]);
});

addCheck("Organization open mutation is blocked without auth", async () => {
  const res = await request("/api/organizations/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isOpen: true }),
  });
  expectStatus(res.status, [401, 403]);
});

addCheck("Public order payment mutation is disabled", async () => {
  const res = await request("/api/public/orders/not-a-real-order", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentId: "fake" }),
  });
  expectStatus(res.status, [405]);
});

addCheck("Homepage is reachable", async () => {
  const res = await request("/fa");
  if (![200, 307, 308].includes(res.status)) {
    throw new Error(`expected 200/307/308, got ${res.status}`);
  }
});

let failed = 0;
console.log(`Running ${checks.length} deployed Phase 1 security checks against ${baseUrl}`);

for (const check of checks) {
  try {
    await check.fn();
    console.log(`✓ ${check.name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${check.name}`);
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed > 0) {
  console.error(`${failed}/${checks.length} checks failed`);
  process.exit(1);
}

console.log(`All ${checks.length} deployed Phase 1 security checks passed`);
