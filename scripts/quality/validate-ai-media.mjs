#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

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

const schema = read("prisma/schema.prisma")
const client = read("lib/services/ai-media-service-client.ts")
const service = read("lib/services/ai-media.service.ts")
const validators = read("lib/validators/index.ts")
const productPage = read("app/[locale]/dashboard/products/[id]/page.tsx")
const newProductPage = read("app/[locale]/dashboard/products/new/page.tsx")
const createRoute = read("app/api/dashboard/products/[productId]/ai-image-suggestions/route.ts")
const selectRoute = read("app/api/dashboard/products/[productId]/ai-image-suggestions/select/route.ts")
const pollRoute = read("app/api/dashboard/ai-image-suggestions/[jobId]/route.ts")
const statusRoute = read("app/api/dashboard/ai-media/status/route.ts")
const runtimeEnv = read("lib/runtime-env.ts")
const packageJson = read("package.json")
const deployedSmoke = read("scripts/e2e/deployed-ai-media-smoke.mjs")

add("AiMediaJob model exists", /model\s+AiMediaJob\s*{/.test(schema))
add("AiMediaJob migration exists", exists("prisma/migrations/20260628000400_add_ai_media_job/migration.sql"))
add("AI media client is server-only", /import "server-only"/.test(client))
add("AI media client reads env lazily", /function getAiMediaConfig/.test(client) && !/const AI_MEDIA_SERVICE_URL\s*=/.test(client))
add("AI media client sends internal key server-side", /X-BazarBaz-AI-Key/.test(client) && !/NEXT_PUBLIC_AI_MEDIA/.test(client))
add("runtime env validates AI media config", /aiMediaServiceEnabled/.test(runtimeEnv) && /AI_MEDIA_SERVICE_INTERNAL_KEY/.test(runtimeEnv))
add("create schema bounds count and prompt", /createAiMediaJobSchema/.test(validators) && /\.min\(1\)\.max\(6\)/.test(validators) && /max\(1000\)/.test(validators))
add("select schema requires job ID and generated image URL", /selectAiMediaImageSchema/.test(validators) && /job_id/.test(validators) && /image_url:\s*z\.string\(\)\.url/.test(validators))
add("create route is authenticated and product-scoped", /requireAuthSession/.test(createRoute) && /requireProductAccess/.test(createRoute))
add("poll route is authenticated and organization-scoped", /requireAuthSession/.test(pollRoute) && /localJob\.organizationId/.test(pollRoute))
add("select route is authenticated and product-scoped", /requireAuthSession/.test(selectRoute) && /requireProductAccess/.test(selectRoute))
add("service enforces product update permission", /hasPermission\(userRole, "product:update"\)/.test(service))
add("service persists local jobs", /prisma\.aiMediaJob\.create/.test(service))
add("service syncs remote job status and outputs", /prisma\.aiMediaJob\.update/.test(service) && /outputs:\s*normalizeOutputs/.test(service))
add("service selects only completed owned outputs", /status !== "COMPLETED"/.test(service) && /Selected image must match/.test(service))
add("service revalidates public image pages", /revalidateAiSelectedProductImage/.test(service) && /revalidateTag\("home-page", "max"\)/.test(service))
add("status route exposes secret-safe readiness", /enabled:\s*status\.ready/.test(statusRoute) && /internalKeyConfigured/.test(statusRoute) && !/process\.env\.AI_MEDIA_SERVICE_INTERNAL_KEY/.test(statusRoute))
add("dashboard UI gates AI button by status endpoint", /aiFeatureEnabled/.test(productPage) && /\/api\/dashboard\/ai-media\/status/.test(productPage))
add("dashboard UI sends job ID when selecting image", /job_id:\s*aiJobId/.test(productPage) && /aiSelectedIndex/.test(productPage))
add("deployed smoke blocks unauthenticated protected routes", /Unauthenticated AI job creation is blocked/.test(deployedSmoke) && /Unauthenticated AI image select is blocked/.test(deployedSmoke))
add("new product UI safely acknowledges AI media after save", /aiFeatureEnabled/.test(newProductPage) && /پس از ذخیره محصول/.test(newProductPage) && /پیشنهاد تصویر حرفه‌ای با AI/.test(newProductPage))
add("package exposes AI media validators", /"quality:ai-media":\s*"node scripts\/quality\/validate-ai-media\.mjs"/.test(packageJson) && /"quality:ai-media-health-gate"/.test(packageJson) && /"quality:ai-media-client"/.test(packageJson) && /"quality:ai-media-mock"/.test(packageJson) && /"quality:ai-media-deployed-smoke"/.test(packageJson) && /"smoke:deployed:ai-media"/.test(packageJson))
add("AI media docs exist", exists("docs/AI_MEDIA_SERVICE.md"))

const pnpmEntrypoint = process.env.npm_execpath
const typecheck = pnpmEntrypoint
  ? spawnSync(process.execPath, [pnpmEntrypoint, "run", "typecheck"], {
      cwd: root,
      encoding: "utf8",
    })
  : spawnSync("pnpm", ["run", "typecheck"], {
  cwd: root,
  encoding: "utf8",
    })
add("typecheck passes", typecheck.status === 0, typecheck.error?.message || typecheck.stderr || typecheck.stdout)

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`AI media validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("AI media validation passed.")
