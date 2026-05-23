#!/usr/bin/env node
const baseUrl = (process.env.DEPLOYED_URL || "http://localhost:3000").replace(/\/$/, "");
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const icon = ok ? "✓" : "✗";
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...options,
    headers: {
      "user-agent": "bazar-baz-phase9-smoke/1.0",
      ...(options.headers || {}),
    },
  });
}

async function expectReachable(name, path) {
  try {
    const response = await request(path);
    record(name, response.status < 500, `status=${response.status}`);
  } catch (error) {
    record(name, false, error.message);
  }
}

async function expectBlocked(name, path, options = {}) {
  try {
    const response = await request(path, options);
    record(name, [401, 403, 404, 405].includes(response.status), `status=${response.status}`);
  } catch (error) {
    record(name, false, error.message);
  }
}

await expectReachable("homepage is reachable", "/fa");
await expectReachable("public search responds", "/api/public/search?q=test");
await expectReachable("dashboard calendar route avoids server error", "/fa/dashboard/calendar");
await expectReachable("dashboard appointments route avoids server error", "/fa/dashboard/appointments");
await expectBlocked("dashboard summary blocks unauthenticated", "/api/dashboard");
await expectBlocked("notifications block unauthenticated", "/api/dashboard/notifications");
await expectBlocked("users list blocks unauthenticated", "/api/users");
await expectBlocked("upload blocks unauthenticated", "/api/upload", { method: "POST" });
await expectBlocked("order mutation blocks unauthenticated", "/api/orders/phase9-placeholder", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ status: "DELIVERED" }),
});
await expectBlocked("appointment mutation blocks unauthenticated", "/api/appointments/phase9-placeholder", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ status: "CONFIRMED" }),
});

console.table(results.map(({ name, ok }) => ({ name, ok })));
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`Phase 9 deployed smoke failed with ${failed.length} issue(s).`);
  process.exit(1);
}
