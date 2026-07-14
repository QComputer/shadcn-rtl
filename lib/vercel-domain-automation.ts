import { ApiError } from "@/lib/api-guards";
import { normalizeDomainHost } from "@/lib/custom-domain-routing";

export type VercelVerificationRecord = {
  type: string;
  domain: string;
  value: string;
  reason?: string;
};

export type VercelDnsRecord = {
  type: "A" | "CNAME" | "TXT";
  name: string;
  value: string;
  purpose: string;
};

export type VercelDomainAutomationResult = {
  ok: boolean;
  dryRun: boolean;
  action: "add" | "check" | "remove";
  domain: string;
  verified: boolean;
  status: "ACTIVE" | "VERIFYING" | "DNS_REQUIRED" | "ERROR";
  message: string;
  projectId?: string | null;
  verificationToken?: string | null;
  verification?: VercelVerificationRecord[];
  dnsRecords: VercelDnsRecord[];
};

type VercelProjectDomainResponse = {
  name?: string;
  apexName?: string;
  projectId?: string;
  verified?: boolean;
  verification?: Array<{
    type?: string;
    domain?: string;
    value?: string;
    reason?: string;
  }>;
};

type VercelApiErrorBody = {
  error?: string | {
    code?: string;
    message?: string;
  };
  message?: string;
};

const VERCEL_API_BASE_URL = "https://api.vercel.com";
const VERCEL_APEX_A_RECORD = "76.76.21.21";
const VERCEL_CNAME_RECORD = "cname.vercel-dns.com";
export const CUSTOM_DOMAIN_REAL_MUTATION_ACK_VALUE = "ENABLE_VERCEL_DOMAIN_MUTATIONS";

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ApiError(503, `${name} is not configured`);
  }
  return value;
}

function isTruthyEnv(value: string | undefined) {
  return value === "1" || value?.toLowerCase() === "true" || value?.toLowerCase() === "yes";
}

export function isVercelDomainAutomationDryRun() {
  return isTruthyEnv(process.env.VERCEL_DOMAIN_AUTOMATION_DRY_RUN);
}

export function isVercelDomainAutomationConfigured() {
  return Boolean(getOptionalVercelToken() && process.env.VERCEL_PROJECT_ID?.trim());
}

export function getVercelDomainAutomationState() {
  return {
    configured: isVercelDomainAutomationConfigured(),
    dryRun: isVercelDomainAutomationDryRun(),
    projectConfigured: Boolean(process.env.VERCEL_PROJECT_ID?.trim()),
    teamConfigured: Boolean(process.env.VERCEL_TEAM_ID?.trim() || process.env.VERCEL_TEAM_SLUG?.trim()),
    realMutationsEnabled: isVercelRealMutationEnabled(),
  };
}

function isVercelRealMutationEnabled() {
  return isTruthyEnv(process.env.CUSTOM_DOMAIN_REAL_MUTATION_ENABLED);
}

function hasExactRealMutationAck() {
  return process.env.CUSTOM_DOMAIN_REAL_MUTATION_ACK?.trim() === CUSTOM_DOMAIN_REAL_MUTATION_ACK_VALUE;
}

function getOptionalVercelToken() {
  return process.env.VERCEL_API_TOKEN?.trim() || process.env.VERCEL_ACCESS_TOKEN?.trim() || "";
}

function getVercelToken() {
  const value = getOptionalVercelToken();
  if (!value) {
    throw new ApiError(503, "VERCEL_API_TOKEN is not configured");
  }
  return value;
}

