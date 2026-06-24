#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const results = [];

function ok(name, detail = "") {
  results.push({ name, ok: true, detail });
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function walk(dir, exts, out = []) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(entry.name)) continue;
    const rel = path.join(dir, entry.name).replaceAll(path.sep, "/");
    if (entry.isDirectory()) walk(rel, exts, out);
    else if (exts.some((ext) => rel.endsWith(ext))) out.push(rel);
  }
  return out;
}

try {
  JSON.parse(read("package.json"));
  ok("package.json parses");
} catch (error) {
  fail("package.json parses", error.message);
}

for (const rel of [
  "README.md",
  "docs/PHASE_1_SECURITY_DASHBOARD_API.md",
  "docs/PHASE_2_RESOURCE_OWNERSHIP.md",
  "docs/PHASE_3_MEMBERSHIP_RBAC.md",
  "docs/PHASE_4_APPOINTMENT_CORRECTNESS.md",
  "docs/PHASE_5_ORDER_PAYMENT_HARDENING.md",
  "docs/PHASE_6_DASHBOARD_CALENDAR.md",
  "docs/PHASE_7_MEDIA_HARDENING.md",
  "docs/PHASE_8_AUDIT_SOFTDELETE_NOTIFICATIONS.md",
  "docs/PHASE_9_QUALITY_GATES.md",
  "docs/PHASE_10_AUTH_SECURITY.md",
  "docs/PHASE_11_HEALTH_ENVIRONMENT.md",
  "docs/PHASE_12_MESSAGING_HARDENING.md",
  "docs/PHASE_13_CATALOG_HARDENING.md",
  "docs/PHASE_14_INVENTORY_OPERATIONS.md",
  "docs/PHASE_15_PUBLIC_ORDER_TRACKING.md",
  "docs/PHASE_16_PUBLIC_ENGAGEMENT.md",
  "docs/PHASE_17_ACCOUNT_SETTINGS.md",
  "docs/PHASE_18_PRODUCTION_INTEGRITY_SMS_READINESS.md",
  "docs/PHASE_19_RBAC_AUTH_DASHBOARD_ACCESS.md",
  "docs/PHASE_20_API_SERVICE_CONSISTENCY.md",
  "docs/PHASE_22_GET_PURITY_API_NORMALIZATION.md",
  "docs/PHASE_23_TENANT_DATABASE_DRIFT_AUDIT.md",
  "docs/PHASE_24_TENANT_IDENTITY_AUDIT_GUARDRAILS.md",
  "docs/PHASE_25_COMMERCE_CORRECTNESS_GUARDRAILS.md",
  "docs/PHASE_26_APPOINTMENT_CORRECTNESS_GUARDRAILS.md",
  "docs/PHASE_26A_ORDER_ORGANIZATION_SLUG_DB_COMPATIBILITY_HOTFIX.md",
  "docs/PHASE_26B_ORDER_DELETED_AT_DB_COMPATIBILITY_HOTFIX.md",
  "docs/PHASE_27_I18N_RTL_COMPLETION_AUDIT.md",
  "docs/PHASE_28_FOLLOW_FANPAGE_READINESS_CLEANUP.md",
  "docs/PHASE_29_PUBLIC_EXPERIENCE_COMPLETION.md",
  "docs/PHASE_30_FANPAGE_MVP.md",
  "docs/PHASE_31_I18N_COMPLETION_PASS.md",
]) {
  exists(rel) ? ok(`${rel} exists`) : fail(`${rel} exists`);
}

const sourceFiles = walk("app", [".ts", ".tsx", ".js", ".mjs"])
  .concat(walk("lib", [".ts", ".tsx", ".js", ".mjs"]))
  .concat(walk("components", [".ts", ".tsx", ".js", ".mjs"]))
  .concat(walk("scripts/e2e", [".ts", ".tsx", ".js", ".mjs"]));

