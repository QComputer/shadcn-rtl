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

const registryPath = "lib/content/b2b-demo-businesses.ts"
const demoPagePath = "app/[locale]/demo/page.tsx"
const homepagePath = "app/[locale]/page.tsx"
const seedPolicyPath = "docs/b2b-public-repositioning/DEMO_SEED_SAFETY_POLICY.md"
const portfolioDocPath = "docs/b2b-public-repositioning/DEMO_BUSINESS_PORTFOLIO.md"
const nextPhaseRoadmap = read("docs/NEXT_PHASE_ROADMAP.md")
const currentSourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")
const routePolicy = read("docs/b2b-public-repositioning/PUBLIC_ROUTE_POLICY.md")

const registry = read(registryPath)
const demoPage = read(demoPagePath)
const homepage = read(homepagePath)
const seedPolicy = read(seedPolicyPath)
const portfolioDoc = read(portfolioDocPath)

add("demo registry source file exists", registry.length > 0, registryPath)
add("demo portfolio route/page exists", demoPage.length > 0, demoPagePath)

if (registry.length > 0) {
  add("registry has at least 8 demo businesses", (registry.match(/id:\s*"/g) || []).length >= 8)
  add("registry demo entries are explicitly labeled as demo/example", /نمونه نمایشی|دمو/.test(registry))
  add("registry includes shop demo", /demo-fashion-shop|فروشگاه/.test(registry))
  add("registry includes restaurant/cafe demo", /demo-restaurant|رستوران/.test(registry))
  add("registry includes pharmacy demo", /demo-pharmacy|داروخانه/.test(registry))
  add("registry includes clinic demo", /demo-clinic|مطب/.test(registry))
  add("registry includes service organization demo", /demo-service-center|مرکز خدماتی/.test(registry))
  add("registry includes beauty salon demo", /demo-beauty-salon|زیبایی/.test(registry))
  add("registry includes education center demo", /demo-education-center|آموزشی/.test(registry))
  add("registry includes technical repair demo", /demo-repair-center|تعمیرات/.test(registry))
  add("registry avoids real tenant data patterns", !/شماره تماس واقعی|شماره ملی|customer phone|real customer/.test(registry))
  add("registry avoids real payment patterns", !/پرداخت واقعی|real payment|شماره کارت/.test(registry))
}

if (demoPage.length > 0) {
  add("demo page avoids marketplace/discovery wording", !/مارکت‌پلیس|بازارچه عمومی|کشف فروشگاه‌های اطراف|لیست فروشگاه‌ها/.test(demoPage))
  add("demo page avoids ad-directory wording", !/تبلیغات فروشگاه‌ها/.test(demoPage))
  add("demo page avoids public social network wording", !/شبکه اجتماعی عمومی/.test(demoPage))
  add("demo page explains demos are examples, not marketplace", /این نمونه‌ها|نمونه کاربرد|برای آشنایی/.test(demoPage))
  add("demo page uses B2B owner/operator messaging", /کسب‌وکار|صاحبان کسب‌وکار|مدیریت/.test(demoPage))
  add("demo page includes CTA back to register/dashboard", /درخواست دمو|ورود به داشبورد|register\/organization|login/.test(demoPage))
}

if (homepage.length > 0) {
  add("homepage demo CTA points to demo portfolio", /\/demo|secondaryCta.*مشاهده نمونه/.test(homepage) || /demoHref/.test(homepage))
  add("homepage demo CTA does not point to marketplace discovery", !/\/api\/public\/organizations|\/api\/public\/search/.test(homepage))
}

add("seed safety policy exists", seedPolicy.length > 0, seedPolicyPath)
add("demo portfolio doc exists", portfolioDoc.length > 0, portfolioDocPath)

if (seedPolicy.length > 0) {
  add("seed policy documents dry-run by default", /dry-run|پیش‌فرض/.test(seedPolicy))
  add("seed policy documents production write gates", /DEMO_SEED_WRITE_ENABLED|DEMO_SEED_PRODUCTION_ACK/.test(seedPolicy))
  add("seed policy blocks real SMS", /no real SMS|عدم ارسال پیامک واقعی|must not send real SMS|ارسال پیامک/.test(seedPolicy))
  add("seed policy blocks real payments", /no real payment|عدم پرداخت واقعی|must not create real payments|real payment/.test(seedPolicy))
  add("seed policy avoids real customer personal data", /no real customer personal data|عدم استفاده از داده‌های واقعی|anonymized|fake/.test(seedPolicy))
  add("seed policy documents rollback/idempotency", /idempotent|rollback|بازگشت/.test(seedPolicy))
}

if (currentSourceOfTruth.length > 0) {
  add("CURRENT_SOURCE_OF_TRUTH marks P04 as completed or current", /BB-B2B-P04/.test(currentSourceOfTruth))
  add("CURRENT_SOURCE_OF_TRUTH marks P05 as next phase", /BB-B2B-P05/.test(currentSourceOfTruth))
  add("CURRENT_SOURCE_OF_TRUTH excludes Creative Studio from near-term", !/Creative Studio.*next/i.test(currentSourceOfTruth) || /Out of scope|excluded|not.*next/.test(currentSourceOfTruth))
}

if (nextPhaseRoadmap.length > 0) {
  add("NEXT_PHASE_ROADMAP marks P05 as next phase", /BB-B2B-P05/.test(nextPhaseRoadmap))
  add("NEXT_PHASE_ROADMAP does not start Creative Studio", !/BB-B2B-P06|Creative Studio.*Phase/.test(nextPhaseRoadmap) || /P05/.test(nextPhaseRoadmap))
}

if (routePolicy.length > 0) {
  add("route policy preserves tenant direct pages", /tenant direct pages must remain|must not be broken|must keep working/i.test(routePolicy))
  add("route policy preserves checkout/booking/order tracking", /checkout|booking|order tracking/i.test(routePolicy))
  add("route policy defers marketplace API restriction to P05", /P05|restrict.*api|demo.only/i.test(routePolicy) || /marketplace discovery/i.test(routePolicy))
}

const failed = results.filter((r) => !r.ok)
for (const r of results) {
  console.log(`${r.ok ? "OK" : "FAIL"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`)
}
if (failed.length > 0) {
  console.error(`\nB2B demo business portfolio validation failed with ${failed.length} issue(s).`)
  process.exit(1)
}
console.log(`\nB2B demo business portfolio validation passed (${results.length} checks).`)
