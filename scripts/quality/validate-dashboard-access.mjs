import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dashboardRoot = path.join(root, "app", "[locale]", "dashboard");
const accessControlPath = path.join(root, "lib", "access-control.ts");
const layoutPath = path.join(root, "app", "[locale]", "dashboard", "layout.tsx");
const providersPath = path.join(root, "components", "providers.tsx");
const useAuthPath = path.join(root, "hooks", "use-auth.tsx");

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
}

function routeFromPage(filePath) {
  const relative = path.relative(dashboardRoot, path.dirname(filePath));
  const suffix = relative === "" ? "" : `/${relative.replaceAll(path.sep, "/")}`;
  return `/dashboard${suffix}`;
}

const pageRoutes = walk(dashboardRoot)
  .filter((filePath) => path.basename(filePath) === "page.tsx")
  .map(routeFromPage)
  .sort();

const accessControl = fs.readFileSync(accessControlPath, "utf8");
const layout = fs.readFileSync(layoutPath, "utf8");
const providers = fs.readFileSync(providersPath, "utf8");
const useAuth = fs.readFileSync(useAuthPath, "utf8");

const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok, detail });
}

for (const route of pageRoutes) {
  check(`dashboard route policy exists: ${route}`, accessControl.includes(`"${route}"`), route);
}

for (const staleRoute of ["/dashboard/customers", "/dashboard/my-appointments", "/dashboard/my-services", "/dashboard/organization-details"]) {
  check(`stale route removed: ${staleRoute}`, !accessControl.includes(staleRoute), staleRoute);
}

check("dashboard layout is server-side authenticated", layout.includes("const session = await auth()") && layout.includes("redirect(`/${locale}/login"));
check("dashboard layout uses DashboardShell", layout.includes("<DashboardShell"));
check("providers has exactly one SessionProvider element", (providers.match(/<SessionProvider\b/g) || []).length === 1);
check("use-auth does not duplicate OrganizationMembership interface", (useAuth.match(/interface OrganizationMembership/g) || []).length === 1);
check("use-auth redirects staff to existing appointments route", useAuth.includes('return "/dashboard/appointments"') || accessControl.includes('return "/dashboard/appointments"'));
check("unknown dashboard routes deny by explicit config", accessControl.includes("Dashboard route is not explicitly configured") && !accessControl.includes("routeSegments.slice"));
check("organization type requirement denies missing org type", accessControl.includes('reason: "Organization type is required for this dashboard route"'));
check("sidebar icon registry supports QrCode", fs.readFileSync(path.join(root, "components", "dashboard", "dashboard-sidebar.tsx"), "utf8").includes("QrCode"));

console.table(checks);
const failed = checks.filter((item) => !item.ok);
if (failed.length > 0) {
  console.error("Dashboard access validation failed.", failed);
  process.exit(1);
}

console.log("Dashboard access validation passed.");
