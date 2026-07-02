#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const checks = []

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8")
}

function exists(file) {
  return fs.existsSync(path.join(root, file))
}

function add(name, pass, detail = "") {
  checks.push({ name, pass: Boolean(pass), detail })
}

const validators = read("lib/validators/index.ts")
const bookingRoute = read("app/api/organizations/[id]/booking-settings/route.ts")
const paymentRoute = read("app/api/organizations/[id]/payment/route.ts")
const bookingService = read("lib/services/booking-settings.service.ts")
const settingsPage = read("app/[locale]/dashboard/settings/organization/page.tsx")
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")
const readme = read("README.md")
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md")
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")

add("P96 phase document exists", exists("docs/PHASE_96_OPEN_FIELDS_AUDIT.md"))
add("package exposes P96 validator", /"quality:open-fields-audit":\s*"node scripts\/quality\/validate-open-fields-audit\.mjs"/.test(packageJson))
add("project validator references P96 validator", /validate-open-fields-audit\.mjs/.test(validateProject) && /P96 open fields audit validator passes/.test(validateProject))

add("payment settings schema exists", /export const updatePaymentSettingsSchema = z\.object/.test(validators))
add("payment schema constrains payment method", /paymentMethodInt:\s*z\.coerce\.number\(\)\.int\(\)\.min\(0\)\.max\(2\)/.test(validators))
add("booking settings schema exists", /export const updateBookingSettingsSchema = z\.object/.test(validators))
add("booking schema constrains timing fields", /slotDuration:[\s\S]*\.positive\(\)\.max\(1440\)/.test(validators) && /maxBookingAdvance:[\s\S]*\.positive\(\)\.max\(1051200\)/.test(validators))

add("booking route uses shared auth and manageable org resolver", /requireAuthSession/.test(bookingRoute) && /resolveManageableOrganizationId/.test(bookingRoute))
add("booking route resolves organization slug before service calls", /resolveOrganizationSlug/.test(bookingRoute) && /bookingSettingsService\.getForOrganization\(organizationSlug\)/.test(bookingRoute) && /bookingSettingsService\.update\(organizationSlug,\s*data\)/.test(bookingRoute))
add("booking route validates body with schema", /updateBookingSettingsSchema\.parse\(body\)/.test(bookingRoute))
add("booking route no longer passes route id directly as slug", !/bookingSettingsService\.(?:getForOrganization|update)\(id/.test(bookingRoute))
add("booking service names slug-based helpers clearly", /getForOrganization\(organizationSlug: string\)/.test(bookingService) && /validateBooking\(\s*organizationSlug: string/.test(bookingService))

add("payment route uses shared auth and manageable org resolver", /requireAuthSession/.test(paymentRoute) && /resolveManageableOrganizationId/.test(paymentRoute))
add("payment route validates body with schema", /updatePaymentSettingsSchema\.parse\(await request\.json\(\)\)/.test(paymentRoute))
add("payment route keeps payment management permission", /hasPermission\(session\.user\.role,\s*"payment:manage"\)/.test(paymentRoute))
add("payment route avoids raw request body upsert", !/const data = await request\.json\(\)/.test(paymentRoute))

add("organization settings UI sends paymentCondition", /paymentCondition,\s*\n/.test(settingsPage))
add("organization settings UI exposes paymentCondition switch", /<Switch[\s\S]*checked=\{paymentCondition\}[\s\S]*onCheckedChange=\{setPaymentCondition\}/.test(settingsPage))
add("organization settings UI no longer hard-codes paymentCondition false", !/paymentCondition:\s*false/.test(settingsPage))

for (const locale of ["fa", "en", "ar"]) {
  const dictionary = read(`dictionaries/${locale}.json`)
  add(`${locale} dictionary has payment condition copy`, /"paymentCondition"\s*:/.test(dictionary) && /"paymentConditionDescription"\s*:/.test(dictionary))
}

add("README keeps P96 complete while marking P109 latest", /\| 96 \| Open Fields and Workflow Completion Audit/.test(readme) && /Latest completed implementation phase:\s+\*\*P119 - Creative Studio provider result ingestion and review stabilization\*\*/.test(readme) && /P120 - Creative Studio reviewed asset apply and rollback workflow/.test(readme))
add("roadmap keeps P96 complete while marking P109 baseline", /\| P96 \| Open fields and workflow completion audit\. \|/.test(roadmap) && /Completed through \*\*P120A - Operational order notifications and admin order controls for shop staff\*\*/.test(roadmap))
add("source of truth keeps P96 audit while naming P109 baseline", /Open Fields and Workflow Completion Audit exists/.test(sourceOfTruth) && /after P119 Creative Studio provider result ingestion and review stabilization/.test(sourceOfTruth))

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length > 0) {
  console.error(`\n${failed.length} open-fields audit validation check(s) failed.`)
  process.exit(1)
}
