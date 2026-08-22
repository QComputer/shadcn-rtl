import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { getBusinessEntityGraph } from "@/lib/business-entity/business-entity.service";
import { resolveDemoSessionContext } from "@/lib/demo-universe/demo-session-context";

export async function GET(request: NextRequest) {
  try {
    const context = await resolveDemoSessionContext({
      request,
      allowedDemoRoles: ["ORGANIZATION_OWNER", "MANAGER", "PLATFORM_ADMIN"],
    });
    return NextResponse.json(await getBusinessEntityGraph({
      organizationId: context.organizationId,
      rootEntityId: request.nextUrl.searchParams.get("rootEntityId") ?? undefined,
      limit: Number(request.nextUrl.searchParams.get("limit") ?? "100"),
    }));
  } catch (error) {
    return jsonError(error);
  }
}
