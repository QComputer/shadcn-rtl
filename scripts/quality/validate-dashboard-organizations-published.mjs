import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];

function read(relPath) {
  const abs = path.join(root, relPath);
  if (!existsSync(abs)) throw new Error(`Missing required file: ${relPath}`);
  return readFileSync(abs, "utf8");
}

function check(condition, message) {
  checks.push({ ok: Boolean(condition), message });
}

const pagePath = "app/[locale]/dashboard/organizations/page.tsx";
const apiPath = "app/api/organizations/route.ts";
const navPolicyPath = "lib/dashboard/navigation-policy.ts";
const sidebarPath = "components/dashboard/dashboard-sidebar.tsx";

const page = read(pagePath);
const api = read(apiPath);
const navPolicy = read(navPolicyPath);
const sidebar = read(sidebarPath);

check(!page.trimStart().startsWith('"use client"') && !page.trimStart().startsWith("'use client'"), "organizations page must be server-rendered, not a legacy client page");
check(page.includes('export const dynamic = "force-dynamic"'), "organizations page must be dynamic for auth + database reads");
check(page.includes("await auth()"), "organizations page must check the server session");
check(page.includes('session.user.role !== "SUPER_ADMIN"'), "organizations page must be SUPER_ADMIN-only");
check(page.includes("prisma.organization.findMany"), "organizations page must query organizations server-side");
check(page.includes("prisma.organizationDomain.count"), "organizations page must surface custom-domain readiness stats");
check(page.includes("/dashboard/shop-domains"), "organizations page must link to centralized shop-domain management");
check(!page.includes("fetch(\"/api/organizations") && !page.includes("fetch('/api/organizations"), "organizations page must not depend on client-side /api/organizations fetch");
check(!page.includes("TODO: complete"), "organizations page must not contain legacy TODO marker");

check(api.includes("requireAuthSession"), "organizations API must require an authenticated session");
check(api.includes("requireRole") && api.includes('"SUPER_ADMIN"'), "organizations API must require SUPER_ADMIN role");
check(api.includes("organizationService.create(data)"), "organizations API POST must use central SUPER_ADMIN organization creation path");
check(!api.includes("createByUser"), "organizations API POST must not create organizations for non-SUPER_ADMIN users");

check(navPolicy.includes('| "organizations"') || navPolicy.includes('organizations: "/organizations"'), "navigation policy must include organizations key");
check(navPolicy.includes('"/organizations": ROLE_NAVIGATION_POLICY.organizations'), "route policy must publish /dashboard/organizations");
check(sidebar.includes('organizations: "سازمان‌ها"') && sidebar.includes('organizations: "Organizations"'), "sidebar must expose localized organizations navigation labels");

const failed = checks.filter((item) => !item.ok);
if (failed.length > 0) {
  for (const item of failed) console.error(`�— ${item.message}`);
  throw new Error(`Dashboard organizations publish validation failed: ${failed.length} issue(s)`);
}

console.log("Dashboard organizations publish validation passed.");
