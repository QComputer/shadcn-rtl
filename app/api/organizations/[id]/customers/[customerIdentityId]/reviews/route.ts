import { NextResponse } from "next/server";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { getCustomerSubmittedReviews } from "@/lib/customer-reputation/customer-reputation.service";
import { requireTenantContext } from "@/lib/tenant-context";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; customerIdentityId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id, customerIdentityId } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER", "STAFF"]);

    return NextResponse.json(await getCustomerSubmittedReviews({
      organizationId: id,
      customerIdentityId,
    }));
  } catch (error) {
    return jsonError(error, "Failed to load customer reviews");
  }
}
