import type { SupportedLocale } from "@/lib/i18n";
import { buildOrganizationRootPath } from "@/lib/custom-domain-routing";

export function publicOrganizationHref<T extends { slug: string }>(locale: SupportedLocale, organization: T) {
  return buildOrganizationRootPath({ locale, organizationSlug: organization.slug });
}
