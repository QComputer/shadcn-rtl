#!/usr/bin/env node

const baseUrl = (process.env.DEPLOYED_URL || process.env.NEXT_PUBLIC_DEPLOYED_APP_URL || "").replace(/\/$/, "");

if (!baseUrl) {
  console.error("DEPLOYED_URL is required, for example: DEPLOYED_URL=https://example.com npm run e2e:deployed:phase3");
  process.exit(1);
}

const checks = [];

async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    checks.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
    console.error(`✗ ${name}`);
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function expectStatus(path, options, allowedStatuses) {
  const response = await fetch(`${baseUrl}${path}`, options);
  if (!allowedStatuses.includes(response.status)) {
    const body = await response.text().catch(() => "");
    throw new Error(`${path} returned ${response.status}; expected ${allowedStatuses.join("/")}. Body: ${body.slice(0, 300)}`);
  }
  return response;
}

await check("homepage is reachable", async () => {
  await expectStatus("/fa", {}, [200, 307, 308]);
});

await check("public search endpoint still responds", async () => {
  await expectStatus("/api/public/search?q=test", {}, [200]);
});

await check("unauthenticated users list is blocked", async () => {
  await expectStatus("/api/users", {}, [401]);
});

await check("unauthenticated current membership is blocked", async () => {
  await expectStatus("/api/users/me/membership", {}, [401]);
});

await check("unauthenticated organization member list is blocked", async () => {
  await expectStatus("/api/organizations/phase3-test/members", {}, [401]);
});

await check("unauthenticated organization member mutation is blocked", async () => {
  await expectStatus(
    "/api/organizations/phase3-test/members/phase3-member",
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    },
    [401],
  );
});

const failed = checks.filter((item) => !item.ok);
console.table(checks);

if (failed.length > 0) {
  process.exit(1);
}
