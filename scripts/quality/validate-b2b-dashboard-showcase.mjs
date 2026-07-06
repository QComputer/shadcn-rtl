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

const featuresPage = read("app/[locale]/features/page.tsx")
const dashboardShowcasePage = read("app/[locale]/dashboard-showcase/page.tsx")
const homepage = read("app/[locale]/page.tsx")
const demoPage = read("app/[locale]/demo/page.tsx")
const pricingPage = read("app/[locale]/pricing/page.tsx")
const requestDemoPage = read("app/[locale]/request-demo/page.tsx")
const contactPage = read("app/[locale]/contact/page.tsx")
const contentModule = read("lib/content/b2b-feature-pages-content.ts")
const nextPhaseRoadmap = read("docs/NEXT_PHASE_ROADMAP.md")
const currentSourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")
const routePolicy = read("docs/b2b-public-repositioning/PUBLIC_ROUTE_POLICY.md")

const featureContentSource = contentModule.includes("featurePagesContent") ? contentModule : ""
const dashboardContentSource = contentModule.includes("dashboardShowcase") ? contentModule : ""

add("features page exists", featuresPage.length > 0)
add("dashboard showcase page exists", dashboardShowcasePage.length > 0)

if (featuresPage.length > 0) {
  add("features page imports feature content", featuresPage.includes("b2b-feature-pages-content"))
  add("features page has Persian title in content module", /امکانات بازارباز/.test(featureContentSource))
  add("features page has required feature groups in content module", /مدیریت فروشگاه|مدیریت خدمات|باشگاه مشتریان|پیامک|کمپین|داشبورد|صفحه اختصاصی|کارکنان|چندزبانه/.test(featureContentSource))
  add("features page explains shop/order management", /مدیریت فروشگاه و سفارش‌ها|shop-orders/.test(featureContentSource))
  add("features page explains service/appointment management", /مدیریت خدمات و نوبت‌دهی|services-appointments/.test(featureContentSource))
  add("features page explains customer club", /باشگاه مشتریان|customer-club/.test(featureContentSource))
  add("features page explains SMS/Web Push safely", /پیامک|اعلان|notifications/.test(featureContentSource) && !/sms\.ir|sendSMS|real SMS/.test(featureContentSource))
  add("features page explains campaigns", /کمپین|campaigns/.test(featureContentSource))
  add("features page explains dashboard reports", /داشبورد مدیریتی|گزارش‌ها/.test(featureContentSource))
  add("features page explains staff/roles", /مدیریت کارکنان|staff-roles/.test(featureContentSource))
  add("features page avoids real data/secrets", !/SMS_IR_API_KEY|VAPID|شماره تماس واقعی|real customer/.test(featuresPage) && !/SMS_IR_API_KEY|VAPID|شماره تماس واقعی|real customer/.test(featureContentSource))
  add("features page links to request-demo", /\/request-demo/.test(featuresPage))
  add("features page links to dashboard showcase", /\/dashboard-showcase/.test(featuresPage))
}

if (dashboardShowcasePage.length > 0) {
  add("dashboard showcase page imports feature content", dashboardShowcasePage.includes("b2b-feature-pages-content"))
  add("dashboard showcase page is Persian-first in content module", /داشبوردی برای مدیریت روزانه/.test(dashboardContentSource))
  add("dashboard showcase explains workflows in content module", /سفارش‌ها|خدمات|مشتریان|کمپین|پیامک|گزارش|تنظیمات/.test(dashboardContentSource))
  add("dashboard showcase includes safety/trust copy in content module", /ایمنی|اعتماد|patient data|customer data|داده‌های مشتریان/.test(dashboardContentSource))
  add("dashboard showcase avoids private dashboard data", !/\/api\/dashboard|private|secret|password|apiKey/.test(dashboardShowcasePage) && !/\/api\/dashboard|private|secret|password|apiKey/.test(dashboardContentSource))
  add("dashboard showcase avoids real screenshots/data", !/screenshot|real data|production data|customer phone/.test(dashboardShowcasePage) && !/screenshot|real data|production data|customer phone/.test(dashboardContentSource))
  add("dashboard showcase avoids SMS/Web Push side effects", !/sms\.ir|sendSMS|web-push|push subscription/.test(dashboardShowcasePage) && !/sms\.ir|sendSMS|web-push|push subscription/.test(dashboardContentSource))
  add("dashboard showcase links to request-demo", /\/request-demo/.test(dashboardShowcasePage))
  add("dashboard showcase links to pricing", /\/pricing/.test(dashboardShowcasePage))
  add("dashboard showcase links to login", /\/login/.test(dashboardShowcasePage))
}

if (contentModule.length > 0) {
  add("feature pages content module exists", contentModule.length > 0)
  add("content module has Persian features", /امکانات بازارباز/.test(contentModule))
  add("content module has English features", /Bazar Baz Features/i.test(contentModule))
  add("content module has Arabic features", /ميزات بازarbij|بازarbij/.test(contentModule))
}

if (homepage.length > 0) {
  add("homepage links to features page", /\/features/.test(homepage))
  add("homepage links to dashboard showcase", /\/dashboard-showcase/.test(homepage))
}

if (demoPage.length > 0) {
  add("demo page links to features page", /\/features/.test(demoPage))
  add("demo page links to dashboard showcase", /\/dashboard-showcase/.test(demoPage))
}

if (pricingPage.length > 0) {
  add("pricing page links to features page", /\/features/.test(pricingPage))
}

if (requestDemoPage.length > 0) {
  add("request-demo page links to features page", /\/features/.test(requestDemoPage))
  add("request-demo page links to dashboard showcase", /\/dashboard-showcase/.test(requestDemoPage))
}

if (contactPage.length > 0) {
  add("contact page links to features page", /\/features/.test(contactPage))
}

if (currentSourceOfTruth.length > 0) {
  add("CURRENT_SOURCE_OF_TRUTH marks P07 as completed or current", /BB-B2B-P07/.test(currentSourceOfTruth))
  add("CURRENT_SOURCE_OF_TRUTH marks P08 as next phase", /BB-B2B-P08/.test(currentSourceOfTruth))
  add("CURRENT_SOURCE_OF_TRUTH excludes Creative Studio from near-term", !/Creative Studio.*next/i.test(currentSourceOfTruth) || /Out of scope|excluded|not.*next/.test(currentSourceOfTruth))
}

if (nextPhaseRoadmap.length > 0) {
  add("NEXT_PHASE_ROADMAP marks P08 as next phase", /BB-B2B-P08/.test(nextPhaseRoadmap))
  add("NEXT_PHASE_ROADMAP does not start Creative Studio", !/BB-B2B-P09|Creative Studio.*Phase/.test(nextPhaseRoadmap) || /P08/.test(nextPhaseRoadmap))
}

if (routePolicy.length > 0) {
  add("route policy preserves tenant direct pages", /tenant direct pages must remain|must not be broken|must keep working/i.test(routePolicy))
  add("route policy preserves checkout/booking/order tracking", /checkout|booking|order tracking/i.test(routePolicy))
}

const failed = results.filter((r) => !r.ok)
for (const r of results) {
  console.log(`${r.ok ? "OK" : "FAIL"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`)
}
if (failed.length > 0) {
  console.error(`\nB2B dashboard showcase validation failed with ${failed.length} issue(s).`)
  process.exit(1)
}
console.log(`\nB2B dashboard showcase validation passed (${results.length} checks).`)
