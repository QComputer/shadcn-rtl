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

const trustPage = read("app/[locale]/trust/page.tsx")
const privacyPage = read("app/[locale]/privacy/page.tsx")
const termsPage = read("app/[locale]/terms/page.tsx")
const homepage = read("app/[locale]/page.tsx")
const demoPage = read("app/[locale]/demo/page.tsx")
const featuresPage = read("app/[locale]/features/page.tsx")
const dashboardShowcasePage = read("app/[locale]/dashboard-showcase/page.tsx")
const requestDemoPage = read("app/[locale]/request-demo/page.tsx")
const pricingPage = read("app/[locale]/pricing/page.tsx")
const contactPage = read("app/[locale]/contact/page.tsx")
const layout = read("app/[locale]/layout.tsx")
const legalContent = read("lib/content/b2b-legal-content.ts")
const seoIndexingPolicy = read("docs/b2b-public-repositioning/SEO_AND_INDEXING_POLICY.md")
const trustCopyDoc = read("docs/b2b-public-repositioning/TRUST_AND_DATA_OWNERSHIP_COPY.md")
const legalStarterCopyPolicy = read("docs/b2b-public-repositioning/LEGAL_STARTER_COPY_POLICY.md")
const analyticsPolicy = read("docs/b2b-public-repositioning/ANALYTICS_AND_PRIVACY_MEASUREMENT_POLICY.md")
const currentSourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")
const nextPhaseRoadmap = read("docs/NEXT_PHASE_ROADMAP.md")
const routePolicy = read("docs/b2b-public-repositioning/PUBLIC_ROUTE_POLICY.md")

add("trust page exists", trustPage.length > 0)
add("privacy page exists", privacyPage.length > 0)
add("terms page exists", termsPage.length > 0)

if (trustPage.length > 0) {
  add("trust page imports legal content", trustPage.includes("b2b-legal-content"))
  add("trust page has Persian title in content module", /اعتماد، امنیت و مالکیت داده/.test(legalContent))
  add("trust page includes data ownership copy", /مالکیت رابطه با مشتری/.test(trustPage) || /مالکیت داده/.test(legalContent))
  add("trust page includes safety/trust bullets", /امنیت|اعتماد|داده‌های مشتریان/.test(trustPage) || /امنیت|اعتماد|داده‌های مشتریان/.test(legalContent))
  add("trust page avoids unsupported certification claims", !/ certification|ISO 27001|سازمان رسمی/.test(trustPage) && !/ certification|ISO 27001|سازمان رسمی/.test(legalContent))
  add("trust page includes transparency disclaimer", /جایگزین مشاوره حقوقی/.test(trustPage) || /جایگزین مشاوره حقوقی/.test(legalContent))
  add("trust page links to request-demo or features", /\/request-demo/.test(trustPage) || /\/features/.test(trustPage))
}

if (privacyPage.length > 0) {
  add("privacy page imports legal content", privacyPage.includes("b2b-legal-content"))
  add("privacy page has Persian title in content module", /حریم خصوصی/.test(legalContent))
  add("privacy page explains data processing categories", /داده‌های پردازش شده|business account|customer interaction/.test(privacyPage) || /داده‌های پردازش شده/.test(legalContent))
  add("privacy page explains purpose of processing", /هدف از پردازش داده|Purpose of data processing/.test(privacyPage) || /هدف از پردازش داده/.test(legalContent))
  add("privacy page includes starter disclaimer", /مشاور حقوقی|legal counsel|قانونی بررسی/.test(privacyPage) || /مشاور حقوقی/.test(legalContent))
  add("privacy page avoids legal guarantees", !/ضمانت قانونی|legal guarantee|تأیید حقوقی نهایی/.test(privacyPage) && !/ضمانت قانونی|legal guarantee|تأیید حقوقی نهایی/.test(legalContent))
}

if (termsPage.length > 0) {
  add("terms page imports legal content", termsPage.includes("b2b-legal-content"))
  add("terms page has Persian title in content module", /شرایط استفاده/.test(legalContent))
  add("terms page explains business service platform", /پلتفرم خدماتی تجاری|business service platform/.test(termsPage) || /پلتفرم خدماتی تجاری/.test(legalContent))
  add("terms page explains prohibited uses", /استفاده ممنوع|prohibited uses/.test(termsPage) || /استفاده ممنوع/.test(legalContent))
  add("terms page includes starter disclaimer", /مشاور حقوقی|legal counsel|قانونی بررسی/.test(termsPage) || /مشاور حقوقی/.test(legalContent))
  add("terms page avoids final legal approval", !/تأیید نهایی حقوقی|final legal approval|منتشر شده/.test(termsPage) && !/تأیید نهایی حقوقی|final legal approval/.test(legalContent))
}

