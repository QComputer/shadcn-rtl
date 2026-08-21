import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { listCustomerInteractions } from "@/lib/customer-identity/customer-identity.service";
import { requireTenantContext } from "@/lib/tenant-context";
import { listCustomerInteractionsQuerySchema } from "@/lib/validators/customer-identity";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; customerIdentityId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id, customerIdentityId } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER", "STAFF"]);

    const query = listCustomerInteractionsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    return NextResponse.json({
      interactions: await listCustomerInteractions({
        organizationId: id,
        customerIdentityId,
        limit: query.limit,
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
