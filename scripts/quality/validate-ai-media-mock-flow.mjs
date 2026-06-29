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

const editPage = read("app/[locale]/dashboard/products/[id]/page.tsx")
const newPage = read("app/[locale]/dashboard/products/new/page.tsx")
const createRoute = read("app/api/dashboard/products/[productId]/ai-image-suggestions/route.ts")
const pollRoute = read("app/api/dashboard/ai-image-suggestions/[jobId]/route.ts")
const selectRoute = read("app/api/dashboard/products/[productId]/ai-image-suggestions/select/route.ts")
const service = read("lib/services/ai-media.service.ts")
const validators = read("lib/validators/index.ts")
const deployedSmoke = read("scripts/e2e/deployed-ai-media-smoke.mjs")
const packageJson = read("package.json")
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md")

add("edit product AI status fetch waits for dashboard access", /if \(!hasAccess \|\| accessLoading\) return/.test(editPage) && /setAiFeatureEnabled\(Boolean\(data\.enabled\)\)/.test(editPage))
add("new product AI disabled hint waits for dashboard access", /if \(!hasAccess \|\| accessLoading\) return/.test(newPage) && /setAiFeatureEnabled\(Boolean\(data\.enabled\)\)/.test(newPage))
add("edit product AI job creation is feature-gated", /if \(!aiFeatureEnabled\)/.test(editPage) && /پیشنهاد تصویر AI در حال حاضر فعال نیست/.test(editPage))
add("edit product AI polling accepts outputs and output_images", /Array\.isArray\(data\.job\?\.outputs\)/.test(editPage) && /Array\.isArray\(data\.job\?\.output_images\)/.test(editPage))
add("edit product AI polling reports empty completed output", /تصویر پیشنهادی برای این درخواست برنگشت/.test(editPage))
add("edit product AI selection requires a job id", /if \(!aiJobId\)/.test(editPage) && /شناسه درخواست تصویر پیدا نشد/.test(editPage))
add("edit product AI selection applies API-returned image URL", /const selectedImageUrl = data\.imageUrl \|\| imageUrl/.test(editPage) && /setProduct\(\(current\) => current \? \{ \.\.\.current, image: selectedImageUrl \}/.test(editPage))
add("edit product AI retry remains visible for non-terminal errors", /aiError && aiJobStatus !== "FAILED"/.test(editPage) && /تلاش مجدد/.test(editPage))
add("create AI route remains authenticated and product scoped", /requireAuthSession/.test(createRoute) && /requireProductAccess/.test(createRoute))
add("poll AI route remains authenticated and organization scoped", /localJob\.organizationId/.test(pollRoute) && /session\.user\.organizationId/.test(pollRoute))
add("select AI route remains authenticated and product scoped", /requireProductAccess/.test(selectRoute) && /selectAiMediaImageSchema/.test(selectRoute))
add("service sends MOCK defaults for product suggestions", /count: options\.count \?\? 3/.test(service) && /style_preset: options\.style_preset \?\? "LIGHT_MENU_PHOTO"/.test(service))
add("service validates selected image against completed owned job", /status !== "COMPLETED"/.test(service) && /Selected image must match/.test(service))
add("schemas keep MOCK flow bounded", /\.min\(1\)\.max\(6\)/.test(validators) && /seller_prompt: z\.string\(\)\.max\(1000\)/.test(validators))
add("deployed smoke blocks unauthenticated dashboard status", /Unauthenticated AI media status is blocked/.test(deployedSmoke) && /\/api\/dashboard\/ai-media\/status/.test(deployedSmoke))
add("deployed smoke can complete direct MOCK job when key exists", /Render AI media service can complete a MOCK job when key is provided/.test(deployedSmoke) && /expected MOCK \/local-output\/ URLs/.test(deployedSmoke))
add("package exposes P85 MOCK flow validator", /"quality:ai-media-mock-flow":\s*"node scripts\/quality\/validate-ai-media-mock-flow\.mjs"/.test(packageJson))
add("source of truth names P85 MOCK flow", /P85/.test(sourceOfTruth) && /MOCK[- ]flow/.test(sourceOfTruth))
add("roadmap advances next phase to P86", /P86 - Durable selected image storage acceptance\/hardening/.test(roadmap) || /P86 \| Durable selected image storage acceptance\/hardening/.test(roadmap))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`AI media MOCK flow validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("AI media MOCK flow validation passed.")
