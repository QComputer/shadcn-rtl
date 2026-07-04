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
const deliveriesRoute = exists("app/api/dashboard/notification-operations/sms-ir/deliveries/route.ts")
  ? read("app/api/dashboard/notification-operations/sms-ir/deliveries/route.ts")
  : "";
const reportDetailRoute = exists("app/api/dashboard/notification-operations/sms-ir/deliveries/[deliveryId]/route.ts")
  ? read("app/api/dashboard/notification-operations/sms-ir/deliveries/[deliveryId]/route.ts")
  : "";
const reconcileRoute = exists("app/api/dashboard/notification-operations/sms-ir/deliveries/[deliveryId]/reconcile/route.ts")
  ? read("app/api/dashboard/notification-operations/sms-ir/deliveries/[deliveryId]/reconcile/route.ts")
  : "";
const dashboardPage = exists("app/[locale]/dashboard/notification-operations/page.tsx")
  ? read("app/[locale]/dashboard/notification-operations/page.tsx")
  : "";
const smsIrClient = exists("lib/sms/sms-ir-client.server.ts")
  ? read("lib/sms/sms-ir-client.server.ts")
  : "";
const smsProvider = exists("lib/sms/sms-ir-provider.ts")
  ? read("lib/sms/sms-ir-provider.ts")
  : "";
const envExample = read(".env.example");

add("SMS delivery report service exists", /class SmsDeliveryReportService/.test(reportService));
add("dashboard SMS delivery report API/page exists", exists("app/api/dashboard/notification-operations/sms-ir/deliveries/route.ts") && exists("app/[locale]/dashboard/notification-operations/page.tsx"));
add("dashboard route requires auth/tenant role guard", /requireAuthSession/.test(deliveriesRoute) && /requireOrgAccess/.test(deliveriesRoute));
add("phone masking exists in report service", /maskPhoneNumber|phoneMasked/.test(reportService));
add("full phone numbers are not exposed in dashboard DTO", !/to:\s*string/.test(dashboardPage) || /maskedPhone|phoneMasked/.test(dashboardPage));
add("packId surfaced safely in DTO", /externalPackId/.test(reportService) && /externalPackId/.test(dashboardPage));
add("messageIds surfaced safely in DTO", /externalMessageId/.test(reportService) && /externalMessageId/.test(dashboardPage));
add("dry-run/real-send labels exist in DTO", /dryRun/.test(reportService) && /dryRun/.test(dashboardPage));
add("Persian SMS report labels exist", /smsReports:|گزارش پیامک‌ها/.test(dashboardPage));
add("no API key is returned by diagnostics/report endpoint", !/SMS_IR_API_KEY|X-API-KEY/.test(deliveriesRoute) && !/SMS_IR_API_KEY|X-API-KEY/.test(reportDetailRoute));

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
}

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} SMS delivery report validation check(s) failed.`);
  process.exit(1);
}
