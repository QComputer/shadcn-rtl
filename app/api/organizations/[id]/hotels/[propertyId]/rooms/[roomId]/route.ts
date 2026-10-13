import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementRequest } from "@/lib/hotel/management/route-support";
import { updatePhysicalRoomSchema } from "@/lib/hotel/validation/management-contracts";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string; roomId: string }> }) { const { id: organizationId, propertyId, roomId } = await params; return managementRequest(request, organizationId, updatePhysicalRoomSchema, async (p, body) => { const row = await prisma.hotelRoom.findFirst({ where: { id: roomId, propertyId, organizationId }, select: { id: true } }); if (!row) throw new ApiError(404, "Room not found"); return { room: await new HotelManagementService().updatePhysicalRoom(p, { organizationId }, roomId, body) }; }); }
