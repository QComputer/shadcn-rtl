const baseUrl = (process.env.DEPLOYED_URL || "").replace(/\/$/, "");

if (!baseUrl) {
  console.error("DEPLOYED_URL is required, for example: https://bazar-baz.ir");
  process.exit(1);
}

const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
    console.error(`✗ ${name}`);
    console.error(error);
  }
}

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

function expectStatus(name, response, allowed) {
  if (!allowed.includes(response.status)) {
    throw new Error(`${name}: expected ${allowed.join("/")}, got ${response.status}`);
  }
}

await check("homepage is reachable", async () => {
  const res = await request("/fa");
  expectStatus("homepage", res, [200, 307, 308]);
});

await check("appointment list blocks unauthenticated users", async () => {
  const res = await request("/api/appointments");
  expectStatus("appointments list", res, [401, 403]);
});

await check("appointment detail blocks unauthenticated users", async () => {
  const res = await request("/api/appointments/cmphase4missing");
  expectStatus("appointment detail", res, [401, 403]);
});

await check("appointment mutation blocks unauthenticated users", async () => {
  const res = await request("/api/appointments/cmphase4missing", {
    method: "PATCH",
    body: JSON.stringify({ status: "COMPLETED" }),
  });
  expectStatus("appointment patch", res, [401, 403]);
});

await check("slot endpoint validates missing date", async () => {
  const res = await request("/api/services/cmphase4missing/slots");
  expectStatus("slots missing date", res, [400]);
});

await check("public appointment detail requires phone or booking reference", async () => {
  const res = await request("/api/public/appointments/cmphase4missing");
  expectStatus("public appointment detail", res, [400, 401, 403, 404]);
});

console.table(results);

const failed = results.filter((result) => !result.ok);
if (failed.length > 0) {
  process.exit(1);
}
