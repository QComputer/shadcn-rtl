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
const policy = exists("lib/dashboard/navigation-policy.ts") ? read("lib/dashboard/navigation-policy.ts") : "";
const sidebar = exists("components/dashboard/dashboard-sidebar.tsx") ? read("components/dashboard/dashboard-sidebar.tsx") : "";
const accessControl = exists("lib/access-control.ts") ? read("lib/access-control.ts") : "";
const validateProject = exists("scripts/quality/validate-project.mjs") ? read("scripts/quality/validate-project.mjs") : "";
const packageJson = exists("package.json") ? read("package.json") : "";

add("CustomerClubMembership Prisma model exists", /model\s+CustomerClubMembership\s*{/.test(schema));
add("customer club status enum exists", /enum\s+CustomerClubMembershipStatus\s*{[\s\S]*ACTIVE[\s\S]*PAUSED[\s\S]*LEFT[\s\S]*BLOCKED/.test(schema));
add("customer club tier enum exists", /enum\s+CustomerClubTier\s*{[\s\S]*MEMBER[\s\S]*LOYAL[\s\S]*VIP/.test(schema));
add("customer club source enum exists", /enum\s+CustomerClubJoinSource\s*{[\s\S]*PUBLIC_SHOP[\s\S]*CHECKOUT[\s\S]*ADMIN_IMPORT[\s\S]*CAMPAIGN/.test(schema));
add("customer club membership is organization scoped", /organizationId\s+String/.test(schema) && /organization\s+Organization\s+@relation/.test(schema));
add("customer club membership is unique per organization customer", /@@unique\(\[organizationId,\s*customerId\]\)/.test(schema));
add("customer club indexes organization status", /@@index\(\[organizationId,\s*status\]\)/.test(schema));
add("customer club migration exists", exists("prisma/migrations/20260625000100_customer_club_foundation/migration.sql"));

add("customer club service exists", exists("lib/services/customer-club.service.ts"));
add("customer club service writes audit logs", exists("lib/services/customer-club.service.ts") && /writeAuditLog/.test(read("lib/services/customer-club.service.ts")));
add("customer club membership API exists", exists("app/api/customer-club/membership/route.ts"));
add("customer club membership API supports GET", exists("app/api/customer-club/membership/route.ts") && /export\s+async\s+function\s+GET/.test(read("app/api/customer-club/membership/route.ts")));
add("customer club membership API supports POST", exists("app/api/customer-club/membership/route.ts") && /export\s+async\s+function\s+POST/.test(read("app/api/customer-club/membership/route.ts")));
add("customer club membership API supports PATCH", exists("app/api/customer-club/membership/route.ts") && /export\s+async\s+function\s+PATCH/.test(read("app/api/customer-club/membership/route.ts")));
add("customer club membership API supports DELETE", exists("app/api/customer-club/membership/route.ts") && /export\s+async\s+function\s+DELETE/.test(read("app/api/customer-club/membership/route.ts")));
add("dashboard customer club members API exists", exists("app/api/dashboard/customer-club/members/route.ts"));
add("dashboard customer club members API requires management access", exists("app/api/dashboard/customer-club/members/route.ts") && /requireOrgAccess\(session,\s*organizationId,\s*\["ADMIN",\s*"MANAGER"\]\)/.test(read("app/api/dashboard/customer-club/members/route.ts")));

add("dashboard customer club page exists", exists("app/[locale]/dashboard/customer-club/page.tsx"));
add("dashboard customer club members page exists", exists("app/[locale]/dashboard/customer-club/members/page.tsx"));
add("customer club page has loading state", exists("app/[locale]/dashboard/customer-club/members/page.tsx") && /loading/.test(read("app/[locale]/dashboard/customer-club/members/page.tsx")));
add("customer club page has error state", exists("app/[locale]/dashboard/customer-club/members/page.tsx") && /errorTitle/.test(read("app/[locale]/dashboard/customer-club/members/page.tsx")));
add("customer club page has empty state", exists("app/[locale]/dashboard/customer-club/members/page.tsx") && /emptyTitle/.test(read("app/[locale]/dashboard/customer-club/members/page.tsx")));
add("customer club page uses shadcn cards", exists("app/[locale]/dashboard/customer-club/members/page.tsx") && /@\/components\/ui\/card/.test(read("app/[locale]/dashboard/customer-club/members/page.tsx")));
add("customer club page uses dialog for management", exists("app/[locale]/dashboard/customer-club/members/page.tsx") && /@\/components\/ui\/dialog/.test(read("app/[locale]/dashboard/customer-club/members/page.tsx")));

add("navigation policy includes customerClub key", /customerClub/.test(policy));
add("navigation policy has customer club href", /customerClub:\s*"\/customer-club"/.test(policy));
add("route policy maps customer club root", /"\/customer-club":\s*ROLE_NAVIGATION_POLICY\.customerClub/.test(policy));
add("route policy maps customer club members", /"\/customer-club\/members":\s*ROLE_NAVIGATION_POLICY\.customerClub/.test(policy));
add("customer club management nav is management-only", /customerClub:\s*MANAGEMENT_ROLES/.test(policy));
add("driver has no customer club management nav", !/customerClub:\s*\[[^\]]*"DRIVER"/.test(policy));
add("staff has no customer club management nav", !/customerClub:\s*\[[^\]]*"STAFF"/.test(policy));
add("sidebar includes customer club icon", /UserRoundCheck/.test(sidebar));
add("sidebar includes localized customer club labels", /Customer Club/.test(sidebar) && /باشگاه مشتریان/.test(sidebar) && /نادي العملاء/.test(sidebar));
add("legacy access-control registry includes customer club route", /"\/dashboard\/customer-club\/members"/.test(accessControl));

for (const locale of ["fa", "en", "ar"]) {
  const rel = `dictionaries/${locale}.json`;
  const text = exists(rel) ? read(rel) : "";
  add(`${locale} dictionary has customer club copy`, /"customerClub"\s*:/.test(text) && /"statuses"\s*:/.test(text) && /"tiers"\s*:/.test(text));
  add(`${locale} navigation has customer club label`, /"customerClub"\s*:/.test(text) && /"customer-club"\s*:/.test(text));
}

add("P42 phase doc exists", exists("docs/PHASE_42_CUSTOMER_CLUB_FOUNDATION.md"));
add("P42 overlay manifest exists", exists("docs/PHASE_42_OVERLAY_MANIFEST.md"));
add("package script exposes P42 validator", /"quality:customer-club-foundation":\s*"node scripts\/quality\/validate-customer-club-foundation\.mjs"/.test(packageJson));
add("validate-project references P42 validator", /validate-customer-club-foundation\.mjs/.test(validateProject));
add("README references P42 customer club", /P42/.test(read("README.md")) && /Customer Club/.test(read("README.md")));
add("source of truth references P42 customer club", /P42/.test(read("docs/CURRENT_SOURCE_OF_TRUTH.md")) && /Customer Club/.test(read("docs/CURRENT_SOURCE_OF_TRUTH.md")));

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`Customer club foundation validation failed with ${failed.length} issue(s).`, failed);
  process.exit(1);
}
console.log("Customer club foundation validation passed.");