const stalePatterns = [
  { name: "no direct NextAuth ReturnType typing", pattern: /ReturnType<typeof auth>/ },
  { name: "no unsafe SessionWithUser cast", pattern: /as\s+SessionWithUser/ },
  { name: "no guest password fallback", pattern: /password\s*:\s*["']123456["']/ },
  { name: "no public order payment update body", pattern: /paymentId\s*=\s*body\.paymentId/ },
  { name: "no updateManyAndReturn usage", pattern: /updateManyAndReturn/ },
];

for (const check of stalePatterns) {
  const offenders = [];
  for (const file of sourceFiles) {
    const text = read(file);
    if (check.pattern.test(text)) offenders.push(file);
  }
  offenders.length ? fail(check.name, offenders.join(", ")) : ok(check.name);
}

const e2eScripts = Array.from({ length: 9 }, (_, index) => `scripts/e2e/deployed-phase${index + 1}${index + 1 === 8 ? "-audit-softdelete-notifications" : ""}.mjs`);
const expectedE2E = [
  "scripts/e2e/deployed-phase1-security.mjs",
  "scripts/e2e/deployed-phase2-resource-ownership.mjs",
  "scripts/e2e/deployed-phase3-membership-rbac.mjs",
  "scripts/e2e/deployed-phase4-appointments.mjs",
  "scripts/e2e/deployed-phase5-order-payment.mjs",
  "scripts/e2e/deployed-phase6-calendar.mjs",
  "scripts/e2e/deployed-phase7-media.mjs",
  "scripts/e2e/deployed-phase8-audit-softdelete-notifications.mjs",
  "scripts/e2e/deployed-phase9-quality-gates.mjs",
  "scripts/e2e/deployed-phase10-auth-security.mjs",
  "scripts/e2e/deployed-phase11-health.mjs",
  "scripts/e2e/deployed-phase12-messaging.mjs",
  "scripts/e2e/deployed-phase13-catalog-hardening.mjs",
  "scripts/e2e/deployed-phase14-inventory-operations.mjs",
  "scripts/e2e/deployed-phase15-public-order-tracking.mjs",
  "scripts/e2e/deployed-phase16-engagement.mjs",
  "scripts/e2e/deployed-phase17-account-settings.mjs",
  "scripts/e2e/deployed-all.mjs",
];
for (const rel of expectedE2E) {
  exists(rel) ? ok(`${rel} exists`) : fail(`${rel} exists`);
}

for (const rel of ["app/api/health/route.ts", "lib/runtime-env.ts", "scripts/quality/validate-env.mjs", "scripts/quality/validate-release-artifact.mjs", "scripts/quality/validate-get-purity.mjs", "scripts/quality/validate-database-drift.mjs", "scripts/quality/validate-tenant-identity.mjs", "scripts/quality/validate-commerce-correctness.mjs", "scripts/quality/validate-appointment-correctness.mjs", "scripts/quality/validate-i18n-rtl-audit.mjs", "scripts/quality/validate-i18n-completion.mjs", "scripts/quality/validate-fanpage-readiness.mjs",
  "scripts/quality/validate-public-experience.mjs", "scripts/quality/validate-fanpage-mvp.mjs", "scripts/db/repair-known-database-drift.mjs", "scripts/db/known-database-drift-repair.sql"]) {
  exists(rel) ? ok(`${rel} exists`) : fail(`${rel} exists`);
}

for (const rel of ["scripts/e2e/deployed-phase9-quality-gates.mjs", "scripts/e2e/deployed-phase10-auth-security.mjs", "scripts/e2e/deployed-phase11-health.mjs", "scripts/e2e/deployed-phase12-messaging.mjs", "scripts/e2e/deployed-phase13-catalog-hardening.mjs", "scripts/e2e/deployed-phase14-inventory-operations.mjs", "scripts/e2e/deployed-phase15-public-order-tracking.mjs", "scripts/e2e/deployed-phase16-engagement.mjs", "scripts/e2e/deployed-phase17-account-settings.mjs", "scripts/e2e/deployed-all.mjs", "scripts/quality/validate-env.mjs", "scripts/quality/validate-dashboard-access.mjs", "scripts/quality/validate-api-service-safety.mjs", "scripts/quality/validate-release-artifact.mjs", "scripts/quality/validate-get-purity.mjs", "scripts/quality/validate-database-drift.mjs", "scripts/quality/validate-tenant-identity.mjs", "scripts/quality/validate-commerce-correctness.mjs", "scripts/quality/validate-appointment-correctness.mjs", "scripts/quality/validate-i18n-rtl-audit.mjs", "scripts/quality/validate-i18n-completion.mjs", "scripts/quality/validate-fanpage-readiness.mjs",
  "scripts/quality/validate-public-experience.mjs", "scripts/quality/validate-fanpage-mvp.mjs", "scripts/db/repair-known-database-drift.mjs"]) {
  if (!exists(rel)) continue;
  const result = spawnSync(process.execPath, ["--check", rel], { cwd: root, encoding: "utf8" });
  result.status === 0 ? ok(`${rel} syntax`) : fail(`${rel} syntax`, result.stderr || result.stdout);
}


if (exists("scripts/quality/validate-api-service-safety.mjs")) {
  const result = spawnSync(process.execPath, ["scripts/quality/validate-api-service-safety.mjs"], { cwd: root, encoding: "utf8" });
  result.status === 0 ? ok("P20 API/service safety validator passes") : fail("P20 API/service safety validator passes", result.stderr || result.stdout);
}

if (exists("scripts/quality/validate-get-purity.mjs")) {
  const result = spawnSync(process.execPath, ["scripts/quality/validate-get-purity.mjs"], { cwd: root, encoding: "utf8" });
  result.status === 0 ? ok("P22 GET purity validator passes") : fail("P22 GET purity validator passes", result.stderr || result.stdout);
}

if (exists("scripts/quality/validate-tenant-identity.mjs")) {
  const result = spawnSync(process.execPath, ["scripts/quality/validate-tenant-identity.mjs"], { cwd: root, encoding: "utf8" });
  result.status === 0 ? ok("P24 tenant identity validator passes") : fail("P24 tenant identity validator passes", result.stderr || result.stdout);
}

if (exists("scripts/quality/validate-commerce-correctness.mjs")) {
  const result = spawnSync(process.execPath, ["scripts/quality/validate-commerce-correctness.mjs"], { cwd: root, encoding: "utf8" });
  result.status === 0 ? ok("P25 commerce correctness validator passes") : fail("P25 commerce correctness validator passes", result.stderr || result.stdout);
}

if (exists("scripts/quality/validate-appointment-correctness.mjs")) {
  const result = spawnSync(process.execPath, ["scripts/quality/validate-appointment-correctness.mjs"], { cwd: root, encoding: "utf8" });
  result.status === 0 ? ok("P26 appointment correctness validator passes") : fail("P26 appointment correctness validator passes", result.stderr || result.stdout);
}

if (exists("scripts/quality/validate-i18n-rtl-audit.mjs")) {
  const result = spawnSync(process.execPath, ["scripts/quality/validate-i18n-rtl-audit.mjs"], { cwd: root, encoding: "utf8" });
  result.status === 0 ? ok("P27 i18n/RTL audit validator passes") : fail("P27 i18n/RTL audit validator passes", result.stderr || result.stdout);
}


if (exists("scripts/quality/validate-i18n-completion.mjs")) {
  const result = spawnSync(process.execPath, ["scripts/quality/validate-i18n-completion.mjs"], { cwd: root, encoding: "utf8" });
  result.status === 0 ? ok("P31 i18n completion validator passes") : fail("P31 i18n completion validator passes", result.stderr || result.stdout);
}

if (exists("scripts/quality/validate-fanpage-readiness.mjs")) {
  const result = spawnSync(process.execPath, ["scripts/quality/validate-fanpage-readiness.mjs"], { cwd: root, encoding: "utf8" });
  result.status === 0 ? ok("P28 fanpage readiness validator passes") : fail("P28 fanpage readiness validator passes", result.stderr || result.stdout);
}

if (exists("scripts/quality/validate-public-experience.mjs")) {
  const result = spawnSync(process.execPath, ["scripts/quality/validate-public-experience.mjs"], { cwd: root, encoding: "utf8" });
  result.status === 0 ? ok("P29 public experience validator passes") : fail("P29 public experience validator passes", result.stderr || result.stdout);
}

if (exists("scripts/quality/validate-fanpage-mvp.mjs")) {
  const result = spawnSync(process.execPath, ["scripts/quality/validate-fanpage-mvp.mjs"], { cwd: root, encoding: "utf8" });
  result.status === 0 ? ok("P30 fanpage MVP validator passes") : fail("P30 fanpage MVP validator passes", result.stderr || result.stdout);
}

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`Project validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}
console.log("Project validation passed.");
