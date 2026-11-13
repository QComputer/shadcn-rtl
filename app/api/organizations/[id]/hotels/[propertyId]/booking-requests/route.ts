import type { NextRequest } from "next/server";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementAction } from "@/lib/hotel/management/route-support";

const service = new HotelManagementService();

export async function GET(request: NextRequest, context: { params: Promise<{ id: string; propertyId: string }> }) {
  const { id: organizationId, propertyId } = await context.params;
  const cursor = new URL(request.url).searchParams.get("cursor") || undefined;
  return managementAction(request, organizationId, (principal) =>
    service.listGuestBookingRequests(principal, { organizationId }, propertyId, cursor),
  );
}
