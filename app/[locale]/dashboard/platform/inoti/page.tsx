import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { supportedLocales, type SupportedLocale } from "@/lib/i18n";
import { INOTI_PLATFORM_ORGANIZATION_SLUG } from "@/lib/integrations/inoti-ussd/credentials";
import { InotiAccountConsoleClient } from "../../organizations/[id]/integrations/inoti/inoti-account-console-client";

export const dynamic = "force-dynamic";

function validateLocale(locale: string): SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale) ? (locale as SupportedLocale) : "fa";
}

export default async function PlatformInotiPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = validateLocale(rawLocale);
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/dashboard/platform/inoti`)}`);
  }
  if (session.user.role !== "SUPER_ADMIN") {
    redirect(`/${locale}/dashboard`);
  }

  const platformOrganization = await prisma.organization.findFirst({
    where: {
      slug: INOTI_PLATFORM_ORGANIZATION_SLUG,
      isPlatformOwner: true,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!platformOrganization) {
    redirect(`/${locale}/dashboard/organizations`);
  }

  return <InotiAccountConsoleClient locale={locale} organizationId={platformOrganization.id} />;
}
