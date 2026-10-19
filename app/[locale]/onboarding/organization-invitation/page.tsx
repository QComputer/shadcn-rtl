import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { appPath } from "@/lib/app-base-path";
import { InvitationActivation } from "@/components/organization-onboarding/invitation-activation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Organization access", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function OrganizationInvitationPage({ params }: { params: Promise<{ locale: string }> }) {
  const [{ locale: requestedLocale }, session] = await Promise.all([params, auth()]);
  const locale = requestedLocale === "en" || requestedLocale === "ar" ? requestedLocale : "fa";
  if (!session?.user?.id) redirect(appPath(`/${locale}/login?callbackUrl=${encodeURIComponent(appPath(`/${locale}/onboarding/organization-invitation`))}`));
  return <main className="px-4 py-10"><InvitationActivation locale={locale} /></main>;
}
