#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function pass(name) {
  checks.push({ name, ok: true, detail: "" });
}

function fail(name, detail = "") {
  checks.push({ name, ok: false, detail });
}

function assertIncludes(rel, needle, name) {
  const text = read(rel);
  text.includes(needle) ? pass(name) : fail(name, `${rel} is missing ${needle}`);
}

function assertNotIncludes(rel, needle, name) {
  const text = read(rel);
  text.includes(needle) ? fail(name, `${rel} still contains ${needle}`) : pass(name);
}

assertNotIncludes(
  "app/[locale]/dashboard/members/page.tsx",
  "// TODO: complete the members page",
  "members page no longer carries the incomplete-page TODO",
);
assertIncludes(
  "app/[locale]/dashboard/members/page.tsx",
  "const filteredMembers = useMemo",
  "members page implements active client-side filtering",
);
assertIncludes(
  "app/[locale]/dashboard/members/page.tsx",
  "max-h-[85vh] max-w-lg overflow-y-auto",
  "member management dialog is height-limited and scrollable",
);
assertIncludes(
  "app/[locale]/dashboard/members/page.tsx",
  "readError(response",
  "members page surfaces API errors instead of generic-only failures",
);
assertIncludes(
  "app/[locale]/dashboard/members/page.tsx",
  "`/api/organizations/${organizationId}/members/${memberId}`",
  "members page keeps role/status updates scoped to organization-member API",
);

assertIncludes(
  "app/api/organizations/[id]/members/[mId]/route.ts",
  "assertAdminContinuity",
  "member API protects the last active organization admin",
);
assertIncludes(
  "app/api/organizations/[id]/members/[mId]/route.ts",
  "Use another admin account to change your own membership",
  "member API blocks self-lockout membership changes",
);
assertIncludes(
  "app/api/organizations/[id]/members/[mId]/route.ts",
  "Only organization admins can grant admin membership",
  "member API blocks manager-to-admin elevation",
);
assertIncludes(
  "app/api/organizations/[id]/members/[mId]/route.ts",
  "prisma.organizationMember.update",
  "member API updates the membership record directly",
);
assertNotIncludes(
  "app/api/organizations/[id]/members/[mId]/route.ts",
  "organizationService.updateMemberRole",
  "member API no longer mutates global user role through organizationService.updateMemberRole",
);
assertNotIncludes(
  "app/api/organizations/[id]/members/[mId]/route.ts",
  "userService.updateMembershipIsActive",
  "member API no longer depends on userService for membership status updates",
);

assertNotIncludes(
  "components/dashboard/dashboard-shell.tsx",
  "<Providers",
  "dashboard shell no longer nests the app-wide provider stack",
);
assertNotIncludes(
  "components/dashboard/dashboard-shell.tsx",
  "SessionProvider",
  "dashboard shell does not import or create a nested SessionProvider",
);
assertIncludes(
  "app/[locale]/dashboard/layout.tsx",
  "<DashboardShell locale={locale}>",
  "dashboard layout no longer passes a duplicate provider session prop",
);

console.table(checks);
const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error(`Member/provider hardening validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("Member/provider hardening validation passed.");
