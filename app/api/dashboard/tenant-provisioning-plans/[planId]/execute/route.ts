import { NextRequest } from "next/server";
import { onboardingMutation } from "@/lib/organization-onboarding/http";
import { universalProvisioningService } from "@/lib/tenant-provisioning/universal-provisioning.service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  return onboardingMutation(request, { platformOnly: true, idempotency: true }, (actor, body, key) => universalProvisioningService.execute(actor, planId, body, key));
}