function getVercelQueryString() {
  const params = new URLSearchParams();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  const teamSlug = process.env.VERCEL_TEAM_SLUG?.trim();
  if (teamId) params.set("teamId", teamId);
  if (!teamId && teamSlug) params.set("slug", teamSlug);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function getProjectIdOrName() {
  return encodeURIComponent(getRequiredEnv("VERCEL_PROJECT_ID"));
}

function getDomainEndpoint(domain?: string, action?: "verify") {
  const projectIdOrName = getProjectIdOrName();
  const domainPath = domain ? `/${encodeURIComponent(domain)}` : "";
  const actionPath = action ? `/${action}` : "";
  return `${VERCEL_API_BASE_URL}/v10/projects/${projectIdOrName}/domains${domainPath}${actionPath}${getVercelQueryString()}`;
}

function normalizeVerification(verification: VercelProjectDomainResponse["verification"]): VercelVerificationRecord[] {
  if (!Array.isArray(verification)) return [];

  return verification
    .map((record) => ({
      type: String(record.type || "TXT"),
      domain: String(record.domain || ""),
      value: String(record.value || ""),
      reason: record.reason ? String(record.reason) : undefined,
    }))
    .filter((record) => Boolean(record.domain && record.value));
}

function getVerificationToken(records: VercelVerificationRecord[]) {
  return records.find((record) => record.type.toUpperCase() === "TXT")?.value || records[0]?.value || null;
}

function isApexDomain(domain: string) {
  return domain.split(".").length === 2;
}

function assertVercelDomainMutationAllowed() {
  if (!isVercelRealMutationEnabled()) {
    throw new ApiError(
      403,
      "Provider mutations are disabled by default. Set CUSTOM_DOMAIN_REAL_MUTATION_ENABLED=true to enable.",
    );
  }

  if (!hasExactRealMutationAck()) {
    throw new ApiError(
      403,
      `Provider mutations require CUSTOM_DOMAIN_REAL_MUTATION_ACK=${CUSTOM_DOMAIN_REAL_MUTATION_ACK_VALUE}.`,
    );
  }
}

export function getRecommendedVercelDnsRecords(domainInput: string, verification: VercelVerificationRecord[] = []): VercelDnsRecord[] {
  const domain = normalizeDomainHost(domainInput);
  const records: VercelDnsRecord[] = [];

  if (domain) {
    if (isApexDomain(domain)) {
      records.push({
        type: "A",
        name: "@",
        value: VERCEL_APEX_A_RECORD,
        purpose: "Point the apex/root domain to Vercel",
      });
      records.push({
        type: "CNAME",
        name: "www",
        value: VERCEL_CNAME_RECORD,
        purpose: "Optional www subdomain for Vercel",
      });
    } else {
      records.push({
        type: "CNAME",
        name: domain,
        value: VERCEL_CNAME_RECORD,
        purpose: "Point this subdomain to Vercel",
      });
    }
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

function errorMessageFromBody(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback;
  const errorBody = body as VercelApiErrorBody;
  const rawMessage =
    typeof errorBody.error === "string" && errorBody.error.trim()
      ? errorBody.error
      : errorBody.error && typeof errorBody.error === "object" && errorBody.error.message
        ? errorBody.error.message
        : typeof errorBody.message === "string" && errorBody.message.trim()
          ? errorBody.message
          : fallback;

  return rawMessage
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/(token|authorization|api[_-]?key)\s*[:=]\s*["']?[^"'\s,}]+/gi, "$1=[redacted]");
}

async function readJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function vercelFetch(url: string, init: RequestInit) {
  const token = getVercelToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const body = await readJsonSafe(response);
  return { response, body };
}

function resultFromProjectDomainResponse(input: {
  action: "add" | "check";
  domain: string;
  body: VercelProjectDomainResponse;
  message?: string;
}): VercelDomainAutomationResult {
  const verification = normalizeVerification(input.body.verification);
  const verified = input.body.verified === true;
  return {
    ok: true,
    dryRun: false,
    action: input.action,
    domain: input.domain,
    verified,
    status: verified ? "ACTIVE" : verification.length > 0 ? "VERIFYING" : "DNS_REQUIRED",
    message: input.message || (verified ? "Domain is verified on Vercel." : "Domain is waiting for Vercel DNS/ownership verification."),
    projectId: input.body.projectId || null,
    verificationToken: getVerificationToken(verification),
    verification,
    dnsRecords: getRecommendedVercelDnsRecords(input.domain, verification),
  };
}

function dryRunResult(action: "add" | "check" | "remove", domainInput: string): VercelDomainAutomationResult {
  const domain = normalizeDomainHost(domainInput);
  return {
    ok: true,
    dryRun: true,
    action,
    domain,
    verified: false,
    status: action === "remove" ? "DNS_REQUIRED" : "VERIFYING",
    message: `Dry-run: would ${action} ${domain} on the configured Vercel project.`,
    projectId: process.env.VERCEL_PROJECT_ID || null,
    verificationToken: null,
    verification: [],
    dnsRecords: getRecommendedVercelDnsRecords(domain),
  };
}

export async function addProjectDomainToVercel(domainInput: string): Promise<VercelDomainAutomationResult> {
  const domain = normalizeDomainHost(domainInput);
  if (!domain) throw new ApiError(400, "Domain is required");
  if (isVercelDomainAutomationDryRun()) return dryRunResult("add", domain);

  assertVercelDomainMutationAllowed();

  const { response, body } = await vercelFetch(getDomainEndpoint(), {
    method: "POST",
    body: JSON.stringify({ name: domain }),
  });

  if (!response.ok) {
    return {
      ok: false,
      dryRun: false,
      action: "add",
      domain,
      verified: false,
      status: "ERROR",
      message: errorMessageFromBody(body, `Vercel rejected domain provisioning with status ${response.status}.`),
      verification: [],
      verificationToken: null,
      dnsRecords: getRecommendedVercelDnsRecords(domain),
    };
  }

  return resultFromProjectDomainResponse({ action: "add", domain, body: body as VercelProjectDomainResponse, message: "Domain was added to the Vercel project." });
}

export async function verifyProjectDomainOnVercel(domainInput: string): Promise<VercelDomainAutomationResult> {
  const domain = normalizeDomainHost(domainInput);
  if (!domain) throw new ApiError(400, "Domain is required");
  if (isVercelDomainAutomationDryRun()) return dryRunResult("check", domain);

  assertVercelDomainMutationAllowed();

  const { response, body } = await vercelFetch(getDomainEndpoint(domain, "verify"), {
    method: "POST",
  });

  if (!response.ok) {
    return {
      ok: false,
      dryRun: false,
      action: "check",
      domain,
      verified: false,
      status: "ERROR",
      message: errorMessageFromBody(body, `Vercel domain verification failed with status ${response.status}.`),
      verification: [],
      verificationToken: null,
      dnsRecords: getRecommendedVercelDnsRecords(domain),
    };
  }

  return resultFromProjectDomainResponse({ action: "check", domain, body: body as VercelProjectDomainResponse });
}

export async function removeProjectDomainFromVercel(domainInput: string): Promise<VercelDomainAutomationResult> {
  const domain = normalizeDomainHost(domainInput);
  if (!domain) throw new ApiError(400, "Domain is required");
  if (isVercelDomainAutomationDryRun()) return dryRunResult("remove", domain);

  assertVercelDomainMutationAllowed();

  const projectIdOrName = getProjectIdOrName();
  const url = `${VERCEL_API_BASE_URL}/v9/projects/${projectIdOrName}/domains/${encodeURIComponent(domain)}${getVercelQueryString()}`;
  const { response, body } = await vercelFetch(url, { method: "DELETE" });

  if (!response.ok) {
    return {
      ok: false,
      dryRun: false,
      action: "remove",
      domain,
      verified: false,
      status: "ERROR",
      message: errorMessageFromBody(body, `Vercel domain removal failed with status ${response.status}.`),
      verification: [],
      verificationToken: null,
      dnsRecords: getRecommendedVercelDnsRecords(domain),
    };
  }

  return {
    ok: true,
    dryRun: false,
    action: "remove",
    domain,
    verified: false,
    status: "DNS_REQUIRED",
    message: "Domain was removed from the Vercel project.",
    projectId: process.env.VERCEL_PROJECT_ID || null,
    verification: [],
    verificationToken: null,
    dnsRecords: getRecommendedVercelDnsRecords(domain),
  };
}
