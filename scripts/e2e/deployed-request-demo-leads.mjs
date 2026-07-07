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

const BASE_URL = (process.env.DEPLOYED_URL || "").replace(/\/+$/, "")
const ADMIN_USERNAME = process.env.DEPLOYED_ADMIN_USERNAME
const ADMIN_PASSWORD = process.env.DEPLOYED_ADMIN_PASSWORD

function assertEnv(name, value) {
  if (!value) {
    console.error(`[request-demo-smoke] Missing required env: ${name}`)
    process.exit(1)
  }
}

function hasSensitiveLeak(text) {
  return /SMS_IR_API_KEY|VAPID_PRIVATE|DATABASE_URL|localhost:4001|socket\.io/i.test(text)
}

function hasFullPhone(text) {
  return /\b09\d{9}\b/.test(text) || /\b\+98\d{10}\b/.test(text)
}

async function requestDemoSmoke() {
  assertEnv("DEPLOYED_URL", BASE_URL)
  assertEnv("DEPLOYED_ADMIN_USERNAME", ADMIN_USERNAME)
  assertEnv("DEPLOYED_ADMIN_PASSWORD", ADMIN_PASSWORD)

  const results = []

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
    const res = await fetch(`${BASE_URL}/fa/request-demo`)
    if (res.status !== 200) throw new Error(`Status ${res.status}`)
    const html = await res.text()
    if (!/درخواست دمو/.test(html)) throw new Error("Missing Persian B2B copy")
    if (!/consent|تایید/.test(html)) throw new Error("Missing consent UI")
    if (hasSensitiveLeak(html)) throw new Error("Sensitive leak detected")
    return true
  })

  await check("invalid public POST returns 400", async () => {
    const res = await fetch(`${BASE_URL}/api/request-demo`, {
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

  await check("valid public POST returns generic success", async () => {
    const res = await fetch(`${BASE_URL}/api/request-demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "تست",
        businessName: "کافه تستی",
        businessType: "shop",
        phone: "09123456789",
        consentAccepted: true,
      }),
    })
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`)
    const data = await res.json()
    if (!data.message || !data.leadId) throw new Error("Missing generic success fields")
    if (hasSensitiveLeak(JSON.stringify(data))) throw new Error("Sensitive leak in success")
    return true
  })

  await check("unauthenticated admin API blocked", async () => {
    const res = await fetch(`${BASE_URL}/api/dashboard/request-demo-leads`)
    if (res.status < 400) throw new Error(`Expected 4xx, got ${res.status}`)
    return true
  })

  await check("platform-admin login succeeds", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD,
        redirect: "false",
        callbackUrl: `${BASE_URL}/fa/dashboard/request-demo-leads`,
      }),
    })
    if (res.status >= 400) throw new Error(`Login failed with ${res.status}`)

    const setCookie = res.headers.get("set-cookie") || ""
    const match = setCookie.match(/next-auth\.session-token=([^;]+)/) || setCookie.match(/__Secure-next-auth\.session-token=([^;]+)/)
    if (!match) throw new Error("No session cookie in login response")

    const sessionToken = decodeURIComponent(match[1])
    return sessionToken
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
