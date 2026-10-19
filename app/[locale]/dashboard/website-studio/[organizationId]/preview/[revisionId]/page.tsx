import { notFound } from "next/navigation";
import { requireAuthSession, ApiError } from "@/lib/api-guards";
import { RetailWebsiteService } from "@/lib/website-studio/retail.service";
import { RetailWebsitePreview } from "@/components/website-studio/retail-preview";
export default async function RetailPreviewPage({ params }: { params: Promise<{ organizationId: string; revisionId: string }> }) {
  const { organizationId, revisionId } = await params;
  const { user } = await requireAuthSession();
  let data: Awaited<ReturnType<RetailWebsiteService["load"]>>;
  try {
    data = await new RetailWebsiteService().load({ userId: user.id, role: user.role, organizationId: user.organizationId }, organizationId, revisionId);
  } catch (error) { if (error instanceof ApiError && [403, 404].includes(error.status)) notFound(); throw error; }
  return <RetailWebsitePreview content={data.content} media={data.media} organizationName={data.organization.name} />;
}
