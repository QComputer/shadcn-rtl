import { PrivateAppointmentTracking } from "@/components/appointment/private-appointment-tracking";
export default async function MyAppointmentsPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  return <PrivateAppointmentTracking key={`${locale}:${slug}`} locale={locale} slug={slug} />;
}
