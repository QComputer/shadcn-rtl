import { NextResponse } from "next/server";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import {
  createReviewRequestLinkFromBusinessEvent,
  getOwnerReviewsSummary,
  listReputationIntegrationReadinessMappings,
} from "@/lib/customer-reputation/customer-reputation.service";
import { requireTenantContext } from "@/lib/tenant-context";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER", "STAFF"]);
    const summary = await getOwnerReviewsSummary({ organizationId: id });

    return NextResponse.json({
      summary,
      integrationReadiness: listReputationIntegrationReadinessMappings(),
    });
  } catch (error) {
    return jsonError(error, "Failed to load reputation summary");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER", "STAFF"]);
    const body = await request.json();
    const issued = await createReviewRequestLinkFromBusinessEvent({
      organizationId: id,
      businessEventId: String(body.businessEventId ?? ""),
      customerInteractionId: typeof body.customerInteractionId === "string" ? body.customerInteractionId : null,
      expiresAt: typeof body.expiresAt === "string" ? new Date(body.expiresAt) : null,
      metadata: { source: "owner-dashboard" },
    });

    return NextResponse.json(issued);
  } catch (error) {
    return jsonError(error, "Failed to create review request");
  }
}
