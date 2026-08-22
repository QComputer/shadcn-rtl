import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { requireTenantContext } from "@/lib/tenant-context";
import { listSeoOpportunities, updateSeoOpportunityStatus } from "@/lib/seo-content/seo-content.service";

const updateSchema = z.object({
  opportunityId: z.string().min(1),
  status: z.enum(["ACCEPTED", "DISMISSED", "RESOLVED"]),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER"]);
    return NextResponse.json({ opportunities: await listSeoOpportunities({ organizationId: id }) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER"]);
    const body = updateSchema.parse(await request.json());
    return NextResponse.json({
      opportunity: await updateSeoOpportunityStatus({
        organizationId: id,
        opportunityId: body.opportunityId,
        status: body.status,
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
