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

function add(name, pass) {
  checks.push({ name, pass: Boolean(pass) });
}

const reportService = exists("lib/sms/sms-delivery-report.service.ts")
  ? read("lib/sms/sms-delivery-report.service.ts")
  : "";
const reconcileRoute = exists("app/api/dashboard/notification-operations/sms-ir/deliveries/[deliveryId]/reconcile/route.ts")
  ? read("app/api/dashboard/notification-operations/sms-ir/deliveries/[deliveryId]/reconcile/route.ts")
  : "";
const smsIrClient = exists("lib/sms/sms-ir-client.server.ts")
  ? read("lib/sms/sms-ir-client.server.ts")
  : "";
const smsIrProvider = exists("lib/sms/sms-ir-provider.ts")
  ? read("lib/sms/sms-ir-provider.ts")
  : "";
const smsIndex = exists("lib/sms/index.ts") ? read("lib/sms/index.ts") : "";
const packageJson = read("package.json");

add("reconciliation service exists", /class SmsDeliveryReportService/.test(reportService));
add("reconcile route is POST-only", /POST/.test(reconcileRoute) && /Method Not Allowed/.test(reconcileRoute));
add("no undocumented sms.ir report endpoint is hardcoded", !/\/v1\/report/.test(reportService) && !/report\?/.test(reportService));
add("provider report unavailable/docs-required state exists", /SMS_IR_REPORT_ENDPOINT_NOT_CONFIGURED/.test(reportService));
add("provider fetch uses server-only client if implemented", /validateServerOnly/.test(smsIrClient) || !/fetch.*sms\.ir/.test(smsIrProvider));
add("SMS_IR_API_KEY is server-only", !/process\.env\.SMS_IR_API_KEY/.test(reportService.replace(/\/\*.*?\*\//gs, "").replace(/\/\/.*$/gm, "")) || /server-only/.test(smsIrClient));
add("reconciliation does not send SMS", !/sendText|sendBulk|sendLikeToLike/.test(reconcileRoute));
add("reconciliation does not mutate order status/payment status", /orderStatus|paymentStatus/.test(reconcileRoute) === false);
add("provider raw metadata is sanitized/truncated if stored", /sanitizeText|truncate|slice\(0/.test(reportService));
add("package exposes P120E reconciliation validator", /quality:sms-provider-reconciliation/.test(packageJson));

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
}

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} SMS provider reconciliation validation check(s) failed.`);
  process.exit(1);
}
