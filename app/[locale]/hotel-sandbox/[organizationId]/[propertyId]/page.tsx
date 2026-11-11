import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { HotelBookingSandbox } from "@/components/hotel-operations/hotel-booking-sandbox";

export default async function HotelSandboxPage({ params }: { params: Promise<{ locale: string; organizationId: string; propertyId: string }> }) {
  const { locale, organizationId, propertyId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  return <main className="mx-auto min-w-0 w-full max-w-5xl p-4"><HotelBookingSandbox key={`${organizationId}:${propertyId}:${session.user.id}`} organizationId={organizationId} propertyId={propertyId} locale={locale} mode={session.user.role === "CUSTOMER" ? "guest" : "reception"} /></main>;
}
