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
      "user-agent": "bazar-phase11-health-smoke/1.0",
      ...(init.headers || {}),
    },
  });
}

async function jsonOrNull(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function doesNotLeakSecrets(payload) {
  const text = JSON.stringify(payload);
  return !text.includes("postgres://") &&
    !text.includes("postgresql://") &&
    !text.includes("NEXTAUTH_SECRET") &&
    !text.includes("DATABASE_URL=");
}

async function main() {
  const home = await request("/fa");
  record("homepage is reachable", home.status >= 200 && home.status < 400, `status=${home.status}`);

  const health = await request("/api/health");
  const healthJson = await jsonOrNull(health);
  record("health endpoint is reachable", health.status === 200, `status=${health.status}`);
  record("health endpoint returns ok status", healthJson?.status === "ok", `status=${healthJson?.status}`);
  record("health endpoint does not leak secrets", doesNotLeakSecrets(healthJson), "sanitized payload");
  record("health endpoint reports env summary", Boolean(healthJson?.checks?.environment?.summary), "environment summary present");

  const deepHealth = await request("/api/health?deep=1");
  const deepHealthJson = await jsonOrNull(deepHealth);
  record("deep health endpoint is reachable", deepHealth.status === 200, `status=${deepHealth.status}`);
  record("deep health checks database", deepHealthJson?.checks?.database?.checked === true, "database checked=true");
  record("deep health database is ok", deepHealthJson?.checks?.database?.ok === true, `database.ok=${deepHealthJson?.checks?.database?.ok}`);
  record("deep health does not leak secrets", doesNotLeakSecrets(deepHealthJson), "sanitized payload");

  const headers = await request("/api/health");
  record(
    "health endpoint sends no-store cache header",
    /no-store/.test(headers.headers.get("cache-control") || ""),
    `cache-control=${headers.headers.get("cache-control")}`,
  );

  console.table(results.map(({ name, ok }) => ({ name, ok })));
  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
