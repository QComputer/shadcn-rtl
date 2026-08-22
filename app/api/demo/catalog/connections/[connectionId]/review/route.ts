import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { resolveDemoSessionContext } from "@/lib/demo-universe/demo-session-context";
import { reviewExternalCatalogPreview } from "@/lib/external-catalog/external-catalog.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  try {
    const context = await resolveDemoSessionContext({ request, allowedDemoRoles: ["ORGANIZATION_OWNER", "MANAGER", "PLATFORM_ADMIN"] });
    const { connectionId } = await params;
    return NextResponse.json(await reviewExternalCatalogPreview({ organizationId: context.organizationId, connectionId }));
  } catch (error) {
    return jsonError(error);
  }
}
