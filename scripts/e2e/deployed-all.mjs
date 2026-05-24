#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const phases = [
  ["Phase 1", "scripts/e2e/deployed-phase1-security.mjs"],
  ["Phase 2", "scripts/e2e/deployed-phase2-resource-ownership.mjs"],
  ["Phase 3", "scripts/e2e/deployed-phase3-membership-rbac.mjs"],
  ["Phase 4", "scripts/e2e/deployed-phase4-appointments.mjs"],
  ["Phase 5", "scripts/e2e/deployed-phase5-order-payment.mjs"],
  ["Phase 6", "scripts/e2e/deployed-phase6-calendar.mjs"],
  ["Phase 7", "scripts/e2e/deployed-phase7-media.mjs"],
  ["Phase 8", "scripts/e2e/deployed-phase8-audit-softdelete-notifications.mjs"],
  ["Phase 9", "scripts/e2e/deployed-phase9-quality-gates.mjs"],
  ["Phase 10", "scripts/e2e/deployed-phase10-auth-security.mjs"],
  ["Phase 11", "scripts/e2e/deployed-phase11-health.mjs"],
  ["Phase 12", "scripts/e2e/deployed-phase12-messaging.mjs"],
  ["Phase 13", "scripts/e2e/deployed-phase13-catalog-hardening.mjs"],
  ["Phase 14", "scripts/e2e/deployed-phase14-inventory-operations.mjs"],
  ["Phase 15", "scripts/e2e/deployed-phase15-public-order-tracking.mjs"],
  ["Phase 16", "scripts/e2e/deployed-phase16-engagement.mjs"],
  ["Phase 17", "scripts/e2e/deployed-phase17-account-settings.mjs"],
];

if (!process.env.DEPLOYED_URL) {
  console.error("DEPLOYED_URL is required, for example: $env:DEPLOYED_URL='https://zc0.runflare.run'; npm run e2e:deployed:all");
  process.exit(1);
}

const results = [];
for (const [name, script] of phases) {
  console.log(`\n=== ${name}: ${script} ===`);
  const result = spawnSync(process.execPath, [script], {
    stdio: "inherit",
    env: process.env,
  });
  results.push({ name, ok: result.status === 0 });
  if (result.status !== 0) break;
}

console.log("\nAggregate deployed smoke summary:");
console.table(results);
if (results.some((result) => !result.ok)) process.exit(1);
