import type { NextRequest } from "next/server";
import { updateDraftAccommodationSchema } from "@/lib/hotel/management/draft-accommodation-contracts";
import { DraftAccommodationService } from "@/lib/hotel/management/draft-accommodation.service";
import { managementRequest } from "@/lib/hotel/management/route-support";

type Context = { params: Promise<{ id: string; propertyId: string; draftId: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  const { id: organizationId, propertyId, draftId } = await params;
  return managementRequest(request, organizationId, updateDraftAccommodationSchema, async (principal, body) => ({
    draft: await new DraftAccommodationService().update(principal, { organizationId, propertyId }, draftId, body),
  }));
}
