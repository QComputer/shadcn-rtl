import { redirect } from "next/navigation";
import { ShopDomainManager } from "@/components/dashboard/shop-domain-manager";
import { auth } from "@/lib/auth";
import { supportedLocales, type SupportedLocale } from "@/lib/i18n";

function validateLocale(locale: string): SupportedLocale {
  if (supportedLocales.includes(locale as SupportedLocale)) {
    return locale as SupportedLocale;
  }
  return "fa";
}

export default async function ShopDomainsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = validateLocale(rawLocale);
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/dashboard/shop-domains`)}`);
  }

  if (session.user.role !== "SUPER_ADMIN") {
    redirect(`/${locale}/dashboard`);
  }

  return <ShopDomainManager locale={locale} />;
}
