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
const reportValidation = exists("lib/sms/sms-ir-report-validation.ts")
  ? read("lib/sms/sms-ir-report-validation.ts")
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
const dashboardPage = exists("app/[locale]/dashboard/notification-operations/page.tsx")
  ? read("app/[locale]/dashboard/notification-operations/page.tsx")
  : "";

add("official endpoint /v1/send/{messageId} implemented", /\/v1\/send\/\${encodeURIComponent\(String\(messageId\)\)}/.test(smsIrClient));
add("official endpoint /v1/send/pack implemented", /\/v1\/send\/pack\?/.test(smsIrClient) || /\/v1\/send\/pack/.test(smsIrClient));
add("official endpoint /v1/send/pack/{packId} implemented", /\/v1\/send\/pack\/\${encodeURIComponent\(packId\)}/.test(smsIrClient));
add("official endpoint /v1/send/live implemented", /\/v1\/send\/live\?/.test(smsIrClient));
add("official endpoint /v1/send/archive implemented", /\/v1\/send\/archive\?/.test(smsIrClient));
add("no undocumented sms.ir report endpoint is hardcoded", !/\/v1\/report/.test(reportService) && !/report\?/.test(reportService));
add("report client is server-only", /validateServerOnly/.test(smsIrClient));
add("SMS_IR_API_KEY is server-only", !/process\.env\.SMS_IR_API_KEY/.test(reportService.replace(/\/\*.*?\*\//gs, "").replace(/\/\/.*$/gm, "")) || /server-only/.test(smsIrClient));
add("messageId/packId/page/date validation exists", /validateMessageId|validatePackId|validatePagination|validateArchiveInput/.test(reportValidation));
add("provider report response parsing exists", /SmsIrMessageReport|SmsIrPackMessage|deliveryState|deliveryDateTime/.test(reportService));
add("mobile masking exists", /maskMobile/.test(reportService) || /maskMobile/.test(reportValidation));
add("reconcile route is POST-only", /POST/.test(reconcileRoute) && /Method Not Allowed/.test(reconcileRoute));
add("reconciliation does not send SMS", !/sendText|sendBulk|sendLikeToLike/.test(reconcileRoute));
add("reconciliation does not mutate order status/payment status", !/orderStatus|paymentStatus/.test(reconcileRoute));
add("provider raw metadata is sanitized/truncated if stored", /sanitizeText|truncate|slice\(0/.test(reportService));
add("provider report failures are safe", /Failed to fetch message report|Provider report fetch failed|catch/.test(reportService));
add("Persian report labels exist", /reportByMessageId|گزارش پیامک بر اساس شناسه/.test(dashboardPage));
add("package exposes P120E report endpoint validator", /quality:sms-provider-report-endpoints/.test(packageJson));

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
}

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} SMS provider report endpoint validation check(s) failed.`);
  process.exit(1);
}
