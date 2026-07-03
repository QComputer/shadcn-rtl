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

function add(name, pass) {
  checks.push({ name, pass: Boolean(pass) })
}

const component = exists("components/dashboard/ai-media-provider-state.tsx")
  ? read("components/dashboard/ai-media-provider-state.tsx")
  : ""
const editPage = read("app/[locale]/dashboard/products/[id]/page.tsx")
const newPage = read("app/[locale]/dashboard/products/new/page.tsx")
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md")

add("seller state component exists", exists("components/dashboard/ai-media-provider-state.tsx"))
add("component derives all required seller-facing states", /disabled/.test(component) && /mock/.test(component) && /approved/.test(component) && /budget-exhausted/.test(component) && /rollback-paused/.test(component))
add("component uses Persian-first seller copy", /پیشنهاد تصویر AI/.test(component) && /تولید تصویر حرفه‌ای فعال است/.test(component) && /موقتاً متوقف شده است/.test(component))
add("component avoids exposing provider policy internals", !/AI_MEDIA_PAID_PROVIDER/.test(component) && !/approvalBy/.test(component) && !/estimatedJobCostCents/.test(component))
add("edit page fetches status and usage", /\/api\/dashboard\/ai-media\/status/.test(editPage) && /\/api\/dashboard\/ai-media\/usage/.test(editPage))
add("edit page renders seller state panel", /AiMediaProviderState/.test(editPage) && /status=\{aiStatus\}/.test(editPage) && /usage=\{aiUsage\}/.test(editPage))
add("edit page disables AI generation for exhausted or paused states", /canCreateAiMediaJob/.test(editPage) && /disabled=\{!aiCanCreate\}/.test(editPage))
add("new product page renders saved-product guidance", /AiMediaProviderState/.test(newPage) && /productSaved=\{false\}/.test(newPage))
add("new product page fetches usage for seller state", /\/api\/dashboard\/ai-media\/usage/.test(newPage))
add("package exposes P94 validator", /"quality:ai-media-seller-state-ux":\s*"node scripts\/quality\/validate-ai-media-seller-state-ux\.mjs"/.test(packageJson))
add("project validator references P94 validator", /validate-ai-media-seller-state-ux\.mjs/.test(validateProject) && /P94 AI media seller state UX validator passes/.test(validateProject))
add("P94 documentation exists", exists("docs/PHASE_94_AI_MEDIA_SELLER_STATE_UX.md"))
add("roadmap keeps P94 complete in current progression", /\| P94 \| AI media seller-facing paid provider state UX\. \|/.test(roadmap) && /Completed through \*\*P120D - SMS.ir provider completion\*\*/.test(roadmap) && /P120E — SMS delivery reports and provider reconciliation/.test(roadmap))

const failed = checks.filter((check) => !check.pass)

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} ${check.name}`)
}

if (failed.length > 0) {
  console.error(`\n${failed.length} AI media seller state UX validation check(s) failed.`)
  process.exit(1)
}
