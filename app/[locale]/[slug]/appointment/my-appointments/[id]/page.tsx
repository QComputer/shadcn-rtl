import { PrivateAppointmentTracking } from "@/components/appointment/private-appointment-tracking";
export default async function AppointmentDetailPage({ params }: { params: Promise<{ locale: string; slug: string; id: string }> }) {
  const { locale, slug, id } = await params;
  return <PrivateAppointmentTracking key={`${locale}:${slug}:${id}`} locale={locale} slug={slug} appointmentId={id} />;
}
