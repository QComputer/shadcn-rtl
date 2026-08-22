import { NextResponse } from "next/server";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { getCustomerSummary } from "@/lib/customer-crm/customer-summary.service";
import { requireTenantContext } from "@/lib/tenant-context";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; customerIdentityId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id, customerIdentityId } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER", "STAFF"]);
    return NextResponse.json(await getCustomerSummary({
      organizationId: id,
      customerIdentityId,
    }));
  } catch (error) {
    return jsonError(error);
  }
}
