import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supportedLocales, type SupportedLocale } from "@/lib/i18n";

function validateLocale(locale: string): SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale) ? (locale as SupportedLocale) : "fa";
}

export default async function OrganizationIntegrationsRedirectPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: rawLocale, id } = await params;
  const locale = validateLocale(rawLocale);
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/dashboard/organizations/${id}/integrations/inoti`)}`);
  }
  if (session.user.role !== "SUPER_ADMIN") {
    redirect(`/${locale}/dashboard`);
  }

  redirect(`/${locale}/dashboard/organizations/${id}/integrations/inoti`);
}
