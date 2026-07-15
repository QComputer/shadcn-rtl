#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const results = []

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8")
}

function add(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail })
}

const applicationStorage = read("lib/storage/application-storage.ts")
const service = read("lib/services/ai-media.service.ts")
const selectRoute = read("app/api/dashboard/products/[productId]/ai-image-suggestions/select/route.ts")
const editPage = read("app/[locale]/dashboard/products/[id]/page.tsx")
const packageJson = read("package.json")
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md")

add("application storage normalizes content type", /function normalizeContentType/.test(applicationStorage) && /contentType\.split\(";"/.test(applicationStorage))
add("application storage rejects oversized content-length", /content-length/.test(applicationStorage) && /Provider result image is too large/.test(applicationStorage))
add("application storage validates bytes before persistent storage", /validateApplicationImageBuffer/.test(applicationStorage) && /storeCreativeStudioAsset/.test(applicationStorage))
add("application storage rejects remote URL as permanent asset", /sourceUrlPermanent: false/.test(read("lib/services/creative-studio.service.ts")) || /sourceUrlPermanent/.test(read("lib/services/creative-studio.service.ts")))
add("selected AI image storage status type exists", /type AiSelectedImageStorageStatus = "application-storage"/.test(service))
add("selected AI image reports application storage success", /"application-storage"/.test(service) && /storedDurably: true/.test(service))
add("selected AI image compensates storage if database update fails", /compensateFailedAssetImport/.test(service))
add("selected AI image no longer falls back to provider URL", !/remote-fallback|remote-unconfigured|falling back to remote URL/.test(service))
add("selected AI image revalidates public pages after URL replacement", /revalidateAiSelectedProductImage/.test(service) && /revalidateTag\("home-page", "max"\)/.test(service))
add("select route returns durable storage metadata", /storedDurably: result\.storedDurably/.test(selectRoute) && /storageStatus: result\.storageStatus/.test(selectRoute))
add("product edit UI applies API-returned durable URL", /const selectedImageUrl = data\.imageUrl \|\| imageUrl/.test(editPage) && /setImagePreview\(selectedImageUrl\)/.test(editPage))
add("package exposes P86 durable storage validator", /"quality:ai-media-durable-storage":\s*"node scripts\/quality\/validate-ai-media-durable-storage\.mjs"/.test(packageJson))
add("source of truth names P86 durable storage", /P86/.test(sourceOfTruth) && /Durable Storage/.test(sourceOfTruth))
add("roadmap includes P87 long-running UX follow-up", /P87 - Long-running\/local-worker-compatible job state UX/.test(roadmap) || /P87 \| Long-running\/local-worker-compatible job state UX/.test(roadmap) || /P87 \| AI media long-running job UX/.test(roadmap))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`AI media durable storage validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("AI media durable storage validation passed.")
