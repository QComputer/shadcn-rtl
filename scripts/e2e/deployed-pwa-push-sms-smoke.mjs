#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const configuredBaseUrl = (process.env.DEPLOYED_URL || process.env.PWA_PUSH_SMS_DEPLOYED_URL || "https://www.bazar-baz.ir").replace(/\/$/, "")
const username = process.env.DEPLOYED_USERNAME || process.env.DEPLOYED_USER || "Amir"
const password = process.env.DEPLOYED_PASSWORD || "123456"
const locale = process.env.DEPLOYED_LOCALE || "fa"
const requireDryRun = process.env.DEPLOYED_PWA_PUSH_SMS_REQUIRE_DRY_RUN !== "0"
const enableDryRunSend = process.env.DEPLOYED_PWA_PUSH_SMS_ENABLE_DRY_RUN_SEND === "1"
const evidenceDir = process.env.DEPLOYED_PWA_PUSH_SMS_EVIDENCE_DIR || "test-results/deployed-pwa-push-sms"

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
        requireDryRun,
        enableDryRunSend,
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
  if (!headers.has("User-Agent")) headers.set("User-Agent", "bazar-pwa-push-sms-smoke/1.0")

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
    headers: { "User-Agent": "bazar-pwa-push-sms-smoke/1.0" },
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
  const secretKeyPattern = /(apiKey|privateKey|vapidPrivate|token|secret|password)/i
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

function assertDeliveryConfigSafe(config) {
  assertNoSecrets(config, "notification config")
  assert(config?.webPush && config?.sms, "operations config missing webPush or sms")
  assert(typeof config.webPush.provider === "string", "webPush provider missing")
  assert(typeof config.sms.provider === "string", "sms provider missing")

  if (requireDryRun) {
    assert(config.webPush.realSendEnabled === false, "webPush real sends are enabled during deployed smoke")
    assert(config.sms.realSendEnabled === false, "SMS real sends are enabled during deployed smoke")
  }
}

