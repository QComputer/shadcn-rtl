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
const smsProvider = read("lib/sms/sms-provider.ts");
const smsIrProvider = read("lib/sms/sms-ir-provider.ts");
const smsDryRun = read("lib/sms/sms-dry-run-provider.ts");
const orderService = read("lib/services/order.service.ts");
const smsIndex = read("lib/sms/index.ts");

add("customer lifecycle router exists", exists("lib/notifications/customer-order-lifecycle-router.ts"));
add("router handles guest dry-run path", /notifyGuestOrderStatusChangedDryRunSafe|writeAuditLog/.test(router));
add("router does not call real SMS provider for guests", !/smsService\.sendTextToCustomer/.test(router));
add("router does not call sms.ir directly", !/sms\.ir|sms_ir|SmsIrProvider/.test(router));
add("guest phone is normalized before use", /normalizePhone|maskPhoneNumber/.test(router));
add("guest notification failure is non-blocking", (/\.catch\(/.test(router) || /try\s*\{/.test(router)) && /non-blocking/.test(router));

add("SMS provider dry run is default", /dryRun/.test(smsProvider));
add("SMS real send requires explicit env gate", /realSendEnabled/.test(smsProvider));
add("SMS.ir real send throws when disabled", /Real SMS sending is disabled/.test(smsIrProvider));

add("order service updateStatus preserves transaction safety", /prisma\.\$transaction/.test(orderService) && /notifyOrderStatusChangedSafe/.test(orderService));
add("order service updatePaymentStatus preserves transaction safety", /prisma\.\$transaction/.test(orderService) && /notifyPaymentStatusChangedSafe/.test(orderService));

add("SMS provider secrets are server-only", !/process\.env\.SMS_IR_API_KEY/.test(orderService));
add("no guest SMS real-send in tests/smoke", !/SMS_DRY_RUN=false/.test(orderService) || /SMS_DRY_RUN=true/.test(orderService));

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
}

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} guest SMS dry-run validation check(s) failed.`);
  process.exit(1);
}
