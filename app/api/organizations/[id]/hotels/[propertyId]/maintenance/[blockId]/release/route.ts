import { NextRequest } from "next/server";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementAction } from "@/lib/hotel/management/route-support";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string; blockId: string }> }) {
  const { id: organizationId, propertyId, blockId } = await params;
  return managementAction(request, organizationId, async (principal) => ({
    maintenanceBlock: await new HotelManagementService().releaseRoomMaintenanceBlock(principal, { organizationId }, propertyId, blockId),
  }));
}
