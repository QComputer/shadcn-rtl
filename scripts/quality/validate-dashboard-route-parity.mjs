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

function routeToPage(route) {
  const routePart = route === "" ? "" : route.slice(1);
  return path.posix.join("app/[locale]/dashboard", routePart, "page.tsx");
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function expectPolicyEntry(route, policyKey) {
  const policy = exists("lib/dashboard/navigation-policy.ts") ? read("lib/dashboard/navigation-policy.ts") : "";
  const escapedRoute = route === "" ? "" : escapeRegex(route);
  const pattern = new RegExp(`"${escapedRoute}":\\s*ROLE_NAVIGATION_POLICY\\.${policyKey}\\b`);
  pattern.test(policy)
    ? ok(`route policy maps ${route || "/"} to ${policyKey}`)
    : fail(`route policy maps ${route || "/"} to ${policyKey}`);
}

const navigationRoutes = [
  { key: "overview", route: "" },
  { key: "appointments", route: "/appointments" },
  { key: "calendar", route: "/calendar" },
  { key: "orders", route: "/orders" },
  { key: "driverOrders", route: "/driver-orders" },
  { key: "products", route: "/products" },
  { key: "productCategories", route: "/product-categories" },
  { key: "services", route: "/services" },
  { key: "serviceCategories", route: "/service-categories" },
  { key: "members", route: "/members" },
  { key: "settings", route: "/settings" },
  { key: "organizationSettings", route: "/settings/organization" },
  { key: "qrcode", route: "/qrcode" },
  { key: "organizations", route: "/organizations" },
  { key: "users", route: "/users" },
];

const nestedDashboardRoutes = [
  { route: "/appointments/[id]", policyKey: "appointments" },
  { route: "/appointments/[id]/edit", policyKey: "appointments" },
  { route: "/products/new", policyKey: "products" },
  { route: "/products/[id]", policyKey: "products" },
  { route: "/services/new", policyKey: "services" },
  { route: "/services/[id]", policyKey: "services" },
  { route: "/organizations/new", policyKey: "organizations" },
];

expectFile("lib/dashboard/navigation-policy.ts");
expectFile("components/dashboard/dashboard-sidebar.tsx");
expectFile("app/[locale]/dashboard/layout.tsx");
expectFile("components/dashboard/dashboard-shell.tsx");
expectFile("components/dashboard/dashboard-access-boundary.tsx");
expectFile("docs/PHASE_39_DASHBOARD_ROUTE_PARITY.md");
expectFile("docs/PHASE_39_OVERLAY_MANIFEST.md");

expectIncludes(
  "lib/dashboard/navigation-policy.ts",
  "export const DASHBOARD_NAVIGATION_ITEMS",
  "shared policy exports dashboard navigation item hrefs",
);
expectIncludes(
  "lib/dashboard/navigation-policy.ts",
  "export const DASHBOARD_ROUTE_POLICY",
  "shared policy exports dashboard route policy",
);
expectIncludes(
  "lib/dashboard/navigation-policy.ts",
  "export function isDashboardRouteAllowed",
  "shared policy exposes route-allowance helper",
);
expectIncludes(
  "components/dashboard/dashboard-sidebar.tsx",
  "@/lib/dashboard/navigation-policy",
  "sidebar consumes shared dashboard navigation policy",
);
expectIncludes(
  "components/dashboard/dashboard-sidebar.tsx",
  "DASHBOARD_NAVIGATION_ITEMS[key]",
  "sidebar hrefs come from shared dashboard navigation items",
);
expectIncludes(
  "app/[locale]/dashboard/layout.tsx",
  "const session = await auth()",
  "dashboard layout authenticates before rendering dashboard shell",
);
expectIncludes(
  "app/[locale]/dashboard/layout.tsx",
  "redirect(`/${locale}/login?callbackUrl=",
  "dashboard layout redirects unauthenticated users to localized login",
);
expectIncludes(
  "components/dashboard/dashboard-shell.tsx",
  "<DashboardAccessBoundary>",
  "dashboard shell preserves access boundary around dashboard content",
);

for (const { key, route } of navigationRoutes) {
  expectIncludes(
    "lib/dashboard/navigation-policy.ts",
    `${key}: "${route}"`,
    `navigation policy has href for ${key}`,
  );
  expectPolicyEntry(route, key);
  expectFile(routeToPage(route));
}

for (const { route, policyKey } of nestedDashboardRoutes) {
  expectPolicyEntry(route, policyKey);
  expectFile(routeToPage(route));
}

expectIncludes(
  "lib/dashboard/navigation-policy.ts",
  "driverOrders: [\"SUPER_ADMIN\", \"ADMIN\", \"MANAGER\", \"DRIVER\"]",
  "driver route policy preserves admin/manual-driver and driver access",
);
expectIncludes(
  "lib/dashboard/navigation-policy.ts",
  "organizations: [\"SUPER_ADMIN\"]",
  "platform organization navigation policy remains SUPER_ADMIN-only",
);
expectIncludes(
  "lib/dashboard/navigation-policy.ts",
  "users: [\"SUPER_ADMIN\"]",
  "platform user navigation policy remains SUPER_ADMIN-only",
);
expectIncludes(
  "package.json",
  "\"quality:dashboard-route-parity\": \"node scripts/quality/validate-dashboard-route-parity.mjs\"",
  "package script exposes P39 validator",
);
expectIncludes(
  "scripts/quality/validate-project.mjs",
  "validate-dashboard-route-parity.mjs",
  "project validator references P39 validator",
);
expectIncludes("README.md", "P39", "README references P39");
expectIncludes("docs/CURRENT_SOURCE_OF_TRUTH.md", "P39", "source of truth references P39");

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`Dashboard route/navigation parity validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}
console.log("Dashboard route/navigation parity validation passed.");
