import Link from "next/link";
import { requireAuthSession } from "@/lib/api-guards";
import { prisma } from "@/lib/db-runtime";
import { listHotelCmsDashboardOrganizations } from "@/lib/hotel-cms/hotel-cms-dashboard-context.server";
import { retailWebsiteScope } from "@/lib/website-studio/retail.service";

export default async function WebsiteStudioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { user } = await requireAuthSession();
  const [retail, hotels] = await Promise.all([
    prisma.organization.findMany({ where: {
      ...retailWebsiteScope,
      ...(user.role === "SUPER_ADMIN" ? {} : { id: user.organizationId ?? "", members: { some: { userId: user.id, isActive: true, role: { in: ["ADMIN", "MANAGER"] } } } }),
    }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    listHotelCmsDashboardOrganizations({ userId: user.id, sessionOrganizationId: user.organizationId, sessionRole: user.role }),
  ]);
  return <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8" dir="rtl">
    <header><h1 className="text-2xl font-bold">استودیو وب‌سایت سازمان</h1><p className="mt-2 text-muted-foreground">محتوا، تصاویر و ترتیب بخش‌ها را مدیریت و پیش‌نویس خصوصی را بررسی کنید.</p></header>
    {retail.length + hotels.length === 0 && <p className="rounded-xl border p-6">وب‌سایتی با دسترسی مدیریت برای شما در دسترس نیست.</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      {retail.map((org) => <Link key={org.id} href={`/${locale}/dashboard/website-studio/${org.id}`} className="rounded-xl border p-6 hover:bg-muted focus-visible:ring-2"><h2 className="font-bold">{org.name}</h2><p className="mt-2 text-sm text-muted-foreground">فروشگاه · ویرایش و پیش‌نمایش خصوصی</p></Link>)}
      {hotels.map((org) => <Link key={org.id} href={`/${locale}/dashboard/hotel-website?organizationId=${org.id}`} className="rounded-xl border p-6 hover:bg-muted focus-visible:ring-2"><h2 className="font-bold">{org.name}</h2><p className="mt-2 text-sm text-muted-foreground">هتل · استودیوی وب‌سایت</p></Link>)}
    </div>
  </main>;
}
