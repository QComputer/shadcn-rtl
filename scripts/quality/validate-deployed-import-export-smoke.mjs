#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const results = []

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8")
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel))
}

function add(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail })
}

const smoke = exists("scripts/e2e/deployed-import-export-smoke.mjs")
  ? read("scripts/e2e/deployed-import-export-smoke.mjs")
  : ""
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")
const readme = read("README.md")
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md")

add("deployed import/export smoke exists", exists("scripts/e2e/deployed-import-export-smoke.mjs"))
add("smoke authenticates with credentials session", /api\/auth\/csrf/.test(smoke) && /callback\/credentials/.test(smoke) && /api\/auth\/session/.test(smoke))
add("smoke resolves active organization", /api\/users\/me\/membership/.test(smoke) && /organizationId/.test(smoke))
add("smoke checks unauthenticated guards", /unauthenticated import jobs are blocked/.test(smoke) && /unauthenticated export jobs are blocked/.test(smoke))
add("smoke creates draft-first manual text import", /sourceType:\s*"MANUAL_TEXT"/.test(smoke) && /NEEDS_REVIEW/.test(smoke) && /productDrafts/.test(smoke))
add("smoke rejects drafts instead of publishing", /status:\s*"REJECTED"/.test(smoke) && /instead of published/.test(smoke))
add("smoke creates JSON and CSV export jobs", /format:\s*"JSON"/.test(smoke) && /format:\s*"CSV"/.test(smoke) && /type:\s*"PRODUCTS"/.test(smoke))
add("smoke verifies protected export downloads", /content-disposition/.test(smoke) && /attachment/.test(smoke) && /\/download/.test(smoke))
add("package exposes deployed import/export scripts", /"e2e:deployed:import-export":\s*"node scripts\/e2e\/deployed-import-export-smoke\.mjs"/.test(packageJson) && /"quality:deployed-import-export-smoke":\s*"node scripts\/quality\/validate-deployed-import-export-smoke\.mjs"/.test(packageJson))
add("project validator references P82 validator", /validate-deployed-import-export-smoke\.mjs/.test(validateProject) && /P82 deployed import\/export smoke validator passes/.test(validateProject))
add("P82 phase doc exists", exists("docs/PHASE_82_DEPLOYED_IMPORT_EXPORT_SMOKE.md"))
add("roadmap docs reference P82", /P82/.test(readme) && /P82/.test(sourceOfTruth) && /P82/.test(roadmap))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`Deployed import/export smoke validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("Deployed import/export smoke validation passed.")
