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

const operationalRouter = exists("lib/notifications/operational-router.ts") ? read("lib/notifications/operational-router.ts") : ""
const orderService = exists("lib/services/order.service.ts") ? read("lib/services/order.service.ts") : ""
const dashboardPushRoute = exists("app/api/dashboard/push-subscriptions/route.ts") ? read("app/api/dashboard/push-subscriptions/route.ts") : ""
const pushOptIn = exists("components/dashboard/dashboard-push-opt-in.tsx") ? read("components/dashboard/dashboard-push-opt-in.tsx") : ""
const webPushFoundation = exists("lib/services/web-push-foundation.service.ts") ? read("lib/services/web-push-foundation.service.ts") : ""

add("Operational notification router exists", exists("lib/notifications/operational-router.ts"))
add("Operational router targets ADMIN/MANAGER/STAFF roles only", /ADMIN.*MANAGER.*STAFF/.test(operationalRouter) && /OPERATIONAL_ROLES/.test(operationalRouter))
add("CUSTOMER and GUEST excluded from operational recipients", /CUSTOMER.*GUEST/.test(operationalRouter) || !/CUSTOMER/.test(operationalRouter.split("OPERATIONAL_ROLES")[0] || ""))
add("DRIVER excluded from new-order shop-action recipients", !operationalRouter.includes("DRIVER") || operationalRouter.includes('"ADMIN"') && operationalRouter.includes('"MANAGER"') && operationalRouter.includes('"STAFF"'))
add("organizationId is set on staff notifications", /organizationId/.test(operationalRouter))
add("ORDER_CREATED type is set on staff notifications", /type:\s*"ORDER_CREATED"/.test(operationalRouter))
add("Active member filtering exists", /isActive:\s*true/.test(operationalRouter))
add("Inactive members excluded from notifications", /user:\s*\{[\s\S]*isActive:\s*true[\s\S]*deletedAt:\s*null/.test(operationalRouter))
add("Persian context in operational notifications", /سفارش جدید/.test(operationalRouter))
add("Web Push failure is caught and non-blocking", /\.catch/.test(orderService) && /Web Push notification failed/.test(orderService))
add("Registered checkout calls operational notification path", /operationalNotificationRouter\.notifyOrderCreatedForStaff/.test(orderService))
add("Guest checkout calls operational notification path", /operationalNotificationRouter\.notifyOrderCreatedForStaff/.test(orderService) && /createForGuest/.test(orderService))
add("Dashboard push subscription route exists", exists("app/api/dashboard/push-subscriptions/route.ts"))
add("Dashboard push route requires auth and exact tenant context", /requireAuthSession/.test(dashboardPushRoute) && /requireTenantContext/.test(dashboardPushRoute))
add("Dashboard push route permits each supported tenant member role", /\["ADMIN",\s*"MANAGER",\s*"STAFF",\s*"DRIVER"\]/.test(dashboardPushRoute) && /recipientRole:\s*role/.test(dashboardPushRoute))
add("Dashboard push opt-in component exists", exists("components/dashboard/dashboard-push-opt-in.tsx"))
add("Dashboard push opt-in has Persian copy", /اعلان مرورگر/.test(pushOptIn))
add("Dashboard push opt-in does not expose private key", !pushOptIn.includes("VAPID_PRIVATE") && !pushOptIn.includes("privateKey"))
add("Web Push private key is server-only", !webPushFoundation.includes("NEXT_PUBLIC_") || webPushFoundation.includes("WEB_PUSH_VAPID_PRIVATE_KEY"))
add("No SMS real-send added for admin order notifications", !operationalRouter.includes("sms") && !operationalRouter.includes("SMSService"))

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length > 0) {
  console.error(`\n${failed.length} order operational notification validation check(s) failed.`)
  process.exit(1)
}
