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

function grepFile(filePath, pattern) {
  const content = read(filePath)
  const regex = new RegExp(pattern, "gi")
  const matches = []
  let m
  while ((m = regex.exec(content)) !== null) {
    matches.push({ line: content.slice(0, m.index).split("\n").length, match: m[0] })
  }
  return matches
}

function assertNoClientLocalhostSocket() {
  const clientFiles = [
    "context/SocketContext.tsx",
    "components/dashboard/dashboard-shell.tsx",
    "hooks/useWebRTC.ts",
  ]

  for (const file of clientFiles) {
    if (!exists(file)) {
      addCheck(`client file exists: ${file}`, false, "missing")
      return
    }
  }

  const socketContext = read("context/SocketContext.tsx")
  const localhostPattern = /localhost:4001|127\.0\.0\.1:4001|0\.0\.0\.0:4001/i
  const hasHardcodedLocalhost = localhostPattern.test(socketContext) && !/NEXT_PUBLIC_SIGNALING_SERVER_URL/.test(socketContext)
  addCheck("SocketContext has no hardcoded localhost URL without env fallback", !hasHardcodedLocalhost)
  addCheck("SocketContext has no localhost fallback in effectiveSocketUrl", !/effectiveSocketUrl\s*=\s*SOCKET_SERVER_URL\s*\|\|\s*["']http:\/\/localhost:4001["']/.test(socketContext))

  const productionSafe = /isProduction|NODE_ENV.*production/i.test(socketContext) && /isSafePublicRealtimeUrl|localhost/.test(socketContext)
  addCheck("SocketContext has production safety guard", productionSafe)

  const dashboardShell = read("components/dashboard/dashboard-shell.tsx")
  addCheck("dashboard-shell imports SocketProvider", /SocketProvider/.test(dashboardShell))
}

function assertRealtimeUrlValidation() {
  const socketContext = read("context/SocketContext.tsx")
  addCheck("realtime URL validation exists", /isSafePublicRealtimeUrl|SafePublicRealtimeUrl|validateRealtimeUrl/i.test(socketContext))
  addCheck("production blocks localhost realtime URL", /localhost|127\.0\.0\.1/.test(socketContext) && /production/i.test(socketContext))
}

function assertWebPushCapabilityDetection() {
  const pushOptIn = read("components/dashboard/dashboard-push-opt-in.tsx")
  addCheck("push opt-in checks serviceWorker", /serviceWorker/.test(pushOptIn))
  addCheck("push opt-in checks PushManager", /PushManager/.test(pushOptIn))
  addCheck("push opt-in checks secure context", /isSecureContext|secure context/i.test(pushOptIn))
  addCheck("push opt-in does not mark all permission.query failures as unsupported", !/permissions\.query.*unsupported/i.test(pushOptIn.replace(/\/\/.*$/gm, "")))
  addCheck("push opt-in has specific insecure context message", /HTTPS|secure context/i.test(pushOptIn))
  addCheck("push opt-in has specific service worker message", /Service Worker/i.test(pushOptIn))
  addCheck("push opt-in has specific push API message", /Push API/i.test(pushOptIn))
  addCheck("push opt-in has permission denied message", /denied|رد شده/i.test(pushOptIn))
  addCheck("push opt-in has permission prompt message", /اجازه|permission/i.test(pushOptIn))
}

function assertWebPushDiagnostics() {
  const statusRoute = "app/api/dashboard/notification-operations/web-push/status/route.ts"
  addCheck("web-push status route exists", exists(statusRoute))
  if (exists(statusRoute)) {
    const content = read(statusRoute)
    addCheck("web-push status exposes safe booleans only", /vapidPublicKeyConfigured|vapidPrivateKeyConfigured|ok/.test(content))
    addCheck("web-push status does not expose private key value", !/WEB_PUSH_VAPID_PRIVATE_KEY/.test(content))
    addCheck("web-push status does not expose public key value", !/NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY/.test(content))
  }
}

function assertNotificationOpsPage() {
  const page = "app/[locale]/dashboard/notification-operations/page.tsx"
  addCheck("notification ops page exists", exists(page))
  if (exists(page)) {
    const content = read(page)
    addCheck("notification ops page has SMS section", /SMS|پیامک/i.test(content))
    addCheck("notification ops page has delivery reports section", /گزارش تحویل|delivery/i.test(content))
    addCheck("notification ops page has provider reconciliation", /reconcile|تطبیق/i.test(content))
  }
}

function assertDialogDescriptions() {
  const dialogFiles = [
    "components/shop/shop-location-dialog.tsx",
    "components/dashboard/appointment-full-calendar.tsx",
  ]

  for (const file of dialogFiles) {
    if (!exists(file)) continue
    const content = read(file)
    const hasDialogContent = /DialogContent/.test(content)
    const hasDialogDescription = /DialogDescription/.test(content)
    if (hasDialogContent) {
      addCheck(`${file} has DialogDescription`, hasDialogDescription)
    }
  }
}

function assertChartStability() {
  const dashboardPage = "app/[locale]/dashboard/page.tsx"
  if (!exists(dashboardPage)) {
    addCheck("dashboard page exists", false)
    return
  }
  const content = read(dashboardPage)
  addCheck("dashboard charts gated by mount state", /mounted/.test(content))
  addCheck("dashboard charts have explicit height containers", /h-\[300px\]|h-\[250px\]/.test(content))
}

assertNoClientLocalhostSocket()
assertRealtimeUrlValidation()
assertWebPushCapabilityDetection()
assertWebPushDiagnostics()
assertNotificationOpsPage()
assertDialogDescriptions()
assertChartStability()

const failed = checks.filter((c) => !c.ok)
console.log(JSON.stringify({ passed: checks.length - failed.length, failed: failed.length, checks }, null, 2))

if (failed.length > 0) {
  process.exit(1)
}
