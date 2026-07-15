import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supportedLocales, type SupportedLocale } from "@/lib/i18n";
import { LeadProvisioningLauncher } from "./provisioning-launcher";

export const dynamic = "force-dynamic";

function validateLocale(locale: string): SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale) ? (locale as SupportedLocale) : "fa";
}

export default async function LeadProvisioningPage({
  params,
}: {
  params: Promise<{ locale: string; leadId: string }>;
}) {
  const { locale: rawLocale, leadId } = await params;
  const locale = validateLocale(rawLocale);
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/dashboard/request-demo-leads/${leadId}/provisioning`)}`);
  }
  if (session.user.role !== "SUPER_ADMIN") {
    redirect(`/${locale}/dashboard`);
  }

  return <LeadProvisioningLauncher locale={locale} leadId={leadId} />;
}
