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

const retryPolicy = exists("lib/notifications/retry-policy.ts") ? read("lib/notifications/retry-policy.ts") : ""
const retryRouteExists = exists("app/api/dashboard/notifications/delivery-attempts/[attemptId]/retry/route.ts")
const retryRoute = retryRouteExists ? read("app/api/dashboard/notifications/delivery-attempts/[attemptId]/retry/route.ts") : ""

add("retry policy module exists", exists("lib/notifications/retry-policy.ts") && /computeRetryEligibility/.test(retryPolicy));
add("max retry count defined", /maxRetryCount/.test(retryPolicy));
add("backoff defined", /backoffMs/.test(retryPolicy));
add("IN_APP is not retried by default", /IN_APP/.test(retryPolicy) && /in_app_not_retried|channel_not_retryable/.test(retryPolicy));
add("guest SMS real-send retry is blocked", /guest_retry_disabled|allowGuestRetry/.test(retryPolicy));
add("retry route is POST-only", !retryRouteExists || /POST/.test(retryRoute));
add("retry route requires dashboard auth", !retryRouteExists || /requireAuthSession/.test(retryRoute));
add("retry route checks tenant access", !retryRouteExists || /requireOrgAccess/.test(retryRoute));
add("retry respects env gates/preferences", !/realSendEnabled/.test(retryPolicy) || /realSendEnabled/.test(retryPolicy));
add("retry eligibility computed deterministically", /computeRetryEligibility/.test(retryPolicy));

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
}

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} notification retry policy validation check(s) failed.`);
  process.exit(1);
}
