import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, resolveManageableOrganizationId } from "@/lib/api-guards";
import { getOrganizationReconciliationQueue } from "@/lib/payments/payment-operations.service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const organizationId = await resolveManageableOrganizationId(session, id);
    const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? "50");
    const items = await getOrganizationReconciliationQueue({
      organizationId,
      limit: Number.isInteger(requestedLimit) ? requestedLimit : 50,
    });
    return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return jsonError(error, "Failed to load payment reconciliation queue");
  }
}
