#!/usr/bin/env node
const baseUrl = process.env.DEPLOYED_URL;
if (!baseUrl) {
  console.error("DEPLOYED_URL is required, for example: $env:DEPLOYED_URL='https://zc0.runflare.run'; npm run e2e:deployed:phase12");
  process.exit(1);
}

const root = baseUrl.replace(/\/$/, "");
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const marker = ok ? "✓" : "✗";
  console.log(`${marker} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function check(name, fn) {
  try {
    await fn();
  } catch (error) {
    record(name, false, error?.message || String(error));
  }
}

function expectStatus(status, allowed, label) {
  if (!allowed.includes(status)) {
    throw new Error(`${label} status=${status}, expected ${allowed.join("/")}`);
  }
}

await check("homepage is reachable", async () => {
  const response = await fetch(`${root}/fa`, { redirect: "manual" });
  expectStatus(response.status, [200, 307, 308], "homepage");
  record("homepage is reachable", true, `status=${response.status}`);
});

await check("unauthenticated conversation list is blocked", async () => {
  const response = await fetch(`${root}/api/conversations`);
  expectStatus(response.status, [401, 403], "conversation list");
  record("unauthenticated conversation list is blocked", true, `status=${response.status}`);
});

await check("unauthenticated conversation create is blocked", async () => {
  const response = await fetch(`${root}/api/conversations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ participantIds: ["user-a"] }),
  });
  expectStatus(response.status, [401, 403], "conversation create");
  record("unauthenticated conversation create is blocked", true, `status=${response.status}`);
});

await check("unauthenticated conversation detail is blocked", async () => {
  const response = await fetch(`${root}/api/conversations/not-a-real-conversation`);
  expectStatus(response.status, [401, 403], "conversation detail");
  record("unauthenticated conversation detail is blocked", true, `status=${response.status}`);
});

await check("unauthenticated message send is blocked", async () => {
  const response = await fetch(`${root}/api/conversations/not-a-real-conversation/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: "hello" }),
  });
  expectStatus(response.status, [401, 403], "message send");
  record("unauthenticated message send is blocked", true, `status=${response.status}`);
});

await check("health endpoint remains reachable", async () => {
  const response = await fetch(`${root}/api/health`);
  expectStatus(response.status, [200], "health");
  record("health endpoint remains reachable", true, `status=${response.status}`);
});

console.table(results.map(({ name, ok }) => ({ name, ok })));
if (results.some((result) => !result.ok)) process.exit(1);
