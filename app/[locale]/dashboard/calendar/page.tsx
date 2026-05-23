import { AppointmentFullCalendar } from "@/components/dashboard/appointment-full-calendar";

export default async function StaffCalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <AppointmentFullCalendar locale={locale || "fa"} />
    </div>
  );
}
