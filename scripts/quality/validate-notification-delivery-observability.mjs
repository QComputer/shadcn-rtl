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

const schema = exists("prisma/schema.prisma") ? read("prisma/schema.prisma") : ""
const recorder = exists("lib/notifications/delivery-attempt-recorder.ts") ? read("lib/notifications/delivery-attempt-recorder.ts") : ""
const operationalRouter = exists("lib/notifications/operational-router.ts") ? read("lib/notifications/operational-router.ts") : ""
const customerRouter = exists("lib/notifications/customer-order-lifecycle-router.ts") ? read("lib/notifications/customer-order-lifecycle-router.ts") : ""
const router = exists("lib/notifications/router.ts") ? read("lib/notifications/router.ts") : ""
const smsIndex = exists("lib/sms/index.ts") ? read("lib/sms/index.ts") : ""
const webPushService = exists("lib/services/web-push-foundation.service.ts") ? read("lib/services/web-push-foundation.service.ts") : ""
const dashboardPage = exists("app/[locale]/dashboard/notification-operations/page.tsx") ? read("app/[locale]/dashboard/notification-operations/page.tsx") : ""
const apiRoute = exists("app/api/dashboard/notification-operations/route.ts") ? read("app/api/dashboard/notification-operations/route.ts") : ""

add("delivery attempt recorder exists", exists("lib/notifications/delivery-attempt-recorder.ts") && /DeliveryAttemptRecorder/.test(recorder));
add("schema has NotificationDeliveryAttempt model", /model NotificationDeliveryAttempt/.test(schema));
add("schema has attempt status enum", /enum NotificationDeliveryAttemptStatus/.test(schema));
add("statuses include SENT/DRY_RUN/SKIPPED/FAILED or equivalent", /SENT|DRY_RUN|SKIPPED|FAILED/.test(schema));
add("channels include IN_APP/WEB_PUSH/SMS or equivalent", /IN_APP|WEB_PUSH|SMS/.test(schema));
add("metadata field exists for sanitized context", /metadata\s+Json\?/.test(schema));

add("staff operational in-app records attempts", /deliveryAttemptRecorder\.record/.test(operationalRouter) && /IN_APP/.test(operationalRouter));
add("staff operational web push records attempts", /deliveryAttemptRecorder\.record/.test(operationalRouter) && /WEB_PUSH/.test(operationalRouter));

add("customer lifecycle guest dry-run records attempts", /deliveryAttemptRecorder\.record/.test(customerRouter) && /DRY_RUN/.test(customerRouter));

add("router records IN_APP attempts", /deliveryAttemptRecorder\.record/.test(router) && /IN_APP/.test(router));
add("router records WEB_PUSH attempts", /deliveryAttemptRecorder\.record/.test(router) && /WEB_PUSH/.test(router));
add("router records SMS attempts", /deliveryAttemptRecorder\.record/.test(router) && /SMS/.test(router));

add("sms service records attempts", /deliveryAttemptRecorder\.record/.test(smsIndex));
add("web push service records attempts", /deliveryAttemptRecorder\.record/.test(webPushService));

add("metadata sanitization exists", /sanitizeMetadata|sanitizeText/.test(recorder));
add("secrets are not stored in metadata", !/API_KEY|SECRET|PRIVATE_KEY|PASSWORD/.test(recorder));
add("lastErrorText is truncated/sanitized", /lastErrorText/.test(recorder) && /500/.test(recorder));

add("dashboard observability page exists", exists("app/[locale]/dashboard/notification-operations/page.tsx"));
add("dashboard page shows recent attempts", /recentAttempts| attempts/.test(dashboardPage));
add("Persian observability labels exist", /وضعیت/.test(dashboardPage) && /تلاش/.test(dashboardPage));

add("dashboard API requires auth", /requireAuthSession/.test(apiRoute));
add("dashboard API requires organization access", /requireOrgAccess/.test(apiRoute));

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
}

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} notification delivery observability validation check(s) failed.`);
  process.exit(1);
}
