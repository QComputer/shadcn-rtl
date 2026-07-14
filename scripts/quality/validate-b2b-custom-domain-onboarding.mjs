#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = [];

function add(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function includes(rel, needle, label = `${rel} includes ${needle}`) {
  add(label, read(rel).includes(needle), needle);
}

function includesSchema(section, needles) {
  const schema = read("prisma/schema.prisma");
  const sectionStart = schema.indexOf(section);
  if (sectionStart === -1) {
    add(section + " exists", false);
    return false;
  }

  add(section + " exists", true);

  const after = schema.slice(sectionStart);
  const nextSection = after.indexOf("\nmodel ");
  const sectionContent = nextSection === -1 ? after : after.slice(0, nextSection);

  let ok = true;
  for (const needle of needles) {
    const found = sectionContent.includes(needle);
    add(`${section} includes ${needle}`, found);
    ok = ok && found;
  }

  return ok;
}

const checks = [
  {
    name: "OrganizationDomain model extended with P11 fields",
    test: () =>
      includesSchema("model OrganizationDomain", [
        "DomainKind",
        "DomainProvider",
        "kind                  DomainKind",
        "provider              DomainProvider",
        "providerVerified      Boolean",
        "dnsConfigured         Boolean",
        "sslReady              Boolean",
        "verificationType      String?",
        "verificationValue     String?",
        "activatedAt           DateTime?",
        "reviewedAt            DateTime?",
        "lastErrorCode         String?",
        "deletedAt             DateTime?",
        "createdBy             User?",
      ]),
  },
  {
    name: "DomainStatus enum extended with P11 values",
    test: () =>
      includesSchema("enum DomainStatus", [
        "REQUESTED",
        "PROVIDER_PENDING",
        "ERROR",
        "DISABLED",
        "REMOVAL_PENDING",
        "REMOVED",
      ]),
  },
  {
    name: "DomainKind enum exists",
    test: () => includesSchema("enum DomainKind", ["APEX", "SUBDOMAIN"]),
  },
  {
    name: "DomainProvider enum exists",
    test: () => includesSchema("enum DomainProvider", ["VERCEL"]),
  },
  {
    name: "P11 migration exists",
    test: () =>
      exists("prisma/migrations/20260708000100_custom_domain_onboarding/migration.sql"),
  },
  {
    name: "Domain normalization server utility exists",
    test: () =>
      includes("lib/domains/domain-normalization.server.ts", "export function validateRawDomain"),
  },
  {
    name: "Domain validation rejects platform hosts",
    test: () =>
      includes("lib/domains/domain-normalization.server.ts", "isPlatformHost"),
  },
  {
    name: "Domain validation rejects URL-like input",
    test: () =>
      includes("lib/domains/domain-normalization.server.ts", "/[/?#]/"),
  },
  {
    name: "Domain normalization exports Apex detection",
    test: () =>
      includes("lib/domains/domain-normalization.server.ts", "export function getApexDomainInfo"),
  },
  {
    name: "Vercel automation has P11 safety gate",
    test: () =>
      includes("lib/vercel-domain-automation.ts", "function assertVercelDomainMutationAllowed"),
  },
  {
    name: "Vercel automation requires exact real-mutation ACK",
    test: () =>
      includes("lib/vercel-domain-automation.ts", "CUSTOM_DOMAIN_REAL_MUTATION_ACK_VALUE"),
  },
  {
    name: "Vercel automation supports server-only VERCEL_API_TOKEN",
    test: () =>
      includes("lib/vercel-domain-automation.ts", "VERCEL_API_TOKEN"),
  },
  {
    name: "Vercel automation does not expose raw provider payloads",
    test: () => {
      const source = read("lib/vercel-domain-automation.ts");
      add("lib/vercel-domain-automation.ts excludes raw result field", !/\braw\??:|raw:/.test(source));
    },
  },
  {
    name: "Dashboard organization-domains API exists",
    test: () =>
      includes("app/api/dashboard/organization-domains/route.ts", "OrganizationDomain"),
  },
  {
    name: "Dashboard organization-domains vercel state API exists",
    test: () =>
      includes(
        "app/api/dashboard/organization-domains/vercel-automation/route.ts",
        "getVercelDomainAutomationState",
      ),
  },
  {
    name: "Dashboard organization-domains action API exists",
    test: () =>
      includes(
        "app/api/dashboard/organization-domains/[domainId]/vercel/route.ts",
        "organizationDomainActionSchema",
      ),
  },
  {
    name: "Dashboard primary domain action requires ACTIVE status",
    test: () =>
      includes("app/api/dashboard/organization-domains/[domainId]/route.ts", "Only ACTIVE verified domains can be set as primary"),
  },
  {
    name: "Dashboard create route prevents pending primary domains",
    test: () =>
      includes("app/api/dashboard/organization-domains/route.ts", "Only ACTIVE verified domains can be set as primary"),
  },
  {
    name: "Dashboard domains settings page exists",
    test: () =>
      exists("app/[locale]/dashboard/settings/domains/page.tsx"),
  },
  {
    name: "Proxy supports appointment custom domains",
    test: () =>
      includes("proxy.ts", 'organizationType === "APPOINTMENT"'),
  },
  {
    name: "Domain resolver supports non-shop organization types",
    test: () =>
      includes(
        "lib/domains/domain-resolver.server.ts",
        "organizationType: domain.organization.type",
      ),
  },
  {
    name: "SEO helpers support both organization types",
    test: () =>
      includes(
        "lib/custom-domain-seo.ts",
        'organizationType: "SHOP" | "APPOINTMENT"',
      ),
  },
  {
    name: "Legacy validators preserved",
    test: () =>
      includes("lib/shop-domain-admin.ts", "validateShopDomainInput"),
  },
  {
    name: "Legacy validators use strict submitted-domain validation",
    test: () =>
      includes("lib/shop-domain-admin.ts", "validateRawDomain"),
  },
  {
    name: "Legacy Super Admin create route prevents pending primary domains",
    test: () =>
      includes("app/api/organizations/[id]/domains/route.ts", "Only ACTIVE verified domains can be set as primary"),
  },
  {
    name: "Shop-domain admin create and update require ACTIVE primary domains",
    test: () =>
      includes("app/api/dashboard/shop-domains/route.ts", "Only ACTIVE verified domains can be set as primary"),
  },
  {
    name: "Organization Vercel dry-run does not write provider status as real state",
    test: () =>
      includes("app/api/dashboard/organization-domains/[domainId]/vercel/route.ts", "if (result.dryRun)"),
  },
  {
    name: "Shop Vercel dry-run does not write provider status as real state",
    test: () =>
      includes("app/api/dashboard/shop-domains/[domainId]/vercel/route.ts", "if (result.dryRun)"),
  },
  {
    name: "P11 documentation exists",
    test: () =>
      exists("docs/P11_CUSTOM_DOMAIN_ONBOARDING.md"),
  },
  {
    name: "DNS guide exists",
    test: () =>
      exists("docs/P11_DNS_GUIDE_FA.md"),
  },
  {
    name: "Provider safety docs exist",
    test: () =>
      exists("docs/P11_PROVIDER_SAFETY.md"),
  },
  {
    name: "Host routing docs exist",
    test: () =>
      exists("docs/P11_CUSTOM_DOMAIN_HOST_ROUTING.md"),
  },
  {
    name: "Migration note exists",
    test: () =>
      exists("docs/P11_MIGRATION_NOTE.md"),
  },
  {
    name: "Rollback policy exists",
    test: () =>
      exists("docs/P11_ROLLBACK_POLICY.md"),
  },
];

for (const check of checks) {
  try {
    check.test();
  } catch (err) {
    add(check.name, false, err instanceof Error ? err.message : String(err));
  }
}

const packageJson = JSON.parse(read("package.json"));
const envExample = read(".env.example");
add(
  "package.json exposes quality:b2b-custom-domain-onboarding",
  packageJson.scripts?.["quality:b2b-custom-domain-onboarding"] ===
    "node scripts/quality/validate-b2b-custom-domain-onboarding.mjs",
);
add(".env.example includes VERCEL_API_TOKEN placeholder", /(^|\n)VERCEL_API_TOKEN=\s*(\n|$)/.test(envExample));
add(".env.example includes exact ACK placeholder", /(^|\n)CUSTOM_DOMAIN_REAL_MUTATION_ACK=\s*(\n|$)/.test(envExample));

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`B2B custom-domain onboarding validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("B2B custom-domain onboarding validation passed.");
