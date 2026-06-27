import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) });
}

const files = {
  page: "app/[locale]/dashboard/shop-domains/page.tsx",
  client: "components/dashboard/shop-domain-manager.tsx",
  api: "app/api/dashboard/shop-domains/route.ts",
  orgApi: "app/api/organizations/[id]/domains/route.ts",
  orgDomainApi: "app/api/organizations/[id]/domains/[domainId]/route.ts",
  policy: "lib/dashboard/navigation-policy.ts",
  access: "lib/access-control.ts",
  sidebar: "components/dashboard/dashboard-sidebar.tsx",
  helper: "lib/shop-domain-admin.ts",
};

for (const [key, path] of Object.entries(files)) {
  check(`${key} file exists`, existsSync(join(root, path)));
}

const page = read(files.page);
const client = read(files.client);
const api = read(files.api);
const orgApi = read(files.orgApi);
const orgDomainApi = read(files.orgDomainApi);
const policy = read(files.policy);
const access = read(files.access);
const sidebar = read(files.sidebar);
const helper = read(files.helper);
const pkg = JSON.parse(read("package.json"));

check("dashboard route is server-gated to SUPER_ADMIN", page.includes('session.user.role !== "SUPER_ADMIN"'));
check("dashboard route renders central manager", page.includes("<ShopDomainManager"));
check("global shop-domain API requires auth", api.includes("requireAuthSession"));
check("global shop-domain API requires SUPER_ADMIN", api.includes("requireSuperAdmin(session)"));
check("global shop-domain API can connect domain to selected shop", api.includes("organizationId") && api.includes("assertShopOrganization"));
check("global shop-domain API only targets SHOP organizations", api.includes('type: "SHOP"'));
check("global shop-domain API supports reassignment", api.includes("PATCH") && api.includes("targetOrganizationId"));
check("global shop-domain API supports removal", api.includes("export async function DELETE"));
check("legacy organization domain collection API is super-admin-only", orgApi.includes("requireSuperAdmin(session)") && !orgApi.includes("resolveManageableOrganizationId"));
check("legacy organization domain item API is super-admin-only", orgDomainApi.includes("requireSuperAdmin(session)") && !orgDomainApi.includes("resolveManageableOrganizationId"));
check("domain helper centralizes super-admin requirement", helper.includes("requireSuperAdmin") && helper.includes('requireRole(session, ["SUPER_ADMIN"])'));
check("domain helper validates hostname", helper.includes("validateShopDomainInput") && helper.includes("valid hostname"));
check("route access registry includes shop-domains", access.includes('"/dashboard/shop-domains"') && access.includes('allowedRoles: ["SUPER_ADMIN"]'));
check("navigation policy includes shopDomains key", policy.includes('| "shopDomains"') && policy.includes('shopDomains: "/shop-domains"'));
check("navigation policy restricts shopDomains to super admin", policy.includes('shopDomains: ["SUPER_ADMIN"]'));
check("navigation route policy includes /shop-domains", policy.includes('"/shop-domains": ROLE_NAVIGATION_POLICY.shopDomains'));
check("sidebar exposes shop domains for platform admin", sidebar.includes("shopDomains") && sidebar.includes("Shop domains"));
check("client UI states SUPER_ADMIN-only ownership", client.includes("SUPER_ADMIN only") && client.includes("only SUPER_ADMIN"));
check("client UI calls central API", client.includes('fetch("/api/dashboard/shop-domains"'));
check("client UI does not use Button asChild", !client.includes("asChild"));
check("package exposes quality script", pkg.scripts?.["quality:shop-domain-admin"] === "node scripts/quality/validate-shop-domain-admin.mjs");

const failed = checks.filter((item) => !item.ok);

for (const item of checks) {
  console.log(`${item.ok ? "✓" : "✗"} ${item.name}`);
}

if (failed.length > 0) {
  console.error(`\nShop domain admin validation failed: ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("\nShop domain admin validation passed.");
