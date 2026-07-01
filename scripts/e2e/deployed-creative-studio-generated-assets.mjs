#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const configuredBaseUrl = (process.env.DEPLOYED_URL || process.env.CREATIVE_STUDIO_DEPLOYED_URL || "https://www.bazar-baz.ir").replace(/\/$/, "");
const username = process.env.DEPLOYED_USERNAME || process.env.DEPLOYED_USER || "Amir";
const password = process.env.DEPLOYED_PASSWORD || "123456";
const locale = process.env.DEPLOYED_LOCALE || "fa";
const evidenceDir = process.env.CREATIVE_STUDIO_EVIDENCE_DIR || "test-results/deployed-creative-studio";

let baseUrl = configuredBaseUrl;
const results = [];

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  header() {
    return Array.from(this.cookies.entries()).map(([name, value]) => `${name}=${value}`).join("; ");
  }

  store(response) {
    const setCookies = typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : splitSetCookieHeader(response.headers.get("set-cookie") || "");

    for (const line of setCookies) {
      const [pair, ...attributes] = line.split(";");
      const index = pair.indexOf("=");
      if (index <= 0) continue;
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      const deletesCookie = attributes.some((attribute) => /^max-age=0$/i.test(attribute.trim()));
      if (deletesCookie) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
}

function splitSetCookieHeader(header) {
  if (!header) return [];
  return header.split(/,(?=\s*[^;,=]+=[^;,]+)/g).map((part) => part.trim()).filter(Boolean);
}

function absoluteUrl(pathOrUrl) {
  return new URL(pathOrUrl, baseUrl).toString();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function currentGitCommit() {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

function redact(value) {
  if (typeof value !== "string") return value;
  return value.replaceAll(password, "[redacted-password]");
}

function writeEvidence() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = path.join(evidenceDir, "evidence.json");
  fs.writeFileSync(
    evidencePath,
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      gitCommit: currentGitCommit(),
      configuredBaseUrl,
      canonicalBaseUrl: baseUrl,
      locale,
      checks: results.map((result) => ({
        name: result.name,
        ok: result.ok,
        detail: redact(result.detail || ""),
      })),
    }, null, 2)}\n`,
  );
  return evidencePath;
}

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail || "" });
    console.log(`ok: ${name}${detail ? ` - ${detail}` : ""}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, detail });
    console.error(`fail: ${name} - ${detail}`);
  }
}

async function request(session, pathOrUrl, init = {}) {
  const headers = new Headers(init.headers || {});
  const cookieHeader = session?.jar?.header();
  if (cookieHeader) headers.set("Cookie", cookieHeader);
  if (!headers.has("User-Agent")) headers.set("User-Agent", "bazar-creative-studio-smoke/1.0");

  const response = await fetch(absoluteUrl(pathOrUrl), {
    ...init,
    headers,
    redirect: init.redirect || "follow",
  });
  session?.jar?.store(response);
  return response;
}

async function requestJson(session, pathOrUrl, init = {}) {
  const response = await request(session, pathOrUrl, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${pathOrUrl}: expected JSON, got status=${response.status} body=${text.slice(0, 300)}`);
  }
  return { response, json, text };
}

function assertNoSecrets(value, label) {
  const secretKeyPattern = /(apiKey|privateKey|vapidPrivate|internalKey|token|secret|password)/i;
  const findings = [];

  function visit(current, currentPath) {
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${currentPath}[${index}]`));
      return;
    }
    if (!current || typeof current !== "object") return;

    for (const [key, child] of Object.entries(current)) {
      const childPath = currentPath ? `${currentPath}.${key}` : key;
      if (secretKeyPattern.test(key) && typeof child === "string" && child.trim().length > 0) {
        findings.push(childPath);
      }
      visit(child, childPath);
    }
  }

  visit(value, "");
  assert(findings.length === 0, `${label} exposed secret-like values at ${findings.join(", ")}`);
}

async function resolveCanonicalBaseUrl() {
  const response = await fetch(baseUrl, {
    redirect: "manual",
    headers: { "User-Agent": "bazar-creative-studio-smoke/1.0" },
  });
  const location = response.headers.get("location");
  if ([301, 302, 303, 307, 308].includes(response.status) && location) {
    baseUrl = new URL(location, baseUrl).origin;
    return `base=${baseUrl} redirect=${response.status}`;
  }
  return `base=${baseUrl} status=${response.status}`;
}

async function login() {
  const session = { jar: new CookieJar() };
  const csrfResult = await requestJson(session, "/api/auth/csrf");
  assert(csrfResult.response.ok && csrfResult.json?.csrfToken, "CSRF token missing");
  const body = new URLSearchParams({
    csrfToken: csrfResult.json.csrfToken,
    username,
    password,
    redirect: "false",
    callbackUrl: `${baseUrl}/${locale}/dashboard/creative-studio`,
  });

  const response = await request(session, "/api/auth/callback/credentials?json=true", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    redirect: "manual",
  });
  const text = await response.text();
  assert([200, 302, 303, 307, 308].includes(response.status), `login failed status=${response.status} body=${text.slice(0, 300)}`);
  const location = response.headers.get("location") || text;
  assert(!/error=|CredentialsSignin|AccessDenied/i.test(location), `login rejected by credentials provider: ${location.slice(0, 300)}`);

  const sessionResult = await requestJson(session, "/api/auth/session");
  assert(sessionResult.response.ok && sessionResult.json?.user, "authenticated session did not include user data");
  return session;
}

