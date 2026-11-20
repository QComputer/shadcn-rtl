import type { NextRequest } from "next/server";
import { archiveDraftAccommodationSchema } from "@/lib/hotel/management/draft-accommodation-contracts";
import { DraftAccommodationService } from "@/lib/hotel/management/draft-accommodation.service";
import { managementRequest } from "@/lib/hotel/management/route-support";

type Context = { params: Promise<{ id: string; propertyId: string; draftId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const { id: organizationId, propertyId, draftId } = await params;
  return managementRequest(request, organizationId, archiveDraftAccommodationSchema, async (principal, body) => ({
    draft: await new DraftAccommodationService().archive(principal, { organizationId, propertyId }, draftId, body.version),
  }));
}
