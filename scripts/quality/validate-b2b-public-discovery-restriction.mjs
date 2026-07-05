#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()

function read(filePath) {
  try {
    return fs.readFileSync(path.join(root, filePath), "utf8")
  } catch {
    return ""
  }
}

function check(name, ok, detail = "") {
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`)
  return ok
}

const results = []
function add(name, ok, detail = "") {
  results.push({ name, ok, detail })
}

const p05Doc = read("docs/b2b-public-repositioning/P05_PUBLIC_DISCOVERY_RESTRICTION_AND_DEMO_ONLY_APIS.md")
const restrictionMatrix = read("docs/b2b-public-repositioning/PUBLIC_DISCOVERY_RESTRICTION_MATRIX.md")
const apiPolicy = read("docs/b2b-public-repositioning/DEMO_ONLY_PUBLIC_API_POLICY.md")
const preservedPolicy = read("docs/b2b-public-repositioning/PRESERVED_TENANT_DIRECT_ROUTE_POLICY.md")
const homepage = read("app/[locale]/page.tsx")
const demoPage = read("app/[locale]/demo/page.tsx")
const nextPhaseRoadmap = read("docs/NEXT_PHASE_ROADMAP.md")
const currentSourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")
const routePolicy = read("docs/b2b-public-repositioning/PUBLIC_ROUTE_POLICY.md")

add("P05 documentation exists", p05Doc.length > 0)
add("public discovery restriction matrix exists", restrictionMatrix.length > 0)
add("demo-only public API policy exists", apiPolicy.length > 0)
add("preserved tenant direct route policy exists", preservedPolicy.length > 0)

if (p05Doc.length > 0) {
  add("P05 doc mentions inspected routes/APIs", /api\/public\/search|api\/public\/organizations|robots\.ts|sitemap\.ts/i.test(p05Doc))
  add("P05 doc mentions tenant direct pages preserved", /tenant direct pages|preserved/i.test(p05Doc) || /checkout|booking|order tracking/i.test(p05Doc))
  add("P05 doc mentions demo portfolio", /demo page|demo portfolio|app\/\[locale\]\/demo/i.test(p05Doc))
}

if (restrictionMatrix.length > 0) {
  add("restriction matrix classifies marketplace discovery", /MARKETPLACE_DISCOVERY|restrict/i.test(restrictionMatrix))
  add("restriction matrix preserves tenant direct pages", /preserved|tenant direct/i.test(restrictionMatrix))
  add("restriction matrix keeps demo page as example surface", /demo page|official public example/i.test(restrictionMatrix))
}

if (apiPolicy.length > 0) {
  add("API policy forbids exposing all real tenants anonymously", /must not expose all real tenants|anonymous/i.test(apiPolicy))
  add("API policy forbids customer phone exposure", /customer phone|phone numbers|شماره تماس/i.test(apiPolicy))
  add("API policy forbids private order details", /private order details|order details/i.test(apiPolicy))
  add("API policy forbids SMS/VAPID/provider secrets", /SMS\/VAPID|provider secrets|secrets/i.test(apiPolicy))
}

if (preservedPolicy.length > 0) {
  add("preserved policy lists checkout", /checkout/i.test(preservedPolicy))
  add("preserved policy lists booking", /booking/i.test(preservedPolicy))
  add("preserved policy lists order tracking", /order tracking|order\/\{orderNumber\}/i.test(preservedPolicy))
  add("preserved policy lists shop/appointment slugs", /shop\/\{slug\}|appointment\/\{slug\}/i.test(preservedPolicy))
}

if (homepage.length > 0) {
  add("homepage does not link to marketplace discovery", !/\/api\/public\/organizations\?|\/api\/public\/search\?/.test(homepage))
  add("homepage does not link to global shops listing", !/\/shops|\/products|\/services\?/.test(homepage))
  add("homepage demo CTA points to demo portfolio", /\/demo|demoHref/.test(homepage))
}

if (demoPage.length > 0) {
  add("demo page remains official public example surface", /نمونه کاربرد|نمونه‌های نمایشی/.test(demoPage))
  add("demo page avoids marketplace positioning", !/مارکت‌پلیس|بازارچه عمومی|کشف فروشگاه‌های اطراف/.test(demoPage))
  add("demo page avoids real customer data", !/شماره تماس واقعی|customer phone|real customer/.test(demoPage))
  add("demo page avoids real payment data", !/پرداخت واقعی|real payment|شماره کارت/.test(demoPage))
}

if (currentSourceOfTruth.length > 0) {
  add("CURRENT_SOURCE_OF_TRUTH marks P05 as completed or current", /BB-B2B-P05/.test(currentSourceOfTruth))
  add("CURRENT_SOURCE_OF_TRUTH marks P06 as next phase", /BB-B2B-P06/.test(currentSourceOfTruth))
  add("CURRENT_SOURCE_OF_TRUTH excludes Creative Studio from near-term", !/Creative Studio.*next/i.test(currentSourceOfTruth) || /Out of scope|excluded|not.*next/.test(currentSourceOfTruth))
}

if (nextPhaseRoadmap.length > 0) {
  add("NEXT_PHASE_ROADMAP marks P06 as next phase", /BB-B2B-P06/.test(nextPhaseRoadmap))
  add("NEXT_PHASE_ROADMAP does not start Creative Studio", !/BB-B2B-P07|Creative Studio.*Phase/.test(nextPhaseRoadmap) || /P06/.test(nextPhaseRoadmap))
}

if (routePolicy.length > 0) {
  add("route policy classifies broad discovery APIs as MARKETPLACE_DISCOVERY", /MARKETPLACE_DISCOVERY/i.test(routePolicy))
  add("route policy preserves tenant direct pages", /tenant direct pages must remain|must not be broken|must keep working/i.test(routePolicy))
}

const failed = results.filter((r) => !r.ok)
for (const r of results) {
  console.log(`${r.ok ? "OK" : "FAIL"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`)
}
if (failed.length > 0) {
  console.error(`\nB2B public discovery restriction validation failed with ${failed.length} issue(s).`)
  process.exit(1)
}
console.log(`\nB2B public discovery restriction validation passed (${results.length} checks).`)
