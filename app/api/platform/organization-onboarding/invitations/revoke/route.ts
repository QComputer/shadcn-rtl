import { revokeOrganizationInvitationSchema } from "@/lib/organization-onboarding/contract";
import { onboardingMutation } from "@/lib/organization-onboarding/http";
import { OrganizationOnboardingService } from "@/lib/organization-onboarding/service";

export async function POST(request: Request) {
  return onboardingMutation(request, { platformOnly: true }, (actor, body) =>
    new OrganizationOnboardingService().revokeInvitation(actor, revokeOrganizationInvitationSchema.parse(body).invitationId));
}
