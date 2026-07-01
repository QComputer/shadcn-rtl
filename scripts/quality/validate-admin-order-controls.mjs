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

const ordersPage = exists("app/[locale]/dashboard/orders/page.tsx") ? read("app/[locale]/dashboard/orders/page.tsx") : ""
const orderRoutes = exists("app/api/orders/[id]/route.ts") ? read("app/api/orders/[id]/route.ts") : ""
const orderService = exists("lib/services/order.service.ts") ? read("lib/services/order.service.ts") : ""

add("Admin order UI exists", exists("app/[locale]/dashboard/orders/page.tsx"))
add("Order status transitions are defined", /ALLOWED_ORDER_STATUS_TRANSITIONS/.test(orderService))
add("assertAllowedStatusTransition is used", /assertAllowedStatusTransition/.test(orderService))
add("Payment controls exist", /paymentStatus/.test(ordersPage) && /handleUpdatePaymentStatus/.test(ordersPage))
add("Driver controls exist", /assignedDriver/.test(ordersPage) && /assignDriver/.test(ordersPage))
add("Clear/change driver is explicit", /Remove/.test(ordersPage) || /assignDriver.*""/.test(ordersPage) || /change.*driver/.test(ordersPage.toLowerCase()))
add("Persian labels exist", /وضعیت/.test(ordersPage) && /پرداخت/.test(ordersPage))
add("Order mutation routes use POST/PUT not GET", /export async function PUT/.test(orderRoutes) && !/export async function GET.*status/.test(orderRoutes))
add("Tenant/role guards are used in order routes", /requireOrderAccess|requireAuthSession/.test(orderRoutes))
add("Existing orderService transition validation is reused", /orderService/.test(orderRoutes) && /updateStatus/.test(orderRoutes))
add("Payment status controls have proper states", /COMPLETED|FAILED|REFUNDED/.test(ordersPage) && /paymentStatus/.test(ordersPage))
add("Driver dropdown shows driver options", /drivers\.map/.test(ordersPage))

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length > 0) {
  console.error(`\n${failed.length} admin order controls validation check(s) failed.`)
  process.exit(1)
}