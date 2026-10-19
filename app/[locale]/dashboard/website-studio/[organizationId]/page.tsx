import { notFound } from "next/navigation";
import { requireAuthSession, ApiError } from "@/lib/api-guards";
import { RetailWebsiteService } from "@/lib/website-studio/retail.service";
import { RetailStudio } from "@/components/website-studio/retail-studio";
export default async function RetailStudioPage({ params }: { params: Promise<{ locale: string; organizationId: string }> }) {
  const { locale, organizationId } = await params;
  const { user } = await requireAuthSession();
  try { await new RetailWebsiteService().load({ userId: user.id, role: user.role, organizationId: user.organizationId }, organizationId); }
  catch (error) { if (error instanceof ApiError && [403, 404].includes(error.status)) notFound(); throw error; }
  return <RetailStudio key={organizationId} organizationId={organizationId} locale={locale} />;
}
