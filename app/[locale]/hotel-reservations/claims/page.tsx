import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { GuestClaimPanel } from "@/components/customer/guest-claim-panel";
import { auth } from "@/lib/auth";
import { resolveCustomerAuthContext } from "@/lib/customer-auth/context.server";
import { resolveHotelTenantForHost } from "@/lib/hotel/services/hotel-publication.service";

export default async function HotelClaimsPage({ params }: { params: Promise<{ locale: string }> }) {
  const [{ locale }, requestHeaders, session] = await Promise.all([params, headers(), auth()]);
  const tenant = await resolveHotelTenantForHost(requestHeaders.get("host"));
  if (!tenant || process.env.HOTEL_GUEST_RESERVATION_CLAIM_ENABLED !== "1") notFound();
  if (!session?.user?.id) redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/hotel-reservations/claims`)}`);
  if (session.user.role !== "CUSTOMER" || session.user.isTeamMember || !session.user.phoneSessionId || !session.user.customerOrigin || session.user.organizationId !== tenant.organizationId) notFound();
  const context = await resolveCustomerAuthContext(new Request(new URL("/", session.user.customerOrigin), { headers: requestHeaders }));
  if (!context || context.organizationId !== tenant.organizationId || context.origin !== session.user.customerOrigin) notFound();
  return <main className="mx-auto w-full max-w-3xl p-4 sm:p-6" dir={locale === "en" ? "ltr" : "rtl"}><GuestClaimPanel locale={locale} slug={context.slug} kind="HOTEL" /></main>;
}
