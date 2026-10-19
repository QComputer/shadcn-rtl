import { bootstrapHotelOrganizationSchema } from "@/lib/organization-onboarding/contract";
import { onboardingMutation } from "@/lib/organization-onboarding/http";
import { OrganizationOnboardingService } from "@/lib/organization-onboarding/service";

export async function POST(request: Request) {
  return onboardingMutation(request, { platformOnly: true, idempotency: true }, (actor, body, key) =>
    new OrganizationOnboardingService().bootstrapHotel(actor, bootstrapHotelOrganizationSchema.parse(body), key));
}
