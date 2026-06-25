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

assertIncludes("prisma/seed.ts", 'const DEMO_PASSWORD = "123456";', "seed uses a single explicit demo password constant");
assertIncludes("prisma/seed.ts", "bcrypt.hash(DEMO_PASSWORD, 12)", "seed hashes the demo password constant");
assertNotIncludes("prisma/seed.ts", "password123", "seed console does not advertise stale password123 credentials");
assertNotIncludes("docs/SEED_TESTING_GUIDE.md", "password123", "seed guide does not advertise stale password123 credentials");
assertNotIncludes("docs/DASHBOARD_TEST_REPORT.md", "password123", "dashboard test report does not advertise stale password123 credentials");

assertNotIncludes(
  "app/[locale]/dashboard/members/page.tsx",
  "/api/organizations/noId/members",
  "members page does not refetch through placeholder organization id",
);
assertIncludes(
  "app/[locale]/dashboard/members/page.tsx",
  "/api/users/me/membership",
  "members page resolves the active organization membership before loading members",
);
assertIncludes(
  "app/[locale]/dashboard/members/page.tsx",
  "`/api/organizations/${organizationId}/members/${memberId}`",
  "members page updates member records through the organization-member API",
);
assertIncludes(
  "app/api/organizations/[id]/members/[mId]/route.ts",
  "parseManageableMemberRole",
  "member API validates organization member role updates",
);
assertIncludes(
  "app/api/organizations/[id]/members/[mId]/route.ts",
  "organizationService.updateMemberRole",
  "member API supports organization member role updates",
);
assertIncludes(
  "app/api/organizations/[id]/members/[mId]/route.ts",
  "userService.updateMembershipIsActive",
  "member API still supports organization member activation updates",
);

console.table(checks);
const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error(`Seed/auth/member cleanup validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("Seed/auth/member cleanup validation passed.");
