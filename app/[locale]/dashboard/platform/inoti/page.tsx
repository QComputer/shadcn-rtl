import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { supportedLocales, type SupportedLocale } from "@/lib/i18n";
import { INOTI_PLATFORM_ORGANIZATION_SLUG } from "@/lib/integrations/inoti-ussd/credentials";
import { InotiAccountConsoleClient } from "../../organizations/[id]/integrations/inoti/inoti-account-console-client";
import Link from "next/link";

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

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6" dir={locale === "fa" || locale === "ar" ? "rtl" : "ltr"}>
      <header className="border-b pb-5">
        <h1 className="text-2xl font-semibold">iNoti Platform Console</h1>
        <p className="text-sm text-muted-foreground">Connection, services, and USSD observability.</p>
      </header>
      <div className="flex gap-3">
        <Link href={`/${locale}/dashboard/platform/inoti/ussd-events`} className="inline-flex items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none group/button select-none h-8 gap-1.5 px-2.5 border-border bg-background hover:bg-muted hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 aria-expanded:bg-muted aria-expanded:text-foreground">
          USSD Observability
        </Link>
      </div>
      <InotiAccountConsoleClient locale={locale} organizationId={platformOrganization.id} />
    </main>
  );
}
