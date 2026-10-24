import "server-only";
import prisma from "@/lib/db";
import { isPlatformHost, normalizeDomainHost } from "@/lib/custom-domain-routing";

/** Only registry-owned hostnames may become redirect destinations. Preserve www. */
export function validatedPrimaryDomainHost(domain: string | null | undefined) {
  if (!domain || domain !== domain.trim() || domain.length > 253
    || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(domain)
    || /^\d+(?:\.\d+){3}$/.test(domain) || /^\d+$/.test(domain.split(".").at(-1)!)
    || isPlatformHost(domain)) return null;
  return domain.toLowerCase();
}

export async function getActivePrimaryOrganizationDomain(slug: string): Promise<string | null> {
  const record = await prisma.organizationDomain.findFirst({
    where: {
      status: "ACTIVE", isPrimary: true,
      organization: { slug, isActive: true, deletedAt: null, isPlatformOwner: false },
    },
    select: { domain: true, normalizedDomain: true },
  });
  if (!record) return null;
  const normalized = validatedPrimaryDomainHost(record.normalizedDomain);
  if (!normalized) return null;
  const configured = validatedPrimaryDomainHost(record.domain);
  return configured && normalizeDomainHost(configured) === normalizeDomainHost(normalized)
    ? configured : normalized;
}
