#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function ok(name, detail = "") {
  results.push({ name, ok: true, detail });
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
}

function expectFile(rel) {
  exists(rel) ? ok(`${rel} exists`) : fail(`${rel} exists`);
}

function expectIncludes(rel, needle, label = `${rel} includes ${needle}`) {
  if (!exists(rel)) {
    fail(label, `${rel} is missing`);
    return;
  }
  const text = read(rel);
  text.includes(needle) ? ok(label) : fail(label);
}

function expectMatches(rel, pattern, label) {
  if (!exists(rel)) {
    fail(label, `${rel} is missing`);
    return;
  }
  const text = read(rel);
  pattern.test(text) ? ok(label) : fail(label);
}

expectFile("components/dashboard/dashboard-sidebar.tsx");
expectFile("lib/dashboard/navigation-policy.ts");
expectFile("docs/PHASE_38_DASHBOARD_ROLE_NAVIGATION.md");
expectFile("docs/PHASE_38_OVERLAY_MANIFEST.md");

expectIncludes(
  "lib/dashboard/navigation-policy.ts",
  "export const ROLE_NAVIGATION_POLICY",
  "dashboard navigation policy is centralized in a pure module",
);
expectIncludes(
  "components/dashboard/dashboard-sidebar.tsx",
  "@/lib/dashboard/navigation-policy",
  "dashboard sidebar consumes the shared navigation policy module",
);
expectIncludes(
  "components/dashboard/dashboard-sidebar.tsx",
  "function getVisibleNavGroups",
  "dashboard sidebar filters groups before rendering",
);
expectIncludes(
  "components/dashboard/dashboard-sidebar.tsx",
  "useSession",
  "dashboard sidebar reads the current session role",
);
expectIncludes(
  "lib/dashboard/navigation-policy.ts",
  "organizationMembershipRole",
  "shared navigation role resolver can prefer membership-scoped role context",
);
expectIncludes(
  "lib/dashboard/navigation-policy.ts",
  "driverOrders: \"/driver-orders\"",
  "driver order navigation remains available",
);
expectMatches(
  "lib/dashboard/navigation-policy.ts",
  /driverOrders:\s*\["SUPER_ADMIN",\s*"ADMIN",\s*"MANAGER",\s*"DRIVER"\]/,
  "driver order navigation allows admin/manual-driver and driver workflows",
);
expectMatches(
  "lib/dashboard/navigation-policy.ts",
  /organizations:\s*\["SUPER_ADMIN"\]/,
  "organization index is SUPER_ADMIN-only in navigation",
);
expectMatches(
  "lib/dashboard/navigation-policy.ts",
  /users:\s*\["SUPER_ADMIN"\]/,
  "global users page is SUPER_ADMIN-only in navigation",
);
expectIncludes(
  "components/dashboard/dashboard-sidebar.tsx",
  "const roleAwareNavigationCopy",
  "dashboard sidebar labels are locale-aware",
);
for (const locale of ["fa", "en", "ar"]) {
  expectIncludes(
    "components/dashboard/dashboard-sidebar.tsx",
    `${locale}: {`,
    `dashboard sidebar has ${locale} navigation copy`,
  );
}
expectIncludes(
  "components/dashboard/dashboard-sidebar.tsx",
  "SheetTrigger asChild",
  "mobile sidebar keeps shadcn sheet trigger composition",
);
expectIncludes(
  "components/dashboard/dashboard-sidebar.tsx",
  "aria-current={isActive ? \"page\" : undefined}",
  "active navigation item exposes aria-current",
);
expectIncludes(
  "components/dashboard/dashboard-shell.tsx",
  "DashboardSidebarWithDict locale={locale} isMobile={false}",
  "P37 dashboard shell still uses the shared sidebar component",
);
expectIncludes(
  "package.json",
  "\"quality:dashboard-role-navigation\": \"node scripts/quality/validate-dashboard-role-navigation.mjs\"",
  "package script exposes P38 validator",
);
expectIncludes(
  "scripts/quality/validate-project.mjs",
  "validate-dashboard-role-navigation.mjs",
  "project validator references P38 validator",
);
expectIncludes(
  "README.md",
  "P38",
  "README references P38",
);
expectIncludes(
  "docs/CURRENT_SOURCE_OF_TRUTH.md",
  "P38",
  "source of truth references P38",
);

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`Dashboard role-navigation validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}
console.log("Dashboard role-navigation validation passed.");