async function main() {
  console.log("Deployed Creative Studio generated asset smoke");
  console.log(`Configured URL: ${configuredBaseUrl}`);
  console.log(`User: ${username}`);
  console.log("");

  await check("canonical deployment URL resolves", resolveCanonicalBaseUrl);

  await check("unauthenticated Creative Studio APIs are blocked", async () => {
    const response = await request(null, "/api/dashboard/creative-studio/status", { redirect: "manual" });
    assert([401, 403, 302, 307].includes(response.status), `expected auth block, got ${response.status}`);
    return `status=${response.status}`;
  });

  const session = await login();

  await check("authenticated organization membership resolves", async () => {
    const membershipResult = await requestJson(session, "/api/users/me/membership");
    assert(membershipResult.response.ok, `membership status=${membershipResult.response.status}`);
    const active = membershipResult.json.membership || membershipResult.json.memberships?.[0];
    assert(active?.organizationId, "no active organizationId found");
    session.organizationId = active.organizationId;
    session.organizationSlug = active.organizationSlug;
    return `organization=${active.organizationSlug || active.organizationId}`;
  });

  await check("Creative Studio dashboard page is reachable", async () => {
    const response = await request(session, `/${locale}/dashboard/creative-studio`);
    const text = await response.text();
    assert(response.status === 200, `dashboard status=${response.status}`);
    assert(/استودیوی خلاقیت|Creative Studio/.test(text), "dashboard page copy missing");
    return `bytes=${text.length}`;
  });

  await check("Creative Studio status is secret-safe and server-mediated", async () => {
    const result = await requestJson(session, `/api/dashboard/creative-studio/status?organizationId=${encodeURIComponent(session.organizationId)}&check=1`);
    assert(result.response.ok, `status endpoint status=${result.response.status}`);
    const status = result.json.status;
    assert(status?.generationReadiness, "generation readiness missing");
    assert(status.generationReadiness.serverOnly === true, "generation readiness must stay server-only");
    assert(status.generationReadiness.browserWorkerCallsAllowed === false, "browser worker calls must remain blocked");
    assert(status.policy?.draftOnly === true, "Creative Studio should remain draft-first");
    assert(status.policy?.noPublicAssetMutation === false, "apply controls should remain explicit, not automatic");
    assertNoSecrets(status, "Creative Studio status");
    return `phase=${status.generationReadiness.phase} remaining=${status.limits?.remainingDailyJobs}`;
  });

  await check("Creative Studio jobs and usage are readable", async () => {
    const [usageResult, jobsResult] = await Promise.all([
      requestJson(session, `/api/dashboard/creative-studio/usage?organizationId=${encodeURIComponent(session.organizationId)}`),
      requestJson(session, `/api/dashboard/creative-studio/jobs?organizationId=${encodeURIComponent(session.organizationId)}&pageSize=5`),
    ]);
    assert(usageResult.response.ok, `usage status=${usageResult.response.status}`);
    assert(jobsResult.response.ok, `jobs status=${jobsResult.response.status}`);
    assert(typeof usageResult.json.usage?.remainingDailyJobs === "number", "usage remainingDailyJobs missing");
    assert(Array.isArray(jobsResult.json.jobs), "jobs list missing");
    assertNoSecrets(usageResult.json, "Creative Studio usage");
    assertNoSecrets(jobsResult.json, "Creative Studio jobs");
    return `jobs=${jobsResult.json.jobs.length}`;
  });

  await check("unknown asset selection is scoped and non-mutating", async () => {
    const result = await requestJson(session, `/api/dashboard/creative-studio/assets/cm00000000000000000000000/select?organizationId=${encodeURIComponent(session.organizationId)}`, {
      method: "POST",
      body: JSON.stringify({ organizationId: session.organizationId, targetField: "product.image" }),
    });
    assert([404, 400].includes(result.response.status), `expected safe rejection, got ${result.response.status}`);
    assertNoSecrets(result.json, "Creative Studio select rejection");
    return `status=${result.response.status}`;
  });

  const evidencePath = writeEvidence();
  const failed = results.filter((result) => !result.ok);
  console.log("");
  console.log(`Evidence: ${evidencePath}`);
  console.log(`Passed ${results.length - failed.length}/${results.length} checks.`);

  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  results.push({ name: "fatal", ok: false, detail: error instanceof Error ? error.message : String(error) });
  const evidencePath = writeEvidence();
  console.error(`Fatal deployed Creative Studio smoke failure. Evidence: ${evidencePath}`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
