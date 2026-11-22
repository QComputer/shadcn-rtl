import type { NextRequest } from "next/server";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementAction } from "@/lib/hotel/management/route-support";

const service = new HotelManagementService();

export async function GET(request: NextRequest, context: { params: Promise<{ id: string; propertyId: string; requestId: string }> }) {
  const { id: organizationId, propertyId, requestId } = await context.params;
  return managementAction(request, organizationId, (principal) => service.listGuestBookingRequestActivity(principal, { organizationId }, propertyId, requestId));
}
