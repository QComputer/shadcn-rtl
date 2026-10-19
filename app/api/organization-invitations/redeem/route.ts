import { redeemOrganizationInvitationSchema } from "@/lib/organization-onboarding/contract";
import { onboardingMutation } from "@/lib/organization-onboarding/http";
import { OrganizationOnboardingService } from "@/lib/organization-onboarding/service";

export async function POST(request: Request) {
  return onboardingMutation(request, { platformOnly: false }, (actor, body) =>
    new OrganizationOnboardingService().redeemInvitation(actor, redeemOrganizationInvitationSchema.parse(body).token));
}
