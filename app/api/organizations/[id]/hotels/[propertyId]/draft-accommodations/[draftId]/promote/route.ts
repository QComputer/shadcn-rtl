import type { NextRequest } from "next/server";
import { promoteDraftAccommodationSchema } from "@/lib/hotel/management/draft-accommodation-contracts";
import { DraftAccommodationService } from "@/lib/hotel/management/draft-accommodation.service";
import { managementRequest } from "@/lib/hotel/management/route-support";

type Context = { params: Promise<{ id: string; propertyId: string; draftId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const { id: organizationId, propertyId, draftId } = await params;
  return managementRequest(request, organizationId, promoteDraftAccommodationSchema, async (principal, body) => {
    const { expectedVersion, ...promotion } = body;
    const result = await new DraftAccommodationService().promote(principal, { organizationId, propertyId }, {
      draftId,
      expectedVersion,
      ...promotion,
    });
    return { draft: result.draft, room: result.room };
  });
}
