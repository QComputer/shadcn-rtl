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

const adapter = exists("lib/import-hub/snappfood-adapter.ts")
  ? read("lib/import-hub/snappfood-adapter.ts")
  : ""
const service = read("lib/services/import-hub.service.ts")
const detection = read("lib/import-hub/source-detection.ts")
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")

add("Snappfood adapter exists", exists("lib/import-hub/snappfood-adapter.ts"))
add("adapter validates snappfood.ir URLs", /isSnappfoodUrl/.test(adapter) && /snappfood\\.ir/.test(adapter))
add("adapter creates fallback draft rows", /parseSnappfoodUrlFixture/.test(adapter) && /SNAPPFOOD_URL_FALLBACK/.test(adapter))
add("public fetch is disabled", /snappfoodPublicFetchEnabled/.test(adapter) && /return false/.test(adapter))
add("adapter avoids network calls", !/\bfetch\s*\(/.test(adapter))

add("source detection recognizes Snappfood", detection.includes("snappfood\\.ir") && /SNAP_FOOD/.test(detection))
add("Snappfood is a consent-gated third-party URL source", /SNAP_FOOD/.test(detection) && /isThirdPartyUrlSource/.test(detection))

add("service imports Snappfood adapter", /parseSnappfoodUrlFixture/.test(service) && /snappfoodPublicFetchEnabled/.test(service))
add("service requires Snappfood URL", /Snappfood import requires a seller-provided source URL/.test(service))
add("service rejects non-Snappfood URL", /valid snappfood\.ir URL/.test(service))
add("service stores P73 metadata", /P73_SNAPPFOOD_URL_IMPORT/.test(service) && /snappfoodFallback/.test(service))
add("service keeps Snappfood rows draft-only", /status:\s*"DRAFT"/.test(service))
add("service does not create live products", !/prisma\.product\.create/.test(service))

add("package script exposes P73 validator", /"quality:snappfood-url-import":\s*"node scripts\/quality\/validate-snappfood-url-import\.mjs"/.test(packageJson))
add("project validator references P73 validator", /validate-snappfood-url-import\.mjs/.test(validateProject))
add("P73 phase doc exists", exists("docs/PHASE_73_SNAPPFOOD_URL_IMPORT.md"))
add("README references P73", /P73/.test(read("README.md")) && /Snappfood URL Import MVP/.test(read("README.md")))
add("current source of truth references P73", /P73/.test(read("docs/CURRENT_SOURCE_OF_TRUTH.md")))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`Snappfood URL import validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("Snappfood URL import validation passed.")
