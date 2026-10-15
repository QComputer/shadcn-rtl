import { provisioningError as jsonError } from "@/lib/tenant-provisioning/http";
import { readOnboardingBody } from "@/lib/organization-onboarding/http";
import { universalProvisioningService } from "@/lib/tenant-provisioning/universal-provisioning.service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthSession, requireRole, requireSameOriginMutation } from "@/lib/api-guards";
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
    return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error, "Failed to fetch tenant provisioning plans");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);

    requireSameOriginMutation(request);
    const raw: unknown = await readOnboardingBody(request);
    if (raw && typeof raw === "object" && "manual" in raw) {
      const manual = z.object({ manual: z.unknown() }).strict().parse(raw);
      const plan = await universalProvisioningService.create({ userId: session.user.id, role: session.user.role }, manual.manual, request.headers.get("idempotency-key") ?? "");
      return NextResponse.json(plan, { status: 201, headers: { "Cache-Control": "private, no-store" } });
    }
    const body = createPlanSchema.parse(raw);
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
