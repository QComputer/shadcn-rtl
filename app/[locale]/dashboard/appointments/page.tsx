import { AppointmentFullCalendar } from "@/components/dashboard/appointment-full-calendar";

export default async function DashboardAppointmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <AppointmentFullCalendar
        locale={locale || "fa"}
        title="مدیریت نوبت‌ها"
        description="مدیریت نوبت‌ها با همان تقویم FullCalendar، فیلترهای سرویس‌دهنده/سرویس/وضعیت و اکشن‌های امن وضعیت"
      />
    </div>
  );
}
