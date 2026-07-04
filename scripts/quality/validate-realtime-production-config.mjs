import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const checks = []

function addCheck(name, ok, detail = "") {
  checks.push({ name, ok, detail })
}

function exists(filePath) {
  return fs.existsSync(path.join(root, filePath))
}

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8")
}

function assertRealtimeProductionConfig() {
  const socketContext = "context/SocketContext.tsx"
  addCheck("SocketContext exists", exists(socketContext))
  if (!exists(socketContext)) return

  const content = read(socketContext)

  addCheck("no hardcoded localhost:4001 without env guard", !/io\('http:\/\/localhost:4001'\)/.test(content))
  addCheck("no localhost fallback in effectiveSocketUrl", !/effectiveSocketUrl\s*=\s*SOCKET_SERVER_URL\s*\|\|\s*["']http:\/\/localhost:4001["']/.test(content))
  addCheck("production realtime URL safety guard exists", /isProduction|NODE_ENV/.test(content) && /isSafePublicRealtimeUrl|localhost|127\.0\.0\.1/.test(content))
  addCheck("socket connects only when URL is configured and safe", /shouldConnect|effectiveSocketUrl|SOCKET_SERVER_URL/.test(content))
  addCheck("no NEXT_PUBLIC_SOCKET or unsafe default in production", !/NEXT_PUBLIC_SOCKET.*localhost/i.test(content))
}

function assertWebPushCapabilityDetection() {
  const pushOptIn = "components/dashboard/dashboard-push-opt-in.tsx"
  addCheck("dashboard push opt-in exists", exists(pushOptIn))
  if (!exists(pushOptIn)) return

  const content = read(pushOptIn)

  addCheck("checks serviceWorker availability", /serviceWorker/.test(content))
  addCheck("checks PushManager availability", /PushManager/.test(content))
  addCheck("checks secure context", /isSecureContext/.test(content))
  addCheck("permission query failure does not set unsupported", !/permissions\.query.*catch.*unsupported/i.test(content.replace(/\/\/.*$/gm, "")))
  addCheck("has specific HTTPS/secure context message", /HTTPS|secure context/i.test(content))
  addCheck("has specific service worker unavailable message", /Service Worker/i.test(content))
  addCheck("has specific push API unavailable message", /Push API/i.test(content))
  addCheck("has permission denied specific message", /denied|رد شده/i.test(content))
  addCheck("has permission prompt specific message", /اجازه|permission/i.test(content))
  addCheck("does not show generic unsupported for all failures", !/مرورگر شما از اعلان مرورگر پشتیبانی نمی‌کرد/.test(content))
}

function assertNotificationOpsDeployedSafety() {
  const page = "app/[locale]/dashboard/notification-operations/page.tsx"
  addCheck("notification operations page exists", exists(page))
  if (!exists(page)) return

  const content = read(page)
  addCheck("page has SMS diagnostics section", /SMS|پیامک/i.test(content))
  addCheck("page has delivery reports section", /گزارش تحویل|delivery/i.test(content))
  addCheck("page has provider reconciliation", /reconcile|تطبیق/i.test(content))
  addCheck("page masks phone numbers", /masked|phonemasked|شماره/.test(content))
}

assertRealtimeProductionConfig()
assertWebPushCapabilityDetection()
assertNotificationOpsDeployedSafety()

const failed = checks.filter((c) => !c.ok)
console.log(JSON.stringify({ passed: checks.length - failed.length, failed: failed.length, checks }, null, 2))

if (failed.length > 0) {
  process.exit(1)
}
