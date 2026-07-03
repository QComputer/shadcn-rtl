import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

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

function gitTrackedFiles() {
  return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean)
}

const tracked = gitTrackedFiles()
const trackedExisting = tracked.filter((file) => exists(file))
const envExample = read(".env.example")
const packageJson = JSON.parse(read("package.json"))
const readme = read("README.md")
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md")
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")

const requiredEnvPlaceholders = [
  "SMS_PROVIDER=DRY_RUN",
  "SMS_IR_USERNAME=",
  "SMS_IR_API_KEY=",
  "SMS_IR_LINE=",
  "SMS_DRY_RUN=true",
  "WEB_PUSH_ENABLED=false",
  "WEB_PUSH_VAPID_PUBLIC_KEY=",
  "WEB_PUSH_VAPID_PRIVATE_KEY=",
  "WEB_PUSH_SUBJECT=mailto:admin@example.com",
  "PWA_ENABLED=true",
]

for (const line of requiredEnvPlaceholders) {
  add(`.env.example includes ${line.split("=")[0]}`, envExample.includes(line))
}

add("SMS API key placeholder is empty", /^SMS_IR_API_KEY=$/m.test(envExample))
add("Vercel token placeholder is empty", /^VERCEL_ACCESS_TOKEN=$/m.test(envExample))
add("AI media internal key placeholder is empty", /^AI_MEDIA_SERVICE_INTERNAL_KEY=$/m.test(envExample))
add("Creative Studio organization brand internal key placeholder is empty", /^CREATIVE_STUDIO_ORGANIZATION_BRAND_INTERNAL_KEY=$/m.test(envExample))
add(".env.example is tracked", tracked.includes(".env.example"))
add("local DB is not present in tracked source", !trackedExisting.includes("prisma/dev.db"))
add("personal public PDF is not present in tracked source", !trackedExisting.includes("public/myResume.pdf"))
add(".env files are not present in tracked source", !trackedExisting.some((file) => file === ".env" || (file.startsWith(".env.") && file !== ".env.example")))
add("active seed script remains tracked", tracked.includes("prisma/seed.ts"))
add("duplicate client Providers wrapper removed", !exists("components/providers.tsx"))
add("README keeps P95 source cleanup in current progression", /\| 95 \| Source Cleanup and Current-State Verification/.test(readme) && /Latest completed implementation phase:\s+\*\*P120 - Creative Studio reviewed asset apply and rollback workflow\*\*/.test(readme))
add("README recommends P108 after P107", /Recommended next phase:\s+\*\*P120B - Customer order lifecycle notifications and guest SMS dry-run review\*\*/.test(readme))
add("roadmap keeps P95 complete in P109 progression", /\| P95 \| Source cleanup and current-state verification\. \|/.test(roadmap) && /Completed through \*\*P120 - Creative Studio reviewed asset apply and rollback workflow\*\*/.test(roadmap))
add("source of truth keeps P95 source cleanup while naming P109 baseline", /Source Cleanup and Current-State Verification exists/.test(sourceOfTruth) && /after P119 Creative Studio provider result ingestion and review stabilization/.test(sourceOfTruth))

const scripts = packageJson.scripts || {}
const documentedScriptNames = new Set()
for (const file of ["README.md", "docs/CURRENT_SOURCE_OF_TRUTH.md", "docs/NEXT_PHASE_ROADMAP.md"]) {
  const text = read(file)
  for (const match of text.matchAll(/\bpnpm run ([\w:.-]+)/g)) {
    documentedScriptNames.add(match[1])
  }
}
const missingDocumentedScripts = [...documentedScriptNames].filter((script) => !scripts[script])
add("documented pnpm run scripts exist", missingDocumentedScripts.length === 0, missingDocumentedScripts.join(", "))
add("package exposes P95 validator", scripts["quality:source-baseline"] === "node scripts/quality/validate-source-baseline.mjs")

const textExtensions = new Set([".env.example", ".json", ".js", ".mjs", ".ts", ".tsx", ".md", ".prisma", ".sql", ".yml", ".yaml", ".ps1", ".css"])
const secretAssignmentPatterns = [
  { name: "SMS_IR_API_KEY", pattern: /^[ \t]*SMS_IR_API_KEY[ \t]*=[ \t]*([^\r\n]*)$/m },
  { name: "AI_MEDIA_SERVICE_INTERNAL_KEY", pattern: /^[ \t]*AI_MEDIA_SERVICE_INTERNAL_KEY[ \t]*=[ \t]*([^\r\n]*)$/m },
  { name: "CREATIVE_STUDIO_ORGANIZATION_BRAND_INTERNAL_KEY", pattern: /^[ \t]*CREATIVE_STUDIO_ORGANIZATION_BRAND_INTERNAL_KEY[ \t]*=[ \t]*([^\r\n]*)$/m },
  { name: "VERCEL_ACCESS_TOKEN", pattern: /^[ \t]*VERCEL_ACCESS_TOKEN[ \t]*=[ \t]*([^\r\n]*)$/m },
  { name: "RENDER secret", pattern: /^[ \t]*RENDER_[A-Z0-9_]*(?:SECRET|KEY|TOKEN)[ \t]*=[ \t]*([^\r\n]*)$/m },
]

const secretFindings = []
for (const file of tracked) {
  const ext = path.extname(file)
  if (!textExtensions.has(ext) && file !== ".gitignore") continue
  const fullPath = path.join(root, file)
  if (!fs.existsSync(fullPath)) continue
  const content = fs.readFileSync(fullPath, "utf8")
  for (const { name, pattern } of secretAssignmentPatterns) {
    const match = content.match(pattern)
    if (!match) continue
    const value = match[1].trim()
    if (value && !/^["']?["']?$/.test(value) && !/^replace-with/i.test(value) && !/^<[^>]+>$/.test(value)) {
      secretFindings.push(`${file}:${name}`)
    }
  }
}
add("tracked source has no committed secret env values", secretFindings.length === 0, secretFindings.join(", "))

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length > 0) {
  console.error(`\n${failed.length} source baseline validation check(s) failed.`)
  process.exit(1)
}
