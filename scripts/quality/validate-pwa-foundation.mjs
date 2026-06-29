#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

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

const manifest = exists("app/manifest.ts") ? read("app/manifest.ts") : ""
const layout = exists("app/[locale]/layout.tsx") ? read("app/[locale]/layout.tsx") : ""
const installManager = exists("components/pwa-install-manager.tsx") ? read("components/pwa-install-manager.tsx") : ""
const serviceWorker = exists("public/web-push-sw.js") ? read("public/web-push-sw.js") : ""
const packageJson = exists("package.json") ? read("package.json") : ""
const validateProject = exists("scripts/quality/validate-project.mjs") ? read("scripts/quality/validate-project.mjs") : ""
const readme = exists("README.md") ? read("README.md") : ""
const roadmap = exists("docs/NEXT_PHASE_ROADMAP.md") ? read("docs/NEXT_PHASE_ROADMAP.md") : ""
const sourceOfTruth = exists("docs/CURRENT_SOURCE_OF_TRUTH.md") ? read("docs/CURRENT_SOURCE_OF_TRUTH.md") : ""

add("P97 phase document exists", exists("docs/PHASE_97_PWA_FOUNDATION.md"))
add("manifest file exists", exists("app/manifest.ts"))
add("manifest is Persian-first and installable", /start_url:\s*"\/fa"/.test(manifest) && /display:\s*"standalone"/.test(manifest) && /dir:\s*"rtl"/.test(manifest) && /lang:\s*"fa"/.test(manifest))
add("manifest includes any and maskable icons", /src:\s*"\/pwa-icon\.svg"[\s\S]*purpose:\s*"any"/.test(manifest) && /src:\s*"\/pwa-maskable-icon\.svg"[\s\S]*purpose:\s*"maskable"/.test(manifest))
add("manifest includes platform shortcuts", /url:\s*"\/fa"/.test(manifest) && /url:\s*"\/fa\/dashboard"/.test(manifest))
add("PWA icons exist", exists("public/pwa-icon.svg") && exists("public/pwa-maskable-icon.svg"))

add("locale layout exposes PWA metadata", /manifest:\s*"\/manifest\.webmanifest"/.test(layout) && /appleWebApp:\s*\{/.test(layout) && /icons:\s*\{/.test(layout) && /formatDetection:\s*\{/.test(layout))
add("locale layout mounts install manager with env guard", /<PwaInstallManager\s+enabled=\{process\.env\.PWA_ENABLED !== "false"\}\s+locale=\{locale\}\s*\/>/.test(layout))

add("install manager exists", exists("components/pwa-install-manager.tsx"))
add("install manager registers shared service worker", /navigator\.serviceWorker\.register\("\/web-push-sw\.js",\s*\{\s*scope:\s*"\/"\s*\}\)/.test(installManager))
add("install manager is HTTPS or localhost guarded", /window\.location\.protocol === "https:"/.test(installManager) && /window\.location\.hostname === "localhost"/.test(installManager))
add("install manager handles browser install events", /beforeinstallprompt/.test(installManager) && /appinstalled/.test(installManager))
add("install manager keeps Persian as default copy", /copy = \{[\s\S]*fa:\s*\{/.test(installManager) && /copy\[locale as keyof typeof copy\] \|\| copy\.fa/.test(installManager))
add("install manager does not request notification permission", !/Notification\.requestPermission/.test(installManager))

add("service worker has lifecycle handlers", /addEventListener\("install"/.test(serviceWorker) && /skipWaiting\(\)/.test(serviceWorker) && /addEventListener\("activate"/.test(serviceWorker) && /clients\.claim\(\)/.test(serviceWorker))
add("service worker keeps web-push handlers", /addEventListener\("push"/.test(serviceWorker) && /showNotification/.test(serviceWorker) && /addEventListener\("notificationclick"/.test(serviceWorker))
add("P98 offline cache remains guarded", /addEventListener\("fetch"/.test(serviceWorker) ? /request\.mode === "navigate"/.test(serviceWorker) && /shouldBypassCache/.test(serviceWorker) : !/caches\.open|cache\.addAll/.test(serviceWorker))

add("package exposes P97 validator", /"quality:pwa-foundation":\s*"node scripts\/quality\/validate-pwa-foundation\.mjs"/.test(packageJson))
add("project validator references P97 validator", /validate-pwa-foundation\.mjs/.test(validateProject) && /P97 PWA foundation validator passes/.test(validateProject))
add("README keeps P97 complete while marking P105 latest", /\| 97 \| PWA foundation and install experience/.test(readme) && /Latest completed implementation phase:\s+\*\*P105 - Production rollout runbook\*\*/.test(readme) && /No active next phase; current integrated roadmap is complete/.test(readme))
add("roadmap keeps P97 complete while marking P105 baseline", /\| P97 \| PWA foundation and install experience\. \|/.test(roadmap) && /Completed through \*\*P105 - Production rollout runbook\*\*/.test(roadmap))
add("source of truth keeps P97 foundation while naming P105 baseline", /PWA Foundation and Install Experience exists/.test(sourceOfTruth) && /after P105 Production rollout runbook/.test(sourceOfTruth))

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length > 0) {
  console.error(`\n${failed.length} PWA foundation validation check(s) failed.`)
  process.exit(1)
}