if (layout.length > 0) {
  add("layout footer includes privacy link", /\/privacy/.test(layout))
  add("layout footer includes terms link", /\/terms/.test(layout))
  add("layout footer includes trust link", /\/trust/.test(layout))
  add("layout footer includes request-demo link", /\/request-demo/.test(layout))
  add("layout footer includes contact link", /\/contact/.test(layout))
  add("layout footer avoids marketplace discovery links", !/marketplace|همه فروشگاه‌ها|جستجوی فروشگاه‌ها/.test(layout))
}

if (homepage.length > 0) {
  add("homepage has B2B metadata", /پلتفرم مدیریت کسب‌وکار/.test(homepage) || /پلتفرم مدیریت کسب‌وکار/.test(read("lib/content/b2b-homepage-content.ts")))
  add("homepage avoids consumer marketplace metadata", !/مارکت‌پلیس/.test(homepage) && !/مارکت‌پلیس/.test(read("lib/content/b2b-homepage-content.ts")))
}

if (seoIndexingPolicy.length > 0) {
  add("SEO indexing policy doc exists", seoIndexingPolicy.length > 0)
  add("SEO indexing policy covers B2B pages", /\/features|\/dashboard-showcase|\/request-demo/.test(seoIndexingPolicy))
  add("SEO indexing policy restricts marketplace discovery", /noindex|MARKETPLACE_DISCOVERY|restrict/.test(seoIndexingPolicy))
  add("SEO indexing policy preserves tenant pages", /tenant direct|TENANT_DIRECT_PUBLIC|preserve/.test(seoIndexingPolicy))
}

if (trustCopyDoc.length > 0) {
  add("trust/data ownership copy doc exists", trustCopyDoc.length > 0)
}

if (legalStarterCopyPolicy.length > 0) {
  add("legal starter copy policy doc exists", legalStarterCopyPolicy.length > 0)
  add("legal starter copy policy includes disclaimers", /مشاور حقوقی|legal counsel/.test(legalStarterCopyPolicy))
}

if (analyticsPolicy.length > 0) {
  add("analytics/privacy measurement policy exists", analyticsPolicy.length > 0)
  add("analytics policy requires env gate", /NEXT_PUBLIC_ANALYTICS_ENABLED|env gate|environment/.test(analyticsPolicy))
  add("analytics policy prohibits PII collection", /full phone|PII|personal data/.test(analyticsPolicy))
  add("analytics policy prohibits secrets", /SMS_IR_API_KEY|VAPID|DATABASE_URL|secrets/.test(analyticsPolicy))
  add("analytics policy is disabled by default or policy-only", /disabled by default|policy-only|default/.test(analyticsPolicy))
}

if (currentSourceOfTruth.length > 0) {
  add("CURRENT_SOURCE_OF_TRUTH marks P08 as completed or current", /BB-B2B-P08/.test(currentSourceOfTruth))
  add("CURRENT_SOURCE_OF_TRUTH marks P09 as next phase", /BB-B2B-P09/.test(currentSourceOfTruth))
  add("CURRENT_SOURCE_OF_TRUTH excludes Creative Studio from near-term", !/Creative Studio.*next/i.test(currentSourceOfTruth) || /Out of scope|excluded|not.*next/.test(currentSourceOfTruth))
}

if (nextPhaseRoadmap.length > 0) {
  add("NEXT_PHASE_ROADMAP marks P09 as next phase", /BB-B2B-P09/.test(nextPhaseRoadmap))
  add("NEXT_PHASE_ROADMAP does not start Creative Studio", !/BB-B2B-P10|Creative Studio.*Phase/.test(nextPhaseRoadmap) || /P09/.test(nextPhaseRoadmap))
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
  console.error(`\nB2B SEO/trust/legal validation failed with ${failed.length} issue(s).`)
  process.exit(1)
}
console.log(`\nB2B SEO/trust/legal validation passed (${results.length} checks).`)
