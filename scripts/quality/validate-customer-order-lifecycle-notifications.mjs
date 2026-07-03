#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function add(name, pass, detail = "") {
  checks.push({ name, pass: Boolean(pass), detail });
}

const router = exists("lib/notifications/customer-order-lifecycle-router.ts")
  ? read("lib/notifications/customer-order-lifecycle-router.ts")
  : "";
const orderService = read("lib/services/order.service.ts");
const templates = read("lib/notifications/templates.ts");
const operationalRouter = read("lib/notifications/operational-router.ts");

add("customer lifecycle notification router exists", exists("lib/notifications/customer-order-lifecycle-router.ts") && /CustomerOrderLifecycleRouter/.test(router));
add("router handles order status notifications", /notifyOrderStatusChangedSafe/.test(router));
add("router handles payment status notifications", /notifyPaymentStatusChangedSafe/.test(router));
add("router skips unchanged status", /previousStatus === newStatus/.test(router) || /previousStatus\s*===\s*newStatus/.test(router));
add("router catches notification errors", /catch\s*\(error\)/.test(router) && /non-blocking/.test(router));
add("router does not throw into caller", !/throw/.test(router.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")));

const updateStatusMethod = orderService.slice(
  orderService.indexOf("async updateStatus("),
  orderService.indexOf("async updateEstimatedEndTime(")
);
const updatePaymentMethod = orderService.slice(
  orderService.indexOf("async updatePaymentStatus("),
  orderService.indexOf("async assignDriver(")
);

add("updateStatus calls customer notification after success", /customerOrderLifecycleRouter\.notifyOrderStatusChangedSafe/.test(updateStatusMethod));
add("updateStatus includes customer context", /customer:/.test(updateStatusMethod) && /guestCustomer:/.test(updateStatusMethod));
add("updateStatus notification is non-blocking", /\.catch\(/.test(updateStatusMethod) && /non-blocking/.test(updateStatusMethod));
add("updateStatus revalidates after mutation", /revalidatePath/.test(updateStatusMethod));
add("updateStatus preserves P120A flow", !/notifyOrderCreatedForStaff/.test(updateStatusMethod));

add("updatePaymentStatus calls customer notification after success", /customerOrderLifecycleRouter\.notifyPaymentStatusChangedSafe/.test(updatePaymentMethod));
add("updatePaymentStatus includes customer context", /customerId:/.test(updatePaymentMethod) && /guestCustomer:/.test(updatePaymentMethod));
add("updatePaymentStatus notification is non-blocking", /\.catch\(/.test(updatePaymentMethod) && /non-blocking/.test(updatePaymentMethod));
add("updatePaymentStatus revalidates after mutation", /revalidatePath/.test(updatePaymentMethod));

add("existing order_status_updated template exists", /order_status_updated/.test(templates));
add("existing payment_status_updated template exists", /payment_status_updated/.test(templates));
add("templates are Persian-first", /سفارش/.test(templates) && /پرداخت/.test(templates));

add("guest in-app notification not attempted", !/notification\.create/.test(router) || !/guestCustomerId/.test(router));
add("guest Web Push not attempted", !/webPushFoundationService/.test(router) || !/guestCustomerId/.test(router));

add("customer routing uses notificationRouterService", /notificationRouterService\.routeCustomerNotification/.test(router));
add("customer routing respects dry-run fallback", /dryRun:\s*false/.test(router) || /dryRun:\s*true/.test(router));

add("operational staff flow preserved", /notifyOrderCreatedForStaff/.test(orderService));

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
}

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} customer order lifecycle notification validation check(s) failed.`);
  process.exit(1);
}
