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

const smsIrClient = exists("lib/sms/sms-ir-client.server.ts")
  ? read("lib/sms/sms-ir-client.server.ts")
  : "";
const smsIrProvider = read("lib/sms/sms-ir-provider.ts");
const smsTypes = read("lib/sms/sms.types.ts");
const smsIndex = read("lib/sms/index.ts");
const phoneNorm = read("lib/sms/phone-normalization.ts");
const smsValidation = read("lib/sms/sms-ir-validation.ts");
const envExample = read(".env.example");
const router = read("lib/notifications/router.ts");
const customerRouter = read("lib/notifications/customer-order-lifecycle-router.ts");
const deliveryRecorder = read("lib/notifications/delivery-attempt-recorder.ts");
const dashboardStatus = exists("app/api/dashboard/notification-operations/sms-ir/status/route.ts")
  ? read("app/api/dashboard/notification-operations/sms-ir/status/route.ts")
  : "";
const dashboardLines = exists("app/api/dashboard/notification-operations/sms-ir/lines/route.ts")
  ? read("app/api/dashboard/notification-operations/sms-ir/lines/route.ts")
  : "";
const dashboardPage = exists("app/[locale]/dashboard/notification-operations/page.tsx")
  ? read("app/[locale]/dashboard/notification-operations/page.tsx")
  : "";

add("sms.ir client exists", exists("lib/sms/sms-ir-client.server.ts"));
add("client is server-only", /validateServerOnly|typeof window/.test(smsIrClient));
add("GET /v1/line implemented", /\/v1\/line/.test(smsIrClient));
add("POST /v1/send/bulk implemented", /\/v1\/send\/bulk/.test(smsIrClient));
add("POST /v1/send/likeToLike implemented", /\/v1\/send\/likeToLike/.test(smsIrClient));
add("X-API-KEY is only used server-side", /X-API-KEY/.test(smsIrClient));
add("SMS_IR_API_KEY is not referenced in client components", !/process\.env\.SMS_IR_API_KEY/.test(dashboardPage));
add("request body uses lineNumber/messageText/mobiles/sendDateTime", /lineNumber|messageText|mobiles|sendDateTime/.test(smsIrClient));
add("likeToLike uses messageTexts/mobiles", /messageTexts|mobiles/.test(smsIrClient));
add("max 100 recipients enforced", /100/.test(smsValidation));
add("phone normalization exists", exists("lib/sms/phone-normalization.ts"));
add("schedule validation exists", exists("lib/sms/sms-ir-validation.ts"));
add("provider response status === 1 required", /status === 1|status !== 1/.test(smsIrClient));
add("packId/messageIds/cost parsed", /packId|messageIds|cost/.test(smsIrClient));
add("delivery attempts recorded", /deliveryAttemptRecorder/.test(smsIndex));
add("dashboard diagnostic status does not expose secret", !/SMS_IR_API_KEY|X-API-KEY/.test(dashboardStatus));

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
}

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} SMS.ir provider completion validation check(s) failed.`);
  process.exit(1);
}
