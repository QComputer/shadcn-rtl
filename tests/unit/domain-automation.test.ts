import { after, before, mock, test } from "node:test";
import assert from "node:assert";

// Mock @/lib/api-guards to prevent import side effects
mock.module("@/lib/api-guards", {
  namedExports: { ApiError: class ApiError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } } },
});

// Mock @/lib/custom-domain-routing
mock.module("@/lib/custom-domain-routing", {
  namedExports: { normalizeDomainHost: (domain: string) => domain?.toLowerCase().trim() || "" },
});

// Mock @/lib/domains/domain-normalization.server
mock.module("@/lib/domains/domain-normalization.server", {
  namedExports: {
    getHostnamePreservingWww: (domain: string) => domain,
    isApexDomain: (domain: string) => domain?.includes(".") && !domain.startsWith("www.") ? true : false,
  },
});

// Mock process.env for deterministic behavior
const originalEnv = { ...process.env };

before(() => {
  // Clear RunFlare-specific env vars for deterministic dry-run testing
  delete process.env.RUNFLARE_INGRESS_HOST;
  delete process.env.RUNFLARE_INGRESS_IP;
  delete process.env.VERCEL_DOMAIN_AUTOMATION_DRY_RUN;
  delete process.env.CUSTOM_DOMAIN_REAL_MUTATION_ENABLED;
});

after(() => {
  process.env = originalEnv;
});

test("domain automation module exports expected types and functions", async () => {
  const mod = await import("@/lib/domain-automation.server");

  assert.ok(mod.addProjectDomain, "addProjectDomain exported");
  assert.ok(mod.removeProjectDomain, "removeProjectDomain exported");
  assert.ok(mod.verifyProjectDomain, "verifyProjectDomain exported");
  assert.ok(mod.inspectProjectDomain, "inspectProjectDomain exported");
  assert.ok(mod.getDomainAutomationState, "getDomainAutomationState exported");
  assert.ok(mod.getRecommendedDnsRecords, "getRecommendedDnsRecords exported");
  assert.ok(mod.domainUpdateFromResult, "domainUpdateFromResult exported");
  assert.ok(mod.getRecommendedDomainDnsRecords, "getRecommendedDomainDnsRecords exported");
  assert.ok(mod.isDomainAutomationConfigured, "isDomainAutomationConfigured exported");
  assert.ok(mod.isDomainAutomationDryRun, "isDomainAutomationDryRun exported");
});

test("getDomainAutomationState reports unconfigured when no ingress set", async () => {
  const mod = await import("@/lib/domain-automation.server");

  const state = mod.getDomainAutomationState();
  assert.equal(state.configured, false);
  assert.equal(state.dryRun, true); // default dry-run
  assert.equal(state.ingressConfigured, false);
  assert.equal(state.realMutationsEnabled, false);
});

test("getDomainAutomationState reports configured when ingress host set", async () => {
  process.env.RUNFLARE_INGRESS_HOST = "runflare.example.com";

  const mod = await import("@/lib/domain-automation.server");
  const state = mod.getDomainAutomationState();
  assert.equal(state.configured, true);
  assert.equal(state.ingressConfigured, true);
});

test("dry run result has correct structure", async () => {
  const mod = await import("@/lib/domain-automation.server");

  const result = await mod.addProjectDomain("shop.example.com");

  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.action, "add");
  assert.equal(result.domain, "shop.example.com");
  assert.equal(result.verified, false);
  assert.equal(result.status, "VERIFYING");
  assert.equal(result.projectId, null);
  assert.equal(result.verificationToken, null);
  assert.ok(Array.isArray(result.verification));
  assert.ok(Array.isArray(result.dnsRecords));
});

test("getRecommendedDnsRecords returns A record for apex domain when ingress IP set", async () => {
  process.env.RUNFLARE_INGRESS_IP = "192.0.2.1";

  const mod = await import("@/lib/domain-automation.server");
  const records = mod.getRecommendedDnsRecords("example.com");

  const apexARecord = records.find((r) => r.type === "A" && r.name === "@");
  assert.ok(apexARecord, "A record for apex domain should exist");
  assert.equal(apexARecord.value, "192.0.2.1");
  assert.equal(apexARecord.purpose, "Point the apex/root domain to the RunFlare ingress");
});

test("getRecommendedDnsRecords returns CNAME for subdomain when ingress host set", async () => {
  delete process.env.RUNFLARE_INGRESS_IP;
  process.env.RUNFLARE_INGRESS_HOST = "ingress.runflare.com";

  const mod = await import("@/lib/domain-automation.server");
  const records = mod.getRecommendedDnsRecords("shop.example.com");

  const cnameRecord = records.find((r) => r.type === "CNAME");
  assert.ok(cnameRecord, "CNAME record for subdomain should exist");
  assert.equal(cnameRecord.value, "ingress.runflare.com");
});

test("domainUpdateFromResult maps dry run to lastCheckedAt and failureReason", async () => {
  const mod = await import("@/lib/domain-automation.server");

  const dryRunResult = {
    ok: true,
    dryRun: true,
    action: "add" as const,
    domain: "example.com",
    verified: false,
    status: "VERIFYING" as const,
    message: "Dry-run: would add example.com",
    projectId: null,
    verificationToken: null,
    verification: [],
    dnsRecords: [],
  };

  const update = mod.domainUpdateFromResult(dryRunResult);
  assert.ok(update.lastCheckedAt instanceof Date);
  assert.equal(update.failureReason, "Dry-run: would add example.com");
});

test("domainUpdateFromResult nullifies IDs on removal", async () => {
  const mod = await import("@/lib/domain-automation.server");

  const removeResult = {
    ok: true,
    dryRun: false,
    action: "remove" as const,
    domain: "example.com",
    verified: false,
    status: "DNS_REQUIRED" as const,
    message: "Removed",
    projectId: "proj-123",
    verificationToken: "tok-456",
    verification: [],
    dnsRecords: [],
  };

  const update = mod.domainUpdateFromResult(removeResult);
  assert.equal(update.vercelProjectDomainId, null);
  assert.equal(update.verificationToken, null);
  assert.equal(update.status, "DNS_REQUIRED");
});

test("addProjectDomain throws on invalid domain", async () => {
  const mod = await import("@/lib/domain-automation.server");

  await assert.rejects(
    () => mod.addProjectDomain(""),
    /Domain is required/
  );
});
