import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { onboardingWizardContent } from "@/lib/content/b2b-onboarding-wizard-content";
import { BusinessOnboardingWizard } from "./wizard";

type Locale = "fa" | "en" | "ar";

function normalizeLocale(locale: string | undefined): Locale {
  if (locale === "en" || locale === "ar" || locale === "fa") return locale;
  return "fa";
}

export const metadata: Metadata = {
  title: {
    default: onboardingWizardContent.fa.seo.title,
    template: "%s | بازارباز",
  },
  description: onboardingWizardContent.fa.seo.description,
};

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = normalizeLocale(resolvedParams.locale);
  const content = onboardingWizardContent.fa;

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-10 md:py-14">
        <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-end">
          <div className="space-y-4">
            <Link href={`/${locale}/request-demo`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              بازگشت به درخواست دمو
            </Link>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-3xl font-black leading-tight text-foreground sm:text-4xl lg:text-5xl">
                {content.title}
              </h1>
              <p className="max-w-3xl text-base leading-8 text-muted-foreground md:text-lg">
                {content.subtitle}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/${locale}/request-demo`}>
                <Button variant="outline">فرم کوتاه درخواست دمو</Button>
              </Link>
              <Link href={`/${locale}/dashboard-showcase`}>
                <Button variant="outline">مشاهده داشبورد</Button>
              </Link>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-7 text-muted-foreground">
            <div className="mb-2 flex items-center gap-2 font-bold text-foreground">
              <ShieldCheck className="h-5 w-5 text-primary" />
              راه‌اندازی کنترل‌شده
            </div>
            {content.trustNote}
          </div>
        </div>

        <BusinessOnboardingWizard locale={locale} content={content} />
      </main>
    </div>
  );
}
