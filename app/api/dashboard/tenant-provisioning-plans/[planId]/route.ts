import { provisioningError as jsonError } from "@/lib/tenant-provisioning/http";
import { readOnboardingBody } from "@/lib/organization-onboarding/http";
import { universalProvisioningService } from "@/lib/tenant-provisioning/universal-provisioning.service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthSession, requireRole, requireSameOriginMutation } from "@/lib/api-guards";
import {
  getTenantProvisioningPlan,
  updateTenantProvisioningPlan,
} from "@/lib/tenant-provisioning/tenant-provisioning-plan.service";

const updatePlanSchema = z.object({
  proposedOrganizationType: z.enum(["SHOP", "APPOINTMENT"]).optional(),
  proposedName: z.string().trim().min(2).max(200).optional(),
  proposedSlug: z.string().trim().min(3).max(64).optional(),
  proposedDefaultLocale: z.enum(["fa", "en", "ar"]).optional(),
  proposedTimezone: z.enum(["Asia/Tehran"]).optional(),
  proposedCurrency: z.string().trim().max(12).nullable().optional(),
  proposedOwnerName: z.string().trim().max(160).nullable().optional(),
  proposedOwnerPhone: z.string().trim().max(32).nullable().optional(),
  proposedOwnerEmail: z.string().trim().email().max(255).nullable().optional(),
  proposedPackageId: z.enum(["starter", "growth", "pro"]).nullable().optional(),
  proposedModules: z.array(z.string().trim().min(1).max(64)).max(24).optional(),
  proposedFeatureFlags: z.record(z.string(), z.boolean()).optional(),
  proposedSettings: z.record(z.string(), z.union([z.string(), z.boolean(), z.number(), z.null()])).optional(),
  proposedDemoContent: z.boolean().optional(),
  proposedCustomDomain: z.string().trim().max(253).nullable().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ planId: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);

    const { planId } = await params;
    const plan = await getTenantProvisioningPlan(planId);
    if (plan.executionConfiguration) return NextResponse.json({ ...plan, ...(await universalProvisioningService.detail({ userId: session.user.id, role: session.user.role }, planId)) }, { headers: { "Cache-Control": "private, no-store" } });
    return NextResponse.json(plan, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error, "Failed to fetch tenant provisioning plan");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);

    const { planId } = await params;
    requireSameOriginMutation(request);
    const raw: unknown = await readOnboardingBody(request);
    if (raw && typeof raw === "object" && "executionConfiguration" in raw) {
      const configured = z.object({ executionConfiguration: z.unknown() }).strict().parse(raw);
      return NextResponse.json(await universalProvisioningService.configure({ userId: session.user.id, role: session.user.role }, planId, configured.executionConfiguration), { headers: { "Cache-Control": "private, no-store" } });
    }
    const body = updatePlanSchema.parse(raw);
    const plan = await updateTenantProvisioningPlan(planId, body, session.user.id);
    return NextResponse.json(plan);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid provisioning plan update", details: error.issues }, { status: 400 });
    }
    return jsonError(error, "Failed to update tenant provisioning plan");
  }
}
