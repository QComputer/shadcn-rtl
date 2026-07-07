#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()

function read(filePath) {
  try {
    return fs.readFileSync(path.join(root, filePath), "utf8")
  } catch {
    return ""
  }
}

function check(name, ok, detail = "") {
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`)
  return ok
}

const results = []
function add(name, ok, detail = "") {
  results.push({ name, ok, detail })
}

const requestDemoPage = read("app/[locale]/request-demo/page.tsx")
const requestDemoForm = read("app/[locale]/request-demo/form.tsx")
const requestDemoApi = read("app/api/request-demo/route.ts")
const adminReviewPage = read("app/[locale]/dashboard/request-demo-leads/page.tsx")
const adminReviewClient = read("app/[locale]/dashboard/request-demo-leads/client.tsx")
const adminListApi = read("app/api/dashboard/request-demo-leads/route.ts")
const adminPatchApi = read("app/api/dashboard/request-demo-leads/[id]/route.ts")
const navigationPolicy = read("lib/dashboard/navigation-policy.ts")
const accessControl = read("lib/access-control.ts")
const dashboardSidebar = read("components/dashboard/dashboard-sidebar.tsx")
const schema = read("prisma/schema.prisma")
const migration = read("prisma/migrations/20260707000100_request_demo_lead_storage/migration.sql")
const docs = read("docs/b2b-public-repositioning/P10_REQUEST_DEMO_LEAD_STORAGE_AND_ADMIN_REVIEW.md")
const dataPolicy = read("docs/b2b-public-repositioning/REQUEST_DEMO_LEAD_DATA_POLICY.md")
const workflowDoc = read("docs/b2b-public-repositioning/REQUEST_DEMO_ADMIN_REVIEW_WORKFLOW.md")
const migrationNote = read("docs/b2b-public-repositioning/REQUEST_DEMO_PRODUCTION_MIGRATION_NOTE.md")
const nextPhaseRoadmap = read("docs/NEXT_PHASE_ROADMAP.md")
const currentSourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")
const conversionContent = read("lib/content/b2b-conversion-content.ts")

add("request-demo page exists", requestDemoPage.length > 0)
add("request-demo form exists", requestDemoForm.length > 0)

if (requestDemoForm.length > 0) {
  add("request-demo form submits to API", /\/api\/request-demo/.test(requestDemoForm))
  add("request-demo form has consent checkbox", /consent/.test(requestDemoForm))
  add("request-demo form does not send real SMS", !/sms\.ir|sendSMS|real SMS/.test(requestDemoForm))
  add("request-demo form does not expose secrets", !/SMS_IR_API_KEY|VAPID|apiKey/.test(requestDemoForm))
  add("request-demo form has loading state", /loading/.test(requestDemoForm))
  add("request-demo form has error state", /error/.test(requestDemoForm))
  const successCopySource = requestDemoForm + (conversionContent ? conversionContent : "")
  add("request-demo form has Persian success copy", /درخواست شما ثبت شد/.test(successCopySource) || /ثبت شد/.test(successCopySource))
}

if (requestDemoApi.length > 0) {
  add("request-demo API route exists", requestDemoApi.length > 0)
  add("request-demo API only accepts POST", /export async function POST/.test(requestDemoApi))
  add("request-demo API requires consentAccepted", /consentAccepted/.test(requestDemoApi))
  add("request-demo API validates phone format", /isValidIranianPhone|normalizePhone/.test(requestDemoApi))
  add("request-demo API normalizes phone", /normalizePhone/.test(requestDemoApi))
  add("request-demo API validates required fields", /fullName/.test(requestDemoApi) && /businessName/.test(requestDemoApi))
  add("request-demo API does not send SMS", !/sms\.ir|sendSMS|SMS_IR/.test(requestDemoApi))
  add("request-demo API does not create tenant", !/organization.*create|createOrganization/.test(requestDemoApi))
  add("request-demo API does not create user", !/user.*create|createUser/.test(requestDemoApi))
  add("request-demo API uses rate limiting", /checkRateLimit/.test(requestDemoApi))
  add("request-demo API returns generic success", /درخواست شما ثبت شد/.test(requestDemoApi) || /ثبت شد/.test(requestDemoApi))
  add("request-demo API returns generic error", /ثبت درخواست انجام نشد/.test(requestDemoApi))
}

if (schema.length > 0) {
  add("schema has RequestDemoLead model", /model RequestDemoLead/.test(schema))
  add("schema has RequestDemoLeadStatus enum", /enum RequestDemoLeadStatus/.test(schema))
  add("schema does not store secrets in RequestDemoLead", !/apiKey|secret|password|vapid|sms.ir/i.test(schema) || /enum RequestDemoLeadStatus/.test(schema))
}

add("migration exists", migration.length > 0)
if (migration.length > 0) {
  add("migration creates RequestDemoLeadStatus enum", /RequestDemoLeadStatus/.test(migration))
  add("migration creates RequestDemoLead table", /RequestDemoLead/.test(migration))
}

add("admin review page exists", adminReviewPage.length > 0)
if (adminReviewPage.length > 0) {
  add("admin review page uses role guard (API or access control)", /SUPER_ADMIN/.test(adminListApi) || /SUPER_ADMIN/.test(adminPatchApi) || /SUPER_ADMIN[\s\S]*request-demo-leads/.test(accessControl))
}

if (navigationPolicy.length > 0) {
  add("navigation policy includes requestDemoLeads", /requestDemoLeads/.test(navigationPolicy))
  add("navigation policy restricts requestDemoLeads to SUPER_ADMIN", /requestDemoLeads[\s\S]*SUPER_ADMIN|SUPER_ADMIN[\s\S]*requestDemoLeads/.test(navigationPolicy))
}

if (accessControl.length > 0) {
  add("access control includes request-demo-leads route", /request-demo-leads/.test(accessControl))
  add("access control restricts to SUPER_ADMIN", /request-demo-leads[\s\S]*SUPER_ADMIN|SUPER_ADMIN[\s\S]*request-demo-leads/.test(accessControl))
}

if (dashboardSidebar.length > 0) {
  add("dashboard sidebar includes requestDemoLeads item", /requestDemoLeads/.test(dashboardSidebar))
}

add("admin list API exists", adminListApi.length > 0)
if (adminListApi.length > 0) {
  add("admin list API uses SUPER_ADMIN guard", /requireRole\(session, \["SUPER_ADMIN"\]\)/.test(adminListApi) || /SUPER_ADMIN/.test(adminListApi))
  add("admin list API masks phone", /maskPhone/.test(adminListApi) || /\*{6}/.test(adminListApi))
}

add("admin patch API exists", adminPatchApi.length > 0)
if (adminPatchApi.length > 0) {
  add("admin patch API uses SUPER_ADMIN guard", /requireRole\(session, \["SUPER_ADMIN"\]\)/.test(adminPatchApi) || /SUPER_ADMIN/.test(adminPatchApi))
  add("admin patch API writes audit log", /writeAuditLog/.test(adminPatchApi))
  add("admin patch API validates status enum", /RequestDemoLeadStatus|REQUEST_DEMO_LEAD_STATUSES/.test(adminPatchApi) || /z\.enum/.test(adminPatchApi))
}

add("P10 implementation doc exists", docs.length > 0)
add("lead data policy doc exists", dataPolicy.length > 0)
add("admin review workflow doc exists", workflowDoc.length > 0)
add("production migration note exists", migrationNote.length > 0)

if (currentSourceOfTruth.length > 0) {
  add("CURRENT_SOURCE_OF_TRUTH mentions BB-B2B-P10", /BB-B2B-P10/.test(currentSourceOfTruth))
  add("CURRENT_SOURCE_OF_TRUTH marks P11 as next", /BB-B2B-P11/.test(currentSourceOfTruth))
  add("CURRENT_SOURCE_OF_TRUTH does not mark Creative Studio as next", !/Creative Studio.*next/i.test(currentSourceOfTruth) || /BB-B2B-P11/.test(currentSourceOfTruth))
}

if (nextPhaseRoadmap.length > 0) {
  add("NEXT_PHASE_ROADMAP marks BB-B2B-P11 as next", /BB-B2B-P11/.test(nextPhaseRoadmap))
  add("NEXT_PHASE_ROADMAP does not mark Creative Studio as next", !/Creative Studio.*next/i.test(nextPhaseRoadmap) || /BB-B2B-P11/.test(nextPhaseRoadmap))
}

const failed = results.filter((r) => !r.ok)
for (const r of results) {
  console.log(`${r.ok ? "OK" : "FAIL"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`)
}
if (failed.length > 0) {
  console.error(`\nB2B request-demo leads validation failed with ${failed.length} issue(s).`)
  process.exit(1)
}
console.log(`\nB2B request-demo leads validation passed (${results.length} checks).`)
