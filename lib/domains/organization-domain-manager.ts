import type { SupportedLocale } from "@/lib/i18n"

export function organizationDomainsHref(locale: SupportedLocale, organizationId: string): string {
  return `/${locale}/dashboard/settings/domains?organizationId=${encodeURIComponent(organizationId)}`
}

export function organizationDomainCheckRequest(domainId: string): {
  url: string
  init: RequestInit
} {
  return {
    url: `/api/dashboard/organization-domains/${encodeURIComponent(domainId)}/vercel`,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check" }),
    },
  }
}
