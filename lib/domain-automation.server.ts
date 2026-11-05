import "server-only";
import { promises as dns } from "node:dns";
import { ApiError } from "@/lib/api-guards";
import { normalizeDomainHost } from "@/lib/custom-domain-routing";
import { getHostnamePreservingWww, isApexDomain } from "@/lib/domains/domain-normalization.server";

/**
 * RunFlare-compatible domain automation.
 *
 * This module replaces lib/vercel-domain-automation.ts (deprecated). It generates
 * DNS records for manual configuration and verifies DNS resolution via node:dns.
 * It does NOT invoke any Vercel API. The /vercel/ route names are retained as
 * compatibility aliases but route to this provider-neutral implementation.
 *
 * Deprecation plan:
 * - lib/vercel-domain-automation.ts remains for backward-compatible test imports only.
 * - /vercel/ API route paths remain as compatibility aliases.
 * - Future cleanup: remove vercel-domain-automation.ts and rename /vercel/ routes
 *   after all clients and tests migrate to provider-neutral endpoints.
 */

export type DomainVerificationRecord = {
  type: string;
  domain: string;
  value: string;
  reason?: string;
};

export type DomainDnsRecord = {
  type: "A" | "CNAME" | "TXT";
  name: string;
  value: string;
  purpose: string;
};

export type DomainAutomationResult = {
  ok: boolean;
  dryRun: boolean;
  action: "add" | "check" | "remove";
  domain: string;
  verified: boolean;
  status: "ACTIVE" | "VERIFYING" | "DNS_REQUIRED" | "ERROR";
  message: string;
  projectId?: string | null;
  verificationToken?: string | null;
  verification: DomainVerificationRecord[];
  dnsRecords: DomainDnsRecord[];
};

function isTruthyEnv(value: string | undefined) {
  return value === "1" || value?.toLowerCase() === "true" || value?.toLowerCase() === "yes";
}

export function isDomainAutomationDryRun() {
  const val = process.env.RUNFLARE_DOMAIN_AUTOMATION_DRY_RUN ?? process.env.VERCEL_DOMAIN_AUTOMATION_DRY_RUN;
  if (val === undefined) return true;
  return isTruthyEnv(val);
}

function getRunflareIngressHost(): string | null {
  const value = process.env.RUNFLARE_INGRESS_HOST?.trim();
  return value ? value : null;
}

function getRunflareIngressIp(): string | null {
  const value = process.env.RUNFLARE_INGRESS_IP?.trim();
  return value ? value : null;
}

export function isDomainAutomationConfigured() {
  return Boolean(getRunflareIngressHost() || getRunflareIngressIp());
}

export type DomainAutomationState = {
  configured: boolean;
  dryRun: boolean;
  ingressConfigured: boolean;
  realMutationsEnabled: boolean;
};

function isRealMutationEnabled() {
  return isTruthyEnv(process.env.CUSTOM_DOMAIN_REAL_MUTATION_ENABLED);
}

export function getDomainAutomationState(): DomainAutomationState {
  return {
    configured: isDomainAutomationConfigured(),
    dryRun: isDomainAutomationDryRun(),
    ingressConfigured: isDomainAutomationConfigured(),
    realMutationsEnabled: isRealMutationEnabled(),
  };
}

export function getRecommendedDnsRecords(
  domainInput: string,
  verification: Array<{ domain: string; value: string; type?: string; reason?: string }> = [],
): DomainDnsRecord[] {
  const domain = getHostnamePreservingWww(domainInput);
  const canonicalDomain = normalizeDomainHost(domainInput);
  const ingressHost = getRunflareIngressHost();
  const ingressIp = getRunflareIngressIp();
  const records: DomainDnsRecord[] = [];

  if (!domain) {
    return records;
  }

  if (domain === canonicalDomain && isApexDomain(domain)) {
    if (ingressIp) {
      records.push({
        type: "A",
        name: "@",
        value: ingressIp,
        purpose: "Point the apex/root domain to the RunFlare ingress",
      });
    }
    if (ingressHost) {
      records.push({
        type: "CNAME",
        name: "www",
        value: ingressHost,
        purpose: "Optional www subdomain for RunFlare ingress",
      });
    }
  } else {
    if (ingressHost) {
      const cnameTarget = domain.endsWith(ingressHost) ? `www.${canonicalDomain}` : domain;
      records.push({
        type: "CNAME",
        name: cnameTarget,
        value: ingressHost,
        purpose: "Point this subdomain to the RunFlare ingress",
      });
    }
  }

  for (const record of verification) {
    records.push({
      type: "TXT",
      name: record.domain,
      value: record.value,
      purpose: record.reason || "Verify domain ownership for this platform",
    });
  }

  return records;
}

async function resolveDns(domain: string): Promise<{ ips: string[]; cnames: string[]; txts: string[] }> {
  const result = { ips: [] as string[], cnames: [] as string[], txts: [] as string[] };
  try {
    const [aRecords, cnameRecords, txtRecords] = await Promise.allSettled([
      dns.resolve4(domain).catch(() => [] as string[]),
      dns.resolveCname(domain).catch(() => [] as string[]),
      dns.resolveTxt(domain).catch(() => [] as string[][]),
    ]);
    if (aRecords.status === "fulfilled") result.ips = aRecords.value;
    if (cnameRecords.status === "fulfilled") {
      const resolved = await Promise.all(
        cnameRecords.value.map(async (target) => {
          try {
            const ips = await dns.resolve4(target);
            return ips;
          } catch {
            return [] as string[];
          }
        }),
      );
      result.cnames = resolved.flat();
    }
    if (txtRecords.status === "fulfilled") result.txts = txtRecords.value.flat();
  } catch {
    // DNS resolution failure — domain not verified
  }
  return result;
}

