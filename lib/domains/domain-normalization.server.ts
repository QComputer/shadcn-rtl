import { ApiError } from "@/lib/api-guards";
import { DomainKind, DomainProvider, DomainStatus } from "@prisma/client";
import { isPlatformHost, normalizeDomainHost } from "@/lib/custom-domain-routing";

export { normalizeDomainHost };

export type DomainNormalizationInput = {
  rawDomain: string;
  organizationId: string;
  kind?: DomainKind;
  provider?: DomainProvider;
};

export type NormalizedDomain = {
  rawDomain: string;
  normalizedDomain: string;
  kind: DomainKind;
  provider: DomainProvider;
  isApex: boolean;
  labels: string[];
  sld: string;
  tld: string;
};

export type ApexDomainInfo = {
  isApex: boolean;
  primaryLabel: string;
  recommendedAlias: string;
};

export function validateRawDomain(rawDomain: string): string {
  const raw = rawDomain.trim();

  if (/^https?:\/\//i.test(raw) || /[/?#]/.test(raw) || raw.includes(":")) {
    throw new ApiError(400, "Domain must be a hostname only, such as example.ir");
  }

  const normalizedDomain = normalizeDomainHost(rawDomain);

  if (!normalizedDomain || normalizedDomain === "localhost" || normalizedDomain.endsWith(".localhost")) {
    throw new ApiError(400, "Invalid custom domain");
  }

  if (isPlatformHost(normalizedDomain)) {
    throw new ApiError(400, "Platform and reserved hosts cannot be used as custom domains");
  }

  if (normalizedDomain.includes("*")) {
    throw new ApiError(400, "Wildcard domains are not supported");
  }

  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(normalizedDomain)) {
    throw new ApiError(400, "Domain must be a valid hostname, such as example.ir");
  }

  const tld = normalizedDomain.split(".").pop() || "";
  if (tld.length < 2 || /^\d+$/.test(tld)) {
    throw new ApiError(400, "Domain must include a valid top-level domain");
  }

  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(normalizedDomain)) {
    throw new ApiError(400, "Domain must not be an IP address");
  }

  return normalizedDomain;
}

export function isApexDomain(domain: string): boolean {
  const normalized = normalizeDomainHost(domain);
  if (!normalized) return false;
  return normalized.split(".").length === 2;
}

export function getDomainLabels(domain: string): string[] {
  const normalized = normalizeDomainHost(domain);
  if (!normalized) return [];
  return normalized.split(".").filter(Boolean);
}

export function getSld(domain: string): string {
  const labels = getDomainLabels(domain);
  if (labels.length === 0) return "";
  return labels[labels.length - 2] || labels[0] || "";
}

export function getTld(domain: string): string {
  const labels = getDomainLabels(domain);
  if (labels.length === 0) return "";
  return labels[labels.length - 1] || "";
}

export function normalizeDomainInput(input: DomainNormalizationInput): NormalizedDomain {
  const normalizedDomain = validateRawDomain(input.rawDomain);
  const kind = input.kind ?? (isApexDomain(normalizedDomain) ? "APEX" : "SUBDOMAIN");
  const provider = input.provider ?? "VERCEL";
  const labels = getDomainLabels(normalizedDomain);

  return {
    rawDomain: input.rawDomain.trim(),
    normalizedDomain,
    kind,
    provider,
    isApex: kind === "APEX",
    labels,
    sld: getSld(normalizedDomain),
    tld: getTld(normalizedDomain),
  };
}

export function getApexDomainInfo(domain: string): ApexDomainInfo {
  const normalized = normalizeDomainHost(domain);

  if (!normalized) {
    throw new ApiError(400, "Domain is required to determine apex info");
  }

  const labels = getDomainLabels(normalized);

  if (labels.length <= 2) {
    return {
      isApex: true,
      primaryLabel: normalized,
      recommendedAlias: `www.${normalized}`,
    };
  }

  const sld = labels[labels.length - 2];
  const tld = labels[labels.length - 1];
  const apex = `${sld}.${tld}`;

  return {
    isApex: false,
    primaryLabel: apex,
    recommendedAlias: `www.${apex}`,
  };
}

export function mapVercelStatusToDomainStatus(vercelStatus: string): DomainStatus {
  switch (vercelStatus) {
    case "ACTIVE":
      return "ACTIVE";
    case "VERIFYING":
      return "VERIFYING";
    case "DNS_REQUIRED":
      return "DNS_REQUIRED";
    case "ERROR":
      return "ERROR";
    default:
      return "REQUESTED";
  }
}

export function getDefaultDomainStatus(kind: DomainKind, providerVerified: boolean): DomainStatus {
  if (providerVerified) return "VERIFYING";

  switch (kind) {
    case "APEX":
      return "DNS_REQUIRED";
    case "SUBDOMAIN":
    default:
      return "DNS_REQUIRED";
  }
}

export function isTerminalDomainStatus(status: DomainStatus | string): boolean {
  return ["ACTIVE", "DISABLED", "REMOVED"].includes(status);
}

export function isEditableDomainStatus(status: DomainStatus | string): boolean {
  return !isTerminalDomainStatus(status);
}

export function getRecommendedVercelDnsRecords(
  domainInput: string,
  verification: { domain: string; value: string; type?: string; reason?: string }[] = [],
): { type: "A" | "CNAME" | "TXT"; name: string; value: string; purpose: string }[] {
  const domain = normalizeDomainHost(domainInput);
  const records: { type: "A" | "CNAME" | "TXT"; name: string; value: string; purpose: string }[] = [];

  if (!domain) {
    return records;
  }

  if (isApexDomain(domain)) {
    records.push({
      type: "A",
      name: "@",
      value: "76.76.21.21",
      purpose: "Point the apex/root domain to Vercel",
    });
    records.push({
      type: "CNAME",
      name: "www",
      value: "cname.vercel-dns.com",
      purpose: "Optional www subdomain for Vercel",
    });
  } else {
    records.push({
      type: "CNAME",
      name: domain,
      value: "cname.vercel-dns.com",
      purpose: "Point this subdomain to Vercel",
    });
  }

  for (const record of verification) {
    records.push({
      type: "TXT",
      name: record.domain,
      value: record.value,
      purpose: record.reason || "Verify domain ownership for this Vercel project",
    });
  }

  return records;
}
