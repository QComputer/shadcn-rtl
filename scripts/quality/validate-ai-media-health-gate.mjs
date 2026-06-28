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

const client = read("lib/services/ai-media-service-client.ts")
const statusRoute = read("app/api/dashboard/ai-media/status/route.ts")
const packageJson = read("package.json")
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md")
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")

const headerSpreadIndex = client.indexOf("...(init.headers || {})")
const authHeaderIndex = client.indexOf('"X-BazarBaz-AI-Key": config.internalKey')

add("AI media config status helper exists", /export function getAiMediaServiceConfigStatus/.test(client))
add("AI media readiness helper exists", /export async function checkAiMediaServiceReadiness/.test(client))
add("AI media readiness probes Render health and ready endpoints", /probeAiMediaEndpoint\("\/health", "ok"\)/.test(client) && /probeAiMediaEndpoint\("\/ready", "ready"\)/.test(client))
add("AI media timeout is normalized and positive", /function normalizeTimeoutMs/.test(client) && /timeoutMs > 0/.test(client))
add("AI media URL must be http or https", /url\.protocol === "http:" \|\| url\.protocol === "https:"/.test(client))
add("AI media internal key header cannot be overridden by caller headers", headerSpreadIndex >= 0 && authHeaderIndex > headerSpreadIndex)
add("AI media service errors use safe timeout and network codes", /"TIMEOUT"/.test(client) && /"NETWORK_ERROR"/.test(client))
add("AI media dashboard status route is authenticated", /requireAuthSession/.test(statusRoute) && /await requireAuthSession\(\)/.test(statusRoute))
add("AI media dashboard status route keeps legacy enabled boolean tied to readiness", /enabled:\s*status\.ready/.test(statusRoute))
add("AI media dashboard status route exposes config booleans, not secret values", /internalKeyConfigured/.test(statusRoute) && !/process\.env\.AI_MEDIA_SERVICE_INTERNAL_KEY/.test(statusRoute) && !/internalKey:\s/.test(statusRoute))
add("AI media dashboard status route supports explicit remote readiness checks", /searchParams\.get\("check"\) === "1"/.test(statusRoute) && /checkAiMediaServiceReadiness/.test(statusRoute))
add("AI media dashboard status route redacts remote response bodies", !/text\(\)/.test(statusRoute) && !/body/.test(statusRoute))
add("package exposes P84 health gate validator", /"quality:ai-media-health-gate":\s*"node scripts\/quality\/validate-ai-media-health-gate\.mjs"/.test(packageJson))
add("roadmap names P84 as current or completed phase", /P84 - Server-only AI media service client and health gate audit/.test(roadmap) || /P84 \| AI media health gate audit/.test(roadmap))
add("source of truth names P84 AI media health gate", /P84/.test(sourceOfTruth) && /health gate/.test(sourceOfTruth))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`AI media health gate validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("AI media health gate validation passed.")
