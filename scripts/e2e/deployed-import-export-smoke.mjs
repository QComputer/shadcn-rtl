#!/usr/bin/env node

const baseUrl = (process.env.DEPLOYED_URL || process.env.NEXT_PUBLIC_DEPLOYED_APP_URL || "").replace(/\/$/, "")
const username = process.env.DEPLOYED_USERNAME || process.env.DEPLOYED_USER || "Amir"
const password = process.env.DEPLOYED_PASSWORD || "123456"
const locale = process.env.DEPLOYED_LOCALE || "fa"

if (!baseUrl) {
  console.error("DEPLOYED_URL is required, for example: DEPLOYED_URL=https://www.bazar-baz.ir pnpm run e2e:deployed:import-export")
  process.exit(1)
}

const results = []

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
  return header.split(/,(?=\s*[^;,=]+=[^;,]+)/g).map((part) => part.trim()).filter(Boolean)
}

function absoluteUrl(pathOrUrl) {
  return new URL(pathOrUrl, baseUrl).toString()
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

async function request(session, path, init = {}) {
  const headers = new Headers(init.headers || {})
  const cookieHeader = session?.jar?.header()
  if (cookieHeader) headers.set("Cookie", cookieHeader)

  const response = await fetch(absoluteUrl(path), {
    ...init,
    headers,
    redirect: init.redirect || "follow",
  })
  session?.jar?.store(response)
  return response
}

async function requestJson(session, path, init = {}) {
  const response = await request(session, path, {
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
    throw new Error(`${path}: expected JSON, got status=${response.status} body=${text.slice(0, 300)}`)
  }
  if (!response.ok) {
    throw new Error(`${path}: status=${response.status} body=${text.slice(0, 500)}`)
  }
  return json
}

async function expectStatus(name, path, init, allowedStatuses) {
  await check(name, async () => {
    const response = await fetch(absoluteUrl(path), init)
    if (!allowedStatuses.includes(response.status)) {
      const text = await response.text().catch(() => "")
      throw new Error(`expected ${allowedStatuses.join("/")}, got ${response.status}. Body: ${text.slice(0, 300)}`)
    }
    return `status=${response.status}`
  })
}

async function login() {
  const session = { jar: new CookieJar(), username }
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
  const location = response.headers.get("location") || ""
  const loginRedirectSucceeded = [302, 303].includes(response.status) && !/CredentialsSignin|error=/i.test(location)
  const loginJsonSucceeded = response.ok && !/CredentialsSignin|error/i.test(text)

  if (!loginRedirectSucceeded && !loginJsonSucceeded) {
    throw new Error(`login failed for ${username}: status=${response.status} body=${text.slice(0, 300)}`)
  }

  const authSession = await requestJson(session, "/api/auth/session")
  if (!authSession?.user?.id) throw new Error(`login did not establish a session for ${username}`)
  session.user = authSession.user
  return session
}

async function resolveOrganizationId(session) {
  const membershipData = await requestJson(session, "/api/users/me/membership")
  const membership = membershipData.membership || membershipData.memberships?.[0]
  if (membership?.organizationId) return membership.organizationId

  if (session.user?.role !== "SUPER_ADMIN") {
    throw new Error("authenticated user has no active organization membership")
  }

  const organizations = await requestJson(session, "/api/organizations?pageSize=100")
  const organization = (organizations.data || organizations.organizations || []).find((item) => item?.id)
  if (!organization?.id) throw new Error("SUPER_ADMIN has no organization available for deployed smoke")
  return organization.id
}

function smokeImportText() {
  return [
    "P82 smoke product | price: 1000 | stock: 1",
    `توضیح: ردیف تستی P82 که باید فقط به صورت پیش نویس بماند`,
  ].join("\n")
}

function assertAttachment(response, expectedContentType) {
  const disposition = response.headers.get("content-disposition") || ""
  const contentType = response.headers.get("content-type") || ""
  if (!/attachment/i.test(disposition)) throw new Error(`missing attachment disposition: ${disposition}`)
  if (!contentType.toLowerCase().includes(expectedContentType)) {
    throw new Error(`expected content-type containing ${expectedContentType}, got ${contentType}`)
  }
}

let session
let organizationId
let importJob
let jsonExportJob
let csvExportJob

await expectStatus("unauthenticated import jobs are blocked", "/api/dashboard/imports/jobs", {}, [401, 403])
await expectStatus("unauthenticated export jobs are blocked", "/api/dashboard/exports/jobs", {}, [401, 403])

await check("login succeeds", async () => {
  session = await login()
  return `user=${session.user?.role || "unknown"}`
})

await check("organization context resolves", async () => {
  organizationId = await resolveOrganizationId(session)
  return `organizationId=${organizationId}`
})

await check("import dashboard is reachable for authenticated admin", async () => {
  const response = await request(session, `/${locale}/dashboard/imports`, { redirect: "manual" })
  if (![200, 302, 307, 308].includes(response.status)) throw new Error(`status=${response.status}`)
  return `status=${response.status}`
})

await check("manual text import creates review-needed drafts only", async () => {
  const data = await requestJson(session, "/api/dashboard/imports/jobs", {
    method: "POST",
    body: JSON.stringify({
      organizationId,
      sourceType: "MANUAL_TEXT",
      inputText: smokeImportText(),
      consentConfirmed: true,
      consentText: "P82 deployed smoke test: seller-owned manual text.",
    }),
  })
  importJob = data.job
  const draftCount = importJob?._count?.productDrafts ?? importJob?.summary?.productDraftCount ?? 0
  if (!importJob?.id) throw new Error("missing import job id")
  if (importJob.status !== "NEEDS_REVIEW") throw new Error(`expected NEEDS_REVIEW, got ${importJob.status}`)
  if (draftCount < 1) throw new Error(`expected at least one product draft, got ${draftCount}`)
  return `job=${importJob.id} drafts=${draftCount}`
})

await check("import job detail exposes draft ids", async () => {
  const data = await requestJson(session, `/api/dashboard/imports/jobs/${encodeURIComponent(importJob.id)}`)
  importJob = data.job
  const draftIds = (importJob.productDrafts || []).map((draft) => draft.id).filter(Boolean)
  if (draftIds.length < 1) throw new Error("expected product draft ids")
  importJob.productDraftIds = draftIds
  return `draftIds=${draftIds.length}`
})

await check("smoke import drafts are rejected instead of published", async () => {
  const data = await requestJson(session, `/api/dashboard/imports/jobs/${encodeURIComponent(importJob.id)}/review`, {
    method: "POST",
    body: JSON.stringify({
      status: "REJECTED",
      productDraftIds: importJob.productDraftIds,
      contentDraftIds: [],
    }),
  })
  if (!data.job?.id) throw new Error("missing reviewed import job")
  if (data.job.status !== "COMPLETED") throw new Error(`expected COMPLETED after rejection, got ${data.job.status}`)
  return `job=${data.job.id}`
})

await check("export dashboard is reachable for authenticated admin", async () => {
  const response = await request(session, `/${locale}/dashboard/exports`, { redirect: "manual" })
  if (![200, 302, 307, 308].includes(response.status)) throw new Error(`status=${response.status}`)
  return `status=${response.status}`
})

await check("JSON export job completes", async () => {
  const data = await requestJson(session, "/api/dashboard/exports/jobs", {
    method: "POST",
    body: JSON.stringify({ organizationId, type: "PRODUCTS", format: "JSON" }),
  })
  jsonExportJob = data.job
  if (!jsonExportJob?.id) throw new Error("missing JSON export job id")
  if (jsonExportJob.status !== "COMPLETED") throw new Error(`expected COMPLETED, got ${jsonExportJob.status}`)
  return `job=${jsonExportJob.id} rows=${jsonExportJob.rowCount}`
})

await check("CSV export job completes", async () => {
  const data = await requestJson(session, "/api/dashboard/exports/jobs", {
    method: "POST",
    body: JSON.stringify({ organizationId, type: "PRODUCTS", format: "CSV" }),
  })
  csvExportJob = data.job
  if (!csvExportJob?.id) throw new Error("missing CSV export job id")
  if (csvExportJob.status !== "COMPLETED") throw new Error(`expected COMPLETED, got ${csvExportJob.status}`)
  return `job=${csvExportJob.id} rows=${csvExportJob.rowCount}`
})

await check("JSON export download is protected attachment", async () => {
  const response = await request(session, `/api/dashboard/exports/jobs/${encodeURIComponent(jsonExportJob.id)}/download`)
  if (!response.ok) throw new Error(`status=${response.status}`)
  assertAttachment(response, "application/json")
  const json = await response.json()
  if (!Array.isArray(json.rows)) throw new Error("download JSON missing rows array")
  return `rows=${json.rows.length}`
})

await check("CSV export download is protected attachment", async () => {
  const response = await request(session, `/api/dashboard/exports/jobs/${encodeURIComponent(csvExportJob.id)}/download`)
  if (!response.ok) throw new Error(`status=${response.status}`)
  assertAttachment(response, "text/csv")
  const text = await response.text()
  if (!text.includes("id") && !text.includes("name")) throw new Error("download CSV did not include expected header text")
  return `bytes=${text.length}`
})

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) process.exit(1)
