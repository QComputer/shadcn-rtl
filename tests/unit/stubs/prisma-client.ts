export const DomainKind = { APEX: "APEX", SUBDOMAIN: "SUBDOMAIN" } as const;
export const DomainProvider = { VERCEL: "VERCEL" } as const;
export const DomainStatus = {
  ACTIVE: "ACTIVE",
  VERIFYING: "VERIFYING",
  DNS_REQUIRED: "DNS_REQUIRED",
  ERROR: "ERROR",
  REQUESTED: "REQUESTED",
  DISABLED: "DISABLED",
  REMOVED: "REMOVED",
} as const;

export default { DomainKind, DomainProvider, DomainStatus };