async function verifyDomainDns(domainInput: string): Promise<{ verified: boolean; reason: string }> {
  const ingressHost = getRunflareIngressHost();
  const ingressIp = getRunflareIngressIp();
  if (!ingressHost && !ingressIp) {
    return { verified: false, reason: "RunFlare ingress host and IP are not configured" };
  }

  const normalized = normalizeDomainHost(domainInput);
  if (!normalized) return { verified: false, reason: "Domain is required" };

  const { ips, cnames } = await resolveDns(normalized);

  if (ingressIp && ips.includes(ingressIp)) return { verified: true, reason: "A record resolves to RunFlare ingress" };
  if (ingressHost && cnames.length > 0 && ingressHost) {
    try {
      const cnameTarget = await dns.resolveCname(normalized);
      if (cnameTarget.includes(ingressHost)) {
        return { verified: true, reason: "CNAME points to RunFlare ingress" };
      }
    } catch {
      // fall through
    }
  }

  return { verified: false, reason: "DNS does not resolve to RunFlare ingress" };
}

function dryRunResult(action: "add" | "check" | "remove", domainInput: string): DomainAutomationResult {
  const domain = normalizeDomainHost(domainInput);
  return {
    ok: true,
    dryRun: true,
    action,
    domain: domain || domainInput,
    verified: false,
    status: action === "remove" ? "DNS_REQUIRED" : "VERIFYING",
    message: `Dry-run: would ${action} ${domain || domainInput} on the RunFlare platform. Configure DNS to complete verification.`,
    projectId: null,
    verificationToken: null,
    verification: [],
    dnsRecords: getRecommendedDnsRecords(domain || domainInput),
  };
}

async function checkResult(domainInput: string): Promise<DomainAutomationResult> {
  const domain = normalizeDomainHost(domainInput);
  if (!domain) throw new ApiError(400, "Domain is required");

  if (isDomainAutomationDryRun()) return dryRunResult("check", domain);

  const verification = await verifyDomainDns(domain);
  return {
    ok: true,
    dryRun: false,
    action: "check",
    domain,
    verified: verification.verified,
    status: verification.verified ? "ACTIVE" : "DNS_REQUIRED",
    message: verification.verified
      ? "Domain DNS resolves to the RunFlare ingress."
      : `DNS verification pending: ${verification.reason}`,
    projectId: null,
    verificationToken: null,
    verification: [],
    dnsRecords: getRecommendedDnsRecords(domain),
  };
}

export async function addProjectDomain(domainInput: string): Promise<DomainAutomationResult> {
  const domain = normalizeDomainHost(domainInput);
  if (!domain) throw new ApiError(400, "Domain is required");
  if (isDomainAutomationDryRun()) return dryRunResult("add", domain);

  const verification = await verifyDomainDns(domain);
  return {
    ok: true,
    dryRun: false,
    action: "add",
    domain,
    verified: verification.verified,
    status: verification.verified ? "ACTIVE" : "VERIFYING",
    message: verification.verified
      ? "Domain is verified and ready to serve."
      : `Domain added. Configure DNS to complete verification: ${verification.reason}`,
    projectId: null,
    verificationToken: null,
    verification: [],
    dnsRecords: getRecommendedDnsRecords(domain),
  };
}

export async function verifyProjectDomain(domainInput: string): Promise<DomainAutomationResult> {
  return checkResult(domainInput);
}

export async function inspectProjectDomain(domainInput: string): Promise<DomainAutomationResult> {
  return checkResult(domainInput);
}

export async function removeProjectDomain(domainInput: string): Promise<DomainAutomationResult> {
  const domain = normalizeDomainHost(domainInput);
  if (!domain) throw new ApiError(400, "Domain is required");
  if (isDomainAutomationDryRun()) return dryRunResult("remove", domain);

  return {
    ok: true,
    dryRun: false,
    action: "remove",
    domain,
    verified: false,
    status: "DNS_REQUIRED",
    message: "Domain removed from automation. Manually remove DNS records to complete cleanup.",
    projectId: null,
    verificationToken: null,
    verification: [],
    dnsRecords: getRecommendedDnsRecords(domain),
  };
}

export function domainUpdateFromResult(result: DomainAutomationResult) {
  if (result.dryRun) {
    return {
      lastCheckedAt: new Date(),
      failureReason: result.message,
    };
  }

  const isRemoval = result.action === "remove";
  return {
    vercelProjectDomainId: isRemoval ? null : result.projectId || null,
    verificationToken: isRemoval ? null : result.verificationToken || null,
    status: result.status,
    verifiedAt: result.verified ? new Date() : null,
    lastCheckedAt: new Date(),
    failureReason: result.ok ? null : result.message,
  };
}

export {
  getRecommendedDnsRecords as getRecommendedDomainDnsRecords,
};
