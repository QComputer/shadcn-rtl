#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const policyPath = path.join(root, "docs/b2b-public-repositioning/PUBLIC_ROUTE_POLICY.md")
const matrixPath = path.join(root, "docs/b2b-public-repositioning/PUBLIC_ROUTE_DECISION_MATRIX.md")
const phasePath = path.join(root, "docs/b2b-public-repositioning/P01_PUBLIC_SURFACE_POLICY_AND_ROUTE_AUDIT.md")

function read(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8")
  } catch {
    return ""
  }
}

function check(name, ok, detail = "") {
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`)
  return ok
}

const policy = read(policyPath)
const matrix = read(matrixPath)
const phase = read(phasePath)

const results = []
function add(name, ok, detail = "") {
  results.push({ name, ok, detail })
}

add("P01 phase doc exists", phase.length > 0, phasePath)
add("Public route policy doc exists", policy.length > 0, policyPath)
add("Route decision matrix exists", matrix.length > 0, matrixPath)

if (policy.length > 0) {
  add("Policy contains BAZAR_BAZ_MARKETING category", /BAZAR_BAZ_MARKETING/.test(policy))
  add("Policy contains TENANT_DIRECT_PUBLIC category", /TENANT_DIRECT_PUBLIC/.test(policy))
  add("Policy contains TENANT_CUSTOMER_FLOW category", /TENANT_CUSTOMER_FLOW/.test(policy))
  add("Policy contains DEMO_PORTFOLIO category", /DEMO_PORTFOLIO/.test(policy))
  add("Policy contains MARKETPLACE_DISCOVERY category", /MARKETPLACE_DISCOVERY/.test(policy))
  add("Policy says tenant direct pages must remain", /tenant direct pages must remain|must not be broken|must keep working/i.test(policy))
  add("Policy says marketplace discovery must not be promoted", /must not be promoted|remove from nav|noindex|restrict/i.test(policy))
  add("Policy references demo-only strategy", /demo.only|curated demo|demo business/i.test(policy))
  add("Policy excludes Creative Studio as next phase", /Creative Studio.*excluded|exclude.*Creative Studio|not.*next.*phase/i.test(policy) || /Out of scope/.test(policy))
  add("Policy mentions B2B homepage direction", /B2B.*homepage|homepage.*B2B|B2B.*landing/i.test(policy))
  add("Policy mentions business owner as buyer", /business owner| Iranian businesses|B2B.*business/i.test(policy))
  add("Policy mentions public discovery reduction", /public discovery|marketplace.*restrict|reduce.*discovery/i.test(policy))
  add("Policy mentions demo business portfolio", /demo.*portfolio|portfolio.*demo|curated demo/i.test(policy))
  add("Policy references P02 as next B2B phase", /P02|BB-B2B-P02/i.test(policy))
}

if (matrix.length > 0) {
  add("Matrix contains TENANT_DIRECT_PUBLIC routes", /TENANT_DIRECT_PUBLIC/.test(matrix))
  add("Matrix contains TENANT_CUSTOMER_FLOW routes", /TENANT_CUSTOMER_FLOW/.test(matrix))
  add("Matrix contains MARKETPLACE_DISCOVERY routes", /MARKETPLACE_DISCOVERY/.test(matrix))
  add("Matrix contains DEMO_PORTFOLIO routes", /DEMO_PORTFOLIO/.test(matrix))
  add("Matrix preserves shop/[slug] routes", /\/:locale\/shop\/\[slug\]/.test(matrix))
  add("Matrix preserves checkout routes", /checkout/.test(matrix))
  add("Matrix preserves order tracking routes", /order\/\[orderNumber\]|order tracking/i.test(matrix))
  add("Matrix preserves booking routes", /booking/.test(matrix))
  add("Matrix restricts /api/public/organizations", /\/api\/public\/organizations/.test(matrix))
  add("Matrix restricts /api/public/search", /\/api\/public\/search/.test(matrix))
}

const failed = results.filter((r) => !r.ok)
for (const r of results) {
  console.log(`${r.ok ? "OK" : "FAIL"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`)
}
if (failed.length > 0) {
  console.error(`\nB2B public route policy validation failed with ${failed.length} issue(s).`)
  process.exit(1)
}

console.log(`\nB2B public route policy validation passed (${results.length} checks).`)
