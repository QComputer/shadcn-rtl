import { NextRequest } from "next/server";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementRequest } from "@/lib/hotel/management/route-support";
import { createPhysicalRoomSchema } from "@/lib/hotel/validation/management-contracts";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) { const { id: organizationId, propertyId } = await params; return managementRequest(request, organizationId, createPhysicalRoomSchema, async (p, body) => ({ room: await new HotelManagementService().createPhysicalRoom(p, { organizationId }, { ...body, propertyId }) }), 201); }
