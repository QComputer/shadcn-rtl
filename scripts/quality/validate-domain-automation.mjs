#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));
const add = (name, pass, detail = "") => checks.push({ name, pass: Boolean(pass), detail });

const domainAutomation = exists("lib/domain-automation.server.ts") ? read("lib/domain-automation.server.ts") : "";
const shopDomainsApi = read("app/api/dashboard/shop-domains/route.ts");
const shopDomainActionApi = read("app/api/dashboard/shop-domains/[domainId]/vercel/route.ts");
const orgDomainActionApi = read("app/api/dashboard/organization-domains/[domainId]/vercel/route.ts");
const orgAutomationApi = read("app/api/dashboard/organization-domains/vercel-automation/route.ts");

add("domain automation module exists and is server-only", exists("lib/domain-automation.server.ts") && /import "server-only"/.test(domainAutomation));
add("domain automation module does not call Vercel API", !/api\.vercel\.com/.test(domainAutomation) && !/VERCEL_API_TOKEN|VERCEL_ACCESS_TOKEN/.test(domainAutomation));
add("domain automation module generates DNS records", /getRecommendedDnsRecords|getRecommendedDomainDnsRecords/.test(domainAutomation) && /CNAME|A /.test(domainAutomation));
add("domain automation module supports dry-run mode", /isDomainAutomationDryRun/.test(domainAutomation) && /dryRun/.test(domainAutomation));
add("domain automation module supports manual DNS verification", /verifyDomainDns|dns\.resolve/.test(domainAutomation));
add("domain automation module exposes add/remove/verify/inspect", /addProjectDomain/.test(domainAutomation) && /removeProjectDomain/.test(domainAutomation) && /verifyProjectDomain/.test(domainAutomation) && /inspectProjectDomain/.test(domainAutomation));
add("domain automation module exports automation state", /getDomainAutomationState/.test(domainAutomation));
add("domain automation module exports result type", /DomainAutomationResult/.test(domainAutomation));
add("shop domains API uses new domain automation module", !/vercel-domain-automation/.test(shopDomainsApi) && /domain-automation\.server/.test(shopDomainsApi));
add("shop domain action API uses new domain automation module", !/vercel-domain-automation/.test(shopDomainActionApi) && /domain-automation\.server/.test(shopDomainActionApi));
add("org domain action API uses new domain automation module", !/vercel-domain-automation/.test(orgDomainActionApi) && /domain-automation\.server/.test(orgDomainActionApi));
add("org automation state API uses new domain automation module", !/vercel-domain-automation/.test(orgAutomationApi) && /domain-automation\.server/.test(orgAutomationApi));
add("shop domains API returns domainAutomation state", /domainAutomation/.test(shopDomainsApi) && /getDomainAutomationState/.test(shopDomainsApi));
add("shop domains API provisions via addProjectDomain", /addProjectDomain/.test(shopDomainsApi));
add("API routes enforce SUPER_ADMIN authorization", /requireSuperAdmin/.test(shopDomainActionApi) && /requireAuthSession/.test(shopDomainActionApi));
add("org domain action route enforces ownership", /assertDomainOwnership/.test(orgDomainActionApi));
add("API routes write audit logs for domain mutations", /writeAuditLog/.test(shopDomainActionApi) && /writeAuditLog/.test(orgDomainActionApi));
add("domain automation result maps status to database fields", /status: result\.status/.test(domainAutomation) && /verifiedAt/.test(domainAutomation));
add("domain automation result handles removal (nullifies IDs)", /isRemoval/.test(domainAutomation));

for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(`\nDomain automation validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("\nDomain automation validation passed.");
