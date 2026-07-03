import { existsSync, readFileSync } from "node:fs";
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
  vercelLib: "lib/vercel-domain-automation.ts",
  helper: "lib/shop-domain-admin.ts",
  api: "app/api/dashboard/shop-domains/route.ts",
  actionApi: "app/api/dashboard/shop-domains/[domainId]/vercel/route.ts",
  client: "components/dashboard/shop-domain-manager.tsx",
  envExample: ".env.example",
  docs: "docs/PHASE_63_VERCEL_CUSTOM_DOMAIN_AUTOMATION.md",
  setup: "scripts/setup-register-vercel-domain-automation-package-scripts.mjs",
  pkg: "package.json",
};

for (const [key, path] of Object.entries(files)) {
  check(`${key} file exists`, existsSync(join(root, path)));
}

const vercelLib = read(files.vercelLib);
const helper = read(files.helper);
const api = read(files.api);
const actionApi = read(files.actionApi);
const client = read(files.client);
const envExample = read(files.envExample);
const docs = read(files.docs);
const pkg = JSON.parse(read(files.pkg));

check("Vercel lib uses the project-domain add endpoint", vercelLib.includes("/v10/projects/") && vercelLib.includes("/domains"));
check("Vercel lib uses bearer token auth", vercelLib.includes("VERCEL_ACCESS_TOKEN") && vercelLib.includes("Authorization: `Bearer"));
check("Vercel lib supports team scoping", vercelLib.includes("VERCEL_TEAM_ID") && vercelLib.includes("VERCEL_TEAM_SLUG"));
check("Vercel lib supports dry-run mode", vercelLib.includes("VERCEL_DOMAIN_AUTOMATION_DRY_RUN") && vercelLib.includes("dryRunResult"));
check("Vercel lib exposes DNS guidance", vercelLib.includes("getRecommendedVercelDnsRecords") && vercelLib.includes("76.76.21.21") && vercelLib.includes("cname.vercel-dns.com"));
check("Helper accepts provisionOnVercel on create", helper.includes("provisionOnVercel"));
check("Helper defines Vercel action schema", helper.includes("vercelShopDomainActionSchema") && helper.includes("add") && helper.includes("check") && helper.includes("remove"));
check("Central API returns automation state", api.includes("getVercelDomainAutomationState") && api.includes("vercelAutomation"));
check("Central API can provision on create", api.includes("provisionOnVercel") && api.includes("addProjectDomainToVercel"));
check("Central API writes audit logs", api.includes("writeAuditLog") && api.includes("OrganizationDomain"));
check("Vercel action API is SUPER_ADMIN-only", actionApi.includes("requireAuthSession") && actionApi.includes("requireSuperAdmin(session)"));
check("Vercel action API supports add/check/remove", actionApi.includes("addProjectDomainToVercel") && actionApi.includes("verifyProjectDomainOnVercel") && actionApi.includes("removeProjectDomainFromVercel"));
check("Vercel action API updates local domain status", actionApi.includes("domainUpdateFromVercelResult") && actionApi.includes("lastCheckedAt"));
check("Vercel action API writes audit logs", actionApi.includes("writeAuditLog") && actionApi.includes("Vercel domain"));
check("Client shows automation configuration state", client.includes("vercelAutomation") && client.includes("automationDisabled") && client.includes("automationDryRun"));
check("Client can provision on create", client.includes("newProvisionOnVercel") && client.includes("provisionOnVercel"));
check("Client calls Vercel action endpoint", client.includes('/vercel') && client.includes("runVercelAction"));
check("Client exposes add/check/remove buttons", client.includes("addToVercel") && client.includes("checkVercel") && client.includes("removeFromVercel"));
check("Client displays DNS records", client.includes("dnsRecords") && client.includes("record.value"));
check("Client does not use Button asChild", !client.includes("asChild"));
check("env example documents required Vercel vars", envExample.includes("VERCEL_ACCESS_TOKEN=") && envExample.includes("VERCEL_PROJECT_ID=") && envExample.includes("VERCEL_DOMAIN_AUTOMATION_DRY_RUN=true"));
check("docs mention SUPER_ADMIN and dry-run", docs.includes("SUPER_ADMIN") && docs.includes("dry-run"));
check("setup script can register quality script", read(files.setup).includes("quality:vercel-domain-automation"));
check("package exposes quality script", pkg.scripts?.["quality:vercel-domain-automation"] === "node scripts/quality/validate-vercel-domain-automation.mjs");

const failed = checks.filter((item) => !item.ok);

for (const item of checks) {
  console.log(`${item.ok ? "✓" : "�—"} ${item.name}`);
}

if (failed.length > 0) {
  console.error(`\nVercel domain automation validation failed: ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("\nVercel domain automation validation passed.");
