const baseUrl = process.env.DEPLOYED_URL;

if (!baseUrl) {
  console.error("DEPLOYED_URL is required. Example PowerShell: $env:DEPLOYED_URL=\"https://example.com\"; npm run e2e:deployed:phase6");
  process.exit(1);
}

const checks = [];

async function request(path, options = {}) {
  const url = new URL(path, baseUrl).toString();
  return fetch(url, {
    redirect: "manual",
    ...options,
    headers: {
      "user-agent": "bazar-baz-phase6-calendar-smoke/1.0",
      ...(options.headers || {}),
    },
  });
}

async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    checks.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
    console.error(`✗ ${name}`);
    console.error(error);
  }
}

function expectStatus(actual, allowed, context) {
  if (!allowed.includes(actual)) {
    throw new Error(`${context}: expected ${allowed.join("/")}, got ${actual}`);
  }
}

await check("homepage is reachable", async () => {
  const res = await request("/fa");
  expectStatus(res.status, [200], "homepage");
});

await check("dashboard calendar page does not server-error unauthenticated", async () => {
  const res = await request("/fa/dashboard/calendar");
  expectStatus(res.status, [200, 302, 303, 307, 308], "calendar page");
});

await check("dashboard appointments page does not server-error unauthenticated", async () => {
  const res = await request("/fa/dashboard/appointments");
  expectStatus(res.status, [200, 302, 303, 307, 308], "appointments page");
});

await check("appointments API still blocks unauthenticated calendar data", async () => {
  const res = await request("/api/appointments?pageSize=5");
  expectStatus(res.status, [401, 403], "appointments list");
});

await check("membership API still blocks unauthenticated provider filters", async () => {
  const res = await request("/api/users/me/membership");
  expectStatus(res.status, [401, 403], "membership");
});

await check("services API still blocks unauthenticated service filters", async () => {
  const res = await request("/api/services?pageSize=5");
  expectStatus(res.status, [401, 403], "services list");
});

await check("appointment status mutation still blocks unauthenticated users", async () => {
  const res = await request("/api/appointments/not-a-real-id", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "CONFIRMED" }),
  });
  expectStatus(res.status, [401, 403], "appointment mutation");
});

console.table(checks);
const failed = checks.filter((item) => !item.ok);
if (failed.length > 0) {
  process.exit(1);
}
