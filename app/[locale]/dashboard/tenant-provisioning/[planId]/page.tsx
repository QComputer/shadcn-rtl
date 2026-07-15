import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supportedLocales, type SupportedLocale } from "@/lib/i18n";
import { TenantProvisioningPlanEditor } from "./tenant-provisioning-plan-editor";

export const dynamic = "force-dynamic";

function validateLocale(locale: string): SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale) ? (locale as SupportedLocale) : "fa";
}

export default async function TenantProvisioningPlanPage({
  params,
}: {
  params: Promise<{ locale: string; planId: string }>;
}) {
  const { locale: rawLocale, planId } = await params;
  const locale = validateLocale(rawLocale);
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/dashboard/tenant-provisioning/${planId}`)}`);
  }
  if (session.user.role !== "SUPER_ADMIN") {
    redirect(`/${locale}/dashboard`);
  }

  return <TenantProvisioningPlanEditor locale={locale} planId={planId} />;
}
