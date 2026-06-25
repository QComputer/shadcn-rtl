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

function expectPolicyEntry(route, policyKey) {
  const rel = "lib/dashboard/navigation-policy.ts";
  if (!exists(rel)) {
    fail(`route policy maps ${route || "/"} to ${policyKey}`, `${rel} is missing`);
    return;
  }
  const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`"${escapedRoute}":\\s*ROLE_NAVIGATION_POLICY\\.${policyKey}\\b`);
  pattern.test(read(rel))
    ? ok(`route policy maps ${route || "/"} to ${policyKey}`)
    : fail(`route policy maps ${route || "/"} to ${policyKey}`);
}

expectFile("lib/dashboard/navigation-policy.ts");
expectFile("components/dashboard/dashboard-route-access-boundary.tsx");
expectFile("components/dashboard/dashboard-shell.tsx");
expectFile("docs/PHASE_41_DASHBOARD_GUARD_SMOKE.md");
expectFile("docs/PHASE_41_OVERLAY_MANIFEST.md");

expectIncludes(
  "components/dashboard/dashboard-route-access-boundary.tsx",
  "useEffect",
  "unauthorized fallback can manage focus when rendered",
);
expectIncludes(
  "components/dashboard/dashboard-route-access-boundary.tsx",
  "useRef<HTMLElement>(null)",
  "unauthorized fallback stores a focus target ref",
);
expectIncludes(
  "components/dashboard/dashboard-route-access-boundary.tsx",
  "fallbackRef.current?.focus()",
  "unauthorized fallback moves keyboard focus to the alert panel",
);
expectIncludes(
  "components/dashboard/dashboard-route-access-boundary.tsx",
  "tabIndex={-1}",
  "unauthorized fallback is programmatically focusable",
);
expectIncludes(
  "components/dashboard/dashboard-route-access-boundary.tsx",
  "role=\"alert\"",
  "unauthorized fallback announces itself as an alert",
);
expectIncludes(
  "components/dashboard/dashboard-route-access-boundary.tsx",
  "aria-labelledby={titleId}",
  "unauthorized fallback has labelled title semantics",
);
expectIncludes(
  "components/dashboard/dashboard-route-access-boundary.tsx",
  "aria-describedby={`${descriptionId} ${detailsId}`}",
  "unauthorized fallback connects description and details",
);
expectIncludes(
  "components/dashboard/dashboard-route-access-boundary.tsx",
  "copy.roleLabels[role]",
  "unauthorized fallback shows localized current role",
);
expectIncludes(
  "components/dashboard/dashboard-route-access-boundary.tsx",
  "getRequestedRouteLabel(decision.routePath, copy.unknownRoute)",
  "unauthorized fallback shows requested route context",
);
expectIncludes(
  "components/dashboard/dashboard-route-access-boundary.tsx",
  "href={getDashboardHref(locale, \"\")}",
  "unauthorized fallback returns to dashboard overview",
);
for (const locale of ["fa", "en", "ar"]) {
  expectIncludes(
    "components/dashboard/dashboard-route-access-boundary.tsx",
    `${locale}: {`,
    `route access fallback keeps ${locale} copy`,
  );
}

expectIncludes(
  "lib/dashboard/navigation-policy.ts",
  "export function getDashboardRouteAccessDecision",
  "shared policy still exposes the route decision helper",
);
expectIncludes(
  "lib/dashboard/navigation-policy.ts",
  "routeKey !== null ? isDashboardRouteAllowed(routeKey, role) : false",
  "unknown dashboard routes remain denied by default",
);
expectIncludes(
  "lib/dashboard/navigation-policy.ts",
  "routePatternMatches(candidate, normalizedRoute)",
  "dynamic route matching remains enabled",
);
expectPolicyEntry("/driver-orders", "driverOrders");
expectPolicyEntry("/orders", "orders");
expectPolicyEntry("/users", "users");
expectPolicyEntry("/products/[id]", "products");
expectPolicyEntry("/settings/organization", "organizationSettings");
expectMatches(
  "lib/dashboard/navigation-policy.ts",
  /driverOrders:\s*\["SUPER_ADMIN",\s*"ADMIN",\s*"MANAGER",\s*"DRIVER"\]/,
  "smoke case: admin/manual-driver and driver can reach driver-orders",
);
expectMatches(
  "lib/dashboard/navigation-policy.ts",
  /users:\s*\["SUPER_ADMIN"\]/,
  "smoke case: global users remains SUPER_ADMIN-only",
);
expectIncludes(
  "lib/dashboard/navigation-policy.ts",
  "products: ALL_OPERATIONS_ROLES",
  "smoke case: staff can still reach product operations",
);
expectIncludes(
  "lib/dashboard/navigation-policy.ts",
  "productCategories: ADMIN_MANAGER_ROLES",
  "smoke case: product category management stays management-only",
);
expectIncludes(
  "components/dashboard/dashboard-shell.tsx",
  "<DashboardRouteAccessBoundary locale={locale}>",
  "dashboard shell still wraps children with route access boundary",
);

expectIncludes(
  "package.json",
  "\"quality:dashboard-route-guard-smoke\": \"node scripts/quality/validate-dashboard-route-guard-smoke.mjs\"",
  "package script exposes P41 validator",
);
expectIncludes(
  "scripts/quality/validate-project.mjs",
  "validate-dashboard-route-guard-smoke.mjs",
  "project validator references P41 validator",
);
expectIncludes("README.md", "P41", "README references P41");
expectIncludes("docs/CURRENT_SOURCE_OF_TRUTH.md", "P41", "source of truth references P41");

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`Dashboard route guard smoke validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}
console.log("Dashboard route guard smoke validation passed.");
