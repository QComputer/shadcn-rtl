import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supportedLocales, type SupportedLocale } from "@/lib/i18n";
import { BusinessAcquisitionConsoleClient } from "./business-acquisition-console-client";

export const dynamic = "force-dynamic";

function validateLocale(locale: string): SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale) ? (locale as SupportedLocale) : "fa";
}

export default async function BusinessAcquisitionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = validateLocale(rawLocale);
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/dashboard/business-acquisition`)}`);
  }
  if (session.user.role !== "SUPER_ADMIN") {
    redirect(`/${locale}/dashboard`);
  }

  return <BusinessAcquisitionConsoleClient locale={locale} />;
}
