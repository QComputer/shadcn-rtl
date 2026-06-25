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
const dashboardRoute = exists("app/api/dashboard/notifications/route.ts") ? read("app/api/dashboard/notifications/route.ts") : "";
const customerRoute = exists("app/api/customer/notifications/route.ts") ? read("app/api/customer/notifications/route.ts") : "";
const page = exists("app/[locale]/dashboard/notifications/page.tsx") ? read("app/[locale]/dashboard/notifications/page.tsx") : "";
const policy = exists("lib/dashboard/navigation-policy.ts") ? read("lib/dashboard/navigation-policy.ts") : "";
const sidebar = exists("components/dashboard/dashboard-sidebar.tsx") ? read("components/dashboard/dashboard-sidebar.tsx") : "";
const accessControl = exists("lib/access-control.ts") ? read("lib/access-control.ts") : "";
const validateProject = exists("scripts/quality/validate-project.mjs") ? read("scripts/quality/validate-project.mjs") : "";
const packageJson = exists("package.json") ? read("package.json") : "";

add("Notification model has organization scope", /model\s+Notification\s*{[\s\S]*organizationId\s+String\?/.test(schema));
add("Notification model has actor context", /createdByUserId\s+String\?/.test(schema));
add("Notification model relates target user explicitly", /TargetNotifications/.test(schema));
add("Notification model indexes organization timeline", /@@index\(\[organizationId,\s*createdAt\]\)/.test(schema));
add("P43 notification migration exists", exists("prisma/migrations/20260625000200_in_app_notification_inbox/migration.sql"));

add("dashboard notifications API still exists", exists("app/api/dashboard/notifications/route.ts"));
add("dashboard notifications API supports GET", /export\s+async\s+function\s+GET/.test(dashboardRoute));
add("dashboard notifications API supports PATCH", /export\s+async\s+function\s+PATCH/.test(dashboardRoute));
add("dashboard notifications API supports POST", /export\s+async\s+function\s+POST/.test(dashboardRoute));
add("dashboard notifications POST is customer-club scoped", /customerClubMembership\.findMany/.test(dashboardRoute));
add("dashboard notifications POST requires org management", /requireOrgAccess\(session,\s*organizationId,\s*\["ADMIN",\s*"MANAGER"\]\)/.test(dashboardRoute));
add("dashboard notifications POST creates in-app rows only", /prisma\.notification\.createMany/.test(dashboardRoute));
add("dashboard notifications POST supports dry run", /dryRun/.test(dashboardRoute));
add("dashboard notifications POST writes audit log", /writeAuditLog/.test(dashboardRoute));
add("dashboard notifications PATCH supports unread", /seen\s*=\s*body\.seen\s*\?\?\s*true/.test(dashboardRoute) && /readAt:\s*seen\s*\?\s*new Date\(\)\s*:\s*null/.test(dashboardRoute));
add("dashboard notifications API has no external send call", !/(sendEmail|sendSMS|webpush|telegram|kavenegar|twilio)/i.test(dashboardRoute));

add("customer notifications API exists", exists("app/api/customer/notifications/route.ts"));
add("customer notifications API supports GET", /export\s+async\s+function\s+GET/.test(customerRoute));
add("customer notifications API supports PATCH", /export\s+async\s+function\s+PATCH/.test(customerRoute));
add("customer notifications are scoped to signed-in user", /targetUserId:\s*session\.user\.id/.test(customerRoute));

add("dashboard notifications page exists", exists("app/[locale]/dashboard/notifications/page.tsx"));
add("dashboard notifications page has inbox state", /notifications/.test(page) && /unreadCount/.test(page));
add("dashboard notifications page has loading state", /loading/.test(page));
add("dashboard notifications page has empty state", /emptyTitle/.test(page));
add("dashboard notifications page has error state", /errorTitle/.test(page));
add("dashboard notifications page has send form", /sendNotification/.test(page) && /Textarea/.test(page));
add("dashboard notifications page exposes in-app only notice", /inAppOnly/.test(page));

add("navigation policy includes notifications key", /notifications/.test(policy));
add("navigation policy has notifications href", /notifications:\s*"\/notifications"/.test(policy));
add("route policy maps dashboard notifications", /"\/notifications":\s*ROLE_NAVIGATION_POLICY\.notifications/.test(policy));
add("sidebar includes notifications icon", /Bell/.test(sidebar));
add("legacy access-control includes notifications route", /"\/dashboard\/notifications"/.test(accessControl));

for (const locale of ["fa", "en", "ar"]) {
  const rel = `dictionaries/${locale}.json`;
  const text = exists(rel) ? read(rel) : "";
  add(`${locale} dictionary has notification inbox copy`, /"notificationInbox"\s*:/.test(text) && /"inAppOnly"\s*:/.test(text));
  add(`${locale} navigation already has notifications label`, /"notifications"\s*:/.test(text));
}

add("P43 phase doc exists", exists("docs/PHASE_43_IN_APP_NOTIFICATION_INBOX.md"));
add("P43 overlay manifest exists", exists("docs/PHASE_43_OVERLAY_MANIFEST.md"));
add("package script exposes P43 validator", /"quality:in-app-notifications":\s*"node scripts\/quality\/validate-in-app-notifications\.mjs"/.test(packageJson));
add("validate-project references P43 validator", /validate-in-app-notifications\.mjs/.test(validateProject));
add("README references P43 in-app notifications", /P43/.test(read("README.md")) && /in-app notification/i.test(read("README.md")));
add("source of truth references P43 in-app notifications", /P43/.test(read("docs/CURRENT_SOURCE_OF_TRUTH.md")) && /in-app notification/i.test(read("docs/CURRENT_SOURCE_OF_TRUTH.md")));

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`In-app notification validation failed with ${failed.length} issue(s).`, failed);
  process.exit(1);
}
console.log("In-app notification validation passed.");
