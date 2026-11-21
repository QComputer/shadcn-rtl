import type { NextRequest } from "next/server";
import { createDraftAccommodationSchema } from "@/lib/hotel/management/draft-accommodation-contracts";
import { DraftAccommodationService } from "@/lib/hotel/management/draft-accommodation.service";
import { managementAction, managementRequest } from "@/lib/hotel/management/route-support";

type Context = { params: Promise<{ id: string; propertyId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const { id: organizationId, propertyId } = await params;
  return managementAction(request, organizationId, async (principal) => ({
    drafts: await new DraftAccommodationService().list(principal, { organizationId, propertyId }),
  }));
}

export async function POST(request: NextRequest, { params }: Context) {
  const { id: organizationId, propertyId } = await params;
  return managementRequest(request, organizationId, createDraftAccommodationSchema, async (principal, body) => ({
    draft: await new DraftAccommodationService().create(principal, { organizationId, propertyId }, body),
  }), 201);
}
