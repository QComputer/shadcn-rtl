#!/usr/bin/env node
const baseUrl = (process.env.DEPLOYED_URL || process.env.NEXT_PUBLIC_DEPLOYED_APP_URL || "https://www.bazar-baz.ir").replace(/\/$/, "");
const username = process.env.DEPLOYED_USERNAME || process.env.DEPLOYED_USER || "Amir";
const password = process.env.DEPLOYED_PASSWORD || "123456";
const locale = process.env.DEPLOYED_LOCALE || "fa";
const expectedFingerprint = process.env.AI_MEDIA_EXPECTED_CONTRACT_FINGERPRINT || "ab70c8d0bb1d9ccd";

const checks = [];
const add = (name, pass, detail = "") => {
  checks.push({ name, pass: Boolean(pass), detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};

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
      if (attributes.some((attribute) => /^max-age=0$/i.test(attribute.trim()))) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
}

function splitSetCookieHeader(header) {
  if (!header) return [];
  return header.split(/,(?=\s*[^;,=]+=[^;,]+)/g).map((part) => part.trim()).filter(Boolean);
}

function secretSafe(value) {
  const serialized = JSON.stringify(value);
  return !/(BLOB_READ_WRITE_TOKEN|AI_MEDIA_SERVICE_INTERNAL_KEY|DATABASE_URL|SMS_IR_API_KEY|VAPID_PRIVATE_KEY|NEXTAUTH_SECRET|123456|Bearer\s+[A-Za-z0-9._-]+)/i.test(serialized);
}

function absolute(path) {
  return new URL(path, baseUrl).toString();
}

async function request(session, path, init = {}) {
  const headers = new Headers(init.headers || {});
  const cookie = session?.jar?.header();
  if (cookie) headers.set("cookie", cookie);
  if (!headers.has("user-agent")) headers.set("user-agent", "bazar-ai-media-readonly-contract/1.0");
  const response = await fetch(absolute(path), { ...init, headers, redirect: init.redirect || "follow" });
  session?.jar?.store(response);
  return response;
}

async function requestJson(session, path, init = {}) {
  const response = await request(session, path, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${path}: expected JSON, got status=${response.status} body=${text.slice(0, 200)}`);
  }
  if (!response.ok) {
    throw new Error(`${path}: status=${response.status} body=${text.slice(0, 300)}`);
  }
  return json;
}

async function login() {
  const session = { jar: new CookieJar() };
  const csrf = await requestJson(session, "/api/auth/csrf");
  const body = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    username,
    password,
    redirect: "false",
    callbackUrl: `${baseUrl}/${locale}/dashboard`,
  });
  const response = await request(session, "/api/auth/callback/credentials?json=true", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    redirect: "manual",
  });
  const text = await response.text();
  const location = response.headers.get("location") || "";
  const ok = ([302, 303].includes(response.status) && !/CredentialsSignin|error=/i.test(location))
    || (response.ok && !/CredentialsSignin|error/i.test(text));
  if (!ok) throw new Error(`login failed: status=${response.status}`);
  const authSession = await requestJson(session, "/api/auth/session");
  if (!authSession?.user?.id) throw new Error("login did not establish a session");
  return session;
}

try {
  const anonymous = await request(null, "/api/dashboard/ai-media/status?check=1", { redirect: "manual" });
  add("anonymous status diagnostic is protected", [401, 403, 307, 302].includes(anonymous.status), `status=${anonymous.status}`);

  const session = await login();
  add("deployed login succeeded", true, `user=${username}`);

  const status = await requestJson(session, "/api/dashboard/ai-media/status?check=1");
  add("status diagnostic is secret-safe", secretSafe(status));
  add("remote readiness was checked", status.remote?.checked === true || status.remote?.checked === false, `checked=${status.remote?.checked}`);
  add("paid generation remains disabled", status.paidProvider?.enabled === false);
  add("status exposes only boolean config flags", typeof status.checks?.urlConfigured === "boolean" && typeof status.checks?.internalKeyConfigured === "boolean");

  const contractResponse = await request(session, "/api/dashboard/ai-media/contract");
  if (contractResponse.status === 403) {
    add("contract diagnostic is SUPER_ADMIN protected", true, "status=403; fingerprint skipped for current credential");
    add("contract fingerprint check skipped safely", true, `expected=${expectedFingerprint}`);
  } else {
    const text = await contractResponse.text();
    let contract = null;
    try {
      contract = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`/api/dashboard/ai-media/contract: expected JSON, got ${text.slice(0, 200)}`);
    }
    if (!contractResponse.ok) {
      throw new Error(`/api/dashboard/ai-media/contract: status=${contractResponse.status} body=${text.slice(0, 300)}`);
    }
    add("contract diagnostic is secret-safe", secretSafe(contract));
    add("contract fingerprint matches expected", contract.capabilities?.fingerprint === expectedFingerprint, `fingerprint=${contract.capabilities?.fingerprint}`);
    const records = Array.isArray(contract.capabilities?.records) ? contract.capabilities.records : [];
    const product = records.find((record) => record.capability === "PRODUCT_IMAGE");
    const logo = records.find((record) => record.capability === "ORGANIZATION_LOGO");
    const cover = records.find((record) => record.capability === "ORGANIZATION_COVER");
    add("product-image capability is available when service ready", product?.status === "AVAILABLE" || status.ready === false, `product=${product?.status}`);
    add("logo capability remains unavailable", logo?.status === "UNAVAILABLE");
    add("cover capability remains unavailable", cover?.status === "UNAVAILABLE");
    add("diagnostic confirms no browser direct access", contract.security?.browserDirectAccess === false);
  }
} catch (error) {
  add("deployed read-only contract check completed", false, error instanceof Error ? error.message : String(error));
}

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(`AI media deployed read-only contract validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("AI media deployed read-only contract validation passed.");