async function main() {
  console.log("Deployed PWA, Push, and SMS smoke")
  console.log(`Configured URL: ${configuredBaseUrl}`)
  console.log(`User: ${username}`)
  console.log("")

  await check("canonical deployment URL resolves", resolveCanonicalBaseUrl)

  await check("first visit redirects to Persian locale", async () => {
    const response = await fetch(absoluteUrl("/"), {
      redirect: "manual",
      headers: {
        "User-Agent": "bazar-pwa-push-sms-smoke/1.0",
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

  await check("manifest is installable and Persian-first", async () => {
    const manifest = await requestJson(null, "/manifest.webmanifest")
    assert(manifest.start_url === "/fa", `expected start_url /fa, got ${manifest.start_url}`)
    assert(manifest.display === "standalone", `expected standalone display, got ${manifest.display}`)
    assert(manifest.dir === "rtl" && manifest.lang === "fa", "manifest should be RTL Persian")
    assert(Array.isArray(manifest.icons) && manifest.icons.some((icon) => icon.purpose === "maskable"), "manifest missing maskable icon")
    return `icons=${manifest.icons.length}`
  })

  await check("service worker keeps offline and push handlers", async () => {
    const { response, text } = await requestText(null, "/web-push-sw.js")
    expectStatus(response.status, [200])
    assert(/addEventListener\("fetch"/.test(text), "service worker missing fetch handler")
    assert(/addEventListener\("push"/.test(text), "service worker missing push handler")
    assert(/notificationclick/.test(text), "service worker missing notification click handler")
    assert(/offline\.html/.test(text), "service worker missing offline shell cache")
    return `bytes=${text.length}`
  })

  await check("offline shell is reachable and Persian", async () => {
    const { response, text } = await requestText(null, "/offline.html")
    expectStatus(response.status, [200])
    assert(/lang="fa"/.test(text) && /dir="rtl"/.test(text), "offline shell should be Persian RTL")
    assert(/&#1575;&#1578;&#1589;&#1575;&#1604;/.test(text), "offline shell Persian text missing")
    return `content-type=${response.headers.get("content-type") || "unknown"}`
  })

  await check("unauthenticated notification operations is blocked", async () => {
    const response = await request(null, "/api/dashboard/notification-operations", { redirect: "manual" })
    expectStatus(response.status, [401, 403, 302, 307])
    return `status=${response.status}`
  })

  await check("unauthenticated push dashboard is blocked", async () => {
    const response = await request(null, "/api/dashboard/customer-club/push", { redirect: "manual" })
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

  await check("notification operations exposes safe provider health", async () => {
    const payload = await requestJson(session, "/api/dashboard/notification-operations")
    assertDeliveryConfigSafe(payload.config)
    assert(typeof payload.stats?.inApp?.total === "number", "in-app total missing")
    assert(typeof payload.stats?.webPush?.SENT === "number", "webPush status counts missing")
    assert(typeof payload.stats?.sms?.SENT === "number", "sms status counts missing")
    assert(Array.isArray(payload.recent?.webPush), "recent webPush list missing")
    assert(Array.isArray(payload.recent?.sms), "recent sms list missing")
    return `webPush=${payload.config.webPush.provider} sms=${payload.config.sms.provider}`
  })

  await check("dashboard push health is readable", async () => {
    const payload = await requestJson(session, `/api/dashboard/customer-club/push?organizationId=${encodeURIComponent(session.organizationId)}`)
    assert(payload.config, "push dashboard config missing")
    assertNoSecrets(payload.config, "push dashboard config")
    assert(typeof payload.activeCount === "number", "activeCount missing")
    assert(Array.isArray(payload.recentDeliveries), "recentDeliveries missing")
    if (requireDryRun) assert(payload.config.realSendEnabled === false, "dashboard push real sends are enabled during deployed smoke")
    return `active=${payload.activeCount} deliveries=${payload.recentDeliveries.length}`
  })

  await check("customer push status is readable", async () => {
    const payload = await requestJson(session, `/api/customer/push-subscriptions?organizationSlug=${encodeURIComponent(session.organizationSlug)}`)
    assert(payload.config, "customer push config missing")
    assertNoSecrets(payload.config, "customer push config")
    assert(typeof payload.activeSubscriptionCount === "number", "activeSubscriptionCount missing")
    assert(Array.isArray(payload.subscriptions), "subscriptions missing")
    return `activeSubscriptions=${payload.activeSubscriptionCount}`
  })

  await check("customer notification preferences include push and SMS", async () => {
    const payload = await requestJson(session, `/api/customer/notification-preferences?organizationSlug=${encodeURIComponent(session.organizationSlug)}`)
    const channels = new Set((payload.preferences || []).map((preference) => preference.channel))
    assert(channels.has("IN_APP"), "IN_APP preference missing")
    assert(channels.has("WEB_PUSH"), "WEB_PUSH preference missing")
    assert(channels.has("SMS"), "SMS preference missing")
    return `channels=${Array.from(channels).join(",")}`
  })

  if (enableDryRunSend) {
    await check("optional dashboard Web Push dry-run send works", async () => {
      const payload = await requestJson(session, "/api/dashboard/customer-club/push", {
        method: "POST",
        body: JSON.stringify({
          organizationId: session.organizationId,
          title: "Bazar Baz smoke",
          body: "Dry-run deployed smoke",
          dryRun: true,
        }),
      })
      assert(payload.dryRun === true, "dry-run response should report dryRun true")
      assert(typeof payload.eligibleCustomerCount === "number", "eligible customer count missing")
      return `eligible=${payload.eligibleCustomerCount}`
    })
  } else {
    results.push({
      name: "optional dashboard Web Push dry-run send skipped",
      ok: true,
      detail: "set DEPLOYED_PWA_PUSH_SMS_ENABLE_DRY_RUN_SEND=1 to run the mutating dry-run send probe",
    })
    console.log("ok: optional dashboard Web Push dry-run send skipped")
  }

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
