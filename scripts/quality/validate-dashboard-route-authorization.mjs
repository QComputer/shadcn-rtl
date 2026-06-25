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
  read(rel).includes(needle) ? ok(label) : fail(label);
}

function expectMatches(rel, pattern, label) {
  if (!exists(rel)) {
    fail(label, `${rel} is missing`);
    return;
  }
  pattern.test(read(rel)) ? ok(label) : fail(label);
}

expectFile("lib/dashboard/navigation-policy.ts");
expectFile("components/dashboard/dashboard-route-access-boundary.tsx");
expectFile("components/dashboard/dashboard-shell.tsx");
expectFile("docs/PHASE_40_DASHBOARD_ROUTE_AUTHORIZATION.md");
expectFile("docs/PHASE_40_OVERLAY_MANIFEST.md");

expectIncludes(
  "lib/dashboard/navigation-policy.ts",
  "export type DashboardRouteAccessDecision",
  "shared policy exports a route access decision type",
);
expectIncludes(
  "lib/dashboard/navigation-policy.ts",
  "export function getDashboardRoutePathFromPathname",
  "shared policy parses localized dashboard pathnames",
);
expectIncludes(
  "lib/dashboard/navigation-policy.ts",
  "export function routePatternMatches",
  "shared policy supports dynamic dashboard route patterns",
);
expectIncludes(
  "lib/dashboard/navigation-policy.ts",
  "export function getDashboardRouteKeyFromPathname",
  "shared policy resolves route policy keys from pathnames",
);
expectIncludes(
  "lib/dashboard/navigation-policy.ts",
  "export function getDashboardRouteAccessDecision",
  "shared policy exposes route authorization decision helper",
);
expectIncludes(
  "lib/dashboard/navigation-policy.ts",
  "routeKey !== null ? isDashboardRouteAllowed(routeKey, role) : false",
  "unknown dashboard routes are not treated as allowed by the route helper",
);

expectIncludes(
  "components/dashboard/dashboard-route-access-boundary.tsx",
  "\"use client\"",
  "route access boundary is a client component",
);
expectIncludes(
  "components/dashboard/dashboard-route-access-boundary.tsx",
  "usePathname",
  "route access boundary reads the current pathname",
);
expectIncludes(
  "components/dashboard/dashboard-route-access-boundary.tsx",
  "useSession",
  "route access boundary reads the current session role context",
);
expectIncludes(
  "components/dashboard/dashboard-route-access-boundary.tsx",
  "getDashboardRoleFromUser(session?.user)",
  "route access boundary uses shared membership-aware role resolver",
);
expectIncludes(
  "components/dashboard/dashboard-route-access-boundary.tsx",
  "getDashboardRouteAccessDecision({ locale, pathname, role })",
  "route access boundary uses shared route authorization helper",
);
expectIncludes(
  "components/dashboard/dashboard-route-access-boundary.tsx",
  "dashboardRouteAccessCopy",
  "route access fallback copy is localized",
);
for (const locale of ["fa", "en", "ar"]) {
  expectIncludes(
    "components/dashboard/dashboard-route-access-boundary.tsx",
    `${locale}: {`,
    `route access boundary has ${locale} copy`,
  );
}
expectIncludes(
  "components/dashboard/dashboard-route-access-boundary.tsx",
  "href={getDashboardHref(locale, \"\")}",
  "route access fallback returns users to dashboard overview",
);

expectIncludes(
  "components/dashboard/dashboard-shell.tsx",
  "DashboardRouteAccessBoundary",
  "dashboard shell imports/uses route access boundary",
);
expectMatches(
  "components/dashboard/dashboard-shell.tsx",
  /<DashboardRouteAccessBoundary locale=\{locale\}>\s*\{children\}\s*<\/DashboardRouteAccessBoundary>/s,
  "dashboard children are wrapped by route access boundary",
);
expectIncludes(
  "components/dashboard/dashboard-shell.tsx",
  "<DashboardAccessBoundary>",
  "existing dashboard access boundary is preserved",
);

expectIncludes(
  "package.json",
  "\"quality:dashboard-route-authorization\": \"node scripts/quality/validate-dashboard-route-authorization.mjs\"",
  "package script exposes P40 validator",
);
expectIncludes(
  "scripts/quality/validate-project.mjs",
  "validate-dashboard-route-authorization.mjs",
  "project validator references P40 validator",
);
expectIncludes("README.md", "P40", "README references P40");
expectIncludes("docs/CURRENT_SOURCE_OF_TRUTH.md", "P40", "source of truth references P40");

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`Dashboard route authorization validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}
console.log("Dashboard route authorization validation passed.");
