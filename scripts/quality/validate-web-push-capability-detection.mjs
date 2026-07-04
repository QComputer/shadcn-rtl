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

function assertWebPushCapabilityDetection() {
  const pushOptIn = "components/dashboard/dashboard-push-opt-in.tsx"
  addCheck("dashboard push opt-in exists", exists(pushOptIn))
  if (!exists(pushOptIn)) return

  const content = read(pushOptIn)

  addCheck("detects serviceWorker support", /"serviceWorker" in navigator/.test(content))
  addCheck("detects PushManager support", /"PushManager" in window/.test(content))
  addCheck("detects Notification API support", /"Notification" in window/.test(content))
  addCheck("detects secure context", /isSecureContext/.test(content))
  addCheck("handles permissions.query failure without marking unsupported", !/catch.*setPermissionState\("unsupported"\)/i.test(content))
  addCheck("shows specific HTTPS message when insecure", /HTTPS|secure context/i.test(content))
  addCheck("shows specific SW unavailable message", /Service Worker/i.test(content))
  addCheck("shows specific Push API unavailable message", /Push API/i.test(content))
  addCheck("shows permission denied message", /denied|رد شده/i.test(content))
  addCheck("shows permission prompt message", /اجازه|permission/i.test(content))
  addCheck("does not show generic unsupported for all failures", !/مرورگر شما از اعلان مرورگر پشتیبانی نمی‌کرد/.test(content))
  addCheck("VAPID public key checked before subscribe", /publicKey|publicKeyConfigured/.test(content))
}

function assertWebPushDiagnostics() {
  const statusRoute = "app/api/dashboard/notification-operations/web-push/status/route.ts"
  addCheck("web-push status route exists", exists(statusRoute))
  if (exists(statusRoute)) {
    const content = read(statusRoute)
    addCheck("status exposes ok boolean", /ok/.test(content))
    addCheck("status exposes secureContextRequired", /secureContextRequired/.test(content))
    addCheck("status exposes vapidPublicKeyConfigured", /vapidPublicKeyConfigured/.test(content))
    addCheck("status exposes vapidPrivateKeyConfigured", /vapidPrivateKeyConfigured/.test(content))
    addCheck("status does not expose private key value", !/WEB_PUSH_VAPID_PRIVATE_KEY/.test(content))
  }

  const envExample = ".env.example"
  if (exists(envExample)) {
    const content = read(envExample)
    addCheck(".env.example has NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY placeholder", /NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY=/.test(content))
    addCheck(".env.example has WEB_PUSH_VAPID_PRIVATE_KEY placeholder", /WEB_PUSH_VAPID_PRIVATE_KEY=/.test(content))
  }
}

function assertNoClientKeyExposure() {
  const clientFiles = [
    "components/dashboard/dashboard-push-opt-in.tsx",
    "app/[locale]/dashboard/notification-operations/page.tsx",
  ]

  for (const file of clientFiles) {
    if (!exists(file)) continue
    const content = read(file)
    addCheck(`${file} has no SMS_IR_API_KEY`, !/SMS_IR_API_KEY/.test(content))
    addCheck(`${file} has no VAPID private key`, !/VAPID_PRIVATE_KEY/.test(content))
    addCheck(`${file} has no hardcoded API key pattern`, !/bYhHp0axucDvIaskZZWHiR1ziWnaMIYt9ysiNcJCxDORGHcj/.test(content))
  }
}

assertWebPushCapabilityDetection()
assertWebPushDiagnostics()
assertNoClientKeyExposure()

const failed = checks.filter((c) => !c.ok)
console.log(JSON.stringify({ passed: checks.length - failed.length, failed: failed.length, checks }, null, 2))

if (failed.length > 0) {
  process.exit(1)
}
