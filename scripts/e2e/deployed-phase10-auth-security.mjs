const baseUrl = process.env.DEPLOYED_URL || process.env.NEXT_PUBLIC_DEPLOYED_APP_URL || "http://localhost:3000";
const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const mark = ok ? "✓" : "✗";
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function request(path, init = {}) {
  return fetch(`${normalizedBaseUrl}${path}`, {
    redirect: "manual",
    ...init,
    headers: {
      "user-agent": "bazar-phase10-auth-security-smoke/1.0",
      ...(init.headers || {}),
    },
  });
}

async function main() {
  const home = await request("/fa");
  record("homepage is reachable", home.status >= 200 && home.status < 400, `status=${home.status}`);

  const xContentTypeOptions = home.headers.get("x-content-type-options");
  record(
    "security header x-content-type-options is present",
    xContentTypeOptions === "nosniff",
    `x-content-type-options=${xContentTypeOptions}`,
  );

  const xFrameOptions = home.headers.get("x-frame-options");
  record(
    "security header x-frame-options is present",
    xFrameOptions === "SAMEORIGIN",
    `x-frame-options=${xFrameOptions}`,
  );

  const referrerPolicy = home.headers.get("referrer-policy");
  record(
    "security header referrer-policy is present",
    referrerPolicy === "strict-origin-when-cross-origin",
    `referrer-policy=${referrerPolicy}`,
  );

  const search = await request("/api/public/search?q=shop&locale=fa");
  record("public search still responds", search.status === 200 || search.status === 429, `status=${search.status}`);

  const protectedUsers = await request("/api/users");
  record(
    "users API remains blocked without auth",
    [401, 403].includes(protectedUsers.status),
    `status=${protectedUsers.status}`,
  );

  const protectedNotifications = await request("/api/dashboard/notifications");
  record(
    "dashboard notifications remain blocked without auth",
    [401, 403].includes(protectedNotifications.status),
    `status=${protectedNotifications.status}`,
  );

  const passed = results.every((result) => result.ok);
  console.table(results.map(({ name, ok }) => ({ name, ok })));

  if (!passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
