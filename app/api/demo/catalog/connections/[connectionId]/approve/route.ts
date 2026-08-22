import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-guards";
import { resolveDemoSessionContext } from "@/lib/demo-universe/demo-session-context";
import { approveExternalCatalogItems } from "@/lib/external-catalog/external-catalog.service";

const approveSchema = z.object({
  itemIds: z.array(z.string()).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  try {
    const context = await resolveDemoSessionContext({ request, allowedDemoRoles: ["ORGANIZATION_OWNER", "MANAGER"] });
    const { connectionId } = await params;
    const body = approveSchema.parse(await request.json().catch(() => ({})));
    return NextResponse.json(await approveExternalCatalogItems({
      organizationId: context.organizationId,
      connectionId,
      itemIds: body.itemIds,
    }));
  } catch (error) {
    return jsonError(error);
  }
}
