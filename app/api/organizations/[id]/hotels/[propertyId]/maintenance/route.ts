import { NextRequest } from "next/server";
import { z } from "zod";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementRequest } from "@/lib/hotel/management/route-support";

const createSchema = z.object({
  roomId: z.string().trim().min(1).max(200),
  from: z.iso.date(),
  to: z.iso.date(),
  reason: z.string().trim().min(1).max(500),
  idempotencyKey: z.string().trim().min(8).max(200),
}).strict();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  const { id: organizationId, propertyId } = await params;
  return managementRequest(request, organizationId, createSchema, async (principal, body) => ({
    maintenanceBlock: await new HotelManagementService().createRoomMaintenanceBlock(principal, { organizationId }, { ...body, propertyId }),
  }), 201);
}
