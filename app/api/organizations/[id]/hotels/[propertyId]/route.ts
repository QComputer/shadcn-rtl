import { NextRequest, NextResponse } from "next/server";
import { requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementError, managementPrincipal, parseJsonObject } from "@/lib/hotel/management/api-adapter";
import { updatePropertySchema } from "@/lib/hotel/validation/management-contracts";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    const { id: organizationId, propertyId } = await params;
    const body = updatePropertySchema.parse(parseJsonObject(await request.json()));
    const property = await new HotelManagementService().updateProperty(managementPrincipal(session), { organizationId }, propertyId, body);
    return NextResponse.json({ property });
  } catch (error) {
    return managementError(error);
  }
}
