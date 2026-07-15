import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import {
  createTenantProvisioningPlan,
  listTenantProvisioningPlans,
} from "@/lib/tenant-provisioning/tenant-provisioning-plan.service";

const createPlanSchema = z.object({
  requestDemoLeadId: z.string().cuid(),
  idempotencyKey: z.string().trim().min(8).max(160).optional(),
});

export async function GET() {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);

    const items = await listTenantProvisioningPlans();
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError(error, "Failed to fetch tenant provisioning plans");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);

    const body = createPlanSchema.parse(await request.json());
    const plan = await createTenantProvisioningPlan({
      requestDemoLeadId: body.requestDemoLeadId,
      idempotencyKey: body.idempotencyKey,
      createdById: session.user.id,
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid provisioning plan request", details: error.issues }, { status: 400 });
    }
    return jsonError(error, "Failed to create tenant provisioning plan");
  }
}
