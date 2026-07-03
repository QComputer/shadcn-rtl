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

const envExample = read(".env.example");
const smsProvider = read("lib/sms/sms-provider.ts");
const smsIndex = read("lib/sms/index.ts");
const customerRouter = read("lib/notifications/customer-order-lifecycle-router.ts");
const orderService = read("lib/services/order.service.ts");
const appDir = fs.readdirSync(path.join(root, "app")).filter((f) => f.startsWith("[")).join(",")

add("SMS_REAL_SEND_ENABLED defaults false in .env.example", /SMS_REAL_SEND_ENABLED=false|SMS_REAL_SEND_ENABLED=0/.test(envExample));
add("SMS_DRY_RUN defaults true in .env.example", /SMS_DRY_RUN=true/.test(envExample));
add("real send requires explicit ACK", /SMS_IR_ALLOW_REAL_SEND_ACK=|DEPLOYED_ALLOW_REAL_SMS=1|SMS_REAL_SEND_OPERATOR_CONFIRMED=1/.test(envExample));
add("guest real send defaults false", /SMS_GUEST_REAL_SEND_ENABLED=false/.test(envExample));
add("guest real send requires separate ACK if implemented", /SMS_GUEST_ALLOW_REAL_SEND_ACK/.test(envExample));
add("tests/smoke cannot send real SMS", !exists("tests/smoke") || !/SMS_DRY_RUN\s*=\s*false/.test(read("tests/smoke/package.json")));

const clientSources = fs.readdirSync(path.join(root, "app")).flatMap((dir) => {
  const dirPath = path.join(root, "app", dir)
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return []
  return fs.readdirSync(dirPath).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts")).map((f) => path.join("app", dir, f))
})
const clientCode = clientSources.filter((f) => exists(f)).map((f) => read(f)).join("\n")
add("no direct sms.ir call from browser", !/api\.sms\.ir/.test(clientCode));

add("no pasted API key or hardcoded API key appears in source", (() => {
  const smsFiles = fs.readdirSync(path.join(root, "lib", "sms")).filter((f) => f.endsWith(".ts")).map((f) => path.join("lib", "sms", f))
  const files = smsFiles.filter((f) => exists(f)).map((f) => read(f)).join("\n")
  return !/sms\.ir.*api.*key.*=.*["'][^"']{10,}["']/.test(files) && !/SMS_IR_API_KEY\s*[:=]\s*["'][^"']{10,}["']/.test(files)
})());
add("SMS provider secret is not logged", !/console\.log.*SMS_IR_API_KEY|log.*SMS_IR_API_KEY|SMS_IR_API_KEY.*log/.test(smsProvider));
add("failure cannot break order notification flows", /try\s*\{|\.catch\(/.test(customerRouter) && /non-blocking/.test(customerRouter));

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
}

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} SMS real-send gates validation check(s) failed.`);
  process.exit(1);
}
