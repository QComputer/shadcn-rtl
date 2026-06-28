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

const adapter = exists("lib/import-hub/snappmarket-adapter.ts")
  ? read("lib/import-hub/snappmarket-adapter.ts")
  : ""
const service = read("lib/services/import-hub.service.ts")
const detection = read("lib/import-hub/source-detection.ts")
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")

add("Snappmarket adapter exists", exists("lib/import-hub/snappmarket-adapter.ts"))
add("adapter validates Snappmarket URLs", /isSnappmarketUrl/.test(adapter) && /snappmarket/.test(adapter))
add("adapter creates fallback draft rows", /parseSnappmarketUrlFixture/.test(adapter) && /SNAPPMARKET_URL_FALLBACK/.test(adapter))
add("public fetch is disabled", /snappmarketPublicFetchEnabled/.test(adapter) && /return false/.test(adapter))
add("adapter avoids network calls", !/\bfetch\s*\(/.test(adapter))

add("source detection recognizes Snappmarket", detection.includes("snappmarket\\.ir") && /SNAP_MARKET/.test(detection))
add("Snappmarket is a consent-gated third-party URL source", /SNAP_MARKET/.test(detection) && /isThirdPartyUrlSource/.test(detection))

add("service imports Snappmarket adapter", /parseSnappmarketUrlFixture/.test(service) && /snappmarketPublicFetchEnabled/.test(service))
add("service requires Snappmarket URL", /Snappmarket import requires a seller-provided source URL/.test(service))
add("service rejects non-Snappmarket URL", /valid snapp\.market or snappmarket\.ir URL/.test(service))
add("service stores P74 metadata", /P74_SNAPPMARKET_URL_IMPORT/.test(service) && /snappmarketFallback/.test(service))
add("service keeps Snappmarket rows draft-only", /status:\s*"DRAFT"/.test(service))
add("service does not create live products", !/prisma\.product\.create/.test(service))

add("package script exposes P74 validator", /"quality:snappmarket-url-import":\s*"node scripts\/quality\/validate-snappmarket-url-import\.mjs"/.test(packageJson))
add("project validator references P74 validator", /validate-snappmarket-url-import\.mjs/.test(validateProject))
add("P74 phase doc exists", exists("docs/PHASE_74_SNAPPMARKET_URL_IMPORT.md"))
add("README references P74", /P74/.test(read("README.md")) && /Snappmarket URL Import MVP/.test(read("README.md")))
add("current source of truth references P74", /P74/.test(read("docs/CURRENT_SOURCE_OF_TRUTH.md")))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`Snappmarket URL import validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("Snappmarket URL import validation passed.")
