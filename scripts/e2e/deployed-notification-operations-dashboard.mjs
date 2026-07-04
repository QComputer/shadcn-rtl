#!/usr/bin/env node
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const configuredBaseUrl = (process.env.DEPLOYED_URL || "https://www.bazar-baz.ir").replace(/\/$/, "")
const username = process.env.DEPLOYED_USERNAME || process.env.DEPLOYED_USER || "Amir"
const password = process.env.DEPLOYED_PASSWORD || "123456"
const locale = process.env.DEPLOYED_LOCALE || "fa"
const evidenceDir = process.env.DEPLOYED_NOTIF_OPS_EVIDENCE_DIR || "test-results/deployed-notification-operations"

const FORBIDDEN_CONSOLE_PATTERNS = [
  /localhost:4001/i,
  /127\.0\.0\.1:4001/i,
  /\/socket\.io\/\?EIO=/i,
  /ERR_CONNECTION_REFUSED/i,
  /Socket connection error/i,
  /SMS_IR_API_KEY/i,
  /VAPID_PRIVATE_KEY/i,
  /api\.sms\.ir/i,
  /applicationServerKey is not valid/i,
]

const FORBIDDEN_RESPONSE_PATTERNS = [
  /SMS_IR_API_KEY/i,
  /X-API-KEY/i,
  /bYhHp0axucDvIaskZZWHiR1ziWnaMIYt9ysiNcJCxDORGHcj/i,
]

const FORBIDDEN_HTML_PATTERNS = [
  /SMS_IR_API_KEY/i,
  /VAPID_PRIVATE_KEY/i,
  /bYhHp0axucDvIaskZZWHiR1ziWnaMIYt9ysiNcJCxDORGHcj/i,
  /localhost:4001/i,
  /127\.0\.0\.1:4001/i,
  /\/socket\.io\//i,
]

let baseUrl = configuredBaseUrl
const results = []
let consoleErrors = []
let networkRequests = []

function currentGitCommit() {
  const result = require("child_process").spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" })
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
        consoleErrors: consoleErrors.slice(0, 50),
        networkRequests: networkRequests.slice(0, 50),
      },
      null,
      2,
    )}\n`,
  )
  return evidencePath
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

function containsForbidden(text, patterns) {
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      return pattern.source || pattern.toString()
    }
  }
  return null
}

async function resolveCanonicalBaseUrl(page) {
  const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded" })
  const location = response.headers()["location"]
  if (location) {
    baseUrl = new URL(location, baseUrl).origin
    return `base=${baseUrl} redirect=${response.status()}`
  }
  return `base=${baseUrl} status=${response.status()}`
}

async function login(page) {
  await page.goto(`${baseUrl}/${locale}/login`, { waitUntil: "domcontentloaded" })
  await page.fill('input[name="username"]', username)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(`**/${locale}/dashboard`, { timeout: 15000 })
}

async function main() {
  console.log("Deployed Notification Operations Dashboard smoke")
  console.log(`Configured URL: ${configuredBaseUrl}`)
  console.log(`User: ${username}`)
  console.log("")

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  page.on("console", (msg) => {
    const text = msg.text()
    if (msg.type() === "error") {
      consoleErrors.push(text)
    }
  })

  page.on("response", async (response) => {
    const url = response.url()
    networkRequests.push(url)
    try {
      const text = await response.text()
      if (containsForbidden(text, FORBIDDEN_RESPONSE_PATTERNS)) {
        results.push({
          name: `response forbidden pattern: ${new URL(url).pathname}`,
          ok: false,
          detail: `response contained forbidden pattern`,
        })
      }
    } catch {
      // ignore binary/streaming responses
    }
  })

  page.on("request", (request) => {
    const url = request.url()
    if (containsForbidden(url, [/localhost:4001/i, /127\.0\.0\.1:4001/i, /\/socket\.io\//i])) {
      results.push({
        name: "forbidden network request",
        ok: false,
        detail: url,
      })
    }
  })

  await check("canonical deployment URL resolves", async () => {
    const result = await resolveCanonicalBaseUrl(page)
    return result
  })

  await check("first visit redirects to Persian locale", async () => {
    const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded" })
    const location = response.headers()["location"] || ""
    const nextUrl = new URL(location, baseUrl)
    assert(nextUrl.pathname === "/fa" || nextUrl.pathname.startsWith("/fa/"), `expected /fa redirect, got ${location}`)
    return `location=${location}`
  })

  await check("login succeeds", async () => {
    await login(page)
    return `url=${page.url()}`
  })

  await check("no forbidden console errors after navigation", async () => {
    const forbidden = consoleErrors.filter((text) => containsForbidden(text, FORBIDDEN_CONSOLE_PATTERNS))
    if (forbidden.length > 0) {
      throw new Error(`forbidden console errors: ${forbidden.slice(0, 5).join("; ")}`)
    }
    return `consoleErrors=${consoleErrors.length}`
  })

  await check("notification-operations loads without fatal error", async () => {
    const response = await page.goto(`${baseUrl}/${locale}/dashboard/notification-operations`, { waitUntil: "networkidle" })
    expectStatus(response.status(), [200])
    const html = await page.content()
    const htmlForbidden = containsForbidden(html, FORBIDDEN_HTML_PATTERNS)
    if (htmlForbidden) {
      throw new Error(`HTML contained forbidden pattern: ${htmlForbidden}`)
    }
    return `status=${response.status()}`
  })

  await check("SMS diagnostics section is visible", async () => {
    const visible = await page.locator("text=وضعیت سرویس پیامک").first().isVisible().catch(() => false)
    assert(visible, "SMS diagnostics section not visible")
    return "visible"
  })

  await check("delivery reports section is visible", async () => {
    const visible = await page.locator("text=گزارش تحویل پیامک").first().isVisible().catch(() => false)
    assert(visible, "delivery reports section not visible")
    return "visible"
  })

  await check("web push status section is visible or safe unavailable state shown", async () => {
    const pushVisible = await page.locator("text=اعلان مرورگر").first().isVisible().catch(() => false)
    const unsupportedVisible = await page.locator("text=اعلان مرورگر در این مرورگر پشتیبانی نمی‌شود").first().isVisible().catch(() => false)
    assert(pushVisible || unsupportedVisible, "neither web push nor unsupported message visible")
    return `pushVisible=${pushVisible} unsupportedVisible=${unsupportedVisible}`
  })

  await check("no localhost/private network requests during page load", async () => {
    const forbidden = networkRequests.filter((url) => /localhost:4001|127\.0\.0\.1:4001|\/socket\.io\//i.test(url))
    if (forbidden.length > 0) {
      throw new Error(`forbidden network requests: ${forbidden.slice(0, 5).join("; ")}`)
    }
    return `requests=${networkRequests.length}`
  })

  await check("no API key or private key in page source", async () => {
    const html = await page.content()
    const forbidden = containsForbidden(html, FORBIDDEN_HTML_PATTERNS)
    if (forbidden) {
      throw new Error(`page source contained forbidden pattern: ${forbidden}`)
    }
    return "clean"
  })

  await browser.close()

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
