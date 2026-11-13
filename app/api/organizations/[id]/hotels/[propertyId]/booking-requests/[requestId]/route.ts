import type { NextRequest } from "next/server";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementRequest } from "@/lib/hotel/management/route-support";
import { hotelGuestBookingRequestUpdateSchema } from "@/lib/hotel/validation/hotel-contracts";

const service = new HotelManagementService();

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; propertyId: string; requestId: string }> }) {
  const { id: organizationId, propertyId, requestId } = await context.params;
  return managementRequest(request, organizationId, hotelGuestBookingRequestUpdateSchema, (principal, input) =>
    service.updateGuestBookingRequestStatus(principal, { organizationId }, propertyId, requestId, input),
  );
}
