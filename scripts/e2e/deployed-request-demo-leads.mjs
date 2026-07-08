#!/usr/bin/env node
/**
 * Deployed P10 smoke test for request-demo lead capture.
 *
 * Required env:
 *   DEPLOYED_URL - base URL of the deployed Bazar Baz instance
 *   DEPLOYED_ADMIN_USERNAME - SUPER_ADMIN username
 *   DEPLOYED_ADMIN_PASSWORD - SUPER_ADMIN password
 *
 * Does not create a valid production lead by default.
 * Does not send SMS.
 * Does not print credentials or full phone numbers.
 */

const baseUrl = (process.env.DEPLOYED_URL || "").replace(/\/+$/, "")
const adminUsername = process.env.DEPLOYED_ADMIN_USERNAME
const adminPassword = process.env.DEPLOYED_ADMIN_PASSWORD

function assertEnv(name, value) {
  if (!value) {
    console.error(`[request-demo-smoke] Missing required env: ${name}`)
    process.exit(1)
  }
}

function hasSensitiveLeak(text) {
  return /SMS_IR_API_KEY|VAPID_PRIVATE|DATABASE_URL|AUTH_SECRET|NEXTAUTH_SECRET|localhost:4001|socket\.io/i.test(text)
}

function hasFullPhone(text) {
  return /\b09\d{9}\b/.test(text) || /\b\+98\d{10}\b/.test(text)
}

async function requestDemoSmoke() {
  assertEnv("DEPLOYED_URL", baseUrl)
  assertEnv("DEPLOYED_ADMIN_USERNAME", adminUsername)
  assertEnv("DEPLOYED_ADMIN_PASSWORD", adminPassword)

  const results = []
  const cookieJar = {}

  async function withCookies(url, options = {}) {
    const cookieHeader = Object.entries(cookieJar)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ")

    const res = await fetch(url, {
      ...(options || {}),
      headers: {
        ...(options.headers || {}),
        cookie: cookieHeader,
      },
    })

    const setCookie = res.headers.get("set-cookie")
    if (setCookie) {
      for (const cookie of setCookie.split(",")) {
        const [nameValue] = cookie.split(";")
        const [name, value] = nameValue.trim().split("=")
        if (name && value) {
          cookieJar[name] = value
        }
      }
    }

    return res
  }

  async function check(name, fn) {
    try {
      const ok = await fn()
      results.push({ name, ok })
      console.log(`${ok ? "OK" : "FAIL"} ${name}`)
    } catch (error) {
      results.push({ name, ok: false })
      console.log(`FAIL ${name} — ${error.message}`)
    }
  }

  await check("request-demo page returns 200", async () => {
    const res = await withCookies(`${baseUrl}/fa/request-demo`)
    if (res.status !== 200) throw new Error(`Status ${res.status}`)
    const html = await res.text()
    if (!/درخواست دمو/.test(html)) throw new Error("Missing Persian B2B copy")
    if (!/consent|تایید/.test(html)) throw new Error("Missing consent UI")
    if (hasSensitiveLeak(html)) throw new Error("Sensitive leak detected")
    return true
  })

  await check("invalid public POST returns 4xx", async () => {
    const res = await fetch(`${baseUrl}/api/request-demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "", consentAccepted: false }),
    })
    if (res.status < 400 || res.status >= 500) throw new Error(`Expected 4xx, got ${res.status}`)
    const text = await res.text()
    if (hasSensitiveLeak(text)) throw new Error("Sensitive leak in error")
    const data = JSON.parse(text)
    if (!data.error) throw new Error("Missing generic error")
    return true
  })

  await check("unauthenticated admin API blocked", async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/request-demo-leads`)
    if (res.status < 400) throw new Error(`Expected 4xx, got ${res.status}`)
    return true
  })

  await check("platform-admin login succeeds", async () => {
    const csrfRes = await withCookies(`${baseUrl}/api/auth/csrf`)
    const csrfData = await csrfRes.json()
    const csrfToken = csrfData.csrfToken
    if (!csrfToken) throw new Error("No CSRF token")

    const res = await withCookies(`${baseUrl}/api/auth/callback/credentials?json=true`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        csrfToken,
        username: adminUsername,
        password: adminPassword,
        redirect: "false",
        callbackUrl: `${baseUrl}/fa/dashboard/request-demo-leads`,
      }),
      redirect: "manual",
    })

    const setCookies = res.headers.get("set-cookie") || ""
    const hasSessionCookie = setCookies.split(",").some((cookie) => /authjs\.session-token/.test(cookie))
    if (!hasSessionCookie) {
      const location = res.headers.get("location")
      const text = await res.text()
      throw new Error(`Login did not establish session. Status: ${res.status}. Location: ${location}. Body: ${text.slice(0, 200)}`)
    }

    return true
  })

  await check("authenticated admin lead-list API returns 200", async () => {
    const res = await withCookies(`${baseUrl}/api/dashboard/request-demo-leads`)
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
    const text = await res.text()
    if (hasSensitiveLeak(text)) throw new Error("Sensitive leak in lead list")
    if (hasFullPhone(text)) throw new Error("Full phone number exposed in lead list")
    const data = JSON.parse(text)
    if (!Array.isArray(data.items)) throw new Error("Missing items array in lead list")
    return true
  })

  await check("authenticated admin dashboard page accessible", async () => {
    const res = await withCookies(`${baseUrl}/fa/dashboard/request-demo-leads`)
    if (res.status < 200 || res.status >= 500) throw new Error(`Expected 2xx/3xx, got ${res.status}`)
    const html = await res.text()
    if (hasSensitiveLeak(html)) throw new Error("Sensitive leak in dashboard page")
    return true
  })

  const failed = results.filter((r) => !r.ok)
  for (const r of results) {
    console.log(`${r.ok ? "OK" : "FAIL"} ${r.name}`)
  }
  if (failed.length > 0) {
    console.error(`\nDeployed request-demo smoke failed with ${failed.length} issue(s).`)
    process.exitCode = 1
  } else {
    console.log("\nDeployed request-demo smoke passed.")
  }
}

requestDemoSmoke()
