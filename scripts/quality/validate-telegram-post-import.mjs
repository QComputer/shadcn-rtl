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

const parser = exists("lib/import-hub/telegram-manual-parser.ts")
  ? read("lib/import-hub/telegram-manual-parser.ts")
  : ""
const service = read("lib/services/import-hub.service.ts")
const detection = read("lib/import-hub/source-detection.ts")
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")

add("Telegram parser exists", exists("lib/import-hub/telegram-manual-parser.ts"))
add("parser validates public Telegram post URLs", /isTelegramPublicPostUrl/.test(parser) && /t\\.me/.test(parser))
add("parser extracts source evidence", /channel/.test(parser) && /postId/.test(parser))
add("parser extracts hashtags and product hints", /extractHashtags/.test(parser) && /likelyProductMentions/.test(parser))
add("Telegram fetching is disabled", /telegramFetchEnabled/.test(parser) && /return false/.test(parser))
add("parser avoids network calls", !/\bfetch\s*\(/.test(parser))

add("source detection recognizes Telegram", /TELEGRAM/.test(detection) && /telegram/.test(detection))
add("Telegram is a consent-gated third-party URL source", /TELEGRAM/.test(detection) && /isThirdPartyUrlSource/.test(detection))

add("service imports Telegram parser", /parseManualTelegramContent/.test(service) && /telegramFetchEnabled/.test(service))
add("service requires Telegram public post URL", /Telegram import requires a seller-provided public post URL/.test(service))
add("service rejects non-public Telegram URL", /valid public Telegram post URL/.test(service))
add("service stores P75 metadata", /P75_TELEGRAM_POST_IMPORT/.test(service) && /telegramFetchEnabled/.test(service))
add("service keeps Telegram rows content-draft-only", /importedContentDraft\.createMany/.test(service) && /status:\s*"DRAFT"/.test(service))
add("service does not publish fanpage posts", !/fanpagePost\.create/.test(service))

add("package script exposes P75 validator", /"quality:telegram-post-import":\s*"node scripts\/quality\/validate-telegram-post-import\.mjs"/.test(packageJson))
add("project validator references P75 validator", /validate-telegram-post-import\.mjs/.test(validateProject))
add("P75 phase doc exists", exists("docs/PHASE_75_TELEGRAM_POST_IMPORT.md"))
add("README references P75", /P75/.test(read("README.md")) && /Telegram Post Import/.test(read("README.md")))
add("current source of truth references P75", /P75/.test(read("docs/CURRENT_SOURCE_OF_TRUTH.md")))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`Telegram post import validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("Telegram post import validation passed.")
