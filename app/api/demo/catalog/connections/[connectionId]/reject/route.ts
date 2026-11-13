import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-guards";
import { resolveDemoSessionContext } from "@/lib/demo-universe/demo-session-context";
import { rejectExternalCatalogItems } from "@/lib/external-catalog/external-catalog.service";
import { readBoundedJson } from "@/lib/security/bounded-json";

const rejectSchema = z.object({
  itemIds: z.array(z.string()).min(1).max(500),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  try {
    const context = await resolveDemoSessionContext({ request, allowedDemoRoles: ["ORGANIZATION_OWNER", "MANAGER"] });
    const { connectionId } = await params;
    const body = rejectSchema.parse(await readBoundedJson(request));
    return NextResponse.json(await rejectExternalCatalogItems({
      organizationId: context.organizationId,
      connectionId,
      itemIds: body.itemIds,
    }));
  } catch (error) {
    return jsonError(error);
  }
}
