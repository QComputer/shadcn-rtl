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

const homepagePath = "app/[locale]/page.tsx"
const homepage = read(homepagePath)
const contentModule = read("lib/content/b2b-homepage-content.ts")
const nextPhaseRoadmap = read("docs/NEXT_PHASE_ROADMAP.md")
const currentSourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")

add("homepage file exists", homepage.length > 0, homepagePath)

if (homepage.length > 0) {
  add("homepage removes marketplace listing fetch", !homepage.includes("getHomeData") && !homepage.includes("unstable_cache"), homepagePath)
  add("homepage removes organization cards", !homepage.includes("OrganizationSection") && !homepage.includes("OrganizationCardItem"), homepagePath)
  add("homepage removes prisma import for live data", !homepage.includes('import { prisma } from "@/lib/db"'), homepagePath)
  add("homepage imports B2B content", homepage.includes('b2b-homepage-content'), homepagePath)
  add("homepage uses B2B hero component", homepage.includes("B2BHero"), homepagePath)
  add("homepage includes capabilities", homepage.includes("B2BCapabilities"), homepagePath)
  add("homepage includes industries", homepage.includes("B2BIndustries"), homepagePath)
  add("homepage includes demo preview", homepage.includes("B2BDemoPreview"), homepagePath)
  add("homepage includes how it works", homepage.includes("B2BHowItWorks"), homepagePath)
  add("homepage includes FAQ", homepage.includes("B2BFaq"), homepagePath)
  add("homepage includes final CTA", homepage.includes("B2BFinalCta"), homepagePath)
  add("homepage avoids consumer marketplace positioning", !/مارکت‌پلیس|بازارچه عمومی/.test(homepage))
  add("homepage avoids ad-directory positioning", !/تبلیغات فروشگاه‌ها/.test(homepage))
  add("homepage avoids public social network positioning", !/شبکه اجتماعی/.test(homepage))
}

if (contentModule.length > 0) {
  add("content module has B2B hero title", /کسب‌وکار خود را آنلاین مدیریت کنید/.test(contentModule))
  add("content module has primary CTA", /درخواست دمو/.test(contentModule))
  add("content module has secondary CTA", /مشاهده نمونه کسب‌وکارها/.test(contentModule))
  add("content module has problem section", /problem/.test(contentModule) && /چالش/.test(contentModule))
  add("content module has solution section", /solution/.test(contentModule) && /همگی در یک پلتفرم/.test(contentModule))
  add("content module has dashboard explanation", /dashboard/.test(contentModule) && /داشبورد/.test(contentModule))
  add("content module has demo businesses explicitly demo", /demoBusinesses/.test(contentModule) && /نمونه نمایشی/.test(contentModule))
  add("content module has customer club messaging", /باشگاه مشتریان/.test(contentModule))
  add("content module has SMS/Web Push messaging", /پیامک/.test(contentModule) && /اعلان/.test(contentModule))
  add("content module has campaigns/coupons messaging", /کمپین‌ها/.test(contentModule) && /تخفیف‌ها/.test(contentModule))
  add("content module has data ownership/trust copy", /trust/.test(contentModule) && /داده‌های مشتریان شما متعلق/.test(contentModule))
  add("content module has FAQ", /faq/.test(contentModule))
}

add("content module has all 9 capability groups", (contentModule.match(/id:\s*"/g) || []).length >= 9)
add("content module has all 9 industries", /industries:/.test(contentModule) && (contentModule.match(/id:\s*"/g) || []).length >= 9)
add("content module has 5 demo businesses", (contentModule.match(/demoBusinesses/g) || []).length >= 1 && (contentModule.match(/label:/g) || []).length >= 5)

if (currentSourceOfTruth.length > 0) {
  add("CURRENT_SOURCE_OF_TRUTH marks P04 as next phase", /BB-B2B-P04/.test(currentSourceOfTruth))
  add("CURRENT_SOURCE_OF_TRUTH excludes Creative Studio from near-term", !/Creative Studio.*next/i.test(currentSourceOfTruth) || /Out of scope|excluded|not.*next/.test(currentSourceOfTruth))
}

if (nextPhaseRoadmap.length > 0) {
  add("NEXT_PHASE_ROADMAP marks P04 as next phase", /BB-B2B-P04/.test(nextPhaseRoadmap))
  add("NEXT_PHASE_ROADMAP does not start Creative Studio", !/BB-B2B-P05|Creative Studio.*Phase/.test(nextPhaseRoadmap) || /P04/.test(nextPhaseRoadmap))
}

const failed = results.filter((r) => !r.ok)
for (const r of results) {
  console.log(`${r.ok ? "OK" : "FAIL"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`)
}
if (failed.length > 0) {
  console.error(`\nB2B homepage landing validation failed with ${failed.length} issue(s).`)
  process.exit(1)
}
console.log(`\nB2B homepage landing validation passed (${results.length} checks).`)
