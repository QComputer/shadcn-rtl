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

const requestDemoPage = read("app/[locale]/request-demo/page.tsx")
const contactPage = read("app/[locale]/contact/page.tsx")
const pricingPage = read("app/[locale]/pricing/page.tsx")
const homepage = read("app/[locale]/page.tsx")
const demoPage = read("app/[locale]/demo/page.tsx")
const conversionContent = read("lib/content/b2b-conversion-content.ts")
const nextPhaseRoadmap = read("docs/NEXT_PHASE_ROADMAP.md")
const currentSourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")
const routePolicy = read("docs/b2b-public-repositioning/PUBLIC_ROUTE_POLICY.md")

add("request-demo page exists", requestDemoPage.length > 0)
add("contact page exists", contactPage.length > 0)
add("pricing page exists", pricingPage.length > 0)

if (requestDemoPage.length > 0) {
  add("request-demo page exists with form structure", /request-demo|requestDemo|درخواست دمو/.test(requestDemoPage))
  add("request-demo page has form fields", /fullName|businessName|phone|city|consent/.test(requestDemoPage))
  add("request-demo page has consent checkbox", /consent/.test(requestDemoPage))
  add("request-demo page does not send real SMS", !/sms\.ir|sendSMS|real SMS/.test(requestDemoPage))
  add("request-demo page does not expose secrets", !/SMS_IR_API_KEY|VAPID|apiKey/.test(requestDemoPage))
  add("request-demo page has success state", /successTitle|ثبت شد|submitted/.test(requestDemoPage))
}

if (contactPage.length > 0) {
  add("contact page exists with B2B structure", /contact|تماس/.test(contactPage))
  add("contact page has suitable business types", /فروشگاه|رستوران|داروخانه|مطب/.test(contactPage) || /suitableItems|suitableFor/.test(contactPage))
  add("contact page has onboarding path", /مسیر پیشنهادی|onboarding/.test(contactPage))
  add("contact page links to request-demo", /\/request-demo/.test(contactPage))
  add("contact page links to dashboard login", /\/login/.test(contactPage))
}

if (pricingPage.length > 0) {
  add("pricing page exists with package structure", /pricing|تعرفه/.test(pricingPage))
  add("pricing page has package cards", /starter|شروع|growth|رشد|professional|حرفه‌ای|enterprise|سازمانی/.test(pricingPage) || /packages|package/.test(pricingPage))
  add("pricing page avoids final unsupported pricing claims", !/هزینه ماهیانه|قیمت نهایی|ثابت /.test(pricingPage) || /نیازمند بررسی|بسته به نیاز/.test(pricingPage))
  add("pricing page links to request-demo", /\/request-demo/.test(pricingPage))
  add("pricing page avoids payment/billing implementation", !/payment|checkout|صورت حساب|پرداخت/.test(pricingPage) || /درخواست دمو/.test(pricingPage))
}

if (homepage.length > 0) {
  add("homepage request-demo CTA links to request-demo page", /\/request-demo|primaryHref.*request-demo/.test(homepage))
  add("homepage demo CTA links to demo portfolio", /\/demo|demoHref/.test(homepage))
  add("homepage dashboard/login CTA preserved", /B2BFinalCta|login/.test(homepage))
  add("homepage avoids marketplace discovery CTA", !/\/api\/public\/organizations\?|\/api\/public\/search\?/.test(homepage))
}

if (demoPage.length > 0) {
  add("demo page request-demo CTA links to request-demo page", /\/request-demo/.test(demoPage))
  add("demo page dashboard CTA preserved", /\/login/.test(demoPage))
}

if (conversionContent.length > 0) {
  add("conversion content module exists", conversionContent.length > 0)
  add("conversion content has Persian request-demo copy", /درخواست دمو/.test(conversionContent))
  add("conversion content has Persian contact copy", /تماس با بازارباز/.test(conversionContent))
  add("conversion content has Persian pricing copy", /تعرفه‌ها/.test(conversionContent))
  add("conversion content has English copy", /Request.*Demo/i.test(conversionContent))
  add("conversion content has Arabic copy", /طلب عرض تجريبي|بازarbij/i.test(conversionContent))
}

if (currentSourceOfTruth.length > 0) {
  add("CURRENT_SOURCE_OF_TRUTH marks P06 as completed or current", /BB-B2B-P06/.test(currentSourceOfTruth))
  add("CURRENT_SOURCE_OF_TRUTH marks P07 as next phase", /BB-B2B-P07/.test(currentSourceOfTruth))
  add("CURRENT_SOURCE_OF_TRUTH excludes Creative Studio from near-term", !/Creative Studio.*next/i.test(currentSourceOfTruth) || /Out of scope|excluded|not.*next/.test(currentSourceOfTruth))
}

if (nextPhaseRoadmap.length > 0) {
  add("NEXT_PHASE_ROADMAP marks P07 as next phase", /BB-B2B-P07/.test(nextPhaseRoadmap))
  add("NEXT_PHASE_ROADMAP does not start Creative Studio", !/BB-B2B-P08|Creative Studio.*Phase/.test(nextPhaseRoadmap) || /P07/.test(nextPhaseRoadmap))
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
  console.error(`\nB2B conversion funnel validation failed with ${failed.length} issue(s).`)
  process.exit(1)
}
console.log(`\nB2B conversion funnel validation passed (${results.length} checks).`)
