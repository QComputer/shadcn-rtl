#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = [];

function ok(name, detail = "") {
  results.push({ name, ok: true, detail });
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function add(name, condition, detail = "") {
  condition ? ok(name, detail) : fail(name, detail);
}

const schema = exists("prisma/schema.prisma") ? read("prisma/schema.prisma") : "";
const migration = exists("prisma/migrations/20260625000600_web_push_foundation/migration.sql")
  ? read("prisma/migrations/20260625000600_web_push_foundation/migration.sql")
  : "";
const service = exists("lib/services/web-push-foundation.service.ts") ? read("lib/services/web-push-foundation.service.ts") : "";
const customerRoute = exists("app/api/customer/push-subscriptions/route.ts") ? read("app/api/customer/push-subscriptions/route.ts") : "";
const dashboardRoute = exists("app/api/dashboard/customer-club/push/route.ts") ? read("app/api/dashboard/customer-club/push/route.ts") : "";
const optIn = exists("components/public/web-push-opt-in.tsx") ? read("components/public/web-push-opt-in.tsx") : "";
const profilePage = exists("app/[locale]/[slug]/shop/profile/page.tsx") ? read("app/[locale]/[slug]/shop/profile/page.tsx") : "";
const dashboardPage = exists("app/[locale]/dashboard/customer-club/push/page.tsx") ? read("app/[locale]/dashboard/customer-club/push/page.tsx") : "";
const serviceWorker = exists("public/web-push-sw.js") ? read("public/web-push-sw.js") : "";
const envValidator = exists("scripts/quality/validate-env.mjs") ? read("scripts/quality/validate-env.mjs") : "";
const runtimeEnv = exists("lib/runtime-env.ts") ? read("lib/runtime-env.ts") : "";
const policy = exists("lib/dashboard/navigation-policy.ts") ? read("lib/dashboard/navigation-policy.ts") : "";
const accessControl = exists("lib/access-control.ts") ? read("lib/access-control.ts") : "";
const membersPage = exists("app/[locale]/dashboard/customer-club/members/page.tsx") ? read("app/[locale]/dashboard/customer-club/members/page.tsx") : "";
const validateProject = exists("scripts/quality/validate-project.mjs") ? read("scripts/quality/validate-project.mjs") : "";
const packageJson = exists("package.json") ? read("package.json") : "";
const readme = exists("README.md") ? read("README.md") : "";
const sourceOfTruth = exists("docs/CURRENT_SOURCE_OF_TRUTH.md") ? read("docs/CURRENT_SOURCE_OF_TRUTH.md") : "";

function modelBlock(name) {
  return schema.match(new RegExp(`model\\s+${name}\\s*{[\\s\\S]*?\\n}`))?.[0] ?? "";
}

const permissionEventModel = modelBlock("NotificationPermissionEvent");

add("PushPermissionState enum exists", /enum\s+PushPermissionState\s*{[\s\S]*PROMPT[\s\S]*GRANTED[\s\S]*DENIED[\s\S]*UNSUPPORTED[\s\S]*REVOKED/.test(schema));
add("PushSubscription model exists", /model\s+PushSubscription\s*{/.test(schema));
add("NotificationPermissionEvent model exists", /model\s+NotificationPermissionEvent\s*{/.test(schema));
add("PushSubscription is organization/customer scoped", /model\s+PushSubscription\s*{[\s\S]*organizationId\s+String[\s\S]*customerId\s+String/.test(schema));
add("PushSubscription stores browser endpoint and keys", /endpoint\s+String/.test(schema) && /p256dh\s+String/.test(schema) && /auth\s+String/.test(schema));
add("PushSubscription supports unsubscribe", /isActive\s+Boolean\s+@default\(true\)/.test(schema) && /unsubscribedAt\s+DateTime\?/.test(schema));
add("PushSubscription is idempotent by org/customer/endpoint", /@@unique\(\[organizationId,\s*customerId,\s*endpoint\]\)/.test(schema));
add("Permission events are append-only", /createdAt\s+DateTime\s+@default\(now\(\)\)/.test(permissionEventModel) && !/updatedAt/.test(permissionEventModel));
add("Organization relations include push", /pushSubscriptions\s+PushSubscription\[\]/.test(schema) && /notificationPermissionEvents\s+NotificationPermissionEvent\[\]/.test(schema));
add("User relations include push", /pushSubscriptions\s+PushSubscription\[\]/.test(schema) && /notificationPermissionEvents\s+NotificationPermissionEvent\[\]/.test(schema));
add("P47 migration exists", exists("prisma/migrations/20260625000600_web_push_foundation/migration.sql"));
add("P47 migration creates push tables", /CREATE TABLE IF NOT EXISTS "PushSubscription"/.test(migration) && /CREATE TABLE IF NOT EXISTS "NotificationPermissionEvent"/.test(migration));

add("web push service exists", exists("lib/services/web-push-foundation.service.ts"));
add("service exposes runtime config", /getWebPushRuntimeConfig/.test(service) && /NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY/.test(service));
add("service stores subscriptions with upsert", /pushSubscription\.upsert/.test(service) && /organizationId_customerId_endpoint/.test(service));
add("service writes GRANTED permission events", /notificationPermissionEvent\.create/.test(service) && /state:\s*"GRANTED"/.test(service));
add("service records denied unsupported revoked states", /recordPermissionEvent/.test(service) && /PushPermissionState/.test(service) && /state:\s*"REVOKED"/.test(service));
add("service unsubscribes by updateMany", /unsubscribe/.test(service) && /pushSubscription\.updateMany/.test(service) && /isActive:\s*false/.test(service));
add("service dry-run send counts subscriptions", /dryRun/.test(service) && /recipientCount/.test(service) && /subscriptionCount/.test(service));
add("real push is feature-flag gated", /WEB_PUSH_ENABLED/.test(service) && /WEB_PUSH_REAL_SEND_ENABLED/.test(service));
add("service performs real provider delivery", /webpush\.setVapidDetails|vapidDetails/.test(service));
add("service writes audit log for dry-run", /writeAuditLog/.test(service) && /Web Push dry-run delivery previewed/.test(service));

add("customer push API exists", exists("app/api/customer/push-subscriptions/route.ts"));
add("customer API supports GET POST PATCH DELETE", /export\s+async\s+function\s+GET/.test(customerRoute) && /export\s+async\s+function\s+POST/.test(customerRoute) && /export\s+async\s+function\s+PATCH/.test(customerRoute) && /export\s+async\s+function\s+DELETE/.test(customerRoute));
add("customer API requires auth", /requireAuthSession/.test(customerRoute));
add("customer API records browser user-agent", /user-agent/.test(customerRoute));
add("dashboard push API exists", exists("app/api/dashboard/customer-club/push/route.ts"));
add("dashboard API supports dry-run POST", /export\s+async\s+function\s+POST/.test(dashboardRoute) && /dryRunPushSchema/.test(dashboardRoute));
add("dashboard API requires manager access", /requireOrgAccess\(session,\s*organizationId,\s*\["ADMIN",\s*"MANAGER"\]\)/.test(dashboardRoute));

add("service worker exists", exists("public/web-push-sw.js"));
add("service worker handles push and notification clicks", /addEventListener\("push"/.test(serviceWorker) && /addEventListener\("notificationclick"/.test(serviceWorker));
add("opt-in component exists", exists("components/public/web-push-opt-in.tsx"));
add("opt-in prompt is behind button handler", /const enablePush\s*=\s*async/.test(optIn) && /Notification\.requestPermission\(\)/.test(optIn) && /onClick=\{enablePush\}/.test(optIn));
add("opt-in component can unsubscribe", /const disablePush\s*=\s*async/.test(optIn) && /method:\s*"DELETE"/.test(optIn) && /\.unsubscribe\(\)/.test(optIn));
add("opt-in records unsupported or denied", /recordPermission/.test(optIn) && /UNSUPPORTED/.test(optIn) && /DENIED/.test(optIn));
add("shop profile renders opt-in UI", /WebPushOptIn/.test(profilePage) && /organizationSlug=\{profile\.slug\}/.test(profilePage));
add("dashboard push page exists", exists("app/[locale]/dashboard/customer-club/push/page.tsx"));
add("dashboard push page has dry-run form", /previewSend/.test(dashboardPage) && /dryRun/.test(dashboardPage));
add("dashboard push page lists subscriptions and events", /subscriptions/.test(dashboardPage) && /permissionEvents/.test(dashboardPage));

add("route policy maps push", /"\/customer-club\/push":\s*ROLE_NAVIGATION_POLICY\.customerClub/.test(policy));
add("legacy access-control maps push", /"\/dashboard\/customer-club\/push"/.test(accessControl));
add("customer club members page links push", /customer-club\/push/.test(membersPage) && /Web Push/.test(membersPage));

add("env validator checks web push provider", /WEB_PUSH_PROVIDER/.test(envValidator) && /WEB_PUSH_ENABLED=true is required/.test(envValidator) && /dry_run/.test(envValidator) && /web_push/.test(envValidator));
add("env validator checks VAPID keys", /NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY/.test(envValidator) && /WEB_PUSH_VAPID_PRIVATE_KEY/.test(envValidator) && /WEB_PUSH_VAPID_SUBJECT/.test(envValidator));
add("runtime env summarizes web push", /webPushProvider/.test(runtimeEnv) && /webPushPublicKeyConfigured/.test(runtimeEnv));

for (const locale of ["fa", "en", "ar"]) {
  const rel = `dictionaries/${locale}.json`;
  const text = exists(rel) ? read(rel) : "";
  add(`${locale} dictionary has webPush copy`, /"webPush"\s*:/.test(text) && /"states"\s*:/.test(text) && /"REVOKED"\s*:/.test(text));
}

add("P47 phase doc exists", exists("docs/PHASE_47_WEB_PUSH_FOUNDATION.md"));
add("P47 overlay manifest exists", exists("docs/PHASE_47_OVERLAY_MANIFEST.md"));
add("package script exposes P47 validator", /"quality:web-push-foundation":\s*"node scripts\/quality\/validate-web-push-foundation\.mjs"/.test(packageJson));
add("validate-project references P47 validator", /validate-web-push-foundation\.mjs/.test(validateProject));
add("README references P47 Web Push", /P47/.test(readme) && /Web Push Opt-In Foundation/i.test(readme));
add("source of truth references P47 Web Push", /P47/.test(sourceOfTruth) && /Web Push Opt-In Foundation/i.test(sourceOfTruth));

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`Web Push foundation validation failed with ${failed.length} issue(s).`, failed);
  process.exit(1);
}
console.log("Web Push foundation validation passed.");
