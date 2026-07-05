#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const contentModulePath = path.join(root, "lib/content/b2b-homepage-content.ts")
const architecturePath = path.join(root, "docs/b2b-public-repositioning/P02_PERSIAN_B2B_CONTENT_ARCHITECTURE.md")
const contentMapPath = path.join(root, "docs/b2b-public-repositioning/HOMEPAGE_CONTENT_MAP.md")
const copyGuidePath = path.join(root, "docs/b2b-public-repositioning/PERSIAN_COPY_GUIDE.md")
const featureMessagingPath = path.join(root, "docs/b2b-public-repositioning/B2B_FEATURE_MESSAGING.md")
const demoMessagingPath = path.join(root, "docs/b2b-public-repositioning/DEMO_BUSINESS_MESSAGING.md")
const routePolicyPath = path.join(root, "docs/b2b-public-repositioning/PUBLIC_ROUTE_POLICY.md")

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

const contentModule = read(contentModulePath)
const architecture = read(architecturePath)
const contentMap = read(contentMapPath)
const copyGuide = read(copyGuidePath)
const featureMessaging = read(featureMessagingPath)
const demoMessaging = read(demoMessagingPath)
const routePolicy = read(routePolicyPath)

const results = []
function add(name, ok, detail = "") {
  results.push({ name, ok, detail })
}

add("P02 content architecture doc exists", architecture.length > 0, architecturePath)
add("Homepage content map exists", contentMap.length > 0, contentMapPath)
add("Persian copy guide exists", copyGuide.length > 0, copyGuidePath)
add("B2B feature messaging exists", featureMessaging.length > 0, featureMessagingPath)
add("Demo business messaging exists", demoMessaging.length > 0, demoMessagingPath)
add("Content module exists", contentModule.length > 0, contentModulePath)

if (contentModule.length > 0) {
  add("Content module has Persian hero title", /کسب‌وکار خود را آنلاین مدیریت کنید/.test(contentModule))
  add("Content module has primary CTA", /درخواست دمو/.test(contentModule))
  add("Content module has secondary CTA", /مشاهده نمونه کسب‌وکارها/.test(contentModule))
  add("Content module has problem section", /problem/.test(contentModule) || /چالش/.test(contentModule))
  add("Content module has solution section", /solution/.test(contentModule) || /راه‌حل/.test(contentModule))
  add("Content module has capabilities", /capabilities/.test(contentModule) && (contentModule.match(/id:\s*"/g) || []).length >= 8)
  add("Content module has industries", /industries/.test(contentModule) && contentModule.match(/id:\s*"/g)?.length >= 5)
  add("Content module has demo businesses", /demoBusinesses/.test(contentModule))
  add("Content module has notifications section", /notifications/.test(contentModule) || /پیامک/.test(contentModule))
  add("Content module has trust section", /trust/.test(contentModule) || /اطلاعات/.test(contentModule))
  add("Content module has FAQ", /faq/.test(contentModule))
  add("Content module has footer", /footer/.test(contentModule))
  add("Content module has howItWorks", /howItWorks/.test(contentModule))
  add("Content module has English locale", /en:/.test(contentModule))
  add("Content module has Arabic locale", /ar:/.test(contentModule))
}

if (architecture.length > 0) {
  add("Architecture mentions B2B buyer/user", /کسب‌وکارهای ایرانی|business owner|B2B/.test(architecture))
  add("Architecture avoids marketplace wording", /مارکت‌پلیس|تبلیغات فروشگاه‌ها|بازارچه عمومی/.test(architecture) === false || /avoid/.test(architecture.toLowerCase()))
  add("Architecture mentions dashboard explanation", /dashboard/.test(architecture) || /داشبورد/.test(architecture))
  add("Architecture mentions SMS/notification", /پیامک|اعلان|SMS|notification/.test(architecture))
  add("Architecture mentions data ownership", /اطلاعات|data ownership/.test(architecture))
  add("Architecture mentions P03 as next phase", /P03|BB-B2B-P03/.test(architecture))
  add("Architecture excludes Creative Studio", /Creative Studio.*excluded|exclude.*Creative Studio|No Creative Studio|Creative Studio.*not.*next|Out of scope/.test(architecture))
}

if (featureMessaging.length > 0) {
  add("Feature messaging has 9 capability groups", (featureMessaging.match(/### \d\./g) || []).length >= 9)
}

if (demoMessaging.length > 0) {
  add("Demo messaging has 5 demo businesses", (demoMessaging.match(/### \d\./g) || []).length >= 5)
  add("Demo messaging uses نمایشی labels", /نمونه نمایشی/.test(demoMessaging))
}

if (routePolicy.length > 0) {
  add("Route policy preserves tenant direct pages", /tenant direct pages must remain|must not be broken|must keep working/i.test(routePolicy))
  add("Route policy restricts marketplace discovery", /must not be promoted|remove from nav|noindex|restrict/i.test(routePolicy))
}

const failed = results.filter((r) => !r.ok)
for (const r of results) {
  console.log(`${r.ok ? "OK" : "FAIL"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`)
}
if (failed.length > 0) {
  console.error(`\nB2B Persian content architecture validation failed with ${failed.length} issue(s).`)
  process.exit(1)
}
console.log(`\nB2B Persian content architecture validation passed (${results.length} checks).`)
