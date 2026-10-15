import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supportedLocales, type SupportedLocale } from "@/lib/i18n";
import { UniversalProvisioningWizard } from "@/components/organization-onboarding/universal-provisioning-wizard";

export const dynamic = "force-dynamic";

function validateLocale(locale: string): SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale) ? locale as SupportedLocale : "fa";
}

export default async function NewTenantProvisioningPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = validateLocale(rawLocale);
  const session = await auth();
  if (!session?.user) {
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/dashboard/tenant-provisioning/new`)}`);
  }
  if (session.user.role !== "SUPER_ADMIN") redirect(`/${locale}/dashboard`);
  return <UniversalProvisioningWizard locale={locale} />;
}
