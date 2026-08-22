import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { listOrganizationCustomers } from "@/lib/customer-crm/customer-crm.service";
import { requireTenantContext } from "@/lib/tenant-context";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER", "STAFF"]);
    return NextResponse.json(await listOrganizationCustomers({
      organizationId: id,
      page: Number(request.nextUrl.searchParams.get("page") ?? "1"),
      pageSize: Number(request.nextUrl.searchParams.get("pageSize") ?? "20"),
      search: request.nextUrl.searchParams.get("search"),
    }));
  } catch (error) {
    return jsonError(error);
  }
}
