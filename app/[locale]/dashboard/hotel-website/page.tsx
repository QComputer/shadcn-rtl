import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listHotelCmsDashboardOrganizations } from "@/lib/hotel-cms/hotel-cms-dashboard-context.server";

const copy = {
  fa: { title: "استودیو وب‌سایت هتل", intro: "محتوا، بخش‌ها، رسانه و نسخه‌های خصوصی هر ملک را مدیریت کنید.", choose: "ویرایش وب‌سایت", empty: "برای این سازمان ملک فعالی ثبت نشده است.", none: "هیچ وب‌سایت هتل فعالی برای مدیریت در دسترس نیست." },
  en: { title: "Hotel website studio", intro: "Manage content, sections, media, and private revisions for each property.", choose: "Edit website", empty: "This organization has no active properties.", none: "No active Hotel websites are available to manage." },
  ar: { title: "استوديو موقع الفندق", intro: "أدر المحتوى والأقسام والوسائط والمسودات الخاصة لكل عقار.", choose: "تحرير الموقع", empty: "لا توجد عقارات نشطة لهذه المؤسسة.", none: "لا توجد مواقع فندقية نشطة للإدارة." },
} as const;

export default async function HotelWebsiteDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string | string[] }>;
}) {
  const [{ locale }, query, session] = await Promise.all([params, searchParams, auth()]);
  if (!session?.user?.id || !session.user.role) {
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/dashboard/hotel-website`)}`);
  }
  const requestedOrganizationId = Array.isArray(query.organizationId) ? query.organizationId[0] : query.organizationId;
  const organizations = await listHotelCmsDashboardOrganizations({
    userId: session.user.id,
    sessionOrganizationId: session.user.organizationId,
    sessionRole: session.user.role,
    requestedOrganizationId,
  });
  const text = copy[locale as keyof typeof copy] ?? copy.fa;
  const isRtl = locale === "fa" || locale === "ar";

  if (organizations.length === 0 && session.user.role !== "SUPER_ADMIN") redirect(`/${locale}/dashboard`);

  return <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6" dir={isRtl ? "rtl" : "ltr"}>
    <header className="space-y-2">
      <h1 className="text-2xl font-bold">{text.title}</h1>
      <p className="text-sm text-muted-foreground">{text.intro}</p>
    </header>
    {organizations.length === 0 ? <p className="rounded-lg border bg-card p-5 text-sm">{text.none}</p> : organizations.map((organization) =>
      <section key={organization.id} className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="text-lg font-semibold">{organization.name}</h2>
        {organization.properties.length === 0 ? <p className="text-sm text-muted-foreground">{text.empty}</p> :
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {organization.properties.map((property) => <li key={property.id}>
              <Link className="block rounded-lg border p-4 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/${locale}/dashboard/hotel-website/${encodeURIComponent(organization.id)}/${encodeURIComponent(property.id)}`}>
                <span className="block font-medium">{property.name}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{text.choose}</span>
              </Link>
            </li>)}
          </ul>}
      </section>,
    )}
  </main>;
}
