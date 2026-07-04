#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const configuredBaseUrl = (process.env.DEPLOYED_URL || process.env.DEPLOYED_SMS_NOTIF_OPS_URL || "https://www.bazar-baz.ir").replace(/\/$/, "")
const username = process.env.DEPLOYED_USERNAME || process.env.DEPLOYED_USER || "Amir"
const password = process.env.DEPLOYED_PASSWORD || "123456"
const locale = process.env.DEPLOYED_LOCALE || "fa"
const evidenceDir = process.env.DEPLOYED_SMS_NOTIF_OPS_EVIDENCE_DIR || "test-results/deployed-sms-notif-ops"

let baseUrl = configuredBaseUrl
const results = []

function currentGitCommit() {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" })
  return result.status === 0 ? result.stdout.trim() : "unknown"
}

function redact(value) {
  if (typeof value !== "string") return value
  return value.replaceAll(password, "[redacted-password]")
}

function writeEvidence() {
  fs.mkdirSync(evidenceDir, { recursive: true })
  const evidencePath = path.join(evidenceDir, "evidence.json")
  fs.writeFileSync(
    evidencePath,
    `${JSON.stringify(
      {
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
      },
      null,
      2,
    )}\n`,
  )
  return evidencePath
}

class CookieJar {
  constructor() {
    this.cookies = new Map()
  }

  header() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ")
  }

  store(response) {
    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : splitSetCookieHeader(response.headers.get("set-cookie") || "")

    for (const line of setCookies) {
      const [pair, ...attributes] = line.split(";")
      const index = pair.indexOf("=")
      if (index <= 0) continue

      const name = pair.slice(0, index).trim()
      const value = pair.slice(index + 1).trim()
      const deletesCookie = attributes.some((attribute) => /^max-age=0$/i.test(attribute.trim()))

      if (deletesCookie) this.cookies.delete(name)
      else this.cookies.set(name, value)
    }
  }
}

function splitSetCookieHeader(header) {
  if (!header) return []
  return header
    .split(/,(?=\s*[^;,=]+=[^;,]+)/g)
    .map((part) => part.trim())
    .filter(Boolean)
}

function absoluteUrl(pathOrUrl) {
  return new URL(pathOrUrl, baseUrl).toString()
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function expectStatus(status, allowed) {
  assert(allowed.includes(status), `expected status ${allowed.join("/")}, got ${status}`)
}

async function check(name, fn) {
  try {
    const detail = await fn()
    results.push({ name, ok: true, detail: detail || "" })
    console.log(`ok: ${name}${detail ? ` - ${detail}` : ""}`)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    results.push({ name, ok: false, detail })
    console.error(`fail: ${name} - ${detail}`)
  }
}

async function request(session, pathOrUrl, init = {}) {
  const headers = new Headers(init.headers || {})
  const cookieHeader = session?.jar?.header()
  if (cookieHeader) headers.set("Cookie", cookieHeader)
  if (!headers.has("User-Agent")) headers.set("User-Agent", "bazar-sms-notif-ops-smoke/1.0")

  const response = await fetch(absoluteUrl(pathOrUrl), {
    ...init,
    headers,
    redirect: init.redirect || "follow",
  })
  session?.jar?.store(response)
  return response
}

async function requestText(session, pathOrUrl, init = {}) {
  const response = await request(session, pathOrUrl, init)
  const text = await response.text()
  return { response, text }
}

async function requestJson(session, pathOrUrl, init = {}) {
  const response = await request(session, pathOrUrl, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init.headers || {}),
    },
  })
  const text = await response.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    throw new Error(`${pathOrUrl}: expected JSON, got status=${response.status} body=${text.slice(0, 300)}`)
  }
  if (!response.ok) {
    throw new Error(`${pathOrUrl}: status=${response.status} body=${text.slice(0, 500)}`)
  }
  return json
}

async function resolveCanonicalBaseUrl() {
  const response = await fetch(baseUrl, {
    redirect: "manual",
    headers: { "User-Agent": "bazar-sms-notif-ops-smoke/1.0" },
  })
  const location = response.headers.get("location")
  if ([301, 302, 303, 307, 308].includes(response.status) && location) {
    baseUrl = new URL(location, baseUrl).origin
    return `base=${baseUrl} redirect=${response.status}`
  }
  return `base=${baseUrl} status=${response.status}`
}

