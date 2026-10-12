import { NextRequest, NextResponse } from "next/server";
import { ApiError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { managementError, managementPrincipal, parseJsonObject } from "@/lib/hotel/management/api-adapter";

export async function managementRequest<T>(request: NextRequest, organizationId: string, schema: { parse(value: unknown): T }, action: (principal: ReturnType<typeof managementPrincipal>, body: T) => Promise<unknown>, status = 200) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    if (session.user.role !== "SUPER_ADMIN" && session.user.organizationId !== organizationId) throw new ApiError(403, "Forbidden");
    const body = schema.parse(parseJsonObject(await request.json()));
    return NextResponse.json(await action(managementPrincipal(session), body), { status });
  } catch (error) { return managementError(error); }
}

export async function managementAction(request: NextRequest, organizationId: string, action: (principal: ReturnType<typeof managementPrincipal>) => Promise<unknown>, status = 200) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    if (session.user.role !== "SUPER_ADMIN" && session.user.organizationId !== organizationId) throw new ApiError(403, "Forbidden");
    return NextResponse.json(await action(managementPrincipal(session)), { status });
  } catch (error) { return managementError(error); }
}
