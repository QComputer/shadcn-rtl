const baseUrl = process.env.DEPLOYED_URL || process.env.NEXT_PUBLIC_DEPLOYED_APP_URL || "https://zc0.runflare.run";

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

function expectStatus(response, expected, context) {
  const values = Array.isArray(expected) ? expected : [expected];
  if (!values.includes(response.status)) {
    throw new Error(`${context}: expected ${values.join("/")}, got ${response.status}`);
  }
}

await check("homepage is reachable", async () => {
  const response = await fetch(`${baseUrl}/fa`, { redirect: "manual" });
  expectStatus(response, [200, 301, 302, 307, 308], "homepage");
});

await check("dashboard summary blocks unauthenticated users", async () => {
  const response = await fetch(`${baseUrl}/api/dashboard`);
  expectStatus(response, 401, "dashboard summary");
});

await check("dashboard notifications block unauthenticated users", async () => {
  const response = await fetch(`${baseUrl}/api/dashboard/notifications`);
  expectStatus(response, 401, "dashboard notifications");
});

await check("media hardening still blocks unauthenticated image list", async () => {
  const response = await fetch(`${baseUrl}/api/images`);
  expectStatus(response, 401, "image list");
});

await check("calendar page still avoids unauthenticated server error", async () => {
  const response = await fetch(`${baseUrl}/fa/dashboard/calendar`, { redirect: "manual" });
  expectStatus(response, [200, 301, 302, 303, 307, 308, 401, 403], "dashboard calendar page");
});

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length > 0) {
  process.exitCode = 1;
}