async function login() {
  const session = { jar: new CookieJar() }
  const csrf = await requestJson(session, "/api/auth/csrf")
  const body = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    username,
    password,
    redirect: "false",
    callbackUrl: `${baseUrl}/${locale}/dashboard`,
  })

  const response = await request(session, "/api/auth/callback/credentials?json=true", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    redirect: "manual",
  })
  const text = await response.text()
  if (![200, 302, 303, 307, 308].includes(response.status)) {
    throw new Error(`login failed status=${response.status} body=${text.slice(0, 300)}`)
  }
  const location = response.headers.get("location") || text
  if (/error=|CredentialsSignin|AccessDenied/i.test(location)) {
    throw new Error(`login rejected by credentials provider: ${location.slice(0, 300)}`)
  }

  const authSession = await requestJson(session, "/api/auth/session")
  assert(authSession?.user, "authenticated session did not include user data")
  return session
}

function assertNoSecrets(value, label) {
  const secretKeyPattern = /(apiKey|privateKey|vapidPrivate|token|secret|password|lineNumber)/i
  const findings = []

  function visit(current, currentPath) {
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${currentPath}[${index}]`))
      return
    }
    if (!current || typeof current !== "object") return

    for (const [key, child] of Object.entries(current)) {
      const childPath = currentPath ? `${currentPath}.${key}` : key
      if (secretKeyPattern.test(key) && typeof child === "string" && child.trim().length > 0) {
        findings.push(childPath)
      }
      visit(child, childPath)
    }
  }

  visit(value, "")
  assert(findings.length === 0, `${label} exposed secret-like values at ${findings.join(", ")}`)
}

async function main() {
  console.log("Deployed SMS and Notification Operations smoke")
  console.log(`Configured URL: ${configuredBaseUrl}`)
  console.log(`User: ${username}`)
  console.log("")

  await check("canonical deployment URL resolves", resolveCanonicalBaseUrl)

  await check("first visit redirects to Persian locale", async () => {
    const response = await fetch(absoluteUrl("/"), {
      redirect: "manual",
      headers: {
        "User-Agent": "bazar-sms-notif-ops-smoke/1.0",
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: "locale=en",
      },
    })
    expectStatus(response.status, [301, 302, 303, 307, 308])
    const location = response.headers.get("location") || ""
    const nextUrl = new URL(location, baseUrl)
    assert(nextUrl.pathname === "/fa" || nextUrl.pathname.startsWith("/fa/"), `expected /fa redirect, got ${location}`)
    return `location=${location}`
  })

  await check("unauthenticated notification operations is blocked", async () => {
    const response = await request(null, "/api/dashboard/notification-operations", { redirect: "manual" })
    expectStatus(response.status, [401, 403, 302, 307])
    return `status=${response.status}`
  })

  await check("unauthenticated SMS status is blocked", async () => {
    const response = await request(null, "/api/dashboard/notification-operations/sms-ir/status", { redirect: "manual" })
    expectStatus(response.status, [401, 403, 302, 307])
    return `status=${response.status}`
  })

  await check("unauthenticated SMS lines is blocked", async () => {
    const response = await request(null, "/api/dashboard/notification-operations/sms-ir/lines", { redirect: "manual" })
    expectStatus(response.status, [401, 403, 302, 307])
    return `status=${response.status}`
  })

  await check("unauthenticated SMS deliveries is blocked", async () => {
    const response = await request(null, "/api/dashboard/notification-operations/sms-ir/deliveries", { redirect: "manual" })
    expectStatus(response.status, [401, 403, 302, 307])
    return `status=${response.status}`
  })

  await check("unauthenticated SMS live report is blocked", async () => {
    const response = await request(null, "/api/dashboard/notification-operations/sms-ir/reports/live", { redirect: "manual" })
    expectStatus(response.status, [401, 403, 302, 307])
    return `status=${response.status}`
  })

  await check("unauthenticated SMS packs report is blocked", async () => {
    const response = await request(null, "/api/dashboard/notification-operations/sms-ir/reports/packs", { redirect: "manual" })
    expectStatus(response.status, [401, 403, 302, 307])
    return `status=${response.status}`
  })

  await check("unauthenticated SMS reconcile is blocked", async () => {
    const response = await request(null, "/api/dashboard/notification-operations/sms-ir/deliveries/fake/reconcile", {
      method: "POST",
      redirect: "manual",
    })
    expectStatus(response.status, [401, 403, 302, 307])
    return `status=${response.status}`
  })

  const session = await login()

  await check("authenticated organization membership resolves", async () => {
    const payload = await requestJson(session, "/api/users/me/membership")
    const active = payload.membership || payload.memberships?.[0]
    assert(active?.organizationId, "no active organizationId found")
    assert(active?.organizationSlug, "no active organizationSlug found")
    session.organizationId = active.organizationId
    session.organizationSlug = active.organizationSlug
    return `organization=${active.organizationSlug}`
  })

  await check("SMS diagnostics expose safe provider health", async () => {
    const payload = await requestJson(session, "/api/dashboard/notification-operations/sms-ir/status")
    assertNoSecrets(payload, "SMS status")
    assert(typeof payload.provider === "string", "SMS provider missing")
    assert(typeof payload.dryRun === "boolean", "SMS dryRun missing")
    assert(typeof payload.apiKeyConfigured === "boolean", "SMS apiKeyConfigured missing")
    assert(typeof payload.lineNumberConfigured === "boolean", "SMS lineNumberConfigured missing")
    return `provider=${payload.provider} dryRun=${payload.dryRun} realSend=${payload.realSendEnabled}`
  })

  await check("SMS lines returns safe data or safe unavailable state", async () => {
    const response = await request(session, "/api/dashboard/notification-operations/sms-ir/lines")
    const text = await response.text()
    assert(!text.includes("SMS_IR_API_KEY"), "SMS status leaked API key")
    if (response.ok) {
      const payload = JSON.parse(text)
      assertNoSecrets(payload, "SMS lines")
      return `lines=${Array.isArray(payload) ? payload.length : "unknown"}`
    }
    return `status=${response.status}`
  })

  await check("SMS deliveries returns masked phone numbers", async () => {
    const response = await request(session, "/api/dashboard/notification-operations/sms-ir/deliveries")
    const text = await response.text()
    assert(!text.includes("SMS_IR_API_KEY"), "SMS deliveries leaked API key")
    if (response.ok) {
      const payload = JSON.parse(text)
      assert(Array.isArray(payload.data), "SMS deliveries payload missing data array")
      assertNoSecrets(payload, "SMS deliveries")
      return `deliveries=${payload.data.length}`
    }
    return `status=${response.status}`
  })

  await check("SMS live report returns safe data or safe unavailable state", async () => {
    const response = await request(session, "/api/dashboard/notification-operations/sms-ir/reports/live")
    const text = await response.text()
    assert(!text.includes("SMS_IR_API_KEY"), "SMS live report leaked API key")
    if (response.ok) {
      const payload = JSON.parse(text)
      assertNoSecrets(payload, "SMS live report")
      return `reports=${Array.isArray(payload.data) ? payload.data.length : "unknown"}`
    }
    return `status=${response.status}`
  })

  await check("SMS packs report returns safe data or safe unavailable state", async () => {
    const response = await request(session, "/api/dashboard/notification-operations/sms-ir/reports/packs")
    const text = await response.text()
    assert(!text.includes("SMS_IR_API_KEY"), "SMS packs report leaked API key")
    if (response.ok) {
      const payload = JSON.parse(text)
      assertNoSecrets(payload, "SMS packs report")
      return `packs=${Array.isArray(payload.data) ? payload.data.length : "unknown"}`
    }
    return `status=${response.status}`
  })

  await check("SMS archive report returns safe data or safe unavailable state", async () => {
    const response = await request(session, "/api/dashboard/notification-operations/sms-ir/reports/archive")
    const text = await response.text()
    assert(!text.includes("SMS_IR_API_KEY"), "SMS archive report leaked API key")
    if (response.ok) {
      const payload = JSON.parse(text)
      assertNoSecrets(payload, "SMS archive report")
      return `reports=${Array.isArray(payload.data) ? payload.data.length : "unknown"}`
    }
    return `status=${response.status}`
  })

  await check("notification operations config is readable and safe", async () => {
    const payload = await requestJson(session, "/api/dashboard/notification-operations")
    assertNoSecrets(payload.config, "operations config")
    assert(typeof payload.stats?.sms?.SENT === "number", "SMS stats missing")
    return `smsProvider=${payload.config.sms.provider}`
  })

  const evidencePath = writeEvidence()
  const failed = results.filter((result) => !result.ok)
  console.log("")
  console.log(`Evidence: ${evidencePath}`)
  console.log(`Passed ${results.length - failed.length}/${results.length} checks.`)

  if (failed.length > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  results.push({ name: "fatal", ok: false, detail: error instanceof Error ? error.message : String(error) })
  const evidencePath = writeEvidence()
  console.error(`Fatal deployed smoke failure. Evidence: ${evidencePath}`)
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
