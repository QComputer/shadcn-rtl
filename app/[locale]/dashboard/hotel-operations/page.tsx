import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listHotelOperationsOrganizations } from "@/lib/hotel/management/hotel-operations-dashboard-context.server";

const labels = {
  fa: { title: "عملیات هتل", intro: "اتاق‌ها، نرخ‌ها و ظرفیت هر ملک را مدیریت کنید.", open: "مدیریت عملیات", empty: "ملک فعالی برای عملیات هتل در دسترس نیست." },
  en: { title: "Hotel operations", intro: "Manage rooms, rates, and inventory for each property.", open: "Open operations", empty: "No active Hotel properties are available for operations." },
  ar: { title: "عمليات الفندق", intro: "أدر الغرف والأسعار والمخزون لكل عقار.", open: "فتح العمليات", empty: "لا توجد عقارات فندقية نشطة متاحة." },
} as const;

export default async function HotelOperationsDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string | string[] }>;
}) {
  const [{ locale }, query, session] = await Promise.all([params, searchParams, auth()]);
  if (!session?.user?.id || !session.user.role) {
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/dashboard/hotel-operations`)}`);
  }
  const requestedOrganizationId = Array.isArray(query.organizationId) ? query.organizationId[0] : query.organizationId;
  const organizations = await listHotelOperationsOrganizations({
    userId: session.user.id,
    sessionOrganizationId: session.user.organizationId,
    sessionRole: session.user.role,
    requestedOrganizationId,
  });
  if (organizations.length === 0 && session.user.role !== "SUPER_ADMIN") redirect(`/${locale}/dashboard`);

  const text = labels[locale as keyof typeof labels] ?? labels.fa;
  const rtl = locale === "fa" || locale === "ar";
  return <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6" dir={rtl ? "rtl" : "ltr"}>
    <header className="space-y-2"><h1 className="text-2xl font-bold">{text.title}</h1><p className="text-sm text-muted-foreground">{text.intro}</p></header>
    {organizations.length === 0 ? <p className="rounded-lg border bg-card p-5 text-sm">{text.empty}</p> : organizations.map((organization) =>
      <section key={organization.id} className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="text-lg font-semibold">{organization.name}</h2>
        {organization.properties.length === 0 ? <p className="text-sm text-muted-foreground">{text.empty}</p> :
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{organization.properties.map((property) =>
            <li key={property.id}><Link className="block rounded-lg border p-4 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/${locale}/dashboard/hotel-operations/${encodeURIComponent(organization.id)}/${encodeURIComponent(property.id)}`}>
              <span className="block font-medium">{property.name}</span><span className="mt-1 block text-sm text-muted-foreground">{text.open}</span>
            </Link></li>,
          )}</ul>}
      </section>,
    )}
  </main>;
}
