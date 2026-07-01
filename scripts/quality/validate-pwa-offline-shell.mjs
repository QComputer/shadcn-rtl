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

const serviceWorker = exists("public/web-push-sw.js") ? read("public/web-push-sw.js") : ""
const offlinePage = exists("public/offline.html") ? read("public/offline.html") : ""
const packageJson = exists("package.json") ? read("package.json") : ""
const validateProject = exists("scripts/quality/validate-project.mjs") ? read("scripts/quality/validate-project.mjs") : ""
const p97Validator = exists("scripts/quality/validate-pwa-foundation.mjs") ? read("scripts/quality/validate-pwa-foundation.mjs") : ""
const readme = exists("README.md") ? read("README.md") : ""
const roadmap = exists("docs/NEXT_PHASE_ROADMAP.md") ? read("docs/NEXT_PHASE_ROADMAP.md") : ""
const sourceOfTruth = exists("docs/CURRENT_SOURCE_OF_TRUTH.md") ? read("docs/CURRENT_SOURCE_OF_TRUTH.md") : ""

add("P98 phase document exists", exists("docs/PHASE_98_PWA_OFFLINE_SHELL.md"))
add("offline shell exists", exists("public/offline.html"))
add("offline shell is Persian-first", /<html lang="fa" dir="rtl">/.test(offlinePage) && /&#1575;&#1578;&#1589;&#1575;&#1604;/.test(offlinePage))
add("offline shell is static and local", !/<script\b/i.test(offlinePage) && !/https?:\/\//i.test(offlinePage))

add("service worker defines P98 cache metadata", /version:\s*"p98-offline-shell"/.test(serviceWorker) && /staticCacheName:\s*"bazar-baz-static-p98"/.test(serviceWorker))
add("service worker precaches offline shell and PWA assets", /cache\.addAll\(PWA_CACHE\.staticAssets\)/.test(serviceWorker) && /"\/offline\.html"/.test(serviceWorker) && /"\/manifest\.webmanifest"/.test(serviceWorker))
add("service worker cleans older Bazar Baz caches", /cacheName\.startsWith\("bazar-baz-"\)/.test(serviceWorker) && /caches\.delete\(cacheName\)/.test(serviceWorker))
add("service worker handles fetch events", /addEventListener\("fetch"/.test(serviceWorker) && /event\.respondWith/.test(serviceWorker))
add("navigation is network-first with offline fallback", /request\.mode === "navigate"[\s\S]*networkFirstNavigation\(request\)/.test(serviceWorker) && /fetch\(request\)[\s\S]*caches\.match\(PWA_CACHE\.offlineUrl\)/.test(serviceWorker))
add("static assets are cache-first", /cacheFirstStaticAsset/.test(serviceWorker) && /caches\.match\(request\)/.test(serviceWorker) && /cache\.put\(request,\s*networkResponse\.clone\(\)\)/.test(serviceWorker))
add("transactional/data routes bypass static caching", /"\/api\/"/.test(serviceWorker) && /"\/uploads\/"/.test(serviceWorker) && /"\/dashboard"/.test(serviceWorker) && /"\/checkout"/.test(serviceWorker) && /"\/booking"/.test(serviceWorker) && /"\/order\/"/.test(serviceWorker) && /"\/payment"/.test(serviceWorker))
add("service worker keeps web push handlers", /addEventListener\("push"/.test(serviceWorker) && /addEventListener\("notificationclick"/.test(serviceWorker))

add("package exposes P98 validator", /"quality:pwa-offline-shell":\s*"node scripts\/quality\/validate-pwa-offline-shell\.mjs"/.test(packageJson))
add("project validator references P98 validator", /validate-pwa-offline-shell\.mjs/.test(validateProject) && /P98 PWA offline shell validator passes/.test(validateProject))
add("P97 validator tolerates P98 offline cache", /P98 offline cache remains guarded/.test(p97Validator))
add("README keeps P98 complete while marking P109 latest", /\| 98 \| Offline shell, caching, and PWA quality gates/.test(readme) && /Latest completed implementation phase:\s+\*\*P117 - Creative Studio organization-brand provider execution rollout gate\*\*/.test(readme) && /P118 - Creative Studio organization-brand provider execution implementation/.test(readme))
add("roadmap marks P98 complete in P109 progression", /\| P98 \| Offline shell, caching, and PWA quality gates\. \|/.test(roadmap) && /Completed through \*\*P117 - Creative Studio organization-brand provider execution rollout gate\*\*/.test(roadmap))
add("source of truth names P109 baseline while keeping P98 offline shell", /Offline Shell, Caching, and PWA Quality Gates exist/.test(sourceOfTruth) && /after P117 Creative Studio organization-brand provider execution rollout gate/.test(sourceOfTruth))

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length > 0) {
  console.error(`\n${failed.length} PWA offline shell validation check(s) failed.`)
  process.exit(1)
}
